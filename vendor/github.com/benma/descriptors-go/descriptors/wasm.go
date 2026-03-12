package descriptors

import (
	"context"
	_ "embed"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"sync"

	"github.com/tetratelabs/wazero"
	"github.com/tetratelabs/wazero/api"
	"github.com/tetratelabs/wazero/imports/wasi_snapshot_preview1"
)

// Network represents the different Bitcoin networks.
type Network int

const (
	// NetworkMainnet represents the main Bitcoin network.
	NetworkMainnet Network = 0

	// NetworkTestnet represents the Bitcoin testnet network.
	NetworkTestnet Network = 1

	// NetworkRegtest represents the Bitcoin regtest network.
	NetworkRegtest Network = 2
)

//go:embed wrapper.wasm
var wasmBytes []byte

var initOnce sync.Once

type wasmModule struct {
	mod api.Module
	// `Call()` is not goroutine-safe, see
	// https://github.com/tetratelabs/wazero/blob/0dea5d7ee1de12d2817d6ac8548a4d36aaf59aea/api/wasm.go#L378
	callMu *sync.Mutex
}

func (m *wasmModule) allocate(size uint32) (uint32, func()) {
	allocate := m.mod.ExportedFunction("allocate")
	results, err := allocate.Call(context.Background(), uint64(size))
	if err != nil {
		log.Panicln(err)
	}
	return uint32(results[0]), func() {
		m.deallocate(results[0], uint64(size))
	}
}

func (m *wasmModule) deallocate(ptr, size uint64) {
	deallocate := m.mod.ExportedFunction("deallocate")
	_, err := deallocate.Call(context.Background(), ptr, size)
	if err != nil {
		log.Panicln(err)
	}
}

func (m *wasmModule) descriptorParse(
	descriptor string) (uint64, func(), error) {
	m.callMu.Lock()
	defer m.callMu.Unlock()

	strPtr, strDrop := rustString(descriptor)
	defer strDrop()
	parseFn := m.mod.ExportedFunction("descriptor_parse")
	result, err := parseFn.Call(context.Background(), strPtr)
	if err != nil {
		return 0, nil, err
	}
	var jsonResult struct {
		Ptr   uint64
		Error string
	}
	if err := jsonUnmarshal(result[0], &jsonResult); err != nil {
		return 0, nil, err
	}
	if jsonResult.Error != "" {
		return 0, nil, errors.New(jsonResult.Error)
	}
	descPtr := jsonResult.Ptr
	return descPtr, func() { m.descriptorDrop(descPtr) }, nil
}

func (m *wasmModule) descriptorMultipathLen(descPtr uint64) uint64 {
	m.callMu.Lock()
	defer m.callMu.Unlock()

	descriptorLenFn := m.mod.ExportedFunction("descriptor_multipath_len")
	results, err := descriptorLenFn.Call(context.Background(), descPtr)
	if err != nil {
		log.Panicln(err)
	}
	return results[0]
}

func (m *wasmModule) descriptorMaxWeightToSatisfy(descPtr uint64) (uint64, error) {
	m.callMu.Lock()
	defer m.callMu.Unlock()

	fn := m.mod.ExportedFunction("descriptor_max_weight_to_satisfy")
	results, err := fn.Call(context.Background(), descPtr)
	if err != nil {
		log.Panicln(err)
	}
	var jsonResult struct {
		Weight uint64
		Error  *string
	}
	if err := jsonUnmarshal(results[0], &jsonResult); err != nil {
		return 0, err
	}
	if jsonResult.Error != nil {
		return 0, errors.New(*jsonResult.Error)
	}
	return jsonResult.Weight, nil

}

func (m *wasmModule) descriptorDrop(descPtr uint64) {
	m.callMu.Lock()
	defer m.callMu.Unlock()

	descriptorDropFn := m.mod.ExportedFunction("descriptor_drop")
	_, err := descriptorDropFn.Call(context.Background(), descPtr)
	if err != nil {
		log.Panicln(err)
	}
}

func (m *wasmModule) planDrop(planPtr uint64) {
	m.callMu.Lock()
	defer m.callMu.Unlock()

	fn := m.mod.ExportedFunction("plan_drop")
	_, err := fn.Call(context.Background(), planPtr)
	if err != nil {
		log.Panicln(err)
	}
}

func (m *wasmModule) descriptorAddressAt(
	descPtr uint64,
	network Network,
	multipathIndex uint32,
	derivationIndex uint32) (string, error) {
	m.callMu.Lock()
	defer m.callMu.Unlock()

	fn := m.mod.ExportedFunction("descriptor_address_at")
	result, err := fn.Call(
		context.Background(),
		descPtr,
		uint64(network),
		uint64(multipathIndex),
		uint64(derivationIndex),
	)
	if err != nil {
		return "", err
	}
	var jsonResult struct {
		Address string
		Error   string
	}
	if err := jsonUnmarshal(result[0], &jsonResult); err != nil {
		return "", err
	}
	if jsonResult.Error != "" {
		return "", errors.New(jsonResult.Error)
	}
	return jsonResult.Address, nil
}

func (m *wasmModule) descriptorLift(descPtr uint64) (*SemanticPolicy, error) {
	m.callMu.Lock()
	defer m.callMu.Unlock()

	fn := m.mod.ExportedFunction("descriptor_lift")
	results, err := fn.Call(context.Background(), descPtr)
	if err != nil {
		log.Panicln(err)
	}
	var jsonResult struct {
		Policy *SemanticPolicy `json:"policy"`
		Error  *string
	}
	if err := jsonUnmarshal(results[0], &jsonResult); err != nil {
		return nil, err
	}
	if jsonResult.Error != nil {
		return nil, errors.New(*jsonResult.Error)
	}
	return jsonResult.Policy, nil
}

func (m *wasmModule) descriptorKeys(descPtr uint64) []string {
	m.callMu.Lock()
	defer m.callMu.Unlock()

	fn := m.mod.ExportedFunction("descriptor_keys")
	results, err := fn.Call(context.Background(), descPtr)
	if err != nil {
		log.Panicln(err)
	}
	var jsonResult []string
	if err := jsonUnmarshal(results[0], &jsonResult); err != nil {
		log.Panicln(err)
	}
	return jsonResult
}

func (m *wasmModule) descriptorDescType(descPtr uint64) string {
	m.callMu.Lock()
	defer m.callMu.Unlock()

	fn := m.mod.ExportedFunction("descriptor_desc_type")
	results, err := fn.Call(context.Background(), descPtr)
	if err != nil {
		log.Panicln(err)
	}
	return fromRustString(results[0])
}

func (m *wasmModule) descriptorString(descPtr uint64) string {
	m.callMu.Lock()
	defer m.callMu.Unlock()

	fn := m.mod.ExportedFunction("descriptor_to_str")
	result, err := fn.Call(context.Background(), descPtr)
	if err != nil {
		log.Panicln(err)
	}
	return fromRustString(result[0])
}

type miniscriptProperties struct {
	Types   string
	OpCodes uint64 `json:"op_codes"`
	Error   string
}

func (m *wasmModule) miniscriptParse(script string) (*miniscriptProperties,
	error) {
	m.callMu.Lock()
	defer m.callMu.Unlock()

	strPtr, strDrop := rustString(script)
	defer strDrop()
	parseFn := m.mod.ExportedFunction("miniscript_parse")
	result, err := parseFn.Call(context.Background(), strPtr)
	if err != nil {
		return nil, err
	}
	var jsonResult miniscriptProperties
	if err := jsonUnmarshal(result[0], &jsonResult); err != nil {
		return nil, err
	}
	if jsonResult.Error != "" {
		return nil, errors.New(jsonResult.Error)
	}
	return &jsonResult, nil
}

func (m *wasmModule) miniscriptCompile(script string) ([]byte, error) {
	m.callMu.Lock()
	defer m.callMu.Unlock()

	strPtr, strDrop := rustString(script)
	defer strDrop()
	parseFn := m.mod.ExportedFunction("miniscript_compile")
	result, err := parseFn.Call(context.Background(), strPtr)
	if err != nil {
		return nil, err
	}
	var jsonResult struct {
		ScriptHex string `json:"script_hex"`
		Error     string
	}
	if err := jsonUnmarshal(result[0], &jsonResult); err != nil {
		return nil, err
	}
	if jsonResult.Error != "" {
		return nil, errors.New(jsonResult.Error)
	}

	resultBytes, err := hex.DecodeString(jsonResult.ScriptHex)
	if err != nil {
		return nil, err
	}

	return resultBytes, nil
}

func (m *wasmModule) callbackTest(f func(string) string) string {
	m.callMu.Lock()
	defer m.callMu.Unlock()

	fn := m.mod.ExportedFunction("callback_test")
	callbackId, cleanup := registerCallback(f)
	defer cleanup()
	results, err := fn.Call(context.Background(), uint64(callbackId))
	if err != nil {
		log.Panicln(err)
	}
	return fromRustString(results[0])
}

func (m *wasmModule) descriptorPlanAt(
	descPtr uint64,
	multipathIndex uint32,
	derivationIndex uint32,
	assets Assets) (uint64, func(), error) {
	m.callMu.Lock()
	defer m.callMu.Unlock()

	lookupEcdsaSigId, cleanupLookupEcdsaSig := registerCallback(func(pk string) string {
		type jsonResponse bool

		response := jsonResponse(false)

		if assets.LookupEcdsaSig != nil {
			response = jsonResponse(assets.LookupEcdsaSig(pk))
		}
		return string(mustJsonMarshal(response))
	})
	defer cleanupLookupEcdsaSig()

	lookupTapKeySpendSigId, cleanupLookupTapKeySpendSig := registerCallback(func(pk string) string {
		type jsonResponse *uint32
		response := jsonResponse(nil)

		if assets.LookupTapKeySpendSig != nil {
			sigSize, ok := assets.LookupTapKeySpendSig(pk)
			if ok {
				response = jsonResponse(&sigSize)
			}
		}
		return string(mustJsonMarshal(response))
	})
	defer cleanupLookupTapKeySpendSig()

	lookupTapLeafScriptSigId, cleanupLookupTapLeafScriptSig := registerCallback(func(params string) string {
		type jsonResponse *uint32
		response := jsonResponse(nil)

		if assets.LookupTapLeafScriptSig != nil {
			var jsonParams struct {
				Pk       string
				LeafHash string
			}
			mustJsonUnmarshal([]byte(params), &jsonParams)
			sigSize, ok := assets.LookupTapLeafScriptSig(jsonParams.Pk, jsonParams.LeafHash)
			if ok {
				response = jsonResponse(&sigSize)
			}
		}
		return string(mustJsonMarshal(response))
	})
	defer cleanupLookupTapLeafScriptSig()

	assetsJson, freeAssetsJson := jsonMarshal(map[string]interface{}{
		"lookupEcdsaSig":         lookupEcdsaSigId,
		"lookupTapKeySpendSig":   lookupTapKeySpendSigId,
		"lookupTapLeafScriptSig": lookupTapLeafScriptSigId,
		"relativeLocktime":       assets.RelativeLocktime,
		"absoluteLocktime":       assets.AbsoluteLocktime,
	})
	defer freeAssetsJson()

	fn := m.mod.ExportedFunction("descriptor_plan_at")
	result, err := fn.Call(
		context.Background(),
		descPtr,
		uint64(multipathIndex),
		uint64(derivationIndex),
		assetsJson,
	)
	if err != nil {
		return 0, nil, err
	}
	var jsonResult struct {
		Ptr   uint64
		Error string
	}
	if err := jsonUnmarshal(result[0], &jsonResult); err != nil {
		return 0, nil, err
	}
	if jsonResult.Error != "" {
		return 0, nil, errors.New(jsonResult.Error)
	}
	return jsonResult.Ptr, func() {
		m.planDrop(jsonResult.Ptr)
	}, nil
}

func (m *wasmModule) planSatisfactionWeight(planPtr uint64) uint64 {
	m.callMu.Lock()
	defer m.callMu.Unlock()

	fn := m.mod.ExportedFunction("plan_satisfaction_weight")
	results, err := fn.Call(context.Background(), planPtr)
	if err != nil {
		log.Panicln(err)
	}
	return results[0]
}

func (m *wasmModule) planScriptSigSize(planPtr uint64) uint64 {
	m.callMu.Lock()
	defer m.callMu.Unlock()

	fn := m.mod.ExportedFunction("plan_scriptsig_size")
	results, err := fn.Call(context.Background(), planPtr)
	if err != nil {
		log.Panicln(err)
	}
	return results[0]
}

func (m *wasmModule) planWitnessSize(planPtr uint64) uint64 {
	m.callMu.Lock()
	defer m.callMu.Unlock()

	fn := m.mod.ExportedFunction("plan_witness_size")
	results, err := fn.Call(context.Background(), planPtr)
	if err != nil {
		log.Panicln(err)
	}
	return results[0]
}

func (m *wasmModule) planSatisfy(
	planPtr uint64,
	satisfier *Satisfier) (*SatisfyResult, error) {
	m.callMu.Lock()
	defer m.callMu.Unlock()

	lookupEcdsaSigId, cleanupLookupEcdsaSig := registerCallback(func(pk string) string {
		type jsonResponse *string
		response := jsonResponse(nil)

		if satisfier.LookupEcdsaSig != nil {
			signatureBytes, ok := satisfier.LookupEcdsaSig(pk)
			if ok {
				signatureHex := hex.EncodeToString(signatureBytes)
				response = jsonResponse(&signatureHex)
			}
		}
		return string(mustJsonMarshal(response))
	})
	defer cleanupLookupEcdsaSig()

	lookupTapKeySpendSigId, cleanupLookupTapKeySpendSig := registerCallback(func(string) string {
		type jsonResponse *string
		response := jsonResponse(nil)

		if satisfier.LookupTapKeySpendSig != nil {
			signatureBytes, ok := satisfier.LookupTapKeySpendSig()
			if ok {
				signatureHex := hex.EncodeToString(signatureBytes)
				response = jsonResponse(&signatureHex)
			}
		}
		return string(mustJsonMarshal(response))
	})
	defer cleanupLookupTapKeySpendSig()

	lookupTapLeafScriptSigId, cleanupLookupTapLeafScriptSig := registerCallback(func(params string) string {
		type jsonResponse *string
		response := jsonResponse(nil)

		if satisfier.LookupTapLeafScriptSig != nil {
			var jsonParams struct {
				Pk       string
				LeafHash string
			}
			mustJsonUnmarshal([]byte(params), &jsonParams)
			signatureBytes, ok := satisfier.LookupTapLeafScriptSig(jsonParams.Pk, jsonParams.LeafHash)
			if ok {
				signatureHex := hex.EncodeToString(signatureBytes)
				response = jsonResponse(&signatureHex)
			}
		}
		return string(mustJsonMarshal(response))
	})
	defer cleanupLookupTapLeafScriptSig()

	satisfierJson, freeSatisfierJson := jsonMarshal(map[string]interface{}{
		"lookupEcdsaSig":         lookupEcdsaSigId,
		"lookupTapKeySpendSig":   lookupTapKeySpendSigId,
		"lookupTapLeafScriptSig": lookupTapLeafScriptSigId,
	})
	defer freeSatisfierJson()

	fn := m.mod.ExportedFunction("plan_satisfy")
	result, err := fn.Call(
		context.Background(),
		planPtr,
		satisfierJson,
	)
	if err != nil {
		return nil, err
	}
	var jsonResult struct {
		SatisfyResult
		Error string
	}
	if err := jsonUnmarshal(result[0], &jsonResult); err != nil {
		return nil, err
	}
	if jsonResult.Error != "" {
		return nil, errors.New(jsonResult.Error)
	}

	return &jsonResult.SatisfyResult, nil
}

var wasmMod wasmModule

func logString(_ context.Context, m api.Module, offset, byteCount uint32) {
	buf, ok := m.Memory().Read(offset, byteCount)
	if !ok {
		log.Panicf("Memory.Read(%d, %d) out of range", offset,
			byteCount)
	}
	fmt.Println(string(buf))
}

func getWasmMod() *wasmModule {
	initOnce.Do(func() {
		ctx := context.Background()
		wasmRuntime := wazero.NewRuntime(ctx)
		wasi_snapshot_preview1.MustInstantiate(ctx, wasmRuntime)
		_, err := wasmRuntime.NewHostModuleBuilder("env").
			NewFunctionBuilder().
			WithFunc(logString).
			Export("log").
			NewFunctionBuilder().
			WithFunc(invokeCallback).
			Export("invoke_callback").
			Instantiate(ctx)
		if err != nil {
			log.Panicln(err)
		}

		mod, err := wasmRuntime.Instantiate(ctx, wasmBytes)
		if err != nil {
			log.Panicln(err)
		}
		wasmMod = wasmModule{mod, &sync.Mutex{}}
	})
	return &wasmMod
}

func rustString(str string) (uint64, func()) {
	mod := getWasmMod()
	strSize := len(str)

	strPtr, freeStr := mod.allocate(uint32(strSize))

	if !mod.mod.Memory().Write(uint32(strPtr), []byte(str)) {
		log.Panicf("rustString Memory().Write")
	}
	return (uint64(strPtr) << 32) | uint64(strSize), freeStr
}

func fromRustString(ptr uint64) string {
	mod := getWasmMod()
	strPtr := uint32(ptr >> 32)
	strSize := uint32(ptr)
	defer mod.deallocate(uint64(strPtr), uint64(strSize))
	bytes, ok := mod.mod.Memory().Read(strPtr, strSize)
	if !ok {
		log.Panicf("Memory.Read(%d, %d) out of range of memory size %d",
			strPtr, strSize, mod.mod.Memory().Size())
	}
	return string(bytes)
}

func jsonUnmarshal(ptr uint64, result interface{}) error {
	return json.Unmarshal([]byte(fromRustString(ptr)), result)
}

func mustJsonUnmarshal(j []byte, result interface{}) {
	if err := json.Unmarshal(j, result); err != nil {
		log.Panicf("%v", err)
	}
}

func jsonMarshal(value interface{}) (uint64, func()) {
	jsonBytes, err := json.Marshal(value)
	if err != nil {
		log.Panicf("%v", err)
	}
	return rustString(string(jsonBytes))
}

func mustJsonMarshal(value interface{}) []byte {
	jsonBytes, err := json.Marshal(value)
	if err != nil {
		log.Panicf("%v", err)
	}
	return jsonBytes
}
