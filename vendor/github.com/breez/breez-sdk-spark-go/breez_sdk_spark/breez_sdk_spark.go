package breez_sdk_spark

// #include <breez_sdk_spark.h>
import "C"

import (
	"bytes"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"math"
	"math/big"
	"runtime"
	"runtime/cgo"
	"sync"
	"sync/atomic"
	"unsafe"
)

// This is needed, because as of go 1.24
// type RustBuffer C.RustBuffer cannot have methods,
// RustBuffer is treated as non-local type
type GoRustBuffer struct {
	inner C.RustBuffer
}

type RustBufferI interface {
	AsReader() *bytes.Reader
	Free()
	ToGoBytes() []byte
	Data() unsafe.Pointer
	Len() uint64
	Capacity() uint64
}

// C.RustBuffer fields exposed as an interface so they can be accessed in different Go packages.
// See https://github.com/golang/go/issues/13467
type ExternalCRustBuffer interface {
	Data() unsafe.Pointer
	Len() uint64
	Capacity() uint64
}

func RustBufferFromC(b C.RustBuffer) ExternalCRustBuffer {
	return GoRustBuffer{
		inner: b,
	}
}

func CFromRustBuffer(b ExternalCRustBuffer) C.RustBuffer {
	return C.RustBuffer{
		capacity: C.uint64_t(b.Capacity()),
		len:      C.uint64_t(b.Len()),
		data:     (*C.uchar)(b.Data()),
	}
}

func RustBufferFromExternal(b ExternalCRustBuffer) GoRustBuffer {
	return GoRustBuffer{
		inner: C.RustBuffer{
			capacity: C.uint64_t(b.Capacity()),
			len:      C.uint64_t(b.Len()),
			data:     (*C.uchar)(b.Data()),
		},
	}
}

func (cb GoRustBuffer) Capacity() uint64 {
	return uint64(cb.inner.capacity)
}

func (cb GoRustBuffer) Len() uint64 {
	return uint64(cb.inner.len)
}

func (cb GoRustBuffer) Data() unsafe.Pointer {
	return unsafe.Pointer(cb.inner.data)
}

func (cb GoRustBuffer) AsReader() *bytes.Reader {
	b := unsafe.Slice((*byte)(cb.inner.data), C.uint64_t(cb.inner.len))
	return bytes.NewReader(b)
}

func (cb GoRustBuffer) Free() {
	rustCall(func(status *C.RustCallStatus) bool {
		C.ffi_breez_sdk_spark_rustbuffer_free(cb.inner, status)
		return false
	})
}

func (cb GoRustBuffer) ToGoBytes() []byte {
	return C.GoBytes(unsafe.Pointer(cb.inner.data), C.int(cb.inner.len))
}

func stringToRustBuffer(str string) C.RustBuffer {
	return bytesToRustBuffer([]byte(str))
}

func bytesToRustBuffer(b []byte) C.RustBuffer {
	if len(b) == 0 {
		return C.RustBuffer{}
	}
	// We can pass the pointer along here, as it is pinned
	// for the duration of this call
	foreign := C.ForeignBytes{
		len:  C.int(len(b)),
		data: (*C.uchar)(unsafe.Pointer(&b[0])),
	}

	return rustCall(func(status *C.RustCallStatus) C.RustBuffer {
		return C.ffi_breez_sdk_spark_rustbuffer_from_bytes(foreign, status)
	})
}

type BufLifter[GoType any] interface {
	Lift(value RustBufferI) GoType
}

type BufLowerer[GoType any] interface {
	Lower(value GoType) C.RustBuffer
}

type BufReader[GoType any] interface {
	Read(reader io.Reader) GoType
}

type BufWriter[GoType any] interface {
	Write(writer io.Writer, value GoType)
}

func LowerIntoRustBuffer[GoType any](bufWriter BufWriter[GoType], value GoType) C.RustBuffer {
	// This might be not the most efficient way but it does not require knowing allocation size
	// beforehand
	var buffer bytes.Buffer
	bufWriter.Write(&buffer, value)

	bytes, err := io.ReadAll(&buffer)
	if err != nil {
		panic(fmt.Errorf("reading written data: %w", err))
	}
	return bytesToRustBuffer(bytes)
}

func LiftFromRustBuffer[GoType any](bufReader BufReader[GoType], rbuf RustBufferI) GoType {
	defer rbuf.Free()
	reader := rbuf.AsReader()
	item := bufReader.Read(reader)
	if reader.Len() > 0 {
		// TODO: Remove this
		leftover, _ := io.ReadAll(reader)
		panic(fmt.Errorf("Junk remaining in buffer after lifting: %s", string(leftover)))
	}
	return item
}

func rustCallWithError[E any, U any](converter BufReader[*E], callback func(*C.RustCallStatus) U) (U, *E) {
	var status C.RustCallStatus
	returnValue := callback(&status)
	err := checkCallStatus(converter, status)
	return returnValue, err
}

func checkCallStatus[E any](converter BufReader[*E], status C.RustCallStatus) *E {
	switch status.code {
	case 0:
		return nil
	case 1:
		return LiftFromRustBuffer(converter, GoRustBuffer{inner: status.errorBuf})
	case 2:
		// when the rust code sees a panic, it tries to construct a rustBuffer
		// with the message.  but if that code panics, then it just sends back
		// an empty buffer.
		if status.errorBuf.len > 0 {
			panic(fmt.Errorf("%s", FfiConverterStringINSTANCE.Lift(GoRustBuffer{inner: status.errorBuf})))
		} else {
			panic(fmt.Errorf("Rust panicked while handling Rust panic"))
		}
	default:
		panic(fmt.Errorf("unknown status code: %d", status.code))
	}
}

func checkCallStatusUnknown(status C.RustCallStatus) error {
	switch status.code {
	case 0:
		return nil
	case 1:
		panic(fmt.Errorf("function not returning an error returned an error"))
	case 2:
		// when the rust code sees a panic, it tries to construct a C.RustBuffer
		// with the message.  but if that code panics, then it just sends back
		// an empty buffer.
		if status.errorBuf.len > 0 {
			panic(fmt.Errorf("%s", FfiConverterStringINSTANCE.Lift(GoRustBuffer{
				inner: status.errorBuf,
			})))
		} else {
			panic(fmt.Errorf("Rust panicked while handling Rust panic"))
		}
	default:
		return fmt.Errorf("unknown status code: %d", status.code)
	}
}

func rustCall[U any](callback func(*C.RustCallStatus) U) U {
	returnValue, err := rustCallWithError[error](nil, callback)
	if err != nil {
		panic(err)
	}
	return returnValue
}

type NativeError interface {
	AsError() error
}

func writeInt8(writer io.Writer, value int8) {
	if err := binary.Write(writer, binary.BigEndian, value); err != nil {
		panic(err)
	}
}

func writeUint8(writer io.Writer, value uint8) {
	if err := binary.Write(writer, binary.BigEndian, value); err != nil {
		panic(err)
	}
}

func writeInt16(writer io.Writer, value int16) {
	if err := binary.Write(writer, binary.BigEndian, value); err != nil {
		panic(err)
	}
}

func writeUint16(writer io.Writer, value uint16) {
	if err := binary.Write(writer, binary.BigEndian, value); err != nil {
		panic(err)
	}
}

func writeInt32(writer io.Writer, value int32) {
	if err := binary.Write(writer, binary.BigEndian, value); err != nil {
		panic(err)
	}
}

func writeUint32(writer io.Writer, value uint32) {
	if err := binary.Write(writer, binary.BigEndian, value); err != nil {
		panic(err)
	}
}

func writeInt64(writer io.Writer, value int64) {
	if err := binary.Write(writer, binary.BigEndian, value); err != nil {
		panic(err)
	}
}

func writeUint64(writer io.Writer, value uint64) {
	if err := binary.Write(writer, binary.BigEndian, value); err != nil {
		panic(err)
	}
}

func writeFloat32(writer io.Writer, value float32) {
	if err := binary.Write(writer, binary.BigEndian, value); err != nil {
		panic(err)
	}
}

func writeFloat64(writer io.Writer, value float64) {
	if err := binary.Write(writer, binary.BigEndian, value); err != nil {
		panic(err)
	}
}

func readInt8(reader io.Reader) int8 {
	var result int8
	if err := binary.Read(reader, binary.BigEndian, &result); err != nil {
		panic(err)
	}
	return result
}

func readUint8(reader io.Reader) uint8 {
	var result uint8
	if err := binary.Read(reader, binary.BigEndian, &result); err != nil {
		panic(err)
	}
	return result
}

func readInt16(reader io.Reader) int16 {
	var result int16
	if err := binary.Read(reader, binary.BigEndian, &result); err != nil {
		panic(err)
	}
	return result
}

func readUint16(reader io.Reader) uint16 {
	var result uint16
	if err := binary.Read(reader, binary.BigEndian, &result); err != nil {
		panic(err)
	}
	return result
}

func readInt32(reader io.Reader) int32 {
	var result int32
	if err := binary.Read(reader, binary.BigEndian, &result); err != nil {
		panic(err)
	}
	return result
}

func readUint32(reader io.Reader) uint32 {
	var result uint32
	if err := binary.Read(reader, binary.BigEndian, &result); err != nil {
		panic(err)
	}
	return result
}

func readInt64(reader io.Reader) int64 {
	var result int64
	if err := binary.Read(reader, binary.BigEndian, &result); err != nil {
		panic(err)
	}
	return result
}

func readUint64(reader io.Reader) uint64 {
	var result uint64
	if err := binary.Read(reader, binary.BigEndian, &result); err != nil {
		panic(err)
	}
	return result
}

func readFloat32(reader io.Reader) float32 {
	var result float32
	if err := binary.Read(reader, binary.BigEndian, &result); err != nil {
		panic(err)
	}
	return result
}

func readFloat64(reader io.Reader) float64 {
	var result float64
	if err := binary.Read(reader, binary.BigEndian, &result); err != nil {
		panic(err)
	}
	return result
}

func init() {

	FfiConverterBitcoinChainServiceINSTANCE.register()
	FfiConverterExternalSignerINSTANCE.register()
	FfiConverterFiatServiceINSTANCE.register()
	FfiConverterPasskeyPrfProviderINSTANCE.register()
	FfiConverterPaymentObserverINSTANCE.register()
	FfiConverterRestClientINSTANCE.register()
	FfiConverterStorageINSTANCE.register()
	FfiConverterCallbackInterfaceEventListenerINSTANCE.register()
	FfiConverterCallbackInterfaceLoggerINSTANCE.register()
	uniffiCheckChecksums()
}

func uniffiCheckChecksums() {
	// Get the bindings contract version from our ComponentInterface
	bindingsContractVersion := 29
	// Get the scaffolding contract version by calling the into the dylib
	scaffoldingContractVersion := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint32_t {
		return C.ffi_breez_sdk_spark_uniffi_contract_version()
	})
	if bindingsContractVersion != int(scaffoldingContractVersion) {
		// If this happens try cleaning and rebuilding your project
		panic("breez_sdk_spark: UniFFI contract version mismatch")
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_func_connect()
		})
		if checksum != 40345 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_func_connect: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_func_connect_with_signer()
		})
		if checksum != 1399 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_func_connect_with_signer: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_func_default_config()
		})
		if checksum != 62194 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_func_default_config: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_func_default_external_signer()
		})
		if checksum != 40694 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_func_default_external_signer: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_func_default_postgres_storage_config()
		})
		if checksum != 3515 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_func_default_postgres_storage_config: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_func_get_spark_status()
		})
		if checksum != 62888 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_func_get_spark_status: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_func_init_logging()
		})
		if checksum != 8518 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_func_init_logging: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_bitcoinchainservice_get_address_utxos()
		})
		if checksum != 20959 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_bitcoinchainservice_get_address_utxos: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_bitcoinchainservice_get_transaction_status()
		})
		if checksum != 23018 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_bitcoinchainservice_get_transaction_status: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_bitcoinchainservice_get_transaction_hex()
		})
		if checksum != 59376 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_bitcoinchainservice_get_transaction_hex: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_bitcoinchainservice_broadcast_transaction()
		})
		if checksum != 65179 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_bitcoinchainservice_broadcast_transaction: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_bitcoinchainservice_recommended_fees()
		})
		if checksum != 43230 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_bitcoinchainservice_recommended_fees: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_breezsdk_add_contact()
		})
		if checksum != 26497 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_breezsdk_add_contact: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_breezsdk_add_event_listener()
		})
		if checksum != 37737 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_breezsdk_add_event_listener: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_breezsdk_buy_bitcoin()
		})
		if checksum != 34179 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_breezsdk_buy_bitcoin: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_breezsdk_cancel_leaf_optimization()
		})
		if checksum != 56996 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_breezsdk_cancel_leaf_optimization: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_breezsdk_check_lightning_address_available()
		})
		if checksum != 31624 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_breezsdk_check_lightning_address_available: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_breezsdk_check_message()
		})
		if checksum != 4385 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_breezsdk_check_message: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_breezsdk_claim_deposit()
		})
		if checksum != 43529 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_breezsdk_claim_deposit: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_breezsdk_claim_htlc_payment()
		})
		if checksum != 57587 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_breezsdk_claim_htlc_payment: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_breezsdk_delete_contact()
		})
		if checksum != 15670 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_breezsdk_delete_contact: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_breezsdk_delete_lightning_address()
		})
		if checksum != 44132 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_breezsdk_delete_lightning_address: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_breezsdk_disconnect()
		})
		if checksum != 330 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_breezsdk_disconnect: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_breezsdk_fetch_conversion_limits()
		})
		if checksum != 50958 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_breezsdk_fetch_conversion_limits: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_breezsdk_get_info()
		})
		if checksum != 6771 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_breezsdk_get_info: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_breezsdk_get_leaf_optimization_progress()
		})
		if checksum != 38008 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_breezsdk_get_leaf_optimization_progress: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_breezsdk_get_lightning_address()
		})
		if checksum != 36552 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_breezsdk_get_lightning_address: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_breezsdk_get_payment()
		})
		if checksum != 11540 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_breezsdk_get_payment: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_breezsdk_get_token_issuer()
		})
		if checksum != 26649 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_breezsdk_get_token_issuer: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_breezsdk_get_tokens_metadata()
		})
		if checksum != 40125 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_breezsdk_get_tokens_metadata: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_breezsdk_get_user_settings()
		})
		if checksum != 38537 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_breezsdk_get_user_settings: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_breezsdk_list_contacts()
		})
		if checksum != 2729 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_breezsdk_list_contacts: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_breezsdk_list_fiat_currencies()
		})
		if checksum != 63366 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_breezsdk_list_fiat_currencies: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_breezsdk_list_fiat_rates()
		})
		if checksum != 5904 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_breezsdk_list_fiat_rates: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_breezsdk_list_payments()
		})
		if checksum != 39170 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_breezsdk_list_payments: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_breezsdk_list_unclaimed_deposits()
		})
		if checksum != 22486 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_breezsdk_list_unclaimed_deposits: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_breezsdk_list_webhooks()
		})
		if checksum != 28432 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_breezsdk_list_webhooks: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_breezsdk_lnurl_auth()
		})
		if checksum != 125 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_breezsdk_lnurl_auth: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_breezsdk_lnurl_pay()
		})
		if checksum != 10147 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_breezsdk_lnurl_pay: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_breezsdk_lnurl_withdraw()
		})
		if checksum != 45652 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_breezsdk_lnurl_withdraw: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_breezsdk_parse()
		})
		if checksum != 14285 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_breezsdk_parse: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_breezsdk_prepare_lnurl_pay()
		})
		if checksum != 37691 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_breezsdk_prepare_lnurl_pay: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_breezsdk_prepare_send_payment()
		})
		if checksum != 34185 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_breezsdk_prepare_send_payment: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_breezsdk_receive_payment()
		})
		if checksum != 36984 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_breezsdk_receive_payment: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_breezsdk_recommended_fees()
		})
		if checksum != 16947 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_breezsdk_recommended_fees: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_breezsdk_refund_deposit()
		})
		if checksum != 33646 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_breezsdk_refund_deposit: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_breezsdk_register_lightning_address()
		})
		if checksum != 530 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_breezsdk_register_lightning_address: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_breezsdk_register_webhook()
		})
		if checksum != 13529 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_breezsdk_register_webhook: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_breezsdk_remove_event_listener()
		})
		if checksum != 41066 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_breezsdk_remove_event_listener: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_breezsdk_send_payment()
		})
		if checksum != 54349 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_breezsdk_send_payment: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_breezsdk_sign_message()
		})
		if checksum != 57563 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_breezsdk_sign_message: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_breezsdk_start_leaf_optimization()
		})
		if checksum != 44923 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_breezsdk_start_leaf_optimization: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_breezsdk_sync_wallet()
		})
		if checksum != 30368 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_breezsdk_sync_wallet: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_breezsdk_unregister_webhook()
		})
		if checksum != 34100 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_breezsdk_unregister_webhook: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_breezsdk_update_contact()
		})
		if checksum != 21170 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_breezsdk_update_contact: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_breezsdk_update_user_settings()
		})
		if checksum != 1721 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_breezsdk_update_user_settings: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_externalsigner_identity_public_key()
		})
		if checksum != 62941 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_externalsigner_identity_public_key: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_externalsigner_derive_public_key()
		})
		if checksum != 23137 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_externalsigner_derive_public_key: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_externalsigner_sign_ecdsa()
		})
		if checksum != 37648 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_externalsigner_sign_ecdsa: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_externalsigner_sign_ecdsa_recoverable()
		})
		if checksum != 3107 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_externalsigner_sign_ecdsa_recoverable: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_externalsigner_encrypt_ecies()
		})
		if checksum != 60224 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_externalsigner_encrypt_ecies: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_externalsigner_decrypt_ecies()
		})
		if checksum != 59601 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_externalsigner_decrypt_ecies: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_externalsigner_sign_hash_schnorr()
		})
		if checksum != 57220 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_externalsigner_sign_hash_schnorr: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_externalsigner_hmac_sha256()
		})
		if checksum != 57517 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_externalsigner_hmac_sha256: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_externalsigner_generate_random_signing_commitment()
		})
		if checksum != 31862 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_externalsigner_generate_random_signing_commitment: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_externalsigner_get_public_key_for_node()
		})
		if checksum != 37434 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_externalsigner_get_public_key_for_node: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_externalsigner_generate_random_secret()
		})
		if checksum != 26114 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_externalsigner_generate_random_secret: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_externalsigner_static_deposit_secret_encrypted()
		})
		if checksum != 38925 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_externalsigner_static_deposit_secret_encrypted: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_externalsigner_static_deposit_secret()
		})
		if checksum != 45280 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_externalsigner_static_deposit_secret: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_externalsigner_static_deposit_signing_key()
		})
		if checksum != 62519 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_externalsigner_static_deposit_signing_key: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_externalsigner_subtract_secrets()
		})
		if checksum != 45969 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_externalsigner_subtract_secrets: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_externalsigner_split_secret_with_proofs()
		})
		if checksum != 19489 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_externalsigner_split_secret_with_proofs: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_externalsigner_encrypt_secret_for_receiver()
		})
		if checksum != 51627 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_externalsigner_encrypt_secret_for_receiver: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_externalsigner_public_key_from_secret()
		})
		if checksum != 53055 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_externalsigner_public_key_from_secret: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_externalsigner_sign_frost()
		})
		if checksum != 20635 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_externalsigner_sign_frost: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_externalsigner_aggregate_frost()
		})
		if checksum != 53544 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_externalsigner_aggregate_frost: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_fiatservice_fetch_fiat_currencies()
		})
		if checksum != 19092 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_fiatservice_fetch_fiat_currencies: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_fiatservice_fetch_fiat_rates()
		})
		if checksum != 11512 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_fiatservice_fetch_fiat_rates: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_passkey_get_wallet()
		})
		if checksum != 28830 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_passkey_get_wallet: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_passkey_is_available()
		})
		if checksum != 31283 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_passkey_is_available: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_passkey_list_labels()
		})
		if checksum != 5351 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_passkey_list_labels: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_passkey_store_label()
		})
		if checksum != 42949 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_passkey_store_label: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_passkeyprfprovider_derive_prf_seed()
		})
		if checksum != 44905 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_passkeyprfprovider_derive_prf_seed: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_passkeyprfprovider_is_prf_available()
		})
		if checksum != 33931 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_passkeyprfprovider_is_prf_available: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_paymentobserver_before_send()
		})
		if checksum != 30686 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_paymentobserver_before_send: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_restclient_get_request()
		})
		if checksum != 8260 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_restclient_get_request: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_restclient_post_request()
		})
		if checksum != 24889 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_restclient_post_request: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_restclient_delete_request()
		})
		if checksum != 51072 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_restclient_delete_request: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_sdkbuilder_build()
		})
		if checksum != 8126 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_sdkbuilder_build: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_sdkbuilder_with_chain_service()
		})
		if checksum != 2848 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_sdkbuilder_with_chain_service: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_sdkbuilder_with_default_storage()
		})
		if checksum != 14543 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_sdkbuilder_with_default_storage: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_sdkbuilder_with_fiat_service()
		})
		if checksum != 37854 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_sdkbuilder_with_fiat_service: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_sdkbuilder_with_key_set()
		})
		if checksum != 50052 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_sdkbuilder_with_key_set: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_sdkbuilder_with_lnurl_client()
		})
		if checksum != 51060 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_sdkbuilder_with_lnurl_client: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_sdkbuilder_with_payment_observer()
		})
		if checksum != 21617 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_sdkbuilder_with_payment_observer: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_sdkbuilder_with_postgres_backend()
		})
		if checksum != 59296 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_sdkbuilder_with_postgres_backend: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_sdkbuilder_with_rest_chain_service()
		})
		if checksum != 63155 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_sdkbuilder_with_rest_chain_service: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_sdkbuilder_with_storage()
		})
		if checksum != 59400 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_sdkbuilder_with_storage: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_storage_delete_cached_item()
		})
		if checksum != 6883 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_storage_delete_cached_item: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_storage_get_cached_item()
		})
		if checksum != 30248 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_storage_get_cached_item: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_storage_set_cached_item()
		})
		if checksum != 7970 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_storage_set_cached_item: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_storage_list_payments()
		})
		if checksum != 51078 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_storage_list_payments: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_storage_insert_payment()
		})
		if checksum != 28075 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_storage_insert_payment: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_storage_insert_payment_metadata()
		})
		if checksum != 32757 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_storage_insert_payment_metadata: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_storage_get_payment_by_id()
		})
		if checksum != 35394 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_storage_get_payment_by_id: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_storage_get_payment_by_invoice()
		})
		if checksum != 57075 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_storage_get_payment_by_invoice: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_storage_get_payments_by_parent_ids()
		})
		if checksum != 10948 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_storage_get_payments_by_parent_ids: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_storage_add_deposit()
		})
		if checksum != 35363 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_storage_add_deposit: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_storage_delete_deposit()
		})
		if checksum != 28477 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_storage_delete_deposit: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_storage_list_deposits()
		})
		if checksum != 62636 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_storage_list_deposits: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_storage_update_deposit()
		})
		if checksum != 18714 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_storage_update_deposit: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_storage_set_lnurl_metadata()
		})
		if checksum != 64210 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_storage_set_lnurl_metadata: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_storage_list_contacts()
		})
		if checksum != 10490 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_storage_list_contacts: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_storage_get_contact()
		})
		if checksum != 19980 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_storage_get_contact: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_storage_insert_contact()
		})
		if checksum != 38342 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_storage_insert_contact: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_storage_delete_contact()
		})
		if checksum != 50274 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_storage_delete_contact: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_storage_add_outgoing_change()
		})
		if checksum != 1304 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_storage_add_outgoing_change: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_storage_complete_outgoing_sync()
		})
		if checksum != 7860 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_storage_complete_outgoing_sync: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_storage_get_pending_outgoing_changes()
		})
		if checksum != 30862 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_storage_get_pending_outgoing_changes: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_storage_get_last_revision()
		})
		if checksum != 6931 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_storage_get_last_revision: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_storage_insert_incoming_records()
		})
		if checksum != 59522 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_storage_insert_incoming_records: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_storage_delete_incoming_record()
		})
		if checksum != 19643 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_storage_delete_incoming_record: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_storage_get_incoming_records()
		})
		if checksum != 28540 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_storage_get_incoming_records: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_storage_get_latest_outgoing_change()
		})
		if checksum != 41369 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_storage_get_latest_outgoing_change: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_storage_update_record_from_incoming()
		})
		if checksum != 18793 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_storage_update_record_from_incoming: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_tokenissuer_burn_issuer_token()
		})
		if checksum != 56056 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_tokenissuer_burn_issuer_token: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_tokenissuer_create_issuer_token()
		})
		if checksum != 33277 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_tokenissuer_create_issuer_token: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_tokenissuer_freeze_issuer_token()
		})
		if checksum != 32344 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_tokenissuer_freeze_issuer_token: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_tokenissuer_get_issuer_token_balance()
		})
		if checksum != 9758 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_tokenissuer_get_issuer_token_balance: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_tokenissuer_get_issuer_token_metadata()
		})
		if checksum != 57707 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_tokenissuer_get_issuer_token_metadata: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_tokenissuer_mint_issuer_token()
		})
		if checksum != 36459 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_tokenissuer_mint_issuer_token: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_tokenissuer_unfreeze_issuer_token()
		})
		if checksum != 65025 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_tokenissuer_unfreeze_issuer_token: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_constructor_passkey_new()
		})
		if checksum != 25404 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_constructor_passkey_new: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_constructor_sdkbuilder_new()
		})
		if checksum != 65435 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_constructor_sdkbuilder_new: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_eventlistener_on_event()
		})
		if checksum != 24807 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_eventlistener_on_event: UniFFI API checksum mismatch")
		}
	}
	{
		checksum := rustCall(func(_uniffiStatus *C.RustCallStatus) C.uint16_t {
			return C.uniffi_breez_sdk_spark_checksum_method_logger_log()
		})
		if checksum != 11839 {
			// If this happens try cleaning and rebuilding your project
			panic("breez_sdk_spark: uniffi_breez_sdk_spark_checksum_method_logger_log: UniFFI API checksum mismatch")
		}
	}
}

type FfiConverterUint8 struct{}

var FfiConverterUint8INSTANCE = FfiConverterUint8{}

func (FfiConverterUint8) Lower(value uint8) C.uint8_t {
	return C.uint8_t(value)
}

func (FfiConverterUint8) Write(writer io.Writer, value uint8) {
	writeUint8(writer, value)
}

func (FfiConverterUint8) Lift(value C.uint8_t) uint8 {
	return uint8(value)
}

func (FfiConverterUint8) Read(reader io.Reader) uint8 {
	return readUint8(reader)
}

type FfiDestroyerUint8 struct{}

func (FfiDestroyerUint8) Destroy(_ uint8) {}

type FfiConverterUint16 struct{}

var FfiConverterUint16INSTANCE = FfiConverterUint16{}

func (FfiConverterUint16) Lower(value uint16) C.uint16_t {
	return C.uint16_t(value)
}

func (FfiConverterUint16) Write(writer io.Writer, value uint16) {
	writeUint16(writer, value)
}

func (FfiConverterUint16) Lift(value C.uint16_t) uint16 {
	return uint16(value)
}

func (FfiConverterUint16) Read(reader io.Reader) uint16 {
	return readUint16(reader)
}

type FfiDestroyerUint16 struct{}

func (FfiDestroyerUint16) Destroy(_ uint16) {}

type FfiConverterUint32 struct{}

var FfiConverterUint32INSTANCE = FfiConverterUint32{}

func (FfiConverterUint32) Lower(value uint32) C.uint32_t {
	return C.uint32_t(value)
}

func (FfiConverterUint32) Write(writer io.Writer, value uint32) {
	writeUint32(writer, value)
}

func (FfiConverterUint32) Lift(value C.uint32_t) uint32 {
	return uint32(value)
}

func (FfiConverterUint32) Read(reader io.Reader) uint32 {
	return readUint32(reader)
}

type FfiDestroyerUint32 struct{}

func (FfiDestroyerUint32) Destroy(_ uint32) {}

type FfiConverterUint64 struct{}

var FfiConverterUint64INSTANCE = FfiConverterUint64{}

func (FfiConverterUint64) Lower(value uint64) C.uint64_t {
	return C.uint64_t(value)
}

func (FfiConverterUint64) Write(writer io.Writer, value uint64) {
	writeUint64(writer, value)
}

func (FfiConverterUint64) Lift(value C.uint64_t) uint64 {
	return uint64(value)
}

func (FfiConverterUint64) Read(reader io.Reader) uint64 {
	return readUint64(reader)
}

type FfiDestroyerUint64 struct{}

func (FfiDestroyerUint64) Destroy(_ uint64) {}

type FfiConverterFloat64 struct{}

var FfiConverterFloat64INSTANCE = FfiConverterFloat64{}

func (FfiConverterFloat64) Lower(value float64) C.double {
	return C.double(value)
}

func (FfiConverterFloat64) Write(writer io.Writer, value float64) {
	writeFloat64(writer, value)
}

func (FfiConverterFloat64) Lift(value C.double) float64 {
	return float64(value)
}

func (FfiConverterFloat64) Read(reader io.Reader) float64 {
	return readFloat64(reader)
}

type FfiDestroyerFloat64 struct{}

func (FfiDestroyerFloat64) Destroy(_ float64) {}

type FfiConverterBool struct{}

var FfiConverterBoolINSTANCE = FfiConverterBool{}

func (FfiConverterBool) Lower(value bool) C.int8_t {
	if value {
		return C.int8_t(1)
	}
	return C.int8_t(0)
}

func (FfiConverterBool) Write(writer io.Writer, value bool) {
	if value {
		writeInt8(writer, 1)
	} else {
		writeInt8(writer, 0)
	}
}

func (FfiConverterBool) Lift(value C.int8_t) bool {
	return value != 0
}

func (FfiConverterBool) Read(reader io.Reader) bool {
	return readInt8(reader) != 0
}

type FfiDestroyerBool struct{}

func (FfiDestroyerBool) Destroy(_ bool) {}

type FfiConverterString struct{}

var FfiConverterStringINSTANCE = FfiConverterString{}

func (FfiConverterString) Lift(rb RustBufferI) string {
	defer rb.Free()
	reader := rb.AsReader()
	b, err := io.ReadAll(reader)
	if err != nil {
		panic(fmt.Errorf("reading reader: %w", err))
	}
	return string(b)
}

func (FfiConverterString) Read(reader io.Reader) string {
	length := readInt32(reader)
	buffer := make([]byte, length)
	read_length, err := reader.Read(buffer)
	if err != nil && err != io.EOF {
		panic(err)
	}
	if read_length != int(length) {
		panic(fmt.Errorf("bad read length when reading string, expected %d, read %d", length, read_length))
	}
	return string(buffer)
}

func (FfiConverterString) Lower(value string) C.RustBuffer {
	return stringToRustBuffer(value)
}

func (c FfiConverterString) LowerExternal(value string) ExternalCRustBuffer {
	return RustBufferFromC(stringToRustBuffer(value))
}

func (FfiConverterString) Write(writer io.Writer, value string) {
	if len(value) > math.MaxInt32 {
		panic("String is too large to fit into Int32")
	}

	writeInt32(writer, int32(len(value)))
	write_length, err := io.WriteString(writer, value)
	if err != nil {
		panic(err)
	}
	if write_length != len(value) {
		panic(fmt.Errorf("bad write length when writing string, expected %d, written %d", len(value), write_length))
	}
}

type FfiDestroyerString struct{}

func (FfiDestroyerString) Destroy(_ string) {}

type FfiConverterBytes struct{}

var FfiConverterBytesINSTANCE = FfiConverterBytes{}

func (c FfiConverterBytes) Lower(value []byte) C.RustBuffer {
	return LowerIntoRustBuffer[[]byte](c, value)
}

func (c FfiConverterBytes) LowerExternal(value []byte) ExternalCRustBuffer {
	return RustBufferFromC(c.Lower(value))
}

func (c FfiConverterBytes) Write(writer io.Writer, value []byte) {
	if len(value) > math.MaxInt32 {
		panic("[]byte is too large to fit into Int32")
	}

	writeInt32(writer, int32(len(value)))
	write_length, err := writer.Write(value)
	if err != nil {
		panic(err)
	}
	if write_length != len(value) {
		panic(fmt.Errorf("bad write length when writing []byte, expected %d, written %d", len(value), write_length))
	}
}

func (c FfiConverterBytes) Lift(rb RustBufferI) []byte {
	return LiftFromRustBuffer[[]byte](c, rb)
}

func (c FfiConverterBytes) Read(reader io.Reader) []byte {
	length := readInt32(reader)
	buffer := make([]byte, length)
	read_length, err := reader.Read(buffer)
	if err != nil && err != io.EOF {
		panic(err)
	}
	if read_length != int(length) {
		panic(fmt.Errorf("bad read length when reading []byte, expected %d, read %d", length, read_length))
	}
	return buffer
}

type FfiDestroyerBytes struct{}

func (FfiDestroyerBytes) Destroy(_ []byte) {}

// Below is an implementation of synchronization requirements outlined in the link.
// https://github.com/mozilla/uniffi-rs/blob/0dc031132d9493ca812c3af6e7dd60ad2ea95bf0/uniffi_bindgen/src/bindings/kotlin/templates/ObjectRuntime.kt#L31

type FfiObject struct {
	pointer       unsafe.Pointer
	callCounter   atomic.Int64
	cloneFunction func(unsafe.Pointer, *C.RustCallStatus) unsafe.Pointer
	freeFunction  func(unsafe.Pointer, *C.RustCallStatus)
	destroyed     atomic.Bool
}

func newFfiObject(
	pointer unsafe.Pointer,
	cloneFunction func(unsafe.Pointer, *C.RustCallStatus) unsafe.Pointer,
	freeFunction func(unsafe.Pointer, *C.RustCallStatus),
) FfiObject {
	return FfiObject{
		pointer:       pointer,
		cloneFunction: cloneFunction,
		freeFunction:  freeFunction,
	}
}

func (ffiObject *FfiObject) incrementPointer(debugName string) unsafe.Pointer {
	for {
		counter := ffiObject.callCounter.Load()
		if counter <= -1 {
			panic(fmt.Errorf("%v object has already been destroyed", debugName))
		}
		if counter == math.MaxInt64 {
			panic(fmt.Errorf("%v object call counter would overflow", debugName))
		}
		if ffiObject.callCounter.CompareAndSwap(counter, counter+1) {
			break
		}
	}

	return rustCall(func(status *C.RustCallStatus) unsafe.Pointer {
		return ffiObject.cloneFunction(ffiObject.pointer, status)
	})
}

func (ffiObject *FfiObject) decrementPointer() {
	if ffiObject.callCounter.Add(-1) == -1 {
		ffiObject.freeRustArcPtr()
	}
}

func (ffiObject *FfiObject) destroy() {
	if ffiObject.destroyed.CompareAndSwap(false, true) {
		if ffiObject.callCounter.Add(-1) == -1 {
			ffiObject.freeRustArcPtr()
		}
	}
}

func (ffiObject *FfiObject) freeRustArcPtr() {
	rustCall(func(status *C.RustCallStatus) int32 {
		ffiObject.freeFunction(ffiObject.pointer, status)
		return 0
	})
}

type BitcoinChainService interface {
	GetAddressUtxos(address string) ([]Utxo, error)
	GetTransactionStatus(txid string) (TxStatus, error)
	GetTransactionHex(txid string) (string, error)
	BroadcastTransaction(tx string) error
	RecommendedFees() (RecommendedFees, error)
}
type BitcoinChainServiceImpl struct {
	ffiObject FfiObject
}

func (_self *BitcoinChainServiceImpl) GetAddressUtxos(address string) ([]Utxo, error) {
	_pointer := _self.ffiObject.incrementPointer("BitcoinChainService")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[ChainServiceError](
		FfiConverterChainServiceErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) []Utxo {
			return FfiConverterSequenceUtxoINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_bitcoinchainservice_get_address_utxos(
			_pointer, FfiConverterStringINSTANCE.Lower(address)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

func (_self *BitcoinChainServiceImpl) GetTransactionStatus(txid string) (TxStatus, error) {
	_pointer := _self.ffiObject.incrementPointer("BitcoinChainService")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[ChainServiceError](
		FfiConverterChainServiceErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) TxStatus {
			return FfiConverterTxStatusINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_bitcoinchainservice_get_transaction_status(
			_pointer, FfiConverterStringINSTANCE.Lower(txid)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

func (_self *BitcoinChainServiceImpl) GetTransactionHex(txid string) (string, error) {
	_pointer := _self.ffiObject.incrementPointer("BitcoinChainService")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[ChainServiceError](
		FfiConverterChainServiceErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) string {
			return FfiConverterStringINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_bitcoinchainservice_get_transaction_hex(
			_pointer, FfiConverterStringINSTANCE.Lower(txid)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

func (_self *BitcoinChainServiceImpl) BroadcastTransaction(tx string) error {
	_pointer := _self.ffiObject.incrementPointer("BitcoinChainService")
	defer _self.ffiObject.decrementPointer()
	_, err := uniffiRustCallAsync[ChainServiceError](
		FfiConverterChainServiceErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) struct{} {
			C.ffi_breez_sdk_spark_rust_future_complete_void(handle, status)
			return struct{}{}
		},
		// liftFn
		func(_ struct{}) struct{} { return struct{}{} },
		C.uniffi_breez_sdk_spark_fn_method_bitcoinchainservice_broadcast_transaction(
			_pointer, FfiConverterStringINSTANCE.Lower(tx)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_void(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_void(handle)
		},
	)

	if err == nil {
		return nil
	}

	return err
}

func (_self *BitcoinChainServiceImpl) RecommendedFees() (RecommendedFees, error) {
	_pointer := _self.ffiObject.incrementPointer("BitcoinChainService")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[ChainServiceError](
		FfiConverterChainServiceErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) RecommendedFees {
			return FfiConverterRecommendedFeesINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_bitcoinchainservice_recommended_fees(
			_pointer),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}
func (object *BitcoinChainServiceImpl) Destroy() {
	runtime.SetFinalizer(object, nil)
	object.ffiObject.destroy()
}

type FfiConverterBitcoinChainService struct {
	handleMap *concurrentHandleMap[BitcoinChainService]
}

var FfiConverterBitcoinChainServiceINSTANCE = FfiConverterBitcoinChainService{
	handleMap: newConcurrentHandleMap[BitcoinChainService](),
}

func (c FfiConverterBitcoinChainService) Lift(pointer unsafe.Pointer) BitcoinChainService {
	result := &BitcoinChainServiceImpl{
		newFfiObject(
			pointer,
			func(pointer unsafe.Pointer, status *C.RustCallStatus) unsafe.Pointer {
				return C.uniffi_breez_sdk_spark_fn_clone_bitcoinchainservice(pointer, status)
			},
			func(pointer unsafe.Pointer, status *C.RustCallStatus) {
				C.uniffi_breez_sdk_spark_fn_free_bitcoinchainservice(pointer, status)
			},
		),
	}
	runtime.SetFinalizer(result, (*BitcoinChainServiceImpl).Destroy)
	return result
}

func (c FfiConverterBitcoinChainService) Read(reader io.Reader) BitcoinChainService {
	return c.Lift(unsafe.Pointer(uintptr(readUint64(reader))))
}

func (c FfiConverterBitcoinChainService) Lower(value BitcoinChainService) unsafe.Pointer {
	// TODO: this is bad - all synchronization from ObjectRuntime.go is discarded here,
	// because the pointer will be decremented immediately after this function returns,
	// and someone will be left holding onto a non-locked pointer.
	pointer := unsafe.Pointer(uintptr(c.handleMap.insert(value)))
	return pointer

}

func (c FfiConverterBitcoinChainService) Write(writer io.Writer, value BitcoinChainService) {
	writeUint64(writer, uint64(uintptr(c.Lower(value))))
}

type FfiDestroyerBitcoinChainService struct{}

func (_ FfiDestroyerBitcoinChainService) Destroy(value BitcoinChainService) {
	if val, ok := value.(*BitcoinChainServiceImpl); ok {
		val.Destroy()
	} else {
		panic("Expected *BitcoinChainServiceImpl")
	}
}

type uniffiCallbackResult C.int8_t

const (
	uniffiIdxCallbackFree               uniffiCallbackResult = 0
	uniffiCallbackResultSuccess         uniffiCallbackResult = 0
	uniffiCallbackResultError           uniffiCallbackResult = 1
	uniffiCallbackUnexpectedResultError uniffiCallbackResult = 2
	uniffiCallbackCancelled             uniffiCallbackResult = 3
)

type concurrentHandleMap[T any] struct {
	handles       map[uint64]T
	currentHandle uint64
	lock          sync.RWMutex
}

func newConcurrentHandleMap[T any]() *concurrentHandleMap[T] {
	return &concurrentHandleMap[T]{
		handles: map[uint64]T{},
	}
}

func (cm *concurrentHandleMap[T]) insert(obj T) uint64 {
	cm.lock.Lock()
	defer cm.lock.Unlock()

	cm.currentHandle = cm.currentHandle + 1
	cm.handles[cm.currentHandle] = obj
	return cm.currentHandle
}

func (cm *concurrentHandleMap[T]) remove(handle uint64) {
	cm.lock.Lock()
	defer cm.lock.Unlock()

	delete(cm.handles, handle)
}

func (cm *concurrentHandleMap[T]) tryGet(handle uint64) (T, bool) {
	cm.lock.RLock()
	defer cm.lock.RUnlock()

	val, ok := cm.handles[handle]
	return val, ok
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceBitcoinChainServiceMethod0
func breez_sdk_spark_cgo_dispatchCallbackInterfaceBitcoinChainServiceMethod0(uniffiHandle C.uint64_t, address C.RustBuffer, uniffiFutureCallback C.UniffiForeignFutureCompleteRustBuffer, uniffiCallbackData C.uint64_t, uniffiOutReturn *C.UniffiForeignFuture) {
	handle := uint64(uniffiHandle)
	uniffiObj, ok := FfiConverterBitcoinChainServiceINSTANCE.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}

	result := make(chan C.UniffiForeignFutureStructRustBuffer, 1)
	cancel := make(chan struct{}, 1)
	guardHandle := cgo.NewHandle(cancel)
	*uniffiOutReturn = C.UniffiForeignFuture{
		handle: C.uint64_t(guardHandle),
		free:   C.UniffiForeignFutureFree(C.breez_sdk_spark_uniffiFreeGorutine),
	}

	// Wait for compleation or cancel
	go func() {
		select {
		case <-cancel:
		case res := <-result:
			C.call_UniffiForeignFutureCompleteRustBuffer(uniffiFutureCallback, uniffiCallbackData, res)
		}
	}()

	// Eval callback asynchroniously
	go func() {
		asyncResult := &C.UniffiForeignFutureStructRustBuffer{}
		uniffiOutReturn := &asyncResult.returnValue
		callStatus := &asyncResult.callStatus
		defer func() {
			result <- *asyncResult
		}()

		res, err :=
			uniffiObj.GetAddressUtxos(
				FfiConverterStringINSTANCE.Lift(GoRustBuffer{
					inner: address,
				}),
			)

		if err != nil {
			var actualError *ChainServiceError
			if errors.As(err, &actualError) {
				if actualError != nil {
					*callStatus = C.RustCallStatus{
						code:     C.int8_t(uniffiCallbackResultError),
						errorBuf: FfiConverterChainServiceErrorINSTANCE.Lower(actualError),
					}
					return
				}
			} else {
				*callStatus = C.RustCallStatus{
					code: C.int8_t(uniffiCallbackUnexpectedResultError),
				}
				return
			}
		}

		*uniffiOutReturn = FfiConverterSequenceUtxoINSTANCE.Lower(res)
	}()
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceBitcoinChainServiceMethod1
func breez_sdk_spark_cgo_dispatchCallbackInterfaceBitcoinChainServiceMethod1(uniffiHandle C.uint64_t, txid C.RustBuffer, uniffiFutureCallback C.UniffiForeignFutureCompleteRustBuffer, uniffiCallbackData C.uint64_t, uniffiOutReturn *C.UniffiForeignFuture) {
	handle := uint64(uniffiHandle)
	uniffiObj, ok := FfiConverterBitcoinChainServiceINSTANCE.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}

	result := make(chan C.UniffiForeignFutureStructRustBuffer, 1)
	cancel := make(chan struct{}, 1)
	guardHandle := cgo.NewHandle(cancel)
	*uniffiOutReturn = C.UniffiForeignFuture{
		handle: C.uint64_t(guardHandle),
		free:   C.UniffiForeignFutureFree(C.breez_sdk_spark_uniffiFreeGorutine),
	}

	// Wait for compleation or cancel
	go func() {
		select {
		case <-cancel:
		case res := <-result:
			C.call_UniffiForeignFutureCompleteRustBuffer(uniffiFutureCallback, uniffiCallbackData, res)
		}
	}()

	// Eval callback asynchroniously
	go func() {
		asyncResult := &C.UniffiForeignFutureStructRustBuffer{}
		uniffiOutReturn := &asyncResult.returnValue
		callStatus := &asyncResult.callStatus
		defer func() {
			result <- *asyncResult
		}()

		res, err :=
			uniffiObj.GetTransactionStatus(
				FfiConverterStringINSTANCE.Lift(GoRustBuffer{
					inner: txid,
				}),
			)

		if err != nil {
			var actualError *ChainServiceError
			if errors.As(err, &actualError) {
				if actualError != nil {
					*callStatus = C.RustCallStatus{
						code:     C.int8_t(uniffiCallbackResultError),
						errorBuf: FfiConverterChainServiceErrorINSTANCE.Lower(actualError),
					}
					return
				}
			} else {
				*callStatus = C.RustCallStatus{
					code: C.int8_t(uniffiCallbackUnexpectedResultError),
				}
				return
			}
		}

		*uniffiOutReturn = FfiConverterTxStatusINSTANCE.Lower(res)
	}()
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceBitcoinChainServiceMethod2
func breez_sdk_spark_cgo_dispatchCallbackInterfaceBitcoinChainServiceMethod2(uniffiHandle C.uint64_t, txid C.RustBuffer, uniffiFutureCallback C.UniffiForeignFutureCompleteRustBuffer, uniffiCallbackData C.uint64_t, uniffiOutReturn *C.UniffiForeignFuture) {
	handle := uint64(uniffiHandle)
	uniffiObj, ok := FfiConverterBitcoinChainServiceINSTANCE.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}

	result := make(chan C.UniffiForeignFutureStructRustBuffer, 1)
	cancel := make(chan struct{}, 1)
	guardHandle := cgo.NewHandle(cancel)
	*uniffiOutReturn = C.UniffiForeignFuture{
		handle: C.uint64_t(guardHandle),
		free:   C.UniffiForeignFutureFree(C.breez_sdk_spark_uniffiFreeGorutine),
	}

	// Wait for compleation or cancel
	go func() {
		select {
		case <-cancel:
		case res := <-result:
			C.call_UniffiForeignFutureCompleteRustBuffer(uniffiFutureCallback, uniffiCallbackData, res)
		}
	}()

	// Eval callback asynchroniously
	go func() {
		asyncResult := &C.UniffiForeignFutureStructRustBuffer{}
		uniffiOutReturn := &asyncResult.returnValue
		callStatus := &asyncResult.callStatus
		defer func() {
			result <- *asyncResult
		}()

		res, err :=
			uniffiObj.GetTransactionHex(
				FfiConverterStringINSTANCE.Lift(GoRustBuffer{
					inner: txid,
				}),
			)

		if err != nil {
			var actualError *ChainServiceError
			if errors.As(err, &actualError) {
				if actualError != nil {
					*callStatus = C.RustCallStatus{
						code:     C.int8_t(uniffiCallbackResultError),
						errorBuf: FfiConverterChainServiceErrorINSTANCE.Lower(actualError),
					}
					return
				}
			} else {
				*callStatus = C.RustCallStatus{
					code: C.int8_t(uniffiCallbackUnexpectedResultError),
				}
				return
			}
		}

		*uniffiOutReturn = FfiConverterStringINSTANCE.Lower(res)
	}()
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceBitcoinChainServiceMethod3
func breez_sdk_spark_cgo_dispatchCallbackInterfaceBitcoinChainServiceMethod3(uniffiHandle C.uint64_t, tx C.RustBuffer, uniffiFutureCallback C.UniffiForeignFutureCompleteVoid, uniffiCallbackData C.uint64_t, uniffiOutReturn *C.UniffiForeignFuture) {
	handle := uint64(uniffiHandle)
	uniffiObj, ok := FfiConverterBitcoinChainServiceINSTANCE.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}

	result := make(chan C.UniffiForeignFutureStructVoid, 1)
	cancel := make(chan struct{}, 1)
	guardHandle := cgo.NewHandle(cancel)
	*uniffiOutReturn = C.UniffiForeignFuture{
		handle: C.uint64_t(guardHandle),
		free:   C.UniffiForeignFutureFree(C.breez_sdk_spark_uniffiFreeGorutine),
	}

	// Wait for compleation or cancel
	go func() {
		select {
		case <-cancel:
		case res := <-result:
			C.call_UniffiForeignFutureCompleteVoid(uniffiFutureCallback, uniffiCallbackData, res)
		}
	}()

	// Eval callback asynchroniously
	go func() {
		asyncResult := &C.UniffiForeignFutureStructVoid{}
		callStatus := &asyncResult.callStatus
		defer func() {
			result <- *asyncResult
		}()

		err :=
			uniffiObj.BroadcastTransaction(
				FfiConverterStringINSTANCE.Lift(GoRustBuffer{
					inner: tx,
				}),
			)

		if err != nil {
			var actualError *ChainServiceError
			if errors.As(err, &actualError) {
				if actualError != nil {
					*callStatus = C.RustCallStatus{
						code:     C.int8_t(uniffiCallbackResultError),
						errorBuf: FfiConverterChainServiceErrorINSTANCE.Lower(actualError),
					}
					return
				}
			} else {
				*callStatus = C.RustCallStatus{
					code: C.int8_t(uniffiCallbackUnexpectedResultError),
				}
				return
			}
		}

	}()
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceBitcoinChainServiceMethod4
func breez_sdk_spark_cgo_dispatchCallbackInterfaceBitcoinChainServiceMethod4(uniffiHandle C.uint64_t, uniffiFutureCallback C.UniffiForeignFutureCompleteRustBuffer, uniffiCallbackData C.uint64_t, uniffiOutReturn *C.UniffiForeignFuture) {
	handle := uint64(uniffiHandle)
	uniffiObj, ok := FfiConverterBitcoinChainServiceINSTANCE.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}

	result := make(chan C.UniffiForeignFutureStructRustBuffer, 1)
	cancel := make(chan struct{}, 1)
	guardHandle := cgo.NewHandle(cancel)
	*uniffiOutReturn = C.UniffiForeignFuture{
		handle: C.uint64_t(guardHandle),
		free:   C.UniffiForeignFutureFree(C.breez_sdk_spark_uniffiFreeGorutine),
	}

	// Wait for compleation or cancel
	go func() {
		select {
		case <-cancel:
		case res := <-result:
			C.call_UniffiForeignFutureCompleteRustBuffer(uniffiFutureCallback, uniffiCallbackData, res)
		}
	}()

	// Eval callback asynchroniously
	go func() {
		asyncResult := &C.UniffiForeignFutureStructRustBuffer{}
		uniffiOutReturn := &asyncResult.returnValue
		callStatus := &asyncResult.callStatus
		defer func() {
			result <- *asyncResult
		}()

		res, err :=
			uniffiObj.RecommendedFees()

		if err != nil {
			var actualError *ChainServiceError
			if errors.As(err, &actualError) {
				if actualError != nil {
					*callStatus = C.RustCallStatus{
						code:     C.int8_t(uniffiCallbackResultError),
						errorBuf: FfiConverterChainServiceErrorINSTANCE.Lower(actualError),
					}
					return
				}
			} else {
				*callStatus = C.RustCallStatus{
					code: C.int8_t(uniffiCallbackUnexpectedResultError),
				}
				return
			}
		}

		*uniffiOutReturn = FfiConverterRecommendedFeesINSTANCE.Lower(res)
	}()
}

var UniffiVTableCallbackInterfaceBitcoinChainServiceINSTANCE = C.UniffiVTableCallbackInterfaceBitcoinChainService{
	getAddressUtxos:      (C.UniffiCallbackInterfaceBitcoinChainServiceMethod0)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceBitcoinChainServiceMethod0),
	getTransactionStatus: (C.UniffiCallbackInterfaceBitcoinChainServiceMethod1)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceBitcoinChainServiceMethod1),
	getTransactionHex:    (C.UniffiCallbackInterfaceBitcoinChainServiceMethod2)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceBitcoinChainServiceMethod2),
	broadcastTransaction: (C.UniffiCallbackInterfaceBitcoinChainServiceMethod3)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceBitcoinChainServiceMethod3),
	recommendedFees:      (C.UniffiCallbackInterfaceBitcoinChainServiceMethod4)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceBitcoinChainServiceMethod4),

	uniffiFree: (C.UniffiCallbackInterfaceFree)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceBitcoinChainServiceFree),
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceBitcoinChainServiceFree
func breez_sdk_spark_cgo_dispatchCallbackInterfaceBitcoinChainServiceFree(handle C.uint64_t) {
	FfiConverterBitcoinChainServiceINSTANCE.handleMap.remove(uint64(handle))
}

func (c FfiConverterBitcoinChainService) register() {
	C.uniffi_breez_sdk_spark_fn_init_callback_vtable_bitcoinchainservice(&UniffiVTableCallbackInterfaceBitcoinChainServiceINSTANCE)
}

// `BreezSDK` is a wrapper around `SparkSDK` that provides a more structured API
// with request/response objects and comprehensive error handling.
type BreezSdkInterface interface {
	// Adds a new contact.
	//
	// # Arguments
	//
	// * `request` - The request containing the contact details
	//
	// # Returns
	//
	// The created contact or an error
	AddContact(request AddContactRequest) (Contact, error)
	// Registers a listener to receive SDK events
	//
	// # Arguments
	//
	// * `listener` - An implementation of the `EventListener` trait
	//
	// # Returns
	//
	// A unique identifier for the listener, which can be used to remove it later
	AddEventListener(listener EventListener) string
	// Initiates a Bitcoin purchase flow via an external provider.
	//
	// Returns a URL the user should open to complete the purchase.
	// The request variant determines the provider and its parameters:
	//
	// - [`BuyBitcoinRequest::Moonpay`]: Fiat-to-Bitcoin via on-chain deposit.
	// - [`BuyBitcoinRequest::CashApp`]: Lightning invoice + `cash.app` deep link (mainnet only).
	BuyBitcoin(request BuyBitcoinRequest) (BuyBitcoinResponse, error)
	// Cancels the ongoing leaf optimization.
	//
	// This method cancels the ongoing optimization and waits for it to fully stop.
	// The current round will complete before stopping. This method blocks
	// until the optimization has fully stopped and leaves reserved for optimization
	// are available again.
	//
	// If no optimization is running, this method returns immediately.
	CancelLeafOptimization() error
	CheckLightningAddressAvailable(req CheckLightningAddressRequest) (bool, error)
	// Verifies a message signature against the provided public key. The message
	// is SHA256 hashed before verification. The signature can be hex encoded
	// in either DER or compact format.
	CheckMessage(request CheckMessageRequest) (CheckMessageResponse, error)
	ClaimDeposit(request ClaimDepositRequest) (ClaimDepositResponse, error)
	ClaimHtlcPayment(request ClaimHtlcPaymentRequest) (ClaimHtlcPaymentResponse, error)
	// Deletes a contact by its ID.
	//
	// # Arguments
	//
	// * `id` - The ID of the contact to delete
	//
	// # Returns
	//
	// Success or an error
	DeleteContact(id string) error
	DeleteLightningAddress() error
	// Stops the SDK's background tasks
	//
	// This method stops the background tasks started by the `start()` method.
	// It should be called before your application terminates to ensure proper cleanup.
	//
	// # Returns
	//
	// Result containing either success or an `SdkError` if the background task couldn't be stopped
	Disconnect() error
	FetchConversionLimits(request FetchConversionLimitsRequest) (FetchConversionLimitsResponse, error)
	// Returns the balance of the wallet in satoshis
	GetInfo(request GetInfoRequest) (GetInfoResponse, error)
	// Returns the current optimization progress snapshot.
	GetLeafOptimizationProgress() OptimizationProgress
	GetLightningAddress() (*LightningAddressInfo, error)
	GetPayment(request GetPaymentRequest) (GetPaymentResponse, error)
	// Returns an instance of the [`TokenIssuer`] for managing token issuance.
	GetTokenIssuer() *TokenIssuer
	// Returns the metadata for the given token identifiers.
	//
	// Results are not guaranteed to be in the same order as the input token identifiers.
	//
	// If the metadata is not found locally in cache, it will be queried from
	// the Spark network and then cached.
	GetTokensMetadata(request GetTokensMetadataRequest) (GetTokensMetadataResponse, error)
	// Returns the user settings for the wallet.
	//
	// Some settings are fetched from the Spark network so network requests are performed.
	GetUserSettings() (UserSettings, error)
	// Lists contacts with optional pagination.
	//
	// # Arguments
	//
	// * `request` - The request containing optional pagination parameters
	//
	// # Returns
	//
	// A list of contacts or an error
	ListContacts(request ListContactsRequest) ([]Contact, error)
	// List fiat currencies for which there is a known exchange rate,
	// sorted by the canonical name of the currency.
	ListFiatCurrencies() (ListFiatCurrenciesResponse, error)
	// List the latest rates of fiat currencies, sorted by name.
	ListFiatRates() (ListFiatRatesResponse, error)
	// Lists payments from the storage with pagination
	//
	// This method provides direct access to the payment history stored in the database.
	// It returns payments in reverse chronological order (newest first).
	//
	// # Arguments
	//
	// * `request` - Contains pagination parameters (offset and limit)
	//
	// # Returns
	//
	// * `Ok(ListPaymentsResponse)` - Contains the list of payments if successful
	// * `Err(SdkError)` - If there was an error accessing the storage
	ListPayments(request ListPaymentsRequest) (ListPaymentsResponse, error)
	ListUnclaimedDeposits(request ListUnclaimedDepositsRequest) (ListUnclaimedDepositsResponse, error)
	// Lists all webhooks currently registered for this wallet.
	//
	// # Returns
	//
	// A list of registered webhooks with their IDs, URLs, and subscribed event types
	ListWebhooks() ([]Webhook, error)
	// Performs LNURL-auth with the service.
	//
	// This method implements the LNURL-auth protocol as specified in LUD-04 and LUD-05.
	// It derives a domain-specific linking key, signs the challenge, and sends the
	// authentication request to the service.
	LnurlAuth(requestData LnurlAuthRequestDetails) (LnurlCallbackStatus, error)
	LnurlPay(request LnurlPayRequest) (LnurlPayResponse, error)
	// Performs an LNURL withdraw operation for the amount of satoshis to
	// withdraw and the LNURL withdraw request details. The LNURL withdraw request
	// details can be obtained from calling [`BreezSdk::parse`].
	//
	// The method generates a Lightning invoice for the withdraw amount, stores
	// the LNURL withdraw metadata, and performs the LNURL withdraw using  the generated
	// invoice.
	//
	// If the `completion_timeout_secs` parameter is provided and greater than 0, the
	// method will wait for the payment to be completed within that period. If the
	// withdraw is completed within the timeout, the `payment` field in the response
	// will be set with the payment details. If the `completion_timeout_secs`
	// parameter is not provided or set to 0, the method will not wait for the payment
	// to be completed. If the withdraw is not completed within the
	// timeout, the `payment` field will be empty.
	//
	// # Arguments
	//
	// * `request` - The LNURL withdraw request
	//
	// # Returns
	//
	// Result containing either:
	// * `LnurlWithdrawResponse` - The payment details if the withdraw request was successful
	// * `SdkError` - If there was an error during the withdraw process
	LnurlWithdraw(request LnurlWithdrawRequest) (LnurlWithdrawResponse, error)
	Parse(input string) (InputType, error)
	PrepareLnurlPay(request PrepareLnurlPayRequest) (PrepareLnurlPayResponse, error)
	PrepareSendPayment(request PrepareSendPaymentRequest) (PrepareSendPaymentResponse, error)
	ReceivePayment(request ReceivePaymentRequest) (ReceivePaymentResponse, error)
	// Get the recommended BTC fees based on the configured chain service.
	RecommendedFees() (RecommendedFees, error)
	RefundDeposit(request RefundDepositRequest) (RefundDepositResponse, error)
	RegisterLightningAddress(request RegisterLightningAddressRequest) (LightningAddressInfo, error)
	// Registers a webhook to receive notifications for wallet events.
	//
	// When registered events occur (e.g., a Lightning payment is received),
	// the Spark service provider will send an HTTP POST to the specified URL
	// with a payload signed using HMAC-SHA256 with the provided secret.
	//
	// # Arguments
	//
	// * `request` - The webhook registration details including URL, secret, and event types
	//
	// # Returns
	//
	// A response containing the unique identifier of the registered webhook
	RegisterWebhook(request RegisterWebhookRequest) (RegisterWebhookResponse, error)
	// Removes a previously registered event listener
	//
	// # Arguments
	//
	// * `id` - The listener ID returned from `add_event_listener`
	//
	// # Returns
	//
	// `true` if the listener was found and removed, `false` otherwise
	RemoveEventListener(id string) bool
	SendPayment(request SendPaymentRequest) (SendPaymentResponse, error)
	// Signs a message with the wallet's identity key. The message is SHA256
	// hashed before signing. The returned signature will be hex encoded in
	// DER format by default, or compact format if specified.
	SignMessage(request SignMessageRequest) (SignMessageResponse, error)
	// Starts leaf optimization in the background.
	//
	// This method spawns the optimization work in a background task and returns
	// immediately. Progress is reported via events.
	// If optimization is already running, no new task will be started.
	StartLeafOptimization()
	// Synchronizes the wallet with the Spark network
	SyncWallet(request SyncWalletRequest) (SyncWalletResponse, error)
	// Unregisters a previously registered webhook.
	//
	// After unregistering, the Spark service provider will no longer send
	// notifications to the webhook URL.
	//
	// # Arguments
	//
	// * `request` - The unregister request containing the webhook ID
	UnregisterWebhook(request UnregisterWebhookRequest) error
	// Updates an existing contact.
	//
	// # Arguments
	//
	// * `request` - The request containing the updated contact details
	//
	// # Returns
	//
	// The updated contact or an error
	UpdateContact(request UpdateContactRequest) (Contact, error)
	// Updates the user settings for the wallet.
	//
	// Some settings are updated on the Spark network so network requests may be performed.
	UpdateUserSettings(request UpdateUserSettingsRequest) error
}

// `BreezSDK` is a wrapper around `SparkSDK` that provides a more structured API
// with request/response objects and comprehensive error handling.
type BreezSdk struct {
	ffiObject FfiObject
}

// Adds a new contact.
//
// # Arguments
//
// * `request` - The request containing the contact details
//
// # Returns
//
// The created contact or an error
func (_self *BreezSdk) AddContact(request AddContactRequest) (Contact, error) {
	_pointer := _self.ffiObject.incrementPointer("*BreezSdk")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[SdkError](
		FfiConverterSdkErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) Contact {
			return FfiConverterContactINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_breezsdk_add_contact(
			_pointer, FfiConverterAddContactRequestINSTANCE.Lower(request)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// Registers a listener to receive SDK events
//
// # Arguments
//
// * `listener` - An implementation of the `EventListener` trait
//
// # Returns
//
// A unique identifier for the listener, which can be used to remove it later
func (_self *BreezSdk) AddEventListener(listener EventListener) string {
	_pointer := _self.ffiObject.incrementPointer("*BreezSdk")
	defer _self.ffiObject.decrementPointer()
	res, _ := uniffiRustCallAsync[error](
		nil,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) string {
			return FfiConverterStringINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_breezsdk_add_event_listener(
			_pointer, FfiConverterCallbackInterfaceEventListenerINSTANCE.Lower(listener)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	return res
}

// Initiates a Bitcoin purchase flow via an external provider.
//
// Returns a URL the user should open to complete the purchase.
// The request variant determines the provider and its parameters:
//
// - [`BuyBitcoinRequest::Moonpay`]: Fiat-to-Bitcoin via on-chain deposit.
// - [`BuyBitcoinRequest::CashApp`]: Lightning invoice + `cash.app` deep link (mainnet only).
func (_self *BreezSdk) BuyBitcoin(request BuyBitcoinRequest) (BuyBitcoinResponse, error) {
	_pointer := _self.ffiObject.incrementPointer("*BreezSdk")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[SdkError](
		FfiConverterSdkErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) BuyBitcoinResponse {
			return FfiConverterBuyBitcoinResponseINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_breezsdk_buy_bitcoin(
			_pointer, FfiConverterBuyBitcoinRequestINSTANCE.Lower(request)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// Cancels the ongoing leaf optimization.
//
// This method cancels the ongoing optimization and waits for it to fully stop.
// The current round will complete before stopping. This method blocks
// until the optimization has fully stopped and leaves reserved for optimization
// are available again.
//
// If no optimization is running, this method returns immediately.
func (_self *BreezSdk) CancelLeafOptimization() error {
	_pointer := _self.ffiObject.incrementPointer("*BreezSdk")
	defer _self.ffiObject.decrementPointer()
	_, err := uniffiRustCallAsync[SdkError](
		FfiConverterSdkErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) struct{} {
			C.ffi_breez_sdk_spark_rust_future_complete_void(handle, status)
			return struct{}{}
		},
		// liftFn
		func(_ struct{}) struct{} { return struct{}{} },
		C.uniffi_breez_sdk_spark_fn_method_breezsdk_cancel_leaf_optimization(
			_pointer),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_void(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_void(handle)
		},
	)

	if err == nil {
		return nil
	}

	return err
}

func (_self *BreezSdk) CheckLightningAddressAvailable(req CheckLightningAddressRequest) (bool, error) {
	_pointer := _self.ffiObject.incrementPointer("*BreezSdk")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[SdkError](
		FfiConverterSdkErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) C.int8_t {
			res := C.ffi_breez_sdk_spark_rust_future_complete_i8(handle, status)
			return res
		},
		// liftFn
		func(ffi C.int8_t) bool {
			return FfiConverterBoolINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_breezsdk_check_lightning_address_available(
			_pointer, FfiConverterCheckLightningAddressRequestINSTANCE.Lower(req)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_i8(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_i8(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// Verifies a message signature against the provided public key. The message
// is SHA256 hashed before verification. The signature can be hex encoded
// in either DER or compact format.
func (_self *BreezSdk) CheckMessage(request CheckMessageRequest) (CheckMessageResponse, error) {
	_pointer := _self.ffiObject.incrementPointer("*BreezSdk")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[SdkError](
		FfiConverterSdkErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) CheckMessageResponse {
			return FfiConverterCheckMessageResponseINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_breezsdk_check_message(
			_pointer, FfiConverterCheckMessageRequestINSTANCE.Lower(request)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

func (_self *BreezSdk) ClaimDeposit(request ClaimDepositRequest) (ClaimDepositResponse, error) {
	_pointer := _self.ffiObject.incrementPointer("*BreezSdk")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[SdkError](
		FfiConverterSdkErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) ClaimDepositResponse {
			return FfiConverterClaimDepositResponseINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_breezsdk_claim_deposit(
			_pointer, FfiConverterClaimDepositRequestINSTANCE.Lower(request)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

func (_self *BreezSdk) ClaimHtlcPayment(request ClaimHtlcPaymentRequest) (ClaimHtlcPaymentResponse, error) {
	_pointer := _self.ffiObject.incrementPointer("*BreezSdk")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[SdkError](
		FfiConverterSdkErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) ClaimHtlcPaymentResponse {
			return FfiConverterClaimHtlcPaymentResponseINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_breezsdk_claim_htlc_payment(
			_pointer, FfiConverterClaimHtlcPaymentRequestINSTANCE.Lower(request)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// Deletes a contact by its ID.
//
// # Arguments
//
// * `id` - The ID of the contact to delete
//
// # Returns
//
// Success or an error
func (_self *BreezSdk) DeleteContact(id string) error {
	_pointer := _self.ffiObject.incrementPointer("*BreezSdk")
	defer _self.ffiObject.decrementPointer()
	_, err := uniffiRustCallAsync[SdkError](
		FfiConverterSdkErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) struct{} {
			C.ffi_breez_sdk_spark_rust_future_complete_void(handle, status)
			return struct{}{}
		},
		// liftFn
		func(_ struct{}) struct{} { return struct{}{} },
		C.uniffi_breez_sdk_spark_fn_method_breezsdk_delete_contact(
			_pointer, FfiConverterStringINSTANCE.Lower(id)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_void(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_void(handle)
		},
	)

	if err == nil {
		return nil
	}

	return err
}

func (_self *BreezSdk) DeleteLightningAddress() error {
	_pointer := _self.ffiObject.incrementPointer("*BreezSdk")
	defer _self.ffiObject.decrementPointer()
	_, err := uniffiRustCallAsync[SdkError](
		FfiConverterSdkErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) struct{} {
			C.ffi_breez_sdk_spark_rust_future_complete_void(handle, status)
			return struct{}{}
		},
		// liftFn
		func(_ struct{}) struct{} { return struct{}{} },
		C.uniffi_breez_sdk_spark_fn_method_breezsdk_delete_lightning_address(
			_pointer),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_void(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_void(handle)
		},
	)

	if err == nil {
		return nil
	}

	return err
}

// Stops the SDK's background tasks
//
// This method stops the background tasks started by the `start()` method.
// It should be called before your application terminates to ensure proper cleanup.
//
// # Returns
//
// Result containing either success or an `SdkError` if the background task couldn't be stopped
func (_self *BreezSdk) Disconnect() error {
	_pointer := _self.ffiObject.incrementPointer("*BreezSdk")
	defer _self.ffiObject.decrementPointer()
	_, err := uniffiRustCallAsync[SdkError](
		FfiConverterSdkErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) struct{} {
			C.ffi_breez_sdk_spark_rust_future_complete_void(handle, status)
			return struct{}{}
		},
		// liftFn
		func(_ struct{}) struct{} { return struct{}{} },
		C.uniffi_breez_sdk_spark_fn_method_breezsdk_disconnect(
			_pointer),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_void(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_void(handle)
		},
	)

	if err == nil {
		return nil
	}

	return err
}

func (_self *BreezSdk) FetchConversionLimits(request FetchConversionLimitsRequest) (FetchConversionLimitsResponse, error) {
	_pointer := _self.ffiObject.incrementPointer("*BreezSdk")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[SdkError](
		FfiConverterSdkErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) FetchConversionLimitsResponse {
			return FfiConverterFetchConversionLimitsResponseINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_breezsdk_fetch_conversion_limits(
			_pointer, FfiConverterFetchConversionLimitsRequestINSTANCE.Lower(request)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// Returns the balance of the wallet in satoshis
func (_self *BreezSdk) GetInfo(request GetInfoRequest) (GetInfoResponse, error) {
	_pointer := _self.ffiObject.incrementPointer("*BreezSdk")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[SdkError](
		FfiConverterSdkErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) GetInfoResponse {
			return FfiConverterGetInfoResponseINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_breezsdk_get_info(
			_pointer, FfiConverterGetInfoRequestINSTANCE.Lower(request)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// Returns the current optimization progress snapshot.
func (_self *BreezSdk) GetLeafOptimizationProgress() OptimizationProgress {
	_pointer := _self.ffiObject.incrementPointer("*BreezSdk")
	defer _self.ffiObject.decrementPointer()
	return FfiConverterOptimizationProgressINSTANCE.Lift(rustCall(func(_uniffiStatus *C.RustCallStatus) RustBufferI {
		return GoRustBuffer{
			inner: C.uniffi_breez_sdk_spark_fn_method_breezsdk_get_leaf_optimization_progress(
				_pointer, _uniffiStatus),
		}
	}))
}

func (_self *BreezSdk) GetLightningAddress() (*LightningAddressInfo, error) {
	_pointer := _self.ffiObject.incrementPointer("*BreezSdk")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[SdkError](
		FfiConverterSdkErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) *LightningAddressInfo {
			return FfiConverterOptionalLightningAddressInfoINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_breezsdk_get_lightning_address(
			_pointer),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

func (_self *BreezSdk) GetPayment(request GetPaymentRequest) (GetPaymentResponse, error) {
	_pointer := _self.ffiObject.incrementPointer("*BreezSdk")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[SdkError](
		FfiConverterSdkErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) GetPaymentResponse {
			return FfiConverterGetPaymentResponseINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_breezsdk_get_payment(
			_pointer, FfiConverterGetPaymentRequestINSTANCE.Lower(request)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// Returns an instance of the [`TokenIssuer`] for managing token issuance.
func (_self *BreezSdk) GetTokenIssuer() *TokenIssuer {
	_pointer := _self.ffiObject.incrementPointer("*BreezSdk")
	defer _self.ffiObject.decrementPointer()
	return FfiConverterTokenIssuerINSTANCE.Lift(rustCall(func(_uniffiStatus *C.RustCallStatus) unsafe.Pointer {
		return C.uniffi_breez_sdk_spark_fn_method_breezsdk_get_token_issuer(
			_pointer, _uniffiStatus)
	}))
}

// Returns the metadata for the given token identifiers.
//
// Results are not guaranteed to be in the same order as the input token identifiers.
//
// If the metadata is not found locally in cache, it will be queried from
// the Spark network and then cached.
func (_self *BreezSdk) GetTokensMetadata(request GetTokensMetadataRequest) (GetTokensMetadataResponse, error) {
	_pointer := _self.ffiObject.incrementPointer("*BreezSdk")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[SdkError](
		FfiConverterSdkErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) GetTokensMetadataResponse {
			return FfiConverterGetTokensMetadataResponseINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_breezsdk_get_tokens_metadata(
			_pointer, FfiConverterGetTokensMetadataRequestINSTANCE.Lower(request)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// Returns the user settings for the wallet.
//
// Some settings are fetched from the Spark network so network requests are performed.
func (_self *BreezSdk) GetUserSettings() (UserSettings, error) {
	_pointer := _self.ffiObject.incrementPointer("*BreezSdk")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[SdkError](
		FfiConverterSdkErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) UserSettings {
			return FfiConverterUserSettingsINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_breezsdk_get_user_settings(
			_pointer),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// Lists contacts with optional pagination.
//
// # Arguments
//
// * `request` - The request containing optional pagination parameters
//
// # Returns
//
// A list of contacts or an error
func (_self *BreezSdk) ListContacts(request ListContactsRequest) ([]Contact, error) {
	_pointer := _self.ffiObject.incrementPointer("*BreezSdk")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[SdkError](
		FfiConverterSdkErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) []Contact {
			return FfiConverterSequenceContactINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_breezsdk_list_contacts(
			_pointer, FfiConverterListContactsRequestINSTANCE.Lower(request)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// List fiat currencies for which there is a known exchange rate,
// sorted by the canonical name of the currency.
func (_self *BreezSdk) ListFiatCurrencies() (ListFiatCurrenciesResponse, error) {
	_pointer := _self.ffiObject.incrementPointer("*BreezSdk")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[SdkError](
		FfiConverterSdkErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) ListFiatCurrenciesResponse {
			return FfiConverterListFiatCurrenciesResponseINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_breezsdk_list_fiat_currencies(
			_pointer),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// List the latest rates of fiat currencies, sorted by name.
func (_self *BreezSdk) ListFiatRates() (ListFiatRatesResponse, error) {
	_pointer := _self.ffiObject.incrementPointer("*BreezSdk")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[SdkError](
		FfiConverterSdkErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) ListFiatRatesResponse {
			return FfiConverterListFiatRatesResponseINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_breezsdk_list_fiat_rates(
			_pointer),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// Lists payments from the storage with pagination
//
// This method provides direct access to the payment history stored in the database.
// It returns payments in reverse chronological order (newest first).
//
// # Arguments
//
// * `request` - Contains pagination parameters (offset and limit)
//
// # Returns
//
// * `Ok(ListPaymentsResponse)` - Contains the list of payments if successful
// * `Err(SdkError)` - If there was an error accessing the storage
func (_self *BreezSdk) ListPayments(request ListPaymentsRequest) (ListPaymentsResponse, error) {
	_pointer := _self.ffiObject.incrementPointer("*BreezSdk")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[SdkError](
		FfiConverterSdkErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) ListPaymentsResponse {
			return FfiConverterListPaymentsResponseINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_breezsdk_list_payments(
			_pointer, FfiConverterListPaymentsRequestINSTANCE.Lower(request)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

func (_self *BreezSdk) ListUnclaimedDeposits(request ListUnclaimedDepositsRequest) (ListUnclaimedDepositsResponse, error) {
	_pointer := _self.ffiObject.incrementPointer("*BreezSdk")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[SdkError](
		FfiConverterSdkErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) ListUnclaimedDepositsResponse {
			return FfiConverterListUnclaimedDepositsResponseINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_breezsdk_list_unclaimed_deposits(
			_pointer, FfiConverterListUnclaimedDepositsRequestINSTANCE.Lower(request)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// Lists all webhooks currently registered for this wallet.
//
// # Returns
//
// A list of registered webhooks with their IDs, URLs, and subscribed event types
func (_self *BreezSdk) ListWebhooks() ([]Webhook, error) {
	_pointer := _self.ffiObject.incrementPointer("*BreezSdk")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[SdkError](
		FfiConverterSdkErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) []Webhook {
			return FfiConverterSequenceWebhookINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_breezsdk_list_webhooks(
			_pointer),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// Performs LNURL-auth with the service.
//
// This method implements the LNURL-auth protocol as specified in LUD-04 and LUD-05.
// It derives a domain-specific linking key, signs the challenge, and sends the
// authentication request to the service.
func (_self *BreezSdk) LnurlAuth(requestData LnurlAuthRequestDetails) (LnurlCallbackStatus, error) {
	_pointer := _self.ffiObject.incrementPointer("*BreezSdk")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[SdkError](
		FfiConverterSdkErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) LnurlCallbackStatus {
			return FfiConverterLnurlCallbackStatusINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_breezsdk_lnurl_auth(
			_pointer, FfiConverterLnurlAuthRequestDetailsINSTANCE.Lower(requestData)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

func (_self *BreezSdk) LnurlPay(request LnurlPayRequest) (LnurlPayResponse, error) {
	_pointer := _self.ffiObject.incrementPointer("*BreezSdk")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[SdkError](
		FfiConverterSdkErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) LnurlPayResponse {
			return FfiConverterLnurlPayResponseINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_breezsdk_lnurl_pay(
			_pointer, FfiConverterLnurlPayRequestINSTANCE.Lower(request)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// Performs an LNURL withdraw operation for the amount of satoshis to
// withdraw and the LNURL withdraw request details. The LNURL withdraw request
// details can be obtained from calling [`BreezSdk::parse`].
//
// The method generates a Lightning invoice for the withdraw amount, stores
// the LNURL withdraw metadata, and performs the LNURL withdraw using  the generated
// invoice.
//
// If the `completion_timeout_secs` parameter is provided and greater than 0, the
// method will wait for the payment to be completed within that period. If the
// withdraw is completed within the timeout, the `payment` field in the response
// will be set with the payment details. If the `completion_timeout_secs`
// parameter is not provided or set to 0, the method will not wait for the payment
// to be completed. If the withdraw is not completed within the
// timeout, the `payment` field will be empty.
//
// # Arguments
//
// * `request` - The LNURL withdraw request
//
// # Returns
//
// Result containing either:
// * `LnurlWithdrawResponse` - The payment details if the withdraw request was successful
// * `SdkError` - If there was an error during the withdraw process
func (_self *BreezSdk) LnurlWithdraw(request LnurlWithdrawRequest) (LnurlWithdrawResponse, error) {
	_pointer := _self.ffiObject.incrementPointer("*BreezSdk")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[SdkError](
		FfiConverterSdkErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) LnurlWithdrawResponse {
			return FfiConverterLnurlWithdrawResponseINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_breezsdk_lnurl_withdraw(
			_pointer, FfiConverterLnurlWithdrawRequestINSTANCE.Lower(request)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

func (_self *BreezSdk) Parse(input string) (InputType, error) {
	_pointer := _self.ffiObject.incrementPointer("*BreezSdk")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[SdkError](
		FfiConverterSdkErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) InputType {
			return FfiConverterInputTypeINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_breezsdk_parse(
			_pointer, FfiConverterStringINSTANCE.Lower(input)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

func (_self *BreezSdk) PrepareLnurlPay(request PrepareLnurlPayRequest) (PrepareLnurlPayResponse, error) {
	_pointer := _self.ffiObject.incrementPointer("*BreezSdk")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[SdkError](
		FfiConverterSdkErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) PrepareLnurlPayResponse {
			return FfiConverterPrepareLnurlPayResponseINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_breezsdk_prepare_lnurl_pay(
			_pointer, FfiConverterPrepareLnurlPayRequestINSTANCE.Lower(request)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

func (_self *BreezSdk) PrepareSendPayment(request PrepareSendPaymentRequest) (PrepareSendPaymentResponse, error) {
	_pointer := _self.ffiObject.incrementPointer("*BreezSdk")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[SdkError](
		FfiConverterSdkErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) PrepareSendPaymentResponse {
			return FfiConverterPrepareSendPaymentResponseINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_breezsdk_prepare_send_payment(
			_pointer, FfiConverterPrepareSendPaymentRequestINSTANCE.Lower(request)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

func (_self *BreezSdk) ReceivePayment(request ReceivePaymentRequest) (ReceivePaymentResponse, error) {
	_pointer := _self.ffiObject.incrementPointer("*BreezSdk")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[SdkError](
		FfiConverterSdkErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) ReceivePaymentResponse {
			return FfiConverterReceivePaymentResponseINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_breezsdk_receive_payment(
			_pointer, FfiConverterReceivePaymentRequestINSTANCE.Lower(request)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// Get the recommended BTC fees based on the configured chain service.
func (_self *BreezSdk) RecommendedFees() (RecommendedFees, error) {
	_pointer := _self.ffiObject.incrementPointer("*BreezSdk")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[SdkError](
		FfiConverterSdkErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) RecommendedFees {
			return FfiConverterRecommendedFeesINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_breezsdk_recommended_fees(
			_pointer),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

func (_self *BreezSdk) RefundDeposit(request RefundDepositRequest) (RefundDepositResponse, error) {
	_pointer := _self.ffiObject.incrementPointer("*BreezSdk")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[SdkError](
		FfiConverterSdkErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) RefundDepositResponse {
			return FfiConverterRefundDepositResponseINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_breezsdk_refund_deposit(
			_pointer, FfiConverterRefundDepositRequestINSTANCE.Lower(request)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

func (_self *BreezSdk) RegisterLightningAddress(request RegisterLightningAddressRequest) (LightningAddressInfo, error) {
	_pointer := _self.ffiObject.incrementPointer("*BreezSdk")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[SdkError](
		FfiConverterSdkErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) LightningAddressInfo {
			return FfiConverterLightningAddressInfoINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_breezsdk_register_lightning_address(
			_pointer, FfiConverterRegisterLightningAddressRequestINSTANCE.Lower(request)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// Registers a webhook to receive notifications for wallet events.
//
// When registered events occur (e.g., a Lightning payment is received),
// the Spark service provider will send an HTTP POST to the specified URL
// with a payload signed using HMAC-SHA256 with the provided secret.
//
// # Arguments
//
// * `request` - The webhook registration details including URL, secret, and event types
//
// # Returns
//
// A response containing the unique identifier of the registered webhook
func (_self *BreezSdk) RegisterWebhook(request RegisterWebhookRequest) (RegisterWebhookResponse, error) {
	_pointer := _self.ffiObject.incrementPointer("*BreezSdk")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[SdkError](
		FfiConverterSdkErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) RegisterWebhookResponse {
			return FfiConverterRegisterWebhookResponseINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_breezsdk_register_webhook(
			_pointer, FfiConverterRegisterWebhookRequestINSTANCE.Lower(request)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// Removes a previously registered event listener
//
// # Arguments
//
// * `id` - The listener ID returned from `add_event_listener`
//
// # Returns
//
// `true` if the listener was found and removed, `false` otherwise
func (_self *BreezSdk) RemoveEventListener(id string) bool {
	_pointer := _self.ffiObject.incrementPointer("*BreezSdk")
	defer _self.ffiObject.decrementPointer()
	res, _ := uniffiRustCallAsync[error](
		nil,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) C.int8_t {
			res := C.ffi_breez_sdk_spark_rust_future_complete_i8(handle, status)
			return res
		},
		// liftFn
		func(ffi C.int8_t) bool {
			return FfiConverterBoolINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_breezsdk_remove_event_listener(
			_pointer, FfiConverterStringINSTANCE.Lower(id)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_i8(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_i8(handle)
		},
	)

	return res
}

func (_self *BreezSdk) SendPayment(request SendPaymentRequest) (SendPaymentResponse, error) {
	_pointer := _self.ffiObject.incrementPointer("*BreezSdk")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[SdkError](
		FfiConverterSdkErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) SendPaymentResponse {
			return FfiConverterSendPaymentResponseINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_breezsdk_send_payment(
			_pointer, FfiConverterSendPaymentRequestINSTANCE.Lower(request)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// Signs a message with the wallet's identity key. The message is SHA256
// hashed before signing. The returned signature will be hex encoded in
// DER format by default, or compact format if specified.
func (_self *BreezSdk) SignMessage(request SignMessageRequest) (SignMessageResponse, error) {
	_pointer := _self.ffiObject.incrementPointer("*BreezSdk")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[SdkError](
		FfiConverterSdkErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) SignMessageResponse {
			return FfiConverterSignMessageResponseINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_breezsdk_sign_message(
			_pointer, FfiConverterSignMessageRequestINSTANCE.Lower(request)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// Starts leaf optimization in the background.
//
// This method spawns the optimization work in a background task and returns
// immediately. Progress is reported via events.
// If optimization is already running, no new task will be started.
func (_self *BreezSdk) StartLeafOptimization() {
	_pointer := _self.ffiObject.incrementPointer("*BreezSdk")
	defer _self.ffiObject.decrementPointer()
	uniffiRustCallAsync[error](
		nil,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) struct{} {
			C.ffi_breez_sdk_spark_rust_future_complete_void(handle, status)
			return struct{}{}
		},
		// liftFn
		func(_ struct{}) struct{} { return struct{}{} },
		C.uniffi_breez_sdk_spark_fn_method_breezsdk_start_leaf_optimization(
			_pointer),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_void(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_void(handle)
		},
	)

}

// Synchronizes the wallet with the Spark network
func (_self *BreezSdk) SyncWallet(request SyncWalletRequest) (SyncWalletResponse, error) {
	_pointer := _self.ffiObject.incrementPointer("*BreezSdk")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[SdkError](
		FfiConverterSdkErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) SyncWalletResponse {
			return FfiConverterSyncWalletResponseINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_breezsdk_sync_wallet(
			_pointer, FfiConverterSyncWalletRequestINSTANCE.Lower(request)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// Unregisters a previously registered webhook.
//
// After unregistering, the Spark service provider will no longer send
// notifications to the webhook URL.
//
// # Arguments
//
// * `request` - The unregister request containing the webhook ID
func (_self *BreezSdk) UnregisterWebhook(request UnregisterWebhookRequest) error {
	_pointer := _self.ffiObject.incrementPointer("*BreezSdk")
	defer _self.ffiObject.decrementPointer()
	_, err := uniffiRustCallAsync[SdkError](
		FfiConverterSdkErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) struct{} {
			C.ffi_breez_sdk_spark_rust_future_complete_void(handle, status)
			return struct{}{}
		},
		// liftFn
		func(_ struct{}) struct{} { return struct{}{} },
		C.uniffi_breez_sdk_spark_fn_method_breezsdk_unregister_webhook(
			_pointer, FfiConverterUnregisterWebhookRequestINSTANCE.Lower(request)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_void(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_void(handle)
		},
	)

	if err == nil {
		return nil
	}

	return err
}

// Updates an existing contact.
//
// # Arguments
//
// * `request` - The request containing the updated contact details
//
// # Returns
//
// The updated contact or an error
func (_self *BreezSdk) UpdateContact(request UpdateContactRequest) (Contact, error) {
	_pointer := _self.ffiObject.incrementPointer("*BreezSdk")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[SdkError](
		FfiConverterSdkErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) Contact {
			return FfiConverterContactINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_breezsdk_update_contact(
			_pointer, FfiConverterUpdateContactRequestINSTANCE.Lower(request)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// Updates the user settings for the wallet.
//
// Some settings are updated on the Spark network so network requests may be performed.
func (_self *BreezSdk) UpdateUserSettings(request UpdateUserSettingsRequest) error {
	_pointer := _self.ffiObject.incrementPointer("*BreezSdk")
	defer _self.ffiObject.decrementPointer()
	_, err := uniffiRustCallAsync[SdkError](
		FfiConverterSdkErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) struct{} {
			C.ffi_breez_sdk_spark_rust_future_complete_void(handle, status)
			return struct{}{}
		},
		// liftFn
		func(_ struct{}) struct{} { return struct{}{} },
		C.uniffi_breez_sdk_spark_fn_method_breezsdk_update_user_settings(
			_pointer, FfiConverterUpdateUserSettingsRequestINSTANCE.Lower(request)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_void(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_void(handle)
		},
	)

	if err == nil {
		return nil
	}

	return err
}
func (object *BreezSdk) Destroy() {
	runtime.SetFinalizer(object, nil)
	object.ffiObject.destroy()
}

type FfiConverterBreezSdk struct{}

var FfiConverterBreezSdkINSTANCE = FfiConverterBreezSdk{}

func (c FfiConverterBreezSdk) Lift(pointer unsafe.Pointer) *BreezSdk {
	result := &BreezSdk{
		newFfiObject(
			pointer,
			func(pointer unsafe.Pointer, status *C.RustCallStatus) unsafe.Pointer {
				return C.uniffi_breez_sdk_spark_fn_clone_breezsdk(pointer, status)
			},
			func(pointer unsafe.Pointer, status *C.RustCallStatus) {
				C.uniffi_breez_sdk_spark_fn_free_breezsdk(pointer, status)
			},
		),
	}
	runtime.SetFinalizer(result, (*BreezSdk).Destroy)
	return result
}

func (c FfiConverterBreezSdk) Read(reader io.Reader) *BreezSdk {
	return c.Lift(unsafe.Pointer(uintptr(readUint64(reader))))
}

func (c FfiConverterBreezSdk) Lower(value *BreezSdk) unsafe.Pointer {
	// TODO: this is bad - all synchronization from ObjectRuntime.go is discarded here,
	// because the pointer will be decremented immediately after this function returns,
	// and someone will be left holding onto a non-locked pointer.
	pointer := value.ffiObject.incrementPointer("*BreezSdk")
	defer value.ffiObject.decrementPointer()
	return pointer

}

func (c FfiConverterBreezSdk) Write(writer io.Writer, value *BreezSdk) {
	writeUint64(writer, uint64(uintptr(c.Lower(value))))
}

type FfiDestroyerBreezSdk struct{}

func (_ FfiDestroyerBreezSdk) Destroy(value *BreezSdk) {
	value.Destroy()
}

// External signer trait that can be implemented by users and passed to the SDK.
//
// This trait mirrors the `BreezSigner` trait but uses FFI-compatible types (bytes, strings)
// instead of Rust-specific types. This allows it to be exposed through FFI and WASM bindings.
//
// All methods accept and return simple types:
// - Derivation paths as strings (e.g., "m/44'/0'/0'")
// - Public keys, signatures, and other crypto primitives as Vec<u8>
// - Spark-specific types as serialized representations
//
// Errors are returned as `SignerError` for FFI compatibility.
type ExternalSigner interface {
	// Returns the identity public key as 33 bytes (compressed secp256k1 key).
	//
	// See also: [JavaScript `getIdentityPublicKey`](https://docs.spark.money/wallets/spark-signer#get-identity-public-key)
	IdentityPublicKey() (PublicKeyBytes, error)
	// Derives a public key for the given BIP32 derivation path.
	//
	// # Arguments
	// * `path` - BIP32 derivation path as a string (e.g., "m/44'/0'/0'/0/0")
	//
	// # Returns
	// The derived public key as 33 bytes, or a `SignerError`
	//
	// See also: [JavaScript `getPublicKeyFromDerivation`](https://docs.spark.money/wallets/spark-signer#get-public-key-from-derivation)
	DerivePublicKey(path string) (PublicKeyBytes, error)
	// Signs a message using ECDSA at the given derivation path.
	//
	// The message should be a 32-byte digest (typically a hash of the original data).
	//
	// # Arguments
	// * `message` - The 32-byte message digest to sign
	// * `path` - BIP32 derivation path as a string
	//
	// # Returns
	// 64-byte compact ECDSA signature, or a `SignerError`
	SignEcdsa(message MessageBytes, path string) (EcdsaSignatureBytes, error)
	// Signs a message using recoverable ECDSA at the given derivation path.
	//
	// The message should be a 32-byte digest (typically a hash of the original data).
	//
	// # Arguments
	// * `message` - The 32-byte message digest to sign
	// * `path` - BIP32 derivation path as a string
	//
	// # Returns
	// 65 bytes: recovery ID (31 + `recovery_id`) + 64-byte signature, or a `SignerError`
	SignEcdsaRecoverable(message MessageBytes, path string) (RecoverableEcdsaSignatureBytes, error)
	// Encrypts a message using ECIES at the given derivation path.
	//
	// # Arguments
	// * `message` - The message to encrypt
	// * `path` - BIP32 derivation path for the encryption key
	//
	// # Returns
	// Encrypted data, or a `SignerError`
	EncryptEcies(message []byte, path string) ([]byte, error)
	// Decrypts a message using ECIES at the given derivation path.
	//
	// # Arguments
	// * `message` - The encrypted message
	// * `path` - BIP32 derivation path for the decryption key
	//
	// # Returns
	// Decrypted data, or a `SignerError`
	//
	// See also: [JavaScript `decryptEcies`](https://docs.spark.money/wallets/spark-signer#decrypt-ecies)
	DecryptEcies(message []byte, path string) ([]byte, error)
	// Signs a hash using Schnorr signature at the given derivation path.
	//
	// # Arguments
	// * `hash` - The 32-byte hash to sign (must be 32 bytes)
	// * `path` - BIP32 derivation path as a string
	//
	// # Returns
	// 64-byte Schnorr signature, or a `SignerError`
	SignHashSchnorr(hash []byte, path string) (SchnorrSignatureBytes, error)
	// HMAC-SHA256 of a message at the given derivation path.
	//
	// # Arguments
	// * `message` - The message to hash
	// * `path` - BIP32 derivation path as a string
	//
	// # Returns
	// 32-byte HMAC-SHA256, or a `SignerError`
	//
	// See also: [JavaScript `htlcHMAC`](https://docs.spark.money/wallets/spark-signer#generate-htlc-hmac)
	HmacSha256(message []byte, path string) (HashedMessageBytes, error)
	// Generates Frost signing commitments for multi-party signing.
	//
	// # Returns
	// Frost commitments with nonces, or a `SignerError`
	//
	// See also: [JavaScript `getRandomSigningCommitment`](https://docs.spark.money/wallets/spark-signer#get-random-signing-commitment)
	GenerateRandomSigningCommitment() (ExternalFrostCommitments, error)
	// Gets the public key for a specific tree node in the Spark wallet.
	//
	// # Arguments
	// * `id` - The tree node identifier
	//
	// # Returns
	// The public key for the node, or a `SignerError`
	GetPublicKeyForNode(id ExternalTreeNodeId) (PublicKeyBytes, error)
	// Generates a random secret that is encrypted and known only to the signer.
	//
	// This method creates a new random secret and returns it in encrypted form.
	// The plaintext secret never leaves the signer boundary, providing a secure way
	// to create secrets that can be referenced in subsequent operations without
	// exposing them.
	//
	// This is conceptually similar to Spark's key derivation system where secrets
	// are represented by opaque references (like tree node IDs or Random) rather than raw values.
	// The encrypted secret can be passed to other signer methods that need to operate
	// on it, while keeping the actual secret material protected within the signer.
	//
	// # Returns
	// An encrypted secret that can be used in subsequent signer operations,
	// or a `SignerError` if generation fails.
	//
	// See also: [Key Derivation System](https://docs.spark.money/wallets/spark-signer#the-keyderivation-system)
	GenerateRandomSecret() (ExternalEncryptedSecret, error)
	// Gets an encrypted static deposit secret by index.
	//
	// # Arguments
	// * `index` - The index of the static deposit secret
	//
	// # Returns
	// The encrypted secret, or a `SignerError`
	//
	// This is the encrypted version of: [JavaScript `getStaticDepositSecretKey`](https://docs.spark.money/wallets/spark-signer#get-static-deposit-secret-key)
	StaticDepositSecretEncrypted(index uint32) (ExternalSecretSource, error)
	// Gets a static deposit secret by index.
	//
	// # Arguments
	// * `index` - The index of the static deposit secret
	//
	// # Returns
	// The 32-byte secret, or a `SignerError`
	//
	// See also: [JavaScript `getStaticDepositSecretKey`](https://docs.spark.money/wallets/spark-signer#get-static-deposit-secret-key)
	StaticDepositSecret(index uint32) (SecretBytes, error)
	// Gets a static deposit signing public key by index.
	//
	// # Arguments
	// * `index` - The index of the static deposit public signing key
	//
	// # Returns
	// The 33-byte public key, or a `SignerError`
	//
	// See also: [JavaScript `getStaticDepositSigningKey`](https://docs.spark.money/wallets/spark-signer#get-static-deposit-signing-key)
	StaticDepositSigningKey(index uint32) (PublicKeyBytes, error)
	// Subtracts one secret from another.
	//
	// This is a lower-level primitive used as part of key tweaking operations.
	//
	// # Arguments
	// * `signing_key` - The first secret
	// * `new_signing_key` - The second secret to subtract
	//
	// # Returns
	// The resulting secret, or a `SignerError`
	//
	// See also: [JavaScript `subtractSplitAndEncrypt`](https://docs.spark.money/wallets/spark-signer#subtract,-split,-and-encrypt)
	// (this method provides the subtraction step of that higher-level operation)
	SubtractSecrets(signingKey ExternalSecretSource, newSigningKey ExternalSecretSource) (ExternalSecretSource, error)
	// Splits a secret with proofs using Shamir's Secret Sharing.
	//
	// # Arguments
	// * `secret` - The secret to split
	// * `threshold` - Minimum number of shares needed to reconstruct
	// * `num_shares` - Total number of shares to create
	//
	// # Returns
	// Vector of verifiable secret shares, or a `SignerError`
	//
	// See also: [JavaScript `splitSecretWithProofs`](https://docs.spark.money/wallets/spark-signer#split-secret-with-proofs)
	SplitSecretWithProofs(secret ExternalSecretToSplit, threshold uint32, numShares uint32) ([]ExternalVerifiableSecretShare, error)
	// Encrypts a secret for a specific receiver's public key.
	//
	// # Arguments
	// * `encrypted_secret` - The encrypted secret to re-encrypt
	// * `receiver_public_key` - The receiver's 33-byte public key
	//
	// # Returns
	// Encrypted data for the receiver, or a `SignerError`
	EncryptSecretForReceiver(encryptedSecret ExternalEncryptedSecret, receiverPublicKey PublicKeyBytes) ([]byte, error)
	// Gets the public key from a secret.
	//
	// # Arguments
	// * `secret` - The secret
	//
	// # Returns
	// The corresponding 33-byte public key, or a `SignerError`
	//
	// See also: [JavaScript `getPublicKeyFromDerivation`](https://docs.spark.money/wallets/spark-signer#get-public-key-from-derivation)
	PublicKeyFromSecret(secret ExternalSecretSource) (PublicKeyBytes, error)
	// Signs using Frost protocol (multi-party signing).
	//
	// # Arguments
	// * `request` - The Frost signing request
	//
	// # Returns
	// A signature share, or a `SignerError`
	//
	// See also: [JavaScript `signFrost`](https://docs.spark.money/wallets/spark-signer#frost-signing)
	SignFrost(request ExternalSignFrostRequest) (ExternalFrostSignatureShare, error)
	// Aggregates Frost signature shares into a final signature.
	//
	// # Arguments
	// * `request` - The Frost aggregation request
	//
	// # Returns
	// The aggregated Frost signature, or a `SignerError`
	//
	// See also: [JavaScript `aggregateFrost`](https://docs.spark.money/wallets/spark-signer#aggregate-frost-signatures)
	AggregateFrost(request ExternalAggregateFrostRequest) (ExternalFrostSignature, error)
}

// External signer trait that can be implemented by users and passed to the SDK.
//
// This trait mirrors the `BreezSigner` trait but uses FFI-compatible types (bytes, strings)
// instead of Rust-specific types. This allows it to be exposed through FFI and WASM bindings.
//
// All methods accept and return simple types:
// - Derivation paths as strings (e.g., "m/44'/0'/0'")
// - Public keys, signatures, and other crypto primitives as Vec<u8>
// - Spark-specific types as serialized representations
//
// Errors are returned as `SignerError` for FFI compatibility.
type ExternalSignerImpl struct {
	ffiObject FfiObject
}

// Returns the identity public key as 33 bytes (compressed secp256k1 key).
//
// See also: [JavaScript `getIdentityPublicKey`](https://docs.spark.money/wallets/spark-signer#get-identity-public-key)
func (_self *ExternalSignerImpl) IdentityPublicKey() (PublicKeyBytes, error) {
	_pointer := _self.ffiObject.incrementPointer("ExternalSigner")
	defer _self.ffiObject.decrementPointer()
	_uniffiRV, _uniffiErr := rustCallWithError[SignerError](FfiConverterSignerError{}, func(_uniffiStatus *C.RustCallStatus) RustBufferI {
		return GoRustBuffer{
			inner: C.uniffi_breez_sdk_spark_fn_method_externalsigner_identity_public_key(
				_pointer, _uniffiStatus),
		}
	})
	if _uniffiErr != nil {
		var _uniffiDefaultValue PublicKeyBytes
		return _uniffiDefaultValue, _uniffiErr
	} else {
		return FfiConverterPublicKeyBytesINSTANCE.Lift(_uniffiRV), nil
	}
}

// Derives a public key for the given BIP32 derivation path.
//
// # Arguments
// * `path` - BIP32 derivation path as a string (e.g., "m/44'/0'/0'/0/0")
//
// # Returns
// The derived public key as 33 bytes, or a `SignerError`
//
// See also: [JavaScript `getPublicKeyFromDerivation`](https://docs.spark.money/wallets/spark-signer#get-public-key-from-derivation)
func (_self *ExternalSignerImpl) DerivePublicKey(path string) (PublicKeyBytes, error) {
	_pointer := _self.ffiObject.incrementPointer("ExternalSigner")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[SignerError](
		FfiConverterSignerErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) PublicKeyBytes {
			return FfiConverterPublicKeyBytesINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_externalsigner_derive_public_key(
			_pointer, FfiConverterStringINSTANCE.Lower(path)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// Signs a message using ECDSA at the given derivation path.
//
// The message should be a 32-byte digest (typically a hash of the original data).
//
// # Arguments
// * `message` - The 32-byte message digest to sign
// * `path` - BIP32 derivation path as a string
//
// # Returns
// 64-byte compact ECDSA signature, or a `SignerError`
func (_self *ExternalSignerImpl) SignEcdsa(message MessageBytes, path string) (EcdsaSignatureBytes, error) {
	_pointer := _self.ffiObject.incrementPointer("ExternalSigner")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[SignerError](
		FfiConverterSignerErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) EcdsaSignatureBytes {
			return FfiConverterEcdsaSignatureBytesINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_externalsigner_sign_ecdsa(
			_pointer, FfiConverterMessageBytesINSTANCE.Lower(message), FfiConverterStringINSTANCE.Lower(path)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// Signs a message using recoverable ECDSA at the given derivation path.
//
// The message should be a 32-byte digest (typically a hash of the original data).
//
// # Arguments
// * `message` - The 32-byte message digest to sign
// * `path` - BIP32 derivation path as a string
//
// # Returns
// 65 bytes: recovery ID (31 + `recovery_id`) + 64-byte signature, or a `SignerError`
func (_self *ExternalSignerImpl) SignEcdsaRecoverable(message MessageBytes, path string) (RecoverableEcdsaSignatureBytes, error) {
	_pointer := _self.ffiObject.incrementPointer("ExternalSigner")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[SignerError](
		FfiConverterSignerErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) RecoverableEcdsaSignatureBytes {
			return FfiConverterRecoverableEcdsaSignatureBytesINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_externalsigner_sign_ecdsa_recoverable(
			_pointer, FfiConverterMessageBytesINSTANCE.Lower(message), FfiConverterStringINSTANCE.Lower(path)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// Encrypts a message using ECIES at the given derivation path.
//
// # Arguments
// * `message` - The message to encrypt
// * `path` - BIP32 derivation path for the encryption key
//
// # Returns
// Encrypted data, or a `SignerError`
func (_self *ExternalSignerImpl) EncryptEcies(message []byte, path string) ([]byte, error) {
	_pointer := _self.ffiObject.incrementPointer("ExternalSigner")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[SignerError](
		FfiConverterSignerErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) []byte {
			return FfiConverterBytesINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_externalsigner_encrypt_ecies(
			_pointer, FfiConverterBytesINSTANCE.Lower(message), FfiConverterStringINSTANCE.Lower(path)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// Decrypts a message using ECIES at the given derivation path.
//
// # Arguments
// * `message` - The encrypted message
// * `path` - BIP32 derivation path for the decryption key
//
// # Returns
// Decrypted data, or a `SignerError`
//
// See also: [JavaScript `decryptEcies`](https://docs.spark.money/wallets/spark-signer#decrypt-ecies)
func (_self *ExternalSignerImpl) DecryptEcies(message []byte, path string) ([]byte, error) {
	_pointer := _self.ffiObject.incrementPointer("ExternalSigner")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[SignerError](
		FfiConverterSignerErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) []byte {
			return FfiConverterBytesINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_externalsigner_decrypt_ecies(
			_pointer, FfiConverterBytesINSTANCE.Lower(message), FfiConverterStringINSTANCE.Lower(path)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// Signs a hash using Schnorr signature at the given derivation path.
//
// # Arguments
// * `hash` - The 32-byte hash to sign (must be 32 bytes)
// * `path` - BIP32 derivation path as a string
//
// # Returns
// 64-byte Schnorr signature, or a `SignerError`
func (_self *ExternalSignerImpl) SignHashSchnorr(hash []byte, path string) (SchnorrSignatureBytes, error) {
	_pointer := _self.ffiObject.incrementPointer("ExternalSigner")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[SignerError](
		FfiConverterSignerErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) SchnorrSignatureBytes {
			return FfiConverterSchnorrSignatureBytesINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_externalsigner_sign_hash_schnorr(
			_pointer, FfiConverterBytesINSTANCE.Lower(hash), FfiConverterStringINSTANCE.Lower(path)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// HMAC-SHA256 of a message at the given derivation path.
//
// # Arguments
// * `message` - The message to hash
// * `path` - BIP32 derivation path as a string
//
// # Returns
// 32-byte HMAC-SHA256, or a `SignerError`
//
// See also: [JavaScript `htlcHMAC`](https://docs.spark.money/wallets/spark-signer#generate-htlc-hmac)
func (_self *ExternalSignerImpl) HmacSha256(message []byte, path string) (HashedMessageBytes, error) {
	_pointer := _self.ffiObject.incrementPointer("ExternalSigner")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[SignerError](
		FfiConverterSignerErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) HashedMessageBytes {
			return FfiConverterHashedMessageBytesINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_externalsigner_hmac_sha256(
			_pointer, FfiConverterBytesINSTANCE.Lower(message), FfiConverterStringINSTANCE.Lower(path)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// Generates Frost signing commitments for multi-party signing.
//
// # Returns
// Frost commitments with nonces, or a `SignerError`
//
// See also: [JavaScript `getRandomSigningCommitment`](https://docs.spark.money/wallets/spark-signer#get-random-signing-commitment)
func (_self *ExternalSignerImpl) GenerateRandomSigningCommitment() (ExternalFrostCommitments, error) {
	_pointer := _self.ffiObject.incrementPointer("ExternalSigner")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[SignerError](
		FfiConverterSignerErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) ExternalFrostCommitments {
			return FfiConverterExternalFrostCommitmentsINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_externalsigner_generate_random_signing_commitment(
			_pointer),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// Gets the public key for a specific tree node in the Spark wallet.
//
// # Arguments
// * `id` - The tree node identifier
//
// # Returns
// The public key for the node, or a `SignerError`
func (_self *ExternalSignerImpl) GetPublicKeyForNode(id ExternalTreeNodeId) (PublicKeyBytes, error) {
	_pointer := _self.ffiObject.incrementPointer("ExternalSigner")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[SignerError](
		FfiConverterSignerErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) PublicKeyBytes {
			return FfiConverterPublicKeyBytesINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_externalsigner_get_public_key_for_node(
			_pointer, FfiConverterExternalTreeNodeIdINSTANCE.Lower(id)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// Generates a random secret that is encrypted and known only to the signer.
//
// This method creates a new random secret and returns it in encrypted form.
// The plaintext secret never leaves the signer boundary, providing a secure way
// to create secrets that can be referenced in subsequent operations without
// exposing them.
//
// This is conceptually similar to Spark's key derivation system where secrets
// are represented by opaque references (like tree node IDs or Random) rather than raw values.
// The encrypted secret can be passed to other signer methods that need to operate
// on it, while keeping the actual secret material protected within the signer.
//
// # Returns
// An encrypted secret that can be used in subsequent signer operations,
// or a `SignerError` if generation fails.
//
// See also: [Key Derivation System](https://docs.spark.money/wallets/spark-signer#the-keyderivation-system)
func (_self *ExternalSignerImpl) GenerateRandomSecret() (ExternalEncryptedSecret, error) {
	_pointer := _self.ffiObject.incrementPointer("ExternalSigner")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[SignerError](
		FfiConverterSignerErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) ExternalEncryptedSecret {
			return FfiConverterExternalEncryptedSecretINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_externalsigner_generate_random_secret(
			_pointer),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// Gets an encrypted static deposit secret by index.
//
// # Arguments
// * `index` - The index of the static deposit secret
//
// # Returns
// The encrypted secret, or a `SignerError`
//
// This is the encrypted version of: [JavaScript `getStaticDepositSecretKey`](https://docs.spark.money/wallets/spark-signer#get-static-deposit-secret-key)
func (_self *ExternalSignerImpl) StaticDepositSecretEncrypted(index uint32) (ExternalSecretSource, error) {
	_pointer := _self.ffiObject.incrementPointer("ExternalSigner")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[SignerError](
		FfiConverterSignerErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) ExternalSecretSource {
			return FfiConverterExternalSecretSourceINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_externalsigner_static_deposit_secret_encrypted(
			_pointer, FfiConverterUint32INSTANCE.Lower(index)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// Gets a static deposit secret by index.
//
// # Arguments
// * `index` - The index of the static deposit secret
//
// # Returns
// The 32-byte secret, or a `SignerError`
//
// See also: [JavaScript `getStaticDepositSecretKey`](https://docs.spark.money/wallets/spark-signer#get-static-deposit-secret-key)
func (_self *ExternalSignerImpl) StaticDepositSecret(index uint32) (SecretBytes, error) {
	_pointer := _self.ffiObject.incrementPointer("ExternalSigner")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[SignerError](
		FfiConverterSignerErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) SecretBytes {
			return FfiConverterSecretBytesINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_externalsigner_static_deposit_secret(
			_pointer, FfiConverterUint32INSTANCE.Lower(index)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// Gets a static deposit signing public key by index.
//
// # Arguments
// * `index` - The index of the static deposit public signing key
//
// # Returns
// The 33-byte public key, or a `SignerError`
//
// See also: [JavaScript `getStaticDepositSigningKey`](https://docs.spark.money/wallets/spark-signer#get-static-deposit-signing-key)
func (_self *ExternalSignerImpl) StaticDepositSigningKey(index uint32) (PublicKeyBytes, error) {
	_pointer := _self.ffiObject.incrementPointer("ExternalSigner")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[SignerError](
		FfiConverterSignerErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) PublicKeyBytes {
			return FfiConverterPublicKeyBytesINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_externalsigner_static_deposit_signing_key(
			_pointer, FfiConverterUint32INSTANCE.Lower(index)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// Subtracts one secret from another.
//
// This is a lower-level primitive used as part of key tweaking operations.
//
// # Arguments
// * `signing_key` - The first secret
// * `new_signing_key` - The second secret to subtract
//
// # Returns
// The resulting secret, or a `SignerError`
//
// See also: [JavaScript `subtractSplitAndEncrypt`](https://docs.spark.money/wallets/spark-signer#subtract,-split,-and-encrypt)
// (this method provides the subtraction step of that higher-level operation)
func (_self *ExternalSignerImpl) SubtractSecrets(signingKey ExternalSecretSource, newSigningKey ExternalSecretSource) (ExternalSecretSource, error) {
	_pointer := _self.ffiObject.incrementPointer("ExternalSigner")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[SignerError](
		FfiConverterSignerErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) ExternalSecretSource {
			return FfiConverterExternalSecretSourceINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_externalsigner_subtract_secrets(
			_pointer, FfiConverterExternalSecretSourceINSTANCE.Lower(signingKey), FfiConverterExternalSecretSourceINSTANCE.Lower(newSigningKey)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// Splits a secret with proofs using Shamir's Secret Sharing.
//
// # Arguments
// * `secret` - The secret to split
// * `threshold` - Minimum number of shares needed to reconstruct
// * `num_shares` - Total number of shares to create
//
// # Returns
// Vector of verifiable secret shares, or a `SignerError`
//
// See also: [JavaScript `splitSecretWithProofs`](https://docs.spark.money/wallets/spark-signer#split-secret-with-proofs)
func (_self *ExternalSignerImpl) SplitSecretWithProofs(secret ExternalSecretToSplit, threshold uint32, numShares uint32) ([]ExternalVerifiableSecretShare, error) {
	_pointer := _self.ffiObject.incrementPointer("ExternalSigner")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[SignerError](
		FfiConverterSignerErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) []ExternalVerifiableSecretShare {
			return FfiConverterSequenceExternalVerifiableSecretShareINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_externalsigner_split_secret_with_proofs(
			_pointer, FfiConverterExternalSecretToSplitINSTANCE.Lower(secret), FfiConverterUint32INSTANCE.Lower(threshold), FfiConverterUint32INSTANCE.Lower(numShares)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// Encrypts a secret for a specific receiver's public key.
//
// # Arguments
// * `encrypted_secret` - The encrypted secret to re-encrypt
// * `receiver_public_key` - The receiver's 33-byte public key
//
// # Returns
// Encrypted data for the receiver, or a `SignerError`
func (_self *ExternalSignerImpl) EncryptSecretForReceiver(encryptedSecret ExternalEncryptedSecret, receiverPublicKey PublicKeyBytes) ([]byte, error) {
	_pointer := _self.ffiObject.incrementPointer("ExternalSigner")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[SignerError](
		FfiConverterSignerErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) []byte {
			return FfiConverterBytesINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_externalsigner_encrypt_secret_for_receiver(
			_pointer, FfiConverterExternalEncryptedSecretINSTANCE.Lower(encryptedSecret), FfiConverterPublicKeyBytesINSTANCE.Lower(receiverPublicKey)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// Gets the public key from a secret.
//
// # Arguments
// * `secret` - The secret
//
// # Returns
// The corresponding 33-byte public key, or a `SignerError`
//
// See also: [JavaScript `getPublicKeyFromDerivation`](https://docs.spark.money/wallets/spark-signer#get-public-key-from-derivation)
func (_self *ExternalSignerImpl) PublicKeyFromSecret(secret ExternalSecretSource) (PublicKeyBytes, error) {
	_pointer := _self.ffiObject.incrementPointer("ExternalSigner")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[SignerError](
		FfiConverterSignerErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) PublicKeyBytes {
			return FfiConverterPublicKeyBytesINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_externalsigner_public_key_from_secret(
			_pointer, FfiConverterExternalSecretSourceINSTANCE.Lower(secret)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// Signs using Frost protocol (multi-party signing).
//
// # Arguments
// * `request` - The Frost signing request
//
// # Returns
// A signature share, or a `SignerError`
//
// See also: [JavaScript `signFrost`](https://docs.spark.money/wallets/spark-signer#frost-signing)
func (_self *ExternalSignerImpl) SignFrost(request ExternalSignFrostRequest) (ExternalFrostSignatureShare, error) {
	_pointer := _self.ffiObject.incrementPointer("ExternalSigner")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[SignerError](
		FfiConverterSignerErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) ExternalFrostSignatureShare {
			return FfiConverterExternalFrostSignatureShareINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_externalsigner_sign_frost(
			_pointer, FfiConverterExternalSignFrostRequestINSTANCE.Lower(request)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// Aggregates Frost signature shares into a final signature.
//
// # Arguments
// * `request` - The Frost aggregation request
//
// # Returns
// The aggregated Frost signature, or a `SignerError`
//
// See also: [JavaScript `aggregateFrost`](https://docs.spark.money/wallets/spark-signer#aggregate-frost-signatures)
func (_self *ExternalSignerImpl) AggregateFrost(request ExternalAggregateFrostRequest) (ExternalFrostSignature, error) {
	_pointer := _self.ffiObject.incrementPointer("ExternalSigner")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[SignerError](
		FfiConverterSignerErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) ExternalFrostSignature {
			return FfiConverterExternalFrostSignatureINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_externalsigner_aggregate_frost(
			_pointer, FfiConverterExternalAggregateFrostRequestINSTANCE.Lower(request)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}
func (object *ExternalSignerImpl) Destroy() {
	runtime.SetFinalizer(object, nil)
	object.ffiObject.destroy()
}

type FfiConverterExternalSigner struct {
	handleMap *concurrentHandleMap[ExternalSigner]
}

var FfiConverterExternalSignerINSTANCE = FfiConverterExternalSigner{
	handleMap: newConcurrentHandleMap[ExternalSigner](),
}

func (c FfiConverterExternalSigner) Lift(pointer unsafe.Pointer) ExternalSigner {
	result := &ExternalSignerImpl{
		newFfiObject(
			pointer,
			func(pointer unsafe.Pointer, status *C.RustCallStatus) unsafe.Pointer {
				return C.uniffi_breez_sdk_spark_fn_clone_externalsigner(pointer, status)
			},
			func(pointer unsafe.Pointer, status *C.RustCallStatus) {
				C.uniffi_breez_sdk_spark_fn_free_externalsigner(pointer, status)
			},
		),
	}
	runtime.SetFinalizer(result, (*ExternalSignerImpl).Destroy)
	return result
}

func (c FfiConverterExternalSigner) Read(reader io.Reader) ExternalSigner {
	return c.Lift(unsafe.Pointer(uintptr(readUint64(reader))))
}

func (c FfiConverterExternalSigner) Lower(value ExternalSigner) unsafe.Pointer {
	// TODO: this is bad - all synchronization from ObjectRuntime.go is discarded here,
	// because the pointer will be decremented immediately after this function returns,
	// and someone will be left holding onto a non-locked pointer.
	pointer := unsafe.Pointer(uintptr(c.handleMap.insert(value)))
	return pointer

}

func (c FfiConverterExternalSigner) Write(writer io.Writer, value ExternalSigner) {
	writeUint64(writer, uint64(uintptr(c.Lower(value))))
}

type FfiDestroyerExternalSigner struct{}

func (_ FfiDestroyerExternalSigner) Destroy(value ExternalSigner) {
	if val, ok := value.(*ExternalSignerImpl); ok {
		val.Destroy()
	} else {
		panic("Expected *ExternalSignerImpl")
	}
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerMethod0
func breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerMethod0(uniffiHandle C.uint64_t, uniffiOutReturn *C.RustBuffer, callStatus *C.RustCallStatus) {
	handle := uint64(uniffiHandle)
	uniffiObj, ok := FfiConverterExternalSignerINSTANCE.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}

	res, err :=
		uniffiObj.IdentityPublicKey()

	if err != nil {
		var actualError *SignerError
		if errors.As(err, &actualError) {
			if actualError != nil {
				*callStatus = C.RustCallStatus{
					code:     C.int8_t(uniffiCallbackResultError),
					errorBuf: FfiConverterSignerErrorINSTANCE.Lower(actualError),
				}
				return
			}
		} else {
			*callStatus = C.RustCallStatus{
				code: C.int8_t(uniffiCallbackUnexpectedResultError),
			}
			return
		}
	}

	*uniffiOutReturn = FfiConverterPublicKeyBytesINSTANCE.Lower(res)
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerMethod1
func breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerMethod1(uniffiHandle C.uint64_t, path C.RustBuffer, uniffiFutureCallback C.UniffiForeignFutureCompleteRustBuffer, uniffiCallbackData C.uint64_t, uniffiOutReturn *C.UniffiForeignFuture) {
	handle := uint64(uniffiHandle)
	uniffiObj, ok := FfiConverterExternalSignerINSTANCE.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}

	result := make(chan C.UniffiForeignFutureStructRustBuffer, 1)
	cancel := make(chan struct{}, 1)
	guardHandle := cgo.NewHandle(cancel)
	*uniffiOutReturn = C.UniffiForeignFuture{
		handle: C.uint64_t(guardHandle),
		free:   C.UniffiForeignFutureFree(C.breez_sdk_spark_uniffiFreeGorutine),
	}

	// Wait for compleation or cancel
	go func() {
		select {
		case <-cancel:
		case res := <-result:
			C.call_UniffiForeignFutureCompleteRustBuffer(uniffiFutureCallback, uniffiCallbackData, res)
		}
	}()

	// Eval callback asynchroniously
	go func() {
		asyncResult := &C.UniffiForeignFutureStructRustBuffer{}
		uniffiOutReturn := &asyncResult.returnValue
		callStatus := &asyncResult.callStatus
		defer func() {
			result <- *asyncResult
		}()

		res, err :=
			uniffiObj.DerivePublicKey(
				FfiConverterStringINSTANCE.Lift(GoRustBuffer{
					inner: path,
				}),
			)

		if err != nil {
			var actualError *SignerError
			if errors.As(err, &actualError) {
				if actualError != nil {
					*callStatus = C.RustCallStatus{
						code:     C.int8_t(uniffiCallbackResultError),
						errorBuf: FfiConverterSignerErrorINSTANCE.Lower(actualError),
					}
					return
				}
			} else {
				*callStatus = C.RustCallStatus{
					code: C.int8_t(uniffiCallbackUnexpectedResultError),
				}
				return
			}
		}

		*uniffiOutReturn = FfiConverterPublicKeyBytesINSTANCE.Lower(res)
	}()
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerMethod2
func breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerMethod2(uniffiHandle C.uint64_t, message C.RustBuffer, path C.RustBuffer, uniffiFutureCallback C.UniffiForeignFutureCompleteRustBuffer, uniffiCallbackData C.uint64_t, uniffiOutReturn *C.UniffiForeignFuture) {
	handle := uint64(uniffiHandle)
	uniffiObj, ok := FfiConverterExternalSignerINSTANCE.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}

	result := make(chan C.UniffiForeignFutureStructRustBuffer, 1)
	cancel := make(chan struct{}, 1)
	guardHandle := cgo.NewHandle(cancel)
	*uniffiOutReturn = C.UniffiForeignFuture{
		handle: C.uint64_t(guardHandle),
		free:   C.UniffiForeignFutureFree(C.breez_sdk_spark_uniffiFreeGorutine),
	}

	// Wait for compleation or cancel
	go func() {
		select {
		case <-cancel:
		case res := <-result:
			C.call_UniffiForeignFutureCompleteRustBuffer(uniffiFutureCallback, uniffiCallbackData, res)
		}
	}()

	// Eval callback asynchroniously
	go func() {
		asyncResult := &C.UniffiForeignFutureStructRustBuffer{}
		uniffiOutReturn := &asyncResult.returnValue
		callStatus := &asyncResult.callStatus
		defer func() {
			result <- *asyncResult
		}()

		res, err :=
			uniffiObj.SignEcdsa(
				FfiConverterMessageBytesINSTANCE.Lift(GoRustBuffer{
					inner: message,
				}),
				FfiConverterStringINSTANCE.Lift(GoRustBuffer{
					inner: path,
				}),
			)

		if err != nil {
			var actualError *SignerError
			if errors.As(err, &actualError) {
				if actualError != nil {
					*callStatus = C.RustCallStatus{
						code:     C.int8_t(uniffiCallbackResultError),
						errorBuf: FfiConverterSignerErrorINSTANCE.Lower(actualError),
					}
					return
				}
			} else {
				*callStatus = C.RustCallStatus{
					code: C.int8_t(uniffiCallbackUnexpectedResultError),
				}
				return
			}
		}

		*uniffiOutReturn = FfiConverterEcdsaSignatureBytesINSTANCE.Lower(res)
	}()
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerMethod3
func breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerMethod3(uniffiHandle C.uint64_t, message C.RustBuffer, path C.RustBuffer, uniffiFutureCallback C.UniffiForeignFutureCompleteRustBuffer, uniffiCallbackData C.uint64_t, uniffiOutReturn *C.UniffiForeignFuture) {
	handle := uint64(uniffiHandle)
	uniffiObj, ok := FfiConverterExternalSignerINSTANCE.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}

	result := make(chan C.UniffiForeignFutureStructRustBuffer, 1)
	cancel := make(chan struct{}, 1)
	guardHandle := cgo.NewHandle(cancel)
	*uniffiOutReturn = C.UniffiForeignFuture{
		handle: C.uint64_t(guardHandle),
		free:   C.UniffiForeignFutureFree(C.breez_sdk_spark_uniffiFreeGorutine),
	}

	// Wait for compleation or cancel
	go func() {
		select {
		case <-cancel:
		case res := <-result:
			C.call_UniffiForeignFutureCompleteRustBuffer(uniffiFutureCallback, uniffiCallbackData, res)
		}
	}()

	// Eval callback asynchroniously
	go func() {
		asyncResult := &C.UniffiForeignFutureStructRustBuffer{}
		uniffiOutReturn := &asyncResult.returnValue
		callStatus := &asyncResult.callStatus
		defer func() {
			result <- *asyncResult
		}()

		res, err :=
			uniffiObj.SignEcdsaRecoverable(
				FfiConverterMessageBytesINSTANCE.Lift(GoRustBuffer{
					inner: message,
				}),
				FfiConverterStringINSTANCE.Lift(GoRustBuffer{
					inner: path,
				}),
			)

		if err != nil {
			var actualError *SignerError
			if errors.As(err, &actualError) {
				if actualError != nil {
					*callStatus = C.RustCallStatus{
						code:     C.int8_t(uniffiCallbackResultError),
						errorBuf: FfiConverterSignerErrorINSTANCE.Lower(actualError),
					}
					return
				}
			} else {
				*callStatus = C.RustCallStatus{
					code: C.int8_t(uniffiCallbackUnexpectedResultError),
				}
				return
			}
		}

		*uniffiOutReturn = FfiConverterRecoverableEcdsaSignatureBytesINSTANCE.Lower(res)
	}()
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerMethod4
func breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerMethod4(uniffiHandle C.uint64_t, message C.RustBuffer, path C.RustBuffer, uniffiFutureCallback C.UniffiForeignFutureCompleteRustBuffer, uniffiCallbackData C.uint64_t, uniffiOutReturn *C.UniffiForeignFuture) {
	handle := uint64(uniffiHandle)
	uniffiObj, ok := FfiConverterExternalSignerINSTANCE.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}

	result := make(chan C.UniffiForeignFutureStructRustBuffer, 1)
	cancel := make(chan struct{}, 1)
	guardHandle := cgo.NewHandle(cancel)
	*uniffiOutReturn = C.UniffiForeignFuture{
		handle: C.uint64_t(guardHandle),
		free:   C.UniffiForeignFutureFree(C.breez_sdk_spark_uniffiFreeGorutine),
	}

	// Wait for compleation or cancel
	go func() {
		select {
		case <-cancel:
		case res := <-result:
			C.call_UniffiForeignFutureCompleteRustBuffer(uniffiFutureCallback, uniffiCallbackData, res)
		}
	}()

	// Eval callback asynchroniously
	go func() {
		asyncResult := &C.UniffiForeignFutureStructRustBuffer{}
		uniffiOutReturn := &asyncResult.returnValue
		callStatus := &asyncResult.callStatus
		defer func() {
			result <- *asyncResult
		}()

		res, err :=
			uniffiObj.EncryptEcies(
				FfiConverterBytesINSTANCE.Lift(GoRustBuffer{
					inner: message,
				}),
				FfiConverterStringINSTANCE.Lift(GoRustBuffer{
					inner: path,
				}),
			)

		if err != nil {
			var actualError *SignerError
			if errors.As(err, &actualError) {
				if actualError != nil {
					*callStatus = C.RustCallStatus{
						code:     C.int8_t(uniffiCallbackResultError),
						errorBuf: FfiConverterSignerErrorINSTANCE.Lower(actualError),
					}
					return
				}
			} else {
				*callStatus = C.RustCallStatus{
					code: C.int8_t(uniffiCallbackUnexpectedResultError),
				}
				return
			}
		}

		*uniffiOutReturn = FfiConverterBytesINSTANCE.Lower(res)
	}()
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerMethod5
func breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerMethod5(uniffiHandle C.uint64_t, message C.RustBuffer, path C.RustBuffer, uniffiFutureCallback C.UniffiForeignFutureCompleteRustBuffer, uniffiCallbackData C.uint64_t, uniffiOutReturn *C.UniffiForeignFuture) {
	handle := uint64(uniffiHandle)
	uniffiObj, ok := FfiConverterExternalSignerINSTANCE.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}

	result := make(chan C.UniffiForeignFutureStructRustBuffer, 1)
	cancel := make(chan struct{}, 1)
	guardHandle := cgo.NewHandle(cancel)
	*uniffiOutReturn = C.UniffiForeignFuture{
		handle: C.uint64_t(guardHandle),
		free:   C.UniffiForeignFutureFree(C.breez_sdk_spark_uniffiFreeGorutine),
	}

	// Wait for compleation or cancel
	go func() {
		select {
		case <-cancel:
		case res := <-result:
			C.call_UniffiForeignFutureCompleteRustBuffer(uniffiFutureCallback, uniffiCallbackData, res)
		}
	}()

	// Eval callback asynchroniously
	go func() {
		asyncResult := &C.UniffiForeignFutureStructRustBuffer{}
		uniffiOutReturn := &asyncResult.returnValue
		callStatus := &asyncResult.callStatus
		defer func() {
			result <- *asyncResult
		}()

		res, err :=
			uniffiObj.DecryptEcies(
				FfiConverterBytesINSTANCE.Lift(GoRustBuffer{
					inner: message,
				}),
				FfiConverterStringINSTANCE.Lift(GoRustBuffer{
					inner: path,
				}),
			)

		if err != nil {
			var actualError *SignerError
			if errors.As(err, &actualError) {
				if actualError != nil {
					*callStatus = C.RustCallStatus{
						code:     C.int8_t(uniffiCallbackResultError),
						errorBuf: FfiConverterSignerErrorINSTANCE.Lower(actualError),
					}
					return
				}
			} else {
				*callStatus = C.RustCallStatus{
					code: C.int8_t(uniffiCallbackUnexpectedResultError),
				}
				return
			}
		}

		*uniffiOutReturn = FfiConverterBytesINSTANCE.Lower(res)
	}()
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerMethod6
func breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerMethod6(uniffiHandle C.uint64_t, hash C.RustBuffer, path C.RustBuffer, uniffiFutureCallback C.UniffiForeignFutureCompleteRustBuffer, uniffiCallbackData C.uint64_t, uniffiOutReturn *C.UniffiForeignFuture) {
	handle := uint64(uniffiHandle)
	uniffiObj, ok := FfiConverterExternalSignerINSTANCE.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}

	result := make(chan C.UniffiForeignFutureStructRustBuffer, 1)
	cancel := make(chan struct{}, 1)
	guardHandle := cgo.NewHandle(cancel)
	*uniffiOutReturn = C.UniffiForeignFuture{
		handle: C.uint64_t(guardHandle),
		free:   C.UniffiForeignFutureFree(C.breez_sdk_spark_uniffiFreeGorutine),
	}

	// Wait for compleation or cancel
	go func() {
		select {
		case <-cancel:
		case res := <-result:
			C.call_UniffiForeignFutureCompleteRustBuffer(uniffiFutureCallback, uniffiCallbackData, res)
		}
	}()

	// Eval callback asynchroniously
	go func() {
		asyncResult := &C.UniffiForeignFutureStructRustBuffer{}
		uniffiOutReturn := &asyncResult.returnValue
		callStatus := &asyncResult.callStatus
		defer func() {
			result <- *asyncResult
		}()

		res, err :=
			uniffiObj.SignHashSchnorr(
				FfiConverterBytesINSTANCE.Lift(GoRustBuffer{
					inner: hash,
				}),
				FfiConverterStringINSTANCE.Lift(GoRustBuffer{
					inner: path,
				}),
			)

		if err != nil {
			var actualError *SignerError
			if errors.As(err, &actualError) {
				if actualError != nil {
					*callStatus = C.RustCallStatus{
						code:     C.int8_t(uniffiCallbackResultError),
						errorBuf: FfiConverterSignerErrorINSTANCE.Lower(actualError),
					}
					return
				}
			} else {
				*callStatus = C.RustCallStatus{
					code: C.int8_t(uniffiCallbackUnexpectedResultError),
				}
				return
			}
		}

		*uniffiOutReturn = FfiConverterSchnorrSignatureBytesINSTANCE.Lower(res)
	}()
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerMethod7
func breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerMethod7(uniffiHandle C.uint64_t, message C.RustBuffer, path C.RustBuffer, uniffiFutureCallback C.UniffiForeignFutureCompleteRustBuffer, uniffiCallbackData C.uint64_t, uniffiOutReturn *C.UniffiForeignFuture) {
	handle := uint64(uniffiHandle)
	uniffiObj, ok := FfiConverterExternalSignerINSTANCE.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}

	result := make(chan C.UniffiForeignFutureStructRustBuffer, 1)
	cancel := make(chan struct{}, 1)
	guardHandle := cgo.NewHandle(cancel)
	*uniffiOutReturn = C.UniffiForeignFuture{
		handle: C.uint64_t(guardHandle),
		free:   C.UniffiForeignFutureFree(C.breez_sdk_spark_uniffiFreeGorutine),
	}

	// Wait for compleation or cancel
	go func() {
		select {
		case <-cancel:
		case res := <-result:
			C.call_UniffiForeignFutureCompleteRustBuffer(uniffiFutureCallback, uniffiCallbackData, res)
		}
	}()

	// Eval callback asynchroniously
	go func() {
		asyncResult := &C.UniffiForeignFutureStructRustBuffer{}
		uniffiOutReturn := &asyncResult.returnValue
		callStatus := &asyncResult.callStatus
		defer func() {
			result <- *asyncResult
		}()

		res, err :=
			uniffiObj.HmacSha256(
				FfiConverterBytesINSTANCE.Lift(GoRustBuffer{
					inner: message,
				}),
				FfiConverterStringINSTANCE.Lift(GoRustBuffer{
					inner: path,
				}),
			)

		if err != nil {
			var actualError *SignerError
			if errors.As(err, &actualError) {
				if actualError != nil {
					*callStatus = C.RustCallStatus{
						code:     C.int8_t(uniffiCallbackResultError),
						errorBuf: FfiConverterSignerErrorINSTANCE.Lower(actualError),
					}
					return
				}
			} else {
				*callStatus = C.RustCallStatus{
					code: C.int8_t(uniffiCallbackUnexpectedResultError),
				}
				return
			}
		}

		*uniffiOutReturn = FfiConverterHashedMessageBytesINSTANCE.Lower(res)
	}()
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerMethod8
func breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerMethod8(uniffiHandle C.uint64_t, uniffiFutureCallback C.UniffiForeignFutureCompleteRustBuffer, uniffiCallbackData C.uint64_t, uniffiOutReturn *C.UniffiForeignFuture) {
	handle := uint64(uniffiHandle)
	uniffiObj, ok := FfiConverterExternalSignerINSTANCE.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}

	result := make(chan C.UniffiForeignFutureStructRustBuffer, 1)
	cancel := make(chan struct{}, 1)
	guardHandle := cgo.NewHandle(cancel)
	*uniffiOutReturn = C.UniffiForeignFuture{
		handle: C.uint64_t(guardHandle),
		free:   C.UniffiForeignFutureFree(C.breez_sdk_spark_uniffiFreeGorutine),
	}

	// Wait for compleation or cancel
	go func() {
		select {
		case <-cancel:
		case res := <-result:
			C.call_UniffiForeignFutureCompleteRustBuffer(uniffiFutureCallback, uniffiCallbackData, res)
		}
	}()

	// Eval callback asynchroniously
	go func() {
		asyncResult := &C.UniffiForeignFutureStructRustBuffer{}
		uniffiOutReturn := &asyncResult.returnValue
		callStatus := &asyncResult.callStatus
		defer func() {
			result <- *asyncResult
		}()

		res, err :=
			uniffiObj.GenerateRandomSigningCommitment()

		if err != nil {
			var actualError *SignerError
			if errors.As(err, &actualError) {
				if actualError != nil {
					*callStatus = C.RustCallStatus{
						code:     C.int8_t(uniffiCallbackResultError),
						errorBuf: FfiConverterSignerErrorINSTANCE.Lower(actualError),
					}
					return
				}
			} else {
				*callStatus = C.RustCallStatus{
					code: C.int8_t(uniffiCallbackUnexpectedResultError),
				}
				return
			}
		}

		*uniffiOutReturn = FfiConverterExternalFrostCommitmentsINSTANCE.Lower(res)
	}()
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerMethod9
func breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerMethod9(uniffiHandle C.uint64_t, id C.RustBuffer, uniffiFutureCallback C.UniffiForeignFutureCompleteRustBuffer, uniffiCallbackData C.uint64_t, uniffiOutReturn *C.UniffiForeignFuture) {
	handle := uint64(uniffiHandle)
	uniffiObj, ok := FfiConverterExternalSignerINSTANCE.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}

	result := make(chan C.UniffiForeignFutureStructRustBuffer, 1)
	cancel := make(chan struct{}, 1)
	guardHandle := cgo.NewHandle(cancel)
	*uniffiOutReturn = C.UniffiForeignFuture{
		handle: C.uint64_t(guardHandle),
		free:   C.UniffiForeignFutureFree(C.breez_sdk_spark_uniffiFreeGorutine),
	}

	// Wait for compleation or cancel
	go func() {
		select {
		case <-cancel:
		case res := <-result:
			C.call_UniffiForeignFutureCompleteRustBuffer(uniffiFutureCallback, uniffiCallbackData, res)
		}
	}()

	// Eval callback asynchroniously
	go func() {
		asyncResult := &C.UniffiForeignFutureStructRustBuffer{}
		uniffiOutReturn := &asyncResult.returnValue
		callStatus := &asyncResult.callStatus
		defer func() {
			result <- *asyncResult
		}()

		res, err :=
			uniffiObj.GetPublicKeyForNode(
				FfiConverterExternalTreeNodeIdINSTANCE.Lift(GoRustBuffer{
					inner: id,
				}),
			)

		if err != nil {
			var actualError *SignerError
			if errors.As(err, &actualError) {
				if actualError != nil {
					*callStatus = C.RustCallStatus{
						code:     C.int8_t(uniffiCallbackResultError),
						errorBuf: FfiConverterSignerErrorINSTANCE.Lower(actualError),
					}
					return
				}
			} else {
				*callStatus = C.RustCallStatus{
					code: C.int8_t(uniffiCallbackUnexpectedResultError),
				}
				return
			}
		}

		*uniffiOutReturn = FfiConverterPublicKeyBytesINSTANCE.Lower(res)
	}()
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerMethod10
func breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerMethod10(uniffiHandle C.uint64_t, uniffiFutureCallback C.UniffiForeignFutureCompleteRustBuffer, uniffiCallbackData C.uint64_t, uniffiOutReturn *C.UniffiForeignFuture) {
	handle := uint64(uniffiHandle)
	uniffiObj, ok := FfiConverterExternalSignerINSTANCE.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}

	result := make(chan C.UniffiForeignFutureStructRustBuffer, 1)
	cancel := make(chan struct{}, 1)
	guardHandle := cgo.NewHandle(cancel)
	*uniffiOutReturn = C.UniffiForeignFuture{
		handle: C.uint64_t(guardHandle),
		free:   C.UniffiForeignFutureFree(C.breez_sdk_spark_uniffiFreeGorutine),
	}

	// Wait for compleation or cancel
	go func() {
		select {
		case <-cancel:
		case res := <-result:
			C.call_UniffiForeignFutureCompleteRustBuffer(uniffiFutureCallback, uniffiCallbackData, res)
		}
	}()

	// Eval callback asynchroniously
	go func() {
		asyncResult := &C.UniffiForeignFutureStructRustBuffer{}
		uniffiOutReturn := &asyncResult.returnValue
		callStatus := &asyncResult.callStatus
		defer func() {
			result <- *asyncResult
		}()

		res, err :=
			uniffiObj.GenerateRandomSecret()

		if err != nil {
			var actualError *SignerError
			if errors.As(err, &actualError) {
				if actualError != nil {
					*callStatus = C.RustCallStatus{
						code:     C.int8_t(uniffiCallbackResultError),
						errorBuf: FfiConverterSignerErrorINSTANCE.Lower(actualError),
					}
					return
				}
			} else {
				*callStatus = C.RustCallStatus{
					code: C.int8_t(uniffiCallbackUnexpectedResultError),
				}
				return
			}
		}

		*uniffiOutReturn = FfiConverterExternalEncryptedSecretINSTANCE.Lower(res)
	}()
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerMethod11
func breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerMethod11(uniffiHandle C.uint64_t, index C.uint32_t, uniffiFutureCallback C.UniffiForeignFutureCompleteRustBuffer, uniffiCallbackData C.uint64_t, uniffiOutReturn *C.UniffiForeignFuture) {
	handle := uint64(uniffiHandle)
	uniffiObj, ok := FfiConverterExternalSignerINSTANCE.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}

	result := make(chan C.UniffiForeignFutureStructRustBuffer, 1)
	cancel := make(chan struct{}, 1)
	guardHandle := cgo.NewHandle(cancel)
	*uniffiOutReturn = C.UniffiForeignFuture{
		handle: C.uint64_t(guardHandle),
		free:   C.UniffiForeignFutureFree(C.breez_sdk_spark_uniffiFreeGorutine),
	}

	// Wait for compleation or cancel
	go func() {
		select {
		case <-cancel:
		case res := <-result:
			C.call_UniffiForeignFutureCompleteRustBuffer(uniffiFutureCallback, uniffiCallbackData, res)
		}
	}()

	// Eval callback asynchroniously
	go func() {
		asyncResult := &C.UniffiForeignFutureStructRustBuffer{}
		uniffiOutReturn := &asyncResult.returnValue
		callStatus := &asyncResult.callStatus
		defer func() {
			result <- *asyncResult
		}()

		res, err :=
			uniffiObj.StaticDepositSecretEncrypted(
				FfiConverterUint32INSTANCE.Lift(index),
			)

		if err != nil {
			var actualError *SignerError
			if errors.As(err, &actualError) {
				if actualError != nil {
					*callStatus = C.RustCallStatus{
						code:     C.int8_t(uniffiCallbackResultError),
						errorBuf: FfiConverterSignerErrorINSTANCE.Lower(actualError),
					}
					return
				}
			} else {
				*callStatus = C.RustCallStatus{
					code: C.int8_t(uniffiCallbackUnexpectedResultError),
				}
				return
			}
		}

		*uniffiOutReturn = FfiConverterExternalSecretSourceINSTANCE.Lower(res)
	}()
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerMethod12
func breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerMethod12(uniffiHandle C.uint64_t, index C.uint32_t, uniffiFutureCallback C.UniffiForeignFutureCompleteRustBuffer, uniffiCallbackData C.uint64_t, uniffiOutReturn *C.UniffiForeignFuture) {
	handle := uint64(uniffiHandle)
	uniffiObj, ok := FfiConverterExternalSignerINSTANCE.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}

	result := make(chan C.UniffiForeignFutureStructRustBuffer, 1)
	cancel := make(chan struct{}, 1)
	guardHandle := cgo.NewHandle(cancel)
	*uniffiOutReturn = C.UniffiForeignFuture{
		handle: C.uint64_t(guardHandle),
		free:   C.UniffiForeignFutureFree(C.breez_sdk_spark_uniffiFreeGorutine),
	}

	// Wait for compleation or cancel
	go func() {
		select {
		case <-cancel:
		case res := <-result:
			C.call_UniffiForeignFutureCompleteRustBuffer(uniffiFutureCallback, uniffiCallbackData, res)
		}
	}()

	// Eval callback asynchroniously
	go func() {
		asyncResult := &C.UniffiForeignFutureStructRustBuffer{}
		uniffiOutReturn := &asyncResult.returnValue
		callStatus := &asyncResult.callStatus
		defer func() {
			result <- *asyncResult
		}()

		res, err :=
			uniffiObj.StaticDepositSecret(
				FfiConverterUint32INSTANCE.Lift(index),
			)

		if err != nil {
			var actualError *SignerError
			if errors.As(err, &actualError) {
				if actualError != nil {
					*callStatus = C.RustCallStatus{
						code:     C.int8_t(uniffiCallbackResultError),
						errorBuf: FfiConverterSignerErrorINSTANCE.Lower(actualError),
					}
					return
				}
			} else {
				*callStatus = C.RustCallStatus{
					code: C.int8_t(uniffiCallbackUnexpectedResultError),
				}
				return
			}
		}

		*uniffiOutReturn = FfiConverterSecretBytesINSTANCE.Lower(res)
	}()
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerMethod13
func breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerMethod13(uniffiHandle C.uint64_t, index C.uint32_t, uniffiFutureCallback C.UniffiForeignFutureCompleteRustBuffer, uniffiCallbackData C.uint64_t, uniffiOutReturn *C.UniffiForeignFuture) {
	handle := uint64(uniffiHandle)
	uniffiObj, ok := FfiConverterExternalSignerINSTANCE.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}

	result := make(chan C.UniffiForeignFutureStructRustBuffer, 1)
	cancel := make(chan struct{}, 1)
	guardHandle := cgo.NewHandle(cancel)
	*uniffiOutReturn = C.UniffiForeignFuture{
		handle: C.uint64_t(guardHandle),
		free:   C.UniffiForeignFutureFree(C.breez_sdk_spark_uniffiFreeGorutine),
	}

	// Wait for compleation or cancel
	go func() {
		select {
		case <-cancel:
		case res := <-result:
			C.call_UniffiForeignFutureCompleteRustBuffer(uniffiFutureCallback, uniffiCallbackData, res)
		}
	}()

	// Eval callback asynchroniously
	go func() {
		asyncResult := &C.UniffiForeignFutureStructRustBuffer{}
		uniffiOutReturn := &asyncResult.returnValue
		callStatus := &asyncResult.callStatus
		defer func() {
			result <- *asyncResult
		}()

		res, err :=
			uniffiObj.StaticDepositSigningKey(
				FfiConverterUint32INSTANCE.Lift(index),
			)

		if err != nil {
			var actualError *SignerError
			if errors.As(err, &actualError) {
				if actualError != nil {
					*callStatus = C.RustCallStatus{
						code:     C.int8_t(uniffiCallbackResultError),
						errorBuf: FfiConverterSignerErrorINSTANCE.Lower(actualError),
					}
					return
				}
			} else {
				*callStatus = C.RustCallStatus{
					code: C.int8_t(uniffiCallbackUnexpectedResultError),
				}
				return
			}
		}

		*uniffiOutReturn = FfiConverterPublicKeyBytesINSTANCE.Lower(res)
	}()
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerMethod14
func breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerMethod14(uniffiHandle C.uint64_t, signingKey C.RustBuffer, newSigningKey C.RustBuffer, uniffiFutureCallback C.UniffiForeignFutureCompleteRustBuffer, uniffiCallbackData C.uint64_t, uniffiOutReturn *C.UniffiForeignFuture) {
	handle := uint64(uniffiHandle)
	uniffiObj, ok := FfiConverterExternalSignerINSTANCE.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}

	result := make(chan C.UniffiForeignFutureStructRustBuffer, 1)
	cancel := make(chan struct{}, 1)
	guardHandle := cgo.NewHandle(cancel)
	*uniffiOutReturn = C.UniffiForeignFuture{
		handle: C.uint64_t(guardHandle),
		free:   C.UniffiForeignFutureFree(C.breez_sdk_spark_uniffiFreeGorutine),
	}

	// Wait for compleation or cancel
	go func() {
		select {
		case <-cancel:
		case res := <-result:
			C.call_UniffiForeignFutureCompleteRustBuffer(uniffiFutureCallback, uniffiCallbackData, res)
		}
	}()

	// Eval callback asynchroniously
	go func() {
		asyncResult := &C.UniffiForeignFutureStructRustBuffer{}
		uniffiOutReturn := &asyncResult.returnValue
		callStatus := &asyncResult.callStatus
		defer func() {
			result <- *asyncResult
		}()

		res, err :=
			uniffiObj.SubtractSecrets(
				FfiConverterExternalSecretSourceINSTANCE.Lift(GoRustBuffer{
					inner: signingKey,
				}),
				FfiConverterExternalSecretSourceINSTANCE.Lift(GoRustBuffer{
					inner: newSigningKey,
				}),
			)

		if err != nil {
			var actualError *SignerError
			if errors.As(err, &actualError) {
				if actualError != nil {
					*callStatus = C.RustCallStatus{
						code:     C.int8_t(uniffiCallbackResultError),
						errorBuf: FfiConverterSignerErrorINSTANCE.Lower(actualError),
					}
					return
				}
			} else {
				*callStatus = C.RustCallStatus{
					code: C.int8_t(uniffiCallbackUnexpectedResultError),
				}
				return
			}
		}

		*uniffiOutReturn = FfiConverterExternalSecretSourceINSTANCE.Lower(res)
	}()
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerMethod15
func breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerMethod15(uniffiHandle C.uint64_t, secret C.RustBuffer, threshold C.uint32_t, numShares C.uint32_t, uniffiFutureCallback C.UniffiForeignFutureCompleteRustBuffer, uniffiCallbackData C.uint64_t, uniffiOutReturn *C.UniffiForeignFuture) {
	handle := uint64(uniffiHandle)
	uniffiObj, ok := FfiConverterExternalSignerINSTANCE.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}

	result := make(chan C.UniffiForeignFutureStructRustBuffer, 1)
	cancel := make(chan struct{}, 1)
	guardHandle := cgo.NewHandle(cancel)
	*uniffiOutReturn = C.UniffiForeignFuture{
		handle: C.uint64_t(guardHandle),
		free:   C.UniffiForeignFutureFree(C.breez_sdk_spark_uniffiFreeGorutine),
	}

	// Wait for compleation or cancel
	go func() {
		select {
		case <-cancel:
		case res := <-result:
			C.call_UniffiForeignFutureCompleteRustBuffer(uniffiFutureCallback, uniffiCallbackData, res)
		}
	}()

	// Eval callback asynchroniously
	go func() {
		asyncResult := &C.UniffiForeignFutureStructRustBuffer{}
		uniffiOutReturn := &asyncResult.returnValue
		callStatus := &asyncResult.callStatus
		defer func() {
			result <- *asyncResult
		}()

		res, err :=
			uniffiObj.SplitSecretWithProofs(
				FfiConverterExternalSecretToSplitINSTANCE.Lift(GoRustBuffer{
					inner: secret,
				}),
				FfiConverterUint32INSTANCE.Lift(threshold),
				FfiConverterUint32INSTANCE.Lift(numShares),
			)

		if err != nil {
			var actualError *SignerError
			if errors.As(err, &actualError) {
				if actualError != nil {
					*callStatus = C.RustCallStatus{
						code:     C.int8_t(uniffiCallbackResultError),
						errorBuf: FfiConverterSignerErrorINSTANCE.Lower(actualError),
					}
					return
				}
			} else {
				*callStatus = C.RustCallStatus{
					code: C.int8_t(uniffiCallbackUnexpectedResultError),
				}
				return
			}
		}

		*uniffiOutReturn = FfiConverterSequenceExternalVerifiableSecretShareINSTANCE.Lower(res)
	}()
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerMethod16
func breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerMethod16(uniffiHandle C.uint64_t, encryptedSecret C.RustBuffer, receiverPublicKey C.RustBuffer, uniffiFutureCallback C.UniffiForeignFutureCompleteRustBuffer, uniffiCallbackData C.uint64_t, uniffiOutReturn *C.UniffiForeignFuture) {
	handle := uint64(uniffiHandle)
	uniffiObj, ok := FfiConverterExternalSignerINSTANCE.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}

	result := make(chan C.UniffiForeignFutureStructRustBuffer, 1)
	cancel := make(chan struct{}, 1)
	guardHandle := cgo.NewHandle(cancel)
	*uniffiOutReturn = C.UniffiForeignFuture{
		handle: C.uint64_t(guardHandle),
		free:   C.UniffiForeignFutureFree(C.breez_sdk_spark_uniffiFreeGorutine),
	}

	// Wait for compleation or cancel
	go func() {
		select {
		case <-cancel:
		case res := <-result:
			C.call_UniffiForeignFutureCompleteRustBuffer(uniffiFutureCallback, uniffiCallbackData, res)
		}
	}()

	// Eval callback asynchroniously
	go func() {
		asyncResult := &C.UniffiForeignFutureStructRustBuffer{}
		uniffiOutReturn := &asyncResult.returnValue
		callStatus := &asyncResult.callStatus
		defer func() {
			result <- *asyncResult
		}()

		res, err :=
			uniffiObj.EncryptSecretForReceiver(
				FfiConverterExternalEncryptedSecretINSTANCE.Lift(GoRustBuffer{
					inner: encryptedSecret,
				}),
				FfiConverterPublicKeyBytesINSTANCE.Lift(GoRustBuffer{
					inner: receiverPublicKey,
				}),
			)

		if err != nil {
			var actualError *SignerError
			if errors.As(err, &actualError) {
				if actualError != nil {
					*callStatus = C.RustCallStatus{
						code:     C.int8_t(uniffiCallbackResultError),
						errorBuf: FfiConverterSignerErrorINSTANCE.Lower(actualError),
					}
					return
				}
			} else {
				*callStatus = C.RustCallStatus{
					code: C.int8_t(uniffiCallbackUnexpectedResultError),
				}
				return
			}
		}

		*uniffiOutReturn = FfiConverterBytesINSTANCE.Lower(res)
	}()
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerMethod17
func breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerMethod17(uniffiHandle C.uint64_t, secret C.RustBuffer, uniffiFutureCallback C.UniffiForeignFutureCompleteRustBuffer, uniffiCallbackData C.uint64_t, uniffiOutReturn *C.UniffiForeignFuture) {
	handle := uint64(uniffiHandle)
	uniffiObj, ok := FfiConverterExternalSignerINSTANCE.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}

	result := make(chan C.UniffiForeignFutureStructRustBuffer, 1)
	cancel := make(chan struct{}, 1)
	guardHandle := cgo.NewHandle(cancel)
	*uniffiOutReturn = C.UniffiForeignFuture{
		handle: C.uint64_t(guardHandle),
		free:   C.UniffiForeignFutureFree(C.breez_sdk_spark_uniffiFreeGorutine),
	}

	// Wait for compleation or cancel
	go func() {
		select {
		case <-cancel:
		case res := <-result:
			C.call_UniffiForeignFutureCompleteRustBuffer(uniffiFutureCallback, uniffiCallbackData, res)
		}
	}()

	// Eval callback asynchroniously
	go func() {
		asyncResult := &C.UniffiForeignFutureStructRustBuffer{}
		uniffiOutReturn := &asyncResult.returnValue
		callStatus := &asyncResult.callStatus
		defer func() {
			result <- *asyncResult
		}()

		res, err :=
			uniffiObj.PublicKeyFromSecret(
				FfiConverterExternalSecretSourceINSTANCE.Lift(GoRustBuffer{
					inner: secret,
				}),
			)

		if err != nil {
			var actualError *SignerError
			if errors.As(err, &actualError) {
				if actualError != nil {
					*callStatus = C.RustCallStatus{
						code:     C.int8_t(uniffiCallbackResultError),
						errorBuf: FfiConverterSignerErrorINSTANCE.Lower(actualError),
					}
					return
				}
			} else {
				*callStatus = C.RustCallStatus{
					code: C.int8_t(uniffiCallbackUnexpectedResultError),
				}
				return
			}
		}

		*uniffiOutReturn = FfiConverterPublicKeyBytesINSTANCE.Lower(res)
	}()
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerMethod18
func breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerMethod18(uniffiHandle C.uint64_t, request C.RustBuffer, uniffiFutureCallback C.UniffiForeignFutureCompleteRustBuffer, uniffiCallbackData C.uint64_t, uniffiOutReturn *C.UniffiForeignFuture) {
	handle := uint64(uniffiHandle)
	uniffiObj, ok := FfiConverterExternalSignerINSTANCE.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}

	result := make(chan C.UniffiForeignFutureStructRustBuffer, 1)
	cancel := make(chan struct{}, 1)
	guardHandle := cgo.NewHandle(cancel)
	*uniffiOutReturn = C.UniffiForeignFuture{
		handle: C.uint64_t(guardHandle),
		free:   C.UniffiForeignFutureFree(C.breez_sdk_spark_uniffiFreeGorutine),
	}

	// Wait for compleation or cancel
	go func() {
		select {
		case <-cancel:
		case res := <-result:
			C.call_UniffiForeignFutureCompleteRustBuffer(uniffiFutureCallback, uniffiCallbackData, res)
		}
	}()

	// Eval callback asynchroniously
	go func() {
		asyncResult := &C.UniffiForeignFutureStructRustBuffer{}
		uniffiOutReturn := &asyncResult.returnValue
		callStatus := &asyncResult.callStatus
		defer func() {
			result <- *asyncResult
		}()

		res, err :=
			uniffiObj.SignFrost(
				FfiConverterExternalSignFrostRequestINSTANCE.Lift(GoRustBuffer{
					inner: request,
				}),
			)

		if err != nil {
			var actualError *SignerError
			if errors.As(err, &actualError) {
				if actualError != nil {
					*callStatus = C.RustCallStatus{
						code:     C.int8_t(uniffiCallbackResultError),
						errorBuf: FfiConverterSignerErrorINSTANCE.Lower(actualError),
					}
					return
				}
			} else {
				*callStatus = C.RustCallStatus{
					code: C.int8_t(uniffiCallbackUnexpectedResultError),
				}
				return
			}
		}

		*uniffiOutReturn = FfiConverterExternalFrostSignatureShareINSTANCE.Lower(res)
	}()
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerMethod19
func breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerMethod19(uniffiHandle C.uint64_t, request C.RustBuffer, uniffiFutureCallback C.UniffiForeignFutureCompleteRustBuffer, uniffiCallbackData C.uint64_t, uniffiOutReturn *C.UniffiForeignFuture) {
	handle := uint64(uniffiHandle)
	uniffiObj, ok := FfiConverterExternalSignerINSTANCE.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}

	result := make(chan C.UniffiForeignFutureStructRustBuffer, 1)
	cancel := make(chan struct{}, 1)
	guardHandle := cgo.NewHandle(cancel)
	*uniffiOutReturn = C.UniffiForeignFuture{
		handle: C.uint64_t(guardHandle),
		free:   C.UniffiForeignFutureFree(C.breez_sdk_spark_uniffiFreeGorutine),
	}

	// Wait for compleation or cancel
	go func() {
		select {
		case <-cancel:
		case res := <-result:
			C.call_UniffiForeignFutureCompleteRustBuffer(uniffiFutureCallback, uniffiCallbackData, res)
		}
	}()

	// Eval callback asynchroniously
	go func() {
		asyncResult := &C.UniffiForeignFutureStructRustBuffer{}
		uniffiOutReturn := &asyncResult.returnValue
		callStatus := &asyncResult.callStatus
		defer func() {
			result <- *asyncResult
		}()

		res, err :=
			uniffiObj.AggregateFrost(
				FfiConverterExternalAggregateFrostRequestINSTANCE.Lift(GoRustBuffer{
					inner: request,
				}),
			)

		if err != nil {
			var actualError *SignerError
			if errors.As(err, &actualError) {
				if actualError != nil {
					*callStatus = C.RustCallStatus{
						code:     C.int8_t(uniffiCallbackResultError),
						errorBuf: FfiConverterSignerErrorINSTANCE.Lower(actualError),
					}
					return
				}
			} else {
				*callStatus = C.RustCallStatus{
					code: C.int8_t(uniffiCallbackUnexpectedResultError),
				}
				return
			}
		}

		*uniffiOutReturn = FfiConverterExternalFrostSignatureINSTANCE.Lower(res)
	}()
}

var UniffiVTableCallbackInterfaceExternalSignerINSTANCE = C.UniffiVTableCallbackInterfaceExternalSigner{
	identityPublicKey:               (C.UniffiCallbackInterfaceExternalSignerMethod0)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerMethod0),
	derivePublicKey:                 (C.UniffiCallbackInterfaceExternalSignerMethod1)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerMethod1),
	signEcdsa:                       (C.UniffiCallbackInterfaceExternalSignerMethod2)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerMethod2),
	signEcdsaRecoverable:            (C.UniffiCallbackInterfaceExternalSignerMethod3)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerMethod3),
	encryptEcies:                    (C.UniffiCallbackInterfaceExternalSignerMethod4)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerMethod4),
	decryptEcies:                    (C.UniffiCallbackInterfaceExternalSignerMethod5)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerMethod5),
	signHashSchnorr:                 (C.UniffiCallbackInterfaceExternalSignerMethod6)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerMethod6),
	hmacSha256:                      (C.UniffiCallbackInterfaceExternalSignerMethod7)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerMethod7),
	generateRandomSigningCommitment: (C.UniffiCallbackInterfaceExternalSignerMethod8)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerMethod8),
	getPublicKeyForNode:             (C.UniffiCallbackInterfaceExternalSignerMethod9)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerMethod9),
	generateRandomSecret:            (C.UniffiCallbackInterfaceExternalSignerMethod10)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerMethod10),
	staticDepositSecretEncrypted:    (C.UniffiCallbackInterfaceExternalSignerMethod11)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerMethod11),
	staticDepositSecret:             (C.UniffiCallbackInterfaceExternalSignerMethod12)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerMethod12),
	staticDepositSigningKey:         (C.UniffiCallbackInterfaceExternalSignerMethod13)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerMethod13),
	subtractSecrets:                 (C.UniffiCallbackInterfaceExternalSignerMethod14)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerMethod14),
	splitSecretWithProofs:           (C.UniffiCallbackInterfaceExternalSignerMethod15)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerMethod15),
	encryptSecretForReceiver:        (C.UniffiCallbackInterfaceExternalSignerMethod16)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerMethod16),
	publicKeyFromSecret:             (C.UniffiCallbackInterfaceExternalSignerMethod17)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerMethod17),
	signFrost:                       (C.UniffiCallbackInterfaceExternalSignerMethod18)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerMethod18),
	aggregateFrost:                  (C.UniffiCallbackInterfaceExternalSignerMethod19)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerMethod19),

	uniffiFree: (C.UniffiCallbackInterfaceFree)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerFree),
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerFree
func breez_sdk_spark_cgo_dispatchCallbackInterfaceExternalSignerFree(handle C.uint64_t) {
	FfiConverterExternalSignerINSTANCE.handleMap.remove(uint64(handle))
}

func (c FfiConverterExternalSigner) register() {
	C.uniffi_breez_sdk_spark_fn_init_callback_vtable_externalsigner(&UniffiVTableCallbackInterfaceExternalSignerINSTANCE)
}

// Trait covering fiat-related functionality
type FiatService interface {
	// List all supported fiat currencies for which there is a known exchange rate.
	FetchFiatCurrencies() ([]FiatCurrency, error)
	// Get the live rates from the server.
	FetchFiatRates() ([]Rate, error)
}

// Trait covering fiat-related functionality
type FiatServiceImpl struct {
	ffiObject FfiObject
}

// List all supported fiat currencies for which there is a known exchange rate.
func (_self *FiatServiceImpl) FetchFiatCurrencies() ([]FiatCurrency, error) {
	_pointer := _self.ffiObject.incrementPointer("FiatService")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[ServiceConnectivityError](
		FfiConverterServiceConnectivityErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) []FiatCurrency {
			return FfiConverterSequenceFiatCurrencyINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_fiatservice_fetch_fiat_currencies(
			_pointer),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// Get the live rates from the server.
func (_self *FiatServiceImpl) FetchFiatRates() ([]Rate, error) {
	_pointer := _self.ffiObject.incrementPointer("FiatService")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[ServiceConnectivityError](
		FfiConverterServiceConnectivityErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) []Rate {
			return FfiConverterSequenceRateINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_fiatservice_fetch_fiat_rates(
			_pointer),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}
func (object *FiatServiceImpl) Destroy() {
	runtime.SetFinalizer(object, nil)
	object.ffiObject.destroy()
}

type FfiConverterFiatService struct {
	handleMap *concurrentHandleMap[FiatService]
}

var FfiConverterFiatServiceINSTANCE = FfiConverterFiatService{
	handleMap: newConcurrentHandleMap[FiatService](),
}

func (c FfiConverterFiatService) Lift(pointer unsafe.Pointer) FiatService {
	result := &FiatServiceImpl{
		newFfiObject(
			pointer,
			func(pointer unsafe.Pointer, status *C.RustCallStatus) unsafe.Pointer {
				return C.uniffi_breez_sdk_spark_fn_clone_fiatservice(pointer, status)
			},
			func(pointer unsafe.Pointer, status *C.RustCallStatus) {
				C.uniffi_breez_sdk_spark_fn_free_fiatservice(pointer, status)
			},
		),
	}
	runtime.SetFinalizer(result, (*FiatServiceImpl).Destroy)
	return result
}

func (c FfiConverterFiatService) Read(reader io.Reader) FiatService {
	return c.Lift(unsafe.Pointer(uintptr(readUint64(reader))))
}

func (c FfiConverterFiatService) Lower(value FiatService) unsafe.Pointer {
	// TODO: this is bad - all synchronization from ObjectRuntime.go is discarded here,
	// because the pointer will be decremented immediately after this function returns,
	// and someone will be left holding onto a non-locked pointer.
	pointer := unsafe.Pointer(uintptr(c.handleMap.insert(value)))
	return pointer

}

func (c FfiConverterFiatService) Write(writer io.Writer, value FiatService) {
	writeUint64(writer, uint64(uintptr(c.Lower(value))))
}

type FfiDestroyerFiatService struct{}

func (_ FfiDestroyerFiatService) Destroy(value FiatService) {
	if val, ok := value.(*FiatServiceImpl); ok {
		val.Destroy()
	} else {
		panic("Expected *FiatServiceImpl")
	}
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceFiatServiceMethod0
func breez_sdk_spark_cgo_dispatchCallbackInterfaceFiatServiceMethod0(uniffiHandle C.uint64_t, uniffiFutureCallback C.UniffiForeignFutureCompleteRustBuffer, uniffiCallbackData C.uint64_t, uniffiOutReturn *C.UniffiForeignFuture) {
	handle := uint64(uniffiHandle)
	uniffiObj, ok := FfiConverterFiatServiceINSTANCE.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}

	result := make(chan C.UniffiForeignFutureStructRustBuffer, 1)
	cancel := make(chan struct{}, 1)
	guardHandle := cgo.NewHandle(cancel)
	*uniffiOutReturn = C.UniffiForeignFuture{
		handle: C.uint64_t(guardHandle),
		free:   C.UniffiForeignFutureFree(C.breez_sdk_spark_uniffiFreeGorutine),
	}

	// Wait for compleation or cancel
	go func() {
		select {
		case <-cancel:
		case res := <-result:
			C.call_UniffiForeignFutureCompleteRustBuffer(uniffiFutureCallback, uniffiCallbackData, res)
		}
	}()

	// Eval callback asynchroniously
	go func() {
		asyncResult := &C.UniffiForeignFutureStructRustBuffer{}
		uniffiOutReturn := &asyncResult.returnValue
		callStatus := &asyncResult.callStatus
		defer func() {
			result <- *asyncResult
		}()

		res, err :=
			uniffiObj.FetchFiatCurrencies()

		if err != nil {
			var actualError *ServiceConnectivityError
			if errors.As(err, &actualError) {
				if actualError != nil {
					*callStatus = C.RustCallStatus{
						code:     C.int8_t(uniffiCallbackResultError),
						errorBuf: FfiConverterServiceConnectivityErrorINSTANCE.Lower(actualError),
					}
					return
				}
			} else {
				*callStatus = C.RustCallStatus{
					code: C.int8_t(uniffiCallbackUnexpectedResultError),
				}
				return
			}
		}

		*uniffiOutReturn = FfiConverterSequenceFiatCurrencyINSTANCE.Lower(res)
	}()
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceFiatServiceMethod1
func breez_sdk_spark_cgo_dispatchCallbackInterfaceFiatServiceMethod1(uniffiHandle C.uint64_t, uniffiFutureCallback C.UniffiForeignFutureCompleteRustBuffer, uniffiCallbackData C.uint64_t, uniffiOutReturn *C.UniffiForeignFuture) {
	handle := uint64(uniffiHandle)
	uniffiObj, ok := FfiConverterFiatServiceINSTANCE.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}

	result := make(chan C.UniffiForeignFutureStructRustBuffer, 1)
	cancel := make(chan struct{}, 1)
	guardHandle := cgo.NewHandle(cancel)
	*uniffiOutReturn = C.UniffiForeignFuture{
		handle: C.uint64_t(guardHandle),
		free:   C.UniffiForeignFutureFree(C.breez_sdk_spark_uniffiFreeGorutine),
	}

	// Wait for compleation or cancel
	go func() {
		select {
		case <-cancel:
		case res := <-result:
			C.call_UniffiForeignFutureCompleteRustBuffer(uniffiFutureCallback, uniffiCallbackData, res)
		}
	}()

	// Eval callback asynchroniously
	go func() {
		asyncResult := &C.UniffiForeignFutureStructRustBuffer{}
		uniffiOutReturn := &asyncResult.returnValue
		callStatus := &asyncResult.callStatus
		defer func() {
			result <- *asyncResult
		}()

		res, err :=
			uniffiObj.FetchFiatRates()

		if err != nil {
			var actualError *ServiceConnectivityError
			if errors.As(err, &actualError) {
				if actualError != nil {
					*callStatus = C.RustCallStatus{
						code:     C.int8_t(uniffiCallbackResultError),
						errorBuf: FfiConverterServiceConnectivityErrorINSTANCE.Lower(actualError),
					}
					return
				}
			} else {
				*callStatus = C.RustCallStatus{
					code: C.int8_t(uniffiCallbackUnexpectedResultError),
				}
				return
			}
		}

		*uniffiOutReturn = FfiConverterSequenceRateINSTANCE.Lower(res)
	}()
}

var UniffiVTableCallbackInterfaceFiatServiceINSTANCE = C.UniffiVTableCallbackInterfaceFiatService{
	fetchFiatCurrencies: (C.UniffiCallbackInterfaceFiatServiceMethod0)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceFiatServiceMethod0),
	fetchFiatRates:      (C.UniffiCallbackInterfaceFiatServiceMethod1)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceFiatServiceMethod1),

	uniffiFree: (C.UniffiCallbackInterfaceFree)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceFiatServiceFree),
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceFiatServiceFree
func breez_sdk_spark_cgo_dispatchCallbackInterfaceFiatServiceFree(handle C.uint64_t) {
	FfiConverterFiatServiceINSTANCE.handleMap.remove(uint64(handle))
}

func (c FfiConverterFiatService) register() {
	C.uniffi_breez_sdk_spark_fn_init_callback_vtable_fiatservice(&UniffiVTableCallbackInterfaceFiatServiceINSTANCE)
}

// Orchestrates passkey-based wallet creation and restore operations.
//
// This struct coordinates between the platform's passkey PRF provider and
// Nostr relays to derive wallet mnemonics and manage labels.
//
// The Nostr identity (derived from the passkey's magic salt) is cached after
// the first derivation so that subsequent calls to [`Passkey::list_labels`]
// and [`Passkey::store_label`] do not require additional PRF interactions.
type PasskeyInterface interface {
	// Derive a wallet for a given label.
	//
	// Uses the passkey PRF to derive a 12-word BIP39 mnemonic from the label
	// and returns it as a [`Wallet`] containing the seed and resolved label.
	// This works for both creating a new wallet and restoring an existing one.
	//
	// # Arguments
	// * `label` - A user-chosen label (e.g., "personal", "business").
	// If `None`, defaults to [`DEFAULT_LABEL`].
	GetWallet(label *string) (Wallet, error)
	// Check if passkey PRF is available on this device.
	//
	// Delegates to the platform's `PasskeyPrfProvider` implementation.
	IsAvailable() (bool, error)
	// List all labels published to Nostr for this passkey's identity.
	//
	// Queries Nostr relays for all labels associated with the Nostr identity
	// derived from this passkey. Requires 1 PRF call.
	ListLabels() ([]string, error)
	// Publish a label to Nostr relays for this passkey's identity.
	//
	// Idempotent: if the label already exists, it is not published again.
	// Requires 1 PRF call.
	//
	// # Arguments
	// * `label` - A user-chosen label (e.g., "personal", "business")
	StoreLabel(label string) error
}

// Orchestrates passkey-based wallet creation and restore operations.
//
// This struct coordinates between the platform's passkey PRF provider and
// Nostr relays to derive wallet mnemonics and manage labels.
//
// The Nostr identity (derived from the passkey's magic salt) is cached after
// the first derivation so that subsequent calls to [`Passkey::list_labels`]
// and [`Passkey::store_label`] do not require additional PRF interactions.
type Passkey struct {
	ffiObject FfiObject
}

// Create a new `Passkey` instance.
//
// # Arguments
// * `prf_provider` - Platform implementation of passkey PRF operations
// * `relay_config` - Optional configuration for Nostr relay connections (uses default if None)
func NewPasskey(prfProvider PasskeyPrfProvider, relayConfig *NostrRelayConfig) *Passkey {
	return FfiConverterPasskeyINSTANCE.Lift(rustCall(func(_uniffiStatus *C.RustCallStatus) unsafe.Pointer {
		return C.uniffi_breez_sdk_spark_fn_constructor_passkey_new(FfiConverterPasskeyPrfProviderINSTANCE.Lower(prfProvider), FfiConverterOptionalNostrRelayConfigINSTANCE.Lower(relayConfig), _uniffiStatus)
	}))
}

// Derive a wallet for a given label.
//
// Uses the passkey PRF to derive a 12-word BIP39 mnemonic from the label
// and returns it as a [`Wallet`] containing the seed and resolved label.
// This works for both creating a new wallet and restoring an existing one.
//
// # Arguments
// * `label` - A user-chosen label (e.g., "personal", "business").
// If `None`, defaults to [`DEFAULT_LABEL`].
func (_self *Passkey) GetWallet(label *string) (Wallet, error) {
	_pointer := _self.ffiObject.incrementPointer("*Passkey")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[PasskeyError](
		FfiConverterPasskeyErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) Wallet {
			return FfiConverterWalletINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_passkey_get_wallet(
			_pointer, FfiConverterOptionalStringINSTANCE.Lower(label)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// Check if passkey PRF is available on this device.
//
// Delegates to the platform's `PasskeyPrfProvider` implementation.
func (_self *Passkey) IsAvailable() (bool, error) {
	_pointer := _self.ffiObject.incrementPointer("*Passkey")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[PasskeyError](
		FfiConverterPasskeyErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) C.int8_t {
			res := C.ffi_breez_sdk_spark_rust_future_complete_i8(handle, status)
			return res
		},
		// liftFn
		func(ffi C.int8_t) bool {
			return FfiConverterBoolINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_passkey_is_available(
			_pointer),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_i8(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_i8(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// List all labels published to Nostr for this passkey's identity.
//
// Queries Nostr relays for all labels associated with the Nostr identity
// derived from this passkey. Requires 1 PRF call.
func (_self *Passkey) ListLabels() ([]string, error) {
	_pointer := _self.ffiObject.incrementPointer("*Passkey")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[PasskeyError](
		FfiConverterPasskeyErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) []string {
			return FfiConverterSequenceStringINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_passkey_list_labels(
			_pointer),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// Publish a label to Nostr relays for this passkey's identity.
//
// Idempotent: if the label already exists, it is not published again.
// Requires 1 PRF call.
//
// # Arguments
// * `label` - A user-chosen label (e.g., "personal", "business")
func (_self *Passkey) StoreLabel(label string) error {
	_pointer := _self.ffiObject.incrementPointer("*Passkey")
	defer _self.ffiObject.decrementPointer()
	_, err := uniffiRustCallAsync[PasskeyError](
		FfiConverterPasskeyErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) struct{} {
			C.ffi_breez_sdk_spark_rust_future_complete_void(handle, status)
			return struct{}{}
		},
		// liftFn
		func(_ struct{}) struct{} { return struct{}{} },
		C.uniffi_breez_sdk_spark_fn_method_passkey_store_label(
			_pointer, FfiConverterStringINSTANCE.Lower(label)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_void(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_void(handle)
		},
	)

	if err == nil {
		return nil
	}

	return err
}
func (object *Passkey) Destroy() {
	runtime.SetFinalizer(object, nil)
	object.ffiObject.destroy()
}

type FfiConverterPasskey struct{}

var FfiConverterPasskeyINSTANCE = FfiConverterPasskey{}

func (c FfiConverterPasskey) Lift(pointer unsafe.Pointer) *Passkey {
	result := &Passkey{
		newFfiObject(
			pointer,
			func(pointer unsafe.Pointer, status *C.RustCallStatus) unsafe.Pointer {
				return C.uniffi_breez_sdk_spark_fn_clone_passkey(pointer, status)
			},
			func(pointer unsafe.Pointer, status *C.RustCallStatus) {
				C.uniffi_breez_sdk_spark_fn_free_passkey(pointer, status)
			},
		),
	}
	runtime.SetFinalizer(result, (*Passkey).Destroy)
	return result
}

func (c FfiConverterPasskey) Read(reader io.Reader) *Passkey {
	return c.Lift(unsafe.Pointer(uintptr(readUint64(reader))))
}

func (c FfiConverterPasskey) Lower(value *Passkey) unsafe.Pointer {
	// TODO: this is bad - all synchronization from ObjectRuntime.go is discarded here,
	// because the pointer will be decremented immediately after this function returns,
	// and someone will be left holding onto a non-locked pointer.
	pointer := value.ffiObject.incrementPointer("*Passkey")
	defer value.ffiObject.decrementPointer()
	return pointer

}

func (c FfiConverterPasskey) Write(writer io.Writer, value *Passkey) {
	writeUint64(writer, uint64(uintptr(c.Lower(value))))
}

type FfiDestroyerPasskey struct{}

func (_ FfiDestroyerPasskey) Destroy(value *Passkey) {
	value.Destroy()
}

// Trait for passkey PRF (Pseudo-Random Function) operations.
//
// Platforms must implement this trait to provide passkey PRF functionality.
// The implementation is responsible for:
// - Authenticating the user via platform-specific passkey APIs (`WebAuthn`, native passkey managers)
// - Evaluating the PRF extension with the provided salt
// - Returning the 32-byte PRF output
type PasskeyPrfProvider interface {
	// Derive a 32-byte seed from passkey PRF with the given salt.
	//
	// The platform authenticates the user via passkey and evaluates the PRF extension.
	// The salt is used as input to the PRF to derive a deterministic output.
	//
	// # Arguments
	// * `salt` - The salt string to use for PRF evaluation
	//
	// # Returns
	// * `Ok(Vec<u8>)` - The 32-byte PRF output
	// * `Err(PasskeyPrfError)` - If authentication fails or PRF is not supported
	DerivePrfSeed(salt string) ([]byte, error)
	// Check if a PRF-capable passkey is available on this device.
	//
	// This allows applications to gracefully degrade if passkey PRF is not supported.
	//
	// # Returns
	// * `Ok(true)` - PRF-capable passkey is available
	// * `Ok(false)` - No PRF-capable passkey available
	// * `Err(PasskeyPrfError)` - If the check fails
	IsPrfAvailable() (bool, error)
}

// Trait for passkey PRF (Pseudo-Random Function) operations.
//
// Platforms must implement this trait to provide passkey PRF functionality.
// The implementation is responsible for:
// - Authenticating the user via platform-specific passkey APIs (`WebAuthn`, native passkey managers)
// - Evaluating the PRF extension with the provided salt
// - Returning the 32-byte PRF output
type PasskeyPrfProviderImpl struct {
	ffiObject FfiObject
}

// Derive a 32-byte seed from passkey PRF with the given salt.
//
// The platform authenticates the user via passkey and evaluates the PRF extension.
// The salt is used as input to the PRF to derive a deterministic output.
//
// # Arguments
// * `salt` - The salt string to use for PRF evaluation
//
// # Returns
// * `Ok(Vec<u8>)` - The 32-byte PRF output
// * `Err(PasskeyPrfError)` - If authentication fails or PRF is not supported
func (_self *PasskeyPrfProviderImpl) DerivePrfSeed(salt string) ([]byte, error) {
	_pointer := _self.ffiObject.incrementPointer("PasskeyPrfProvider")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[PasskeyPrfError](
		FfiConverterPasskeyPrfErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) []byte {
			return FfiConverterBytesINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_passkeyprfprovider_derive_prf_seed(
			_pointer, FfiConverterStringINSTANCE.Lower(salt)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// Check if a PRF-capable passkey is available on this device.
//
// This allows applications to gracefully degrade if passkey PRF is not supported.
//
// # Returns
// * `Ok(true)` - PRF-capable passkey is available
// * `Ok(false)` - No PRF-capable passkey available
// * `Err(PasskeyPrfError)` - If the check fails
func (_self *PasskeyPrfProviderImpl) IsPrfAvailable() (bool, error) {
	_pointer := _self.ffiObject.incrementPointer("PasskeyPrfProvider")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[PasskeyPrfError](
		FfiConverterPasskeyPrfErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) C.int8_t {
			res := C.ffi_breez_sdk_spark_rust_future_complete_i8(handle, status)
			return res
		},
		// liftFn
		func(ffi C.int8_t) bool {
			return FfiConverterBoolINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_passkeyprfprovider_is_prf_available(
			_pointer),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_i8(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_i8(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}
func (object *PasskeyPrfProviderImpl) Destroy() {
	runtime.SetFinalizer(object, nil)
	object.ffiObject.destroy()
}

type FfiConverterPasskeyPrfProvider struct {
	handleMap *concurrentHandleMap[PasskeyPrfProvider]
}

var FfiConverterPasskeyPrfProviderINSTANCE = FfiConverterPasskeyPrfProvider{
	handleMap: newConcurrentHandleMap[PasskeyPrfProvider](),
}

func (c FfiConverterPasskeyPrfProvider) Lift(pointer unsafe.Pointer) PasskeyPrfProvider {
	result := &PasskeyPrfProviderImpl{
		newFfiObject(
			pointer,
			func(pointer unsafe.Pointer, status *C.RustCallStatus) unsafe.Pointer {
				return C.uniffi_breez_sdk_spark_fn_clone_passkeyprfprovider(pointer, status)
			},
			func(pointer unsafe.Pointer, status *C.RustCallStatus) {
				C.uniffi_breez_sdk_spark_fn_free_passkeyprfprovider(pointer, status)
			},
		),
	}
	runtime.SetFinalizer(result, (*PasskeyPrfProviderImpl).Destroy)
	return result
}

func (c FfiConverterPasskeyPrfProvider) Read(reader io.Reader) PasskeyPrfProvider {
	return c.Lift(unsafe.Pointer(uintptr(readUint64(reader))))
}

func (c FfiConverterPasskeyPrfProvider) Lower(value PasskeyPrfProvider) unsafe.Pointer {
	// TODO: this is bad - all synchronization from ObjectRuntime.go is discarded here,
	// because the pointer will be decremented immediately after this function returns,
	// and someone will be left holding onto a non-locked pointer.
	pointer := unsafe.Pointer(uintptr(c.handleMap.insert(value)))
	return pointer

}

func (c FfiConverterPasskeyPrfProvider) Write(writer io.Writer, value PasskeyPrfProvider) {
	writeUint64(writer, uint64(uintptr(c.Lower(value))))
}

type FfiDestroyerPasskeyPrfProvider struct{}

func (_ FfiDestroyerPasskeyPrfProvider) Destroy(value PasskeyPrfProvider) {
	if val, ok := value.(*PasskeyPrfProviderImpl); ok {
		val.Destroy()
	} else {
		panic("Expected *PasskeyPrfProviderImpl")
	}
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfacePasskeyPrfProviderMethod0
func breez_sdk_spark_cgo_dispatchCallbackInterfacePasskeyPrfProviderMethod0(uniffiHandle C.uint64_t, salt C.RustBuffer, uniffiFutureCallback C.UniffiForeignFutureCompleteRustBuffer, uniffiCallbackData C.uint64_t, uniffiOutReturn *C.UniffiForeignFuture) {
	handle := uint64(uniffiHandle)
	uniffiObj, ok := FfiConverterPasskeyPrfProviderINSTANCE.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}

	result := make(chan C.UniffiForeignFutureStructRustBuffer, 1)
	cancel := make(chan struct{}, 1)
	guardHandle := cgo.NewHandle(cancel)
	*uniffiOutReturn = C.UniffiForeignFuture{
		handle: C.uint64_t(guardHandle),
		free:   C.UniffiForeignFutureFree(C.breez_sdk_spark_uniffiFreeGorutine),
	}

	// Wait for compleation or cancel
	go func() {
		select {
		case <-cancel:
		case res := <-result:
			C.call_UniffiForeignFutureCompleteRustBuffer(uniffiFutureCallback, uniffiCallbackData, res)
		}
	}()

	// Eval callback asynchroniously
	go func() {
		asyncResult := &C.UniffiForeignFutureStructRustBuffer{}
		uniffiOutReturn := &asyncResult.returnValue
		callStatus := &asyncResult.callStatus
		defer func() {
			result <- *asyncResult
		}()

		res, err :=
			uniffiObj.DerivePrfSeed(
				FfiConverterStringINSTANCE.Lift(GoRustBuffer{
					inner: salt,
				}),
			)

		if err != nil {
			var actualError *PasskeyPrfError
			if errors.As(err, &actualError) {
				if actualError != nil {
					*callStatus = C.RustCallStatus{
						code:     C.int8_t(uniffiCallbackResultError),
						errorBuf: FfiConverterPasskeyPrfErrorINSTANCE.Lower(actualError),
					}
					return
				}
			} else {
				*callStatus = C.RustCallStatus{
					code: C.int8_t(uniffiCallbackUnexpectedResultError),
				}
				return
			}
		}

		*uniffiOutReturn = FfiConverterBytesINSTANCE.Lower(res)
	}()
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfacePasskeyPrfProviderMethod1
func breez_sdk_spark_cgo_dispatchCallbackInterfacePasskeyPrfProviderMethod1(uniffiHandle C.uint64_t, uniffiFutureCallback C.UniffiForeignFutureCompleteI8, uniffiCallbackData C.uint64_t, uniffiOutReturn *C.UniffiForeignFuture) {
	handle := uint64(uniffiHandle)
	uniffiObj, ok := FfiConverterPasskeyPrfProviderINSTANCE.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}

	result := make(chan C.UniffiForeignFutureStructI8, 1)
	cancel := make(chan struct{}, 1)
	guardHandle := cgo.NewHandle(cancel)
	*uniffiOutReturn = C.UniffiForeignFuture{
		handle: C.uint64_t(guardHandle),
		free:   C.UniffiForeignFutureFree(C.breez_sdk_spark_uniffiFreeGorutine),
	}

	// Wait for compleation or cancel
	go func() {
		select {
		case <-cancel:
		case res := <-result:
			C.call_UniffiForeignFutureCompleteI8(uniffiFutureCallback, uniffiCallbackData, res)
		}
	}()

	// Eval callback asynchroniously
	go func() {
		asyncResult := &C.UniffiForeignFutureStructI8{}
		uniffiOutReturn := &asyncResult.returnValue
		callStatus := &asyncResult.callStatus
		defer func() {
			result <- *asyncResult
		}()

		res, err :=
			uniffiObj.IsPrfAvailable()

		if err != nil {
			var actualError *PasskeyPrfError
			if errors.As(err, &actualError) {
				if actualError != nil {
					*callStatus = C.RustCallStatus{
						code:     C.int8_t(uniffiCallbackResultError),
						errorBuf: FfiConverterPasskeyPrfErrorINSTANCE.Lower(actualError),
					}
					return
				}
			} else {
				*callStatus = C.RustCallStatus{
					code: C.int8_t(uniffiCallbackUnexpectedResultError),
				}
				return
			}
		}

		*uniffiOutReturn = FfiConverterBoolINSTANCE.Lower(res)
	}()
}

var UniffiVTableCallbackInterfacePasskeyPrfProviderINSTANCE = C.UniffiVTableCallbackInterfacePasskeyPrfProvider{
	derivePrfSeed:  (C.UniffiCallbackInterfacePasskeyPrfProviderMethod0)(C.breez_sdk_spark_cgo_dispatchCallbackInterfacePasskeyPrfProviderMethod0),
	isPrfAvailable: (C.UniffiCallbackInterfacePasskeyPrfProviderMethod1)(C.breez_sdk_spark_cgo_dispatchCallbackInterfacePasskeyPrfProviderMethod1),

	uniffiFree: (C.UniffiCallbackInterfaceFree)(C.breez_sdk_spark_cgo_dispatchCallbackInterfacePasskeyPrfProviderFree),
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfacePasskeyPrfProviderFree
func breez_sdk_spark_cgo_dispatchCallbackInterfacePasskeyPrfProviderFree(handle C.uint64_t) {
	FfiConverterPasskeyPrfProviderINSTANCE.handleMap.remove(uint64(handle))
}

func (c FfiConverterPasskeyPrfProvider) register() {
	C.uniffi_breez_sdk_spark_fn_init_callback_vtable_passkeyprfprovider(&UniffiVTableCallbackInterfacePasskeyPrfProviderINSTANCE)
}

// This interface is used to observe outgoing payments before Lightning, Spark and onchain Bitcoin payments.
// If the implementation returns an error, the payment is cancelled.
type PaymentObserver interface {
	// Called before Lightning, Spark or onchain Bitcoin payments are made
	BeforeSend(payments []ProvisionalPayment) error
}

// This interface is used to observe outgoing payments before Lightning, Spark and onchain Bitcoin payments.
// If the implementation returns an error, the payment is cancelled.
type PaymentObserverImpl struct {
	ffiObject FfiObject
}

// Called before Lightning, Spark or onchain Bitcoin payments are made
func (_self *PaymentObserverImpl) BeforeSend(payments []ProvisionalPayment) error {
	_pointer := _self.ffiObject.incrementPointer("PaymentObserver")
	defer _self.ffiObject.decrementPointer()
	_, err := uniffiRustCallAsync[PaymentObserverError](
		FfiConverterPaymentObserverErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) struct{} {
			C.ffi_breez_sdk_spark_rust_future_complete_void(handle, status)
			return struct{}{}
		},
		// liftFn
		func(_ struct{}) struct{} { return struct{}{} },
		C.uniffi_breez_sdk_spark_fn_method_paymentobserver_before_send(
			_pointer, FfiConverterSequenceProvisionalPaymentINSTANCE.Lower(payments)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_void(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_void(handle)
		},
	)

	if err == nil {
		return nil
	}

	return err
}
func (object *PaymentObserverImpl) Destroy() {
	runtime.SetFinalizer(object, nil)
	object.ffiObject.destroy()
}

type FfiConverterPaymentObserver struct {
	handleMap *concurrentHandleMap[PaymentObserver]
}

var FfiConverterPaymentObserverINSTANCE = FfiConverterPaymentObserver{
	handleMap: newConcurrentHandleMap[PaymentObserver](),
}

func (c FfiConverterPaymentObserver) Lift(pointer unsafe.Pointer) PaymentObserver {
	result := &PaymentObserverImpl{
		newFfiObject(
			pointer,
			func(pointer unsafe.Pointer, status *C.RustCallStatus) unsafe.Pointer {
				return C.uniffi_breez_sdk_spark_fn_clone_paymentobserver(pointer, status)
			},
			func(pointer unsafe.Pointer, status *C.RustCallStatus) {
				C.uniffi_breez_sdk_spark_fn_free_paymentobserver(pointer, status)
			},
		),
	}
	runtime.SetFinalizer(result, (*PaymentObserverImpl).Destroy)
	return result
}

func (c FfiConverterPaymentObserver) Read(reader io.Reader) PaymentObserver {
	return c.Lift(unsafe.Pointer(uintptr(readUint64(reader))))
}

func (c FfiConverterPaymentObserver) Lower(value PaymentObserver) unsafe.Pointer {
	// TODO: this is bad - all synchronization from ObjectRuntime.go is discarded here,
	// because the pointer will be decremented immediately after this function returns,
	// and someone will be left holding onto a non-locked pointer.
	pointer := unsafe.Pointer(uintptr(c.handleMap.insert(value)))
	return pointer

}

func (c FfiConverterPaymentObserver) Write(writer io.Writer, value PaymentObserver) {
	writeUint64(writer, uint64(uintptr(c.Lower(value))))
}

type FfiDestroyerPaymentObserver struct{}

func (_ FfiDestroyerPaymentObserver) Destroy(value PaymentObserver) {
	if val, ok := value.(*PaymentObserverImpl); ok {
		val.Destroy()
	} else {
		panic("Expected *PaymentObserverImpl")
	}
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfacePaymentObserverMethod0
func breez_sdk_spark_cgo_dispatchCallbackInterfacePaymentObserverMethod0(uniffiHandle C.uint64_t, payments C.RustBuffer, uniffiFutureCallback C.UniffiForeignFutureCompleteVoid, uniffiCallbackData C.uint64_t, uniffiOutReturn *C.UniffiForeignFuture) {
	handle := uint64(uniffiHandle)
	uniffiObj, ok := FfiConverterPaymentObserverINSTANCE.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}

	result := make(chan C.UniffiForeignFutureStructVoid, 1)
	cancel := make(chan struct{}, 1)
	guardHandle := cgo.NewHandle(cancel)
	*uniffiOutReturn = C.UniffiForeignFuture{
		handle: C.uint64_t(guardHandle),
		free:   C.UniffiForeignFutureFree(C.breez_sdk_spark_uniffiFreeGorutine),
	}

	// Wait for compleation or cancel
	go func() {
		select {
		case <-cancel:
		case res := <-result:
			C.call_UniffiForeignFutureCompleteVoid(uniffiFutureCallback, uniffiCallbackData, res)
		}
	}()

	// Eval callback asynchroniously
	go func() {
		asyncResult := &C.UniffiForeignFutureStructVoid{}
		callStatus := &asyncResult.callStatus
		defer func() {
			result <- *asyncResult
		}()

		err :=
			uniffiObj.BeforeSend(
				FfiConverterSequenceProvisionalPaymentINSTANCE.Lift(GoRustBuffer{
					inner: payments,
				}),
			)

		if err != nil {
			var actualError *PaymentObserverError
			if errors.As(err, &actualError) {
				if actualError != nil {
					*callStatus = C.RustCallStatus{
						code:     C.int8_t(uniffiCallbackResultError),
						errorBuf: FfiConverterPaymentObserverErrorINSTANCE.Lower(actualError),
					}
					return
				}
			} else {
				*callStatus = C.RustCallStatus{
					code: C.int8_t(uniffiCallbackUnexpectedResultError),
				}
				return
			}
		}

	}()
}

var UniffiVTableCallbackInterfacePaymentObserverINSTANCE = C.UniffiVTableCallbackInterfacePaymentObserver{
	beforeSend: (C.UniffiCallbackInterfacePaymentObserverMethod0)(C.breez_sdk_spark_cgo_dispatchCallbackInterfacePaymentObserverMethod0),

	uniffiFree: (C.UniffiCallbackInterfaceFree)(C.breez_sdk_spark_cgo_dispatchCallbackInterfacePaymentObserverFree),
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfacePaymentObserverFree
func breez_sdk_spark_cgo_dispatchCallbackInterfacePaymentObserverFree(handle C.uint64_t) {
	FfiConverterPaymentObserverINSTANCE.handleMap.remove(uint64(handle))
}

func (c FfiConverterPaymentObserver) register() {
	C.uniffi_breez_sdk_spark_fn_init_callback_vtable_paymentobserver(&UniffiVTableCallbackInterfacePaymentObserverINSTANCE)
}

// REST client trait for making HTTP requests.
//
// This trait provides a way for users to supply their own HTTP client implementation
// for use with the SDK. The SDK will use this client for all HTTP operations including
// LNURL flows and chain service requests.
type RestClient interface {
	// Makes a GET request and logs on DEBUG.
	// ### Arguments
	// - `url`: the URL on which GET will be called
	// - `headers`: optional headers that will be set on the request
	GetRequest(url string, headers *map[string]string) (RestResponse, error)
	// Makes a POST request, and logs on DEBUG.
	// ### Arguments
	// - `url`: the URL on which POST will be called
	// - `headers`: the optional POST headers
	// - `body`: the optional POST body
	PostRequest(url string, headers *map[string]string, body *string) (RestResponse, error)
	// Makes a DELETE request, and logs on DEBUG.
	// ### Arguments
	// - `url`: the URL on which DELETE will be called
	// - `headers`: the optional DELETE headers
	// - `body`: the optional DELETE body
	DeleteRequest(url string, headers *map[string]string, body *string) (RestResponse, error)
}

// REST client trait for making HTTP requests.
//
// This trait provides a way for users to supply their own HTTP client implementation
// for use with the SDK. The SDK will use this client for all HTTP operations including
// LNURL flows and chain service requests.
type RestClientImpl struct {
	ffiObject FfiObject
}

// Makes a GET request and logs on DEBUG.
// ### Arguments
// - `url`: the URL on which GET will be called
// - `headers`: optional headers that will be set on the request
func (_self *RestClientImpl) GetRequest(url string, headers *map[string]string) (RestResponse, error) {
	_pointer := _self.ffiObject.incrementPointer("RestClient")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[ServiceConnectivityError](
		FfiConverterServiceConnectivityErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) RestResponse {
			return FfiConverterRestResponseINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_restclient_get_request(
			_pointer, FfiConverterStringINSTANCE.Lower(url), FfiConverterOptionalMapStringStringINSTANCE.Lower(headers)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// Makes a POST request, and logs on DEBUG.
// ### Arguments
// - `url`: the URL on which POST will be called
// - `headers`: the optional POST headers
// - `body`: the optional POST body
func (_self *RestClientImpl) PostRequest(url string, headers *map[string]string, body *string) (RestResponse, error) {
	_pointer := _self.ffiObject.incrementPointer("RestClient")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[ServiceConnectivityError](
		FfiConverterServiceConnectivityErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) RestResponse {
			return FfiConverterRestResponseINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_restclient_post_request(
			_pointer, FfiConverterStringINSTANCE.Lower(url), FfiConverterOptionalMapStringStringINSTANCE.Lower(headers), FfiConverterOptionalStringINSTANCE.Lower(body)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// Makes a DELETE request, and logs on DEBUG.
// ### Arguments
// - `url`: the URL on which DELETE will be called
// - `headers`: the optional DELETE headers
// - `body`: the optional DELETE body
func (_self *RestClientImpl) DeleteRequest(url string, headers *map[string]string, body *string) (RestResponse, error) {
	_pointer := _self.ffiObject.incrementPointer("RestClient")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[ServiceConnectivityError](
		FfiConverterServiceConnectivityErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) RestResponse {
			return FfiConverterRestResponseINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_restclient_delete_request(
			_pointer, FfiConverterStringINSTANCE.Lower(url), FfiConverterOptionalMapStringStringINSTANCE.Lower(headers), FfiConverterOptionalStringINSTANCE.Lower(body)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}
func (object *RestClientImpl) Destroy() {
	runtime.SetFinalizer(object, nil)
	object.ffiObject.destroy()
}

type FfiConverterRestClient struct {
	handleMap *concurrentHandleMap[RestClient]
}

var FfiConverterRestClientINSTANCE = FfiConverterRestClient{
	handleMap: newConcurrentHandleMap[RestClient](),
}

func (c FfiConverterRestClient) Lift(pointer unsafe.Pointer) RestClient {
	result := &RestClientImpl{
		newFfiObject(
			pointer,
			func(pointer unsafe.Pointer, status *C.RustCallStatus) unsafe.Pointer {
				return C.uniffi_breez_sdk_spark_fn_clone_restclient(pointer, status)
			},
			func(pointer unsafe.Pointer, status *C.RustCallStatus) {
				C.uniffi_breez_sdk_spark_fn_free_restclient(pointer, status)
			},
		),
	}
	runtime.SetFinalizer(result, (*RestClientImpl).Destroy)
	return result
}

func (c FfiConverterRestClient) Read(reader io.Reader) RestClient {
	return c.Lift(unsafe.Pointer(uintptr(readUint64(reader))))
}

func (c FfiConverterRestClient) Lower(value RestClient) unsafe.Pointer {
	// TODO: this is bad - all synchronization from ObjectRuntime.go is discarded here,
	// because the pointer will be decremented immediately after this function returns,
	// and someone will be left holding onto a non-locked pointer.
	pointer := unsafe.Pointer(uintptr(c.handleMap.insert(value)))
	return pointer

}

func (c FfiConverterRestClient) Write(writer io.Writer, value RestClient) {
	writeUint64(writer, uint64(uintptr(c.Lower(value))))
}

type FfiDestroyerRestClient struct{}

func (_ FfiDestroyerRestClient) Destroy(value RestClient) {
	if val, ok := value.(*RestClientImpl); ok {
		val.Destroy()
	} else {
		panic("Expected *RestClientImpl")
	}
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceRestClientMethod0
func breez_sdk_spark_cgo_dispatchCallbackInterfaceRestClientMethod0(uniffiHandle C.uint64_t, url C.RustBuffer, headers C.RustBuffer, uniffiFutureCallback C.UniffiForeignFutureCompleteRustBuffer, uniffiCallbackData C.uint64_t, uniffiOutReturn *C.UniffiForeignFuture) {
	handle := uint64(uniffiHandle)
	uniffiObj, ok := FfiConverterRestClientINSTANCE.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}

	result := make(chan C.UniffiForeignFutureStructRustBuffer, 1)
	cancel := make(chan struct{}, 1)
	guardHandle := cgo.NewHandle(cancel)
	*uniffiOutReturn = C.UniffiForeignFuture{
		handle: C.uint64_t(guardHandle),
		free:   C.UniffiForeignFutureFree(C.breez_sdk_spark_uniffiFreeGorutine),
	}

	// Wait for compleation or cancel
	go func() {
		select {
		case <-cancel:
		case res := <-result:
			C.call_UniffiForeignFutureCompleteRustBuffer(uniffiFutureCallback, uniffiCallbackData, res)
		}
	}()

	// Eval callback asynchroniously
	go func() {
		asyncResult := &C.UniffiForeignFutureStructRustBuffer{}
		uniffiOutReturn := &asyncResult.returnValue
		callStatus := &asyncResult.callStatus
		defer func() {
			result <- *asyncResult
		}()

		res, err :=
			uniffiObj.GetRequest(
				FfiConverterStringINSTANCE.Lift(GoRustBuffer{
					inner: url,
				}),
				FfiConverterOptionalMapStringStringINSTANCE.Lift(GoRustBuffer{
					inner: headers,
				}),
			)

		if err != nil {
			var actualError *ServiceConnectivityError
			if errors.As(err, &actualError) {
				if actualError != nil {
					*callStatus = C.RustCallStatus{
						code:     C.int8_t(uniffiCallbackResultError),
						errorBuf: FfiConverterServiceConnectivityErrorINSTANCE.Lower(actualError),
					}
					return
				}
			} else {
				*callStatus = C.RustCallStatus{
					code: C.int8_t(uniffiCallbackUnexpectedResultError),
				}
				return
			}
		}

		*uniffiOutReturn = FfiConverterRestResponseINSTANCE.Lower(res)
	}()
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceRestClientMethod1
func breez_sdk_spark_cgo_dispatchCallbackInterfaceRestClientMethod1(uniffiHandle C.uint64_t, url C.RustBuffer, headers C.RustBuffer, body C.RustBuffer, uniffiFutureCallback C.UniffiForeignFutureCompleteRustBuffer, uniffiCallbackData C.uint64_t, uniffiOutReturn *C.UniffiForeignFuture) {
	handle := uint64(uniffiHandle)
	uniffiObj, ok := FfiConverterRestClientINSTANCE.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}

	result := make(chan C.UniffiForeignFutureStructRustBuffer, 1)
	cancel := make(chan struct{}, 1)
	guardHandle := cgo.NewHandle(cancel)
	*uniffiOutReturn = C.UniffiForeignFuture{
		handle: C.uint64_t(guardHandle),
		free:   C.UniffiForeignFutureFree(C.breez_sdk_spark_uniffiFreeGorutine),
	}

	// Wait for compleation or cancel
	go func() {
		select {
		case <-cancel:
		case res := <-result:
			C.call_UniffiForeignFutureCompleteRustBuffer(uniffiFutureCallback, uniffiCallbackData, res)
		}
	}()

	// Eval callback asynchroniously
	go func() {
		asyncResult := &C.UniffiForeignFutureStructRustBuffer{}
		uniffiOutReturn := &asyncResult.returnValue
		callStatus := &asyncResult.callStatus
		defer func() {
			result <- *asyncResult
		}()

		res, err :=
			uniffiObj.PostRequest(
				FfiConverterStringINSTANCE.Lift(GoRustBuffer{
					inner: url,
				}),
				FfiConverterOptionalMapStringStringINSTANCE.Lift(GoRustBuffer{
					inner: headers,
				}),
				FfiConverterOptionalStringINSTANCE.Lift(GoRustBuffer{
					inner: body,
				}),
			)

		if err != nil {
			var actualError *ServiceConnectivityError
			if errors.As(err, &actualError) {
				if actualError != nil {
					*callStatus = C.RustCallStatus{
						code:     C.int8_t(uniffiCallbackResultError),
						errorBuf: FfiConverterServiceConnectivityErrorINSTANCE.Lower(actualError),
					}
					return
				}
			} else {
				*callStatus = C.RustCallStatus{
					code: C.int8_t(uniffiCallbackUnexpectedResultError),
				}
				return
			}
		}

		*uniffiOutReturn = FfiConverterRestResponseINSTANCE.Lower(res)
	}()
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceRestClientMethod2
func breez_sdk_spark_cgo_dispatchCallbackInterfaceRestClientMethod2(uniffiHandle C.uint64_t, url C.RustBuffer, headers C.RustBuffer, body C.RustBuffer, uniffiFutureCallback C.UniffiForeignFutureCompleteRustBuffer, uniffiCallbackData C.uint64_t, uniffiOutReturn *C.UniffiForeignFuture) {
	handle := uint64(uniffiHandle)
	uniffiObj, ok := FfiConverterRestClientINSTANCE.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}

	result := make(chan C.UniffiForeignFutureStructRustBuffer, 1)
	cancel := make(chan struct{}, 1)
	guardHandle := cgo.NewHandle(cancel)
	*uniffiOutReturn = C.UniffiForeignFuture{
		handle: C.uint64_t(guardHandle),
		free:   C.UniffiForeignFutureFree(C.breez_sdk_spark_uniffiFreeGorutine),
	}

	// Wait for compleation or cancel
	go func() {
		select {
		case <-cancel:
		case res := <-result:
			C.call_UniffiForeignFutureCompleteRustBuffer(uniffiFutureCallback, uniffiCallbackData, res)
		}
	}()

	// Eval callback asynchroniously
	go func() {
		asyncResult := &C.UniffiForeignFutureStructRustBuffer{}
		uniffiOutReturn := &asyncResult.returnValue
		callStatus := &asyncResult.callStatus
		defer func() {
			result <- *asyncResult
		}()

		res, err :=
			uniffiObj.DeleteRequest(
				FfiConverterStringINSTANCE.Lift(GoRustBuffer{
					inner: url,
				}),
				FfiConverterOptionalMapStringStringINSTANCE.Lift(GoRustBuffer{
					inner: headers,
				}),
				FfiConverterOptionalStringINSTANCE.Lift(GoRustBuffer{
					inner: body,
				}),
			)

		if err != nil {
			var actualError *ServiceConnectivityError
			if errors.As(err, &actualError) {
				if actualError != nil {
					*callStatus = C.RustCallStatus{
						code:     C.int8_t(uniffiCallbackResultError),
						errorBuf: FfiConverterServiceConnectivityErrorINSTANCE.Lower(actualError),
					}
					return
				}
			} else {
				*callStatus = C.RustCallStatus{
					code: C.int8_t(uniffiCallbackUnexpectedResultError),
				}
				return
			}
		}

		*uniffiOutReturn = FfiConverterRestResponseINSTANCE.Lower(res)
	}()
}

var UniffiVTableCallbackInterfaceRestClientINSTANCE = C.UniffiVTableCallbackInterfaceRestClient{
	getRequest:    (C.UniffiCallbackInterfaceRestClientMethod0)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceRestClientMethod0),
	postRequest:   (C.UniffiCallbackInterfaceRestClientMethod1)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceRestClientMethod1),
	deleteRequest: (C.UniffiCallbackInterfaceRestClientMethod2)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceRestClientMethod2),

	uniffiFree: (C.UniffiCallbackInterfaceFree)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceRestClientFree),
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceRestClientFree
func breez_sdk_spark_cgo_dispatchCallbackInterfaceRestClientFree(handle C.uint64_t) {
	FfiConverterRestClientINSTANCE.handleMap.remove(uint64(handle))
}

func (c FfiConverterRestClient) register() {
	C.uniffi_breez_sdk_spark_fn_init_callback_vtable_restclient(&UniffiVTableCallbackInterfaceRestClientINSTANCE)
}

// Builder for creating `BreezSdk` instances with customizable components.
type SdkBuilderInterface interface {
	// Builds the `BreezSdk` instance with the configured components.
	Build() (*BreezSdk, error)
	// Sets the chain service to be used by the SDK.
	// Arguments:
	// - `chain_service`: The chain service to be used.
	WithChainService(chainService BitcoinChainService)
	// Sets the root storage directory to initialize the default storage with.
	// This initializes both storage and real-time sync storage with the
	// default implementations.
	// Arguments:
	// - `storage_dir`: The data directory for storage.
	WithDefaultStorage(storageDir string)
	// Sets the fiat service to be used by the SDK.
	// Arguments:
	// - `fiat_service`: The fiat service to be used.
	WithFiatService(fiatService FiatService)
	// Sets the key set type to be used by the SDK.
	// Arguments:
	// - `config`: Key set configuration containing the key set type, address index flag, and optional account number.
	WithKeySet(config KeySetConfig)
	WithLnurlClient(lnurlClient RestClient)
	// Sets the payment observer to be used by the SDK.
	// Arguments:
	// - `payment_observer`: The payment observer to be used.
	WithPaymentObserver(paymentObserver PaymentObserver)
	// Sets `PostgreSQL` as the backend for all stores (storage, tree store, and token store).
	// The store instances will be created during `build()`.
	// Arguments:
	// - `config`: The `PostgreSQL` storage configuration.
	WithPostgresBackend(config PostgresStorageConfig)
	// Sets the REST chain service to be used by the SDK.
	// Arguments:
	// - `url`: The base URL of the REST API.
	// - `api_type`: The API type to be used.
	// - `credentials`: Optional credentials for basic authentication.
	WithRestChainService(url string, apiType ChainApiType, credentials *Credentials)
	// Sets the storage implementation to be used by the SDK.
	// Arguments:
	// - `storage`: The storage implementation to be used.
	WithStorage(storage Storage)
}

// Builder for creating `BreezSdk` instances with customizable components.
type SdkBuilder struct {
	ffiObject FfiObject
}

// Creates a new `SdkBuilder` with the provided configuration.
// Arguments:
// - `config`: The configuration to be used.
// - `seed`: The seed for wallet generation.
func NewSdkBuilder(config Config, seed Seed) *SdkBuilder {
	return FfiConverterSdkBuilderINSTANCE.Lift(rustCall(func(_uniffiStatus *C.RustCallStatus) unsafe.Pointer {
		return C.uniffi_breez_sdk_spark_fn_constructor_sdkbuilder_new(FfiConverterConfigINSTANCE.Lower(config), FfiConverterSeedINSTANCE.Lower(seed), _uniffiStatus)
	}))
}

// Builds the `BreezSdk` instance with the configured components.
func (_self *SdkBuilder) Build() (*BreezSdk, error) {
	_pointer := _self.ffiObject.incrementPointer("*SdkBuilder")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[SdkError](
		FfiConverterSdkErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) unsafe.Pointer {
			res := C.ffi_breez_sdk_spark_rust_future_complete_pointer(handle, status)
			return res
		},
		// liftFn
		func(ffi unsafe.Pointer) *BreezSdk {
			return FfiConverterBreezSdkINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_sdkbuilder_build(
			_pointer),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_pointer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_pointer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// Sets the chain service to be used by the SDK.
// Arguments:
// - `chain_service`: The chain service to be used.
func (_self *SdkBuilder) WithChainService(chainService BitcoinChainService) {
	_pointer := _self.ffiObject.incrementPointer("*SdkBuilder")
	defer _self.ffiObject.decrementPointer()
	uniffiRustCallAsync[error](
		nil,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) struct{} {
			C.ffi_breez_sdk_spark_rust_future_complete_void(handle, status)
			return struct{}{}
		},
		// liftFn
		func(_ struct{}) struct{} { return struct{}{} },
		C.uniffi_breez_sdk_spark_fn_method_sdkbuilder_with_chain_service(
			_pointer, FfiConverterBitcoinChainServiceINSTANCE.Lower(chainService)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_void(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_void(handle)
		},
	)

}

// Sets the root storage directory to initialize the default storage with.
// This initializes both storage and real-time sync storage with the
// default implementations.
// Arguments:
// - `storage_dir`: The data directory for storage.
func (_self *SdkBuilder) WithDefaultStorage(storageDir string) {
	_pointer := _self.ffiObject.incrementPointer("*SdkBuilder")
	defer _self.ffiObject.decrementPointer()
	uniffiRustCallAsync[error](
		nil,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) struct{} {
			C.ffi_breez_sdk_spark_rust_future_complete_void(handle, status)
			return struct{}{}
		},
		// liftFn
		func(_ struct{}) struct{} { return struct{}{} },
		C.uniffi_breez_sdk_spark_fn_method_sdkbuilder_with_default_storage(
			_pointer, FfiConverterStringINSTANCE.Lower(storageDir)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_void(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_void(handle)
		},
	)

}

// Sets the fiat service to be used by the SDK.
// Arguments:
// - `fiat_service`: The fiat service to be used.
func (_self *SdkBuilder) WithFiatService(fiatService FiatService) {
	_pointer := _self.ffiObject.incrementPointer("*SdkBuilder")
	defer _self.ffiObject.decrementPointer()
	uniffiRustCallAsync[error](
		nil,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) struct{} {
			C.ffi_breez_sdk_spark_rust_future_complete_void(handle, status)
			return struct{}{}
		},
		// liftFn
		func(_ struct{}) struct{} { return struct{}{} },
		C.uniffi_breez_sdk_spark_fn_method_sdkbuilder_with_fiat_service(
			_pointer, FfiConverterFiatServiceINSTANCE.Lower(fiatService)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_void(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_void(handle)
		},
	)

}

// Sets the key set type to be used by the SDK.
// Arguments:
// - `config`: Key set configuration containing the key set type, address index flag, and optional account number.
func (_self *SdkBuilder) WithKeySet(config KeySetConfig) {
	_pointer := _self.ffiObject.incrementPointer("*SdkBuilder")
	defer _self.ffiObject.decrementPointer()
	uniffiRustCallAsync[error](
		nil,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) struct{} {
			C.ffi_breez_sdk_spark_rust_future_complete_void(handle, status)
			return struct{}{}
		},
		// liftFn
		func(_ struct{}) struct{} { return struct{}{} },
		C.uniffi_breez_sdk_spark_fn_method_sdkbuilder_with_key_set(
			_pointer, FfiConverterKeySetConfigINSTANCE.Lower(config)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_void(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_void(handle)
		},
	)

}

func (_self *SdkBuilder) WithLnurlClient(lnurlClient RestClient) {
	_pointer := _self.ffiObject.incrementPointer("*SdkBuilder")
	defer _self.ffiObject.decrementPointer()
	uniffiRustCallAsync[error](
		nil,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) struct{} {
			C.ffi_breez_sdk_spark_rust_future_complete_void(handle, status)
			return struct{}{}
		},
		// liftFn
		func(_ struct{}) struct{} { return struct{}{} },
		C.uniffi_breez_sdk_spark_fn_method_sdkbuilder_with_lnurl_client(
			_pointer, FfiConverterRestClientINSTANCE.Lower(lnurlClient)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_void(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_void(handle)
		},
	)

}

// Sets the payment observer to be used by the SDK.
// Arguments:
// - `payment_observer`: The payment observer to be used.
func (_self *SdkBuilder) WithPaymentObserver(paymentObserver PaymentObserver) {
	_pointer := _self.ffiObject.incrementPointer("*SdkBuilder")
	defer _self.ffiObject.decrementPointer()
	uniffiRustCallAsync[error](
		nil,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) struct{} {
			C.ffi_breez_sdk_spark_rust_future_complete_void(handle, status)
			return struct{}{}
		},
		// liftFn
		func(_ struct{}) struct{} { return struct{}{} },
		C.uniffi_breez_sdk_spark_fn_method_sdkbuilder_with_payment_observer(
			_pointer, FfiConverterPaymentObserverINSTANCE.Lower(paymentObserver)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_void(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_void(handle)
		},
	)

}

// Sets `PostgreSQL` as the backend for all stores (storage, tree store, and token store).
// The store instances will be created during `build()`.
// Arguments:
// - `config`: The `PostgreSQL` storage configuration.
func (_self *SdkBuilder) WithPostgresBackend(config PostgresStorageConfig) {
	_pointer := _self.ffiObject.incrementPointer("*SdkBuilder")
	defer _self.ffiObject.decrementPointer()
	uniffiRustCallAsync[error](
		nil,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) struct{} {
			C.ffi_breez_sdk_spark_rust_future_complete_void(handle, status)
			return struct{}{}
		},
		// liftFn
		func(_ struct{}) struct{} { return struct{}{} },
		C.uniffi_breez_sdk_spark_fn_method_sdkbuilder_with_postgres_backend(
			_pointer, FfiConverterPostgresStorageConfigINSTANCE.Lower(config)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_void(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_void(handle)
		},
	)

}

// Sets the REST chain service to be used by the SDK.
// Arguments:
// - `url`: The base URL of the REST API.
// - `api_type`: The API type to be used.
// - `credentials`: Optional credentials for basic authentication.
func (_self *SdkBuilder) WithRestChainService(url string, apiType ChainApiType, credentials *Credentials) {
	_pointer := _self.ffiObject.incrementPointer("*SdkBuilder")
	defer _self.ffiObject.decrementPointer()
	uniffiRustCallAsync[error](
		nil,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) struct{} {
			C.ffi_breez_sdk_spark_rust_future_complete_void(handle, status)
			return struct{}{}
		},
		// liftFn
		func(_ struct{}) struct{} { return struct{}{} },
		C.uniffi_breez_sdk_spark_fn_method_sdkbuilder_with_rest_chain_service(
			_pointer, FfiConverterStringINSTANCE.Lower(url), FfiConverterChainApiTypeINSTANCE.Lower(apiType), FfiConverterOptionalCredentialsINSTANCE.Lower(credentials)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_void(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_void(handle)
		},
	)

}

// Sets the storage implementation to be used by the SDK.
// Arguments:
// - `storage`: The storage implementation to be used.
func (_self *SdkBuilder) WithStorage(storage Storage) {
	_pointer := _self.ffiObject.incrementPointer("*SdkBuilder")
	defer _self.ffiObject.decrementPointer()
	uniffiRustCallAsync[error](
		nil,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) struct{} {
			C.ffi_breez_sdk_spark_rust_future_complete_void(handle, status)
			return struct{}{}
		},
		// liftFn
		func(_ struct{}) struct{} { return struct{}{} },
		C.uniffi_breez_sdk_spark_fn_method_sdkbuilder_with_storage(
			_pointer, FfiConverterStorageINSTANCE.Lower(storage)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_void(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_void(handle)
		},
	)

}
func (object *SdkBuilder) Destroy() {
	runtime.SetFinalizer(object, nil)
	object.ffiObject.destroy()
}

type FfiConverterSdkBuilder struct{}

var FfiConverterSdkBuilderINSTANCE = FfiConverterSdkBuilder{}

func (c FfiConverterSdkBuilder) Lift(pointer unsafe.Pointer) *SdkBuilder {
	result := &SdkBuilder{
		newFfiObject(
			pointer,
			func(pointer unsafe.Pointer, status *C.RustCallStatus) unsafe.Pointer {
				return C.uniffi_breez_sdk_spark_fn_clone_sdkbuilder(pointer, status)
			},
			func(pointer unsafe.Pointer, status *C.RustCallStatus) {
				C.uniffi_breez_sdk_spark_fn_free_sdkbuilder(pointer, status)
			},
		),
	}
	runtime.SetFinalizer(result, (*SdkBuilder).Destroy)
	return result
}

func (c FfiConverterSdkBuilder) Read(reader io.Reader) *SdkBuilder {
	return c.Lift(unsafe.Pointer(uintptr(readUint64(reader))))
}

func (c FfiConverterSdkBuilder) Lower(value *SdkBuilder) unsafe.Pointer {
	// TODO: this is bad - all synchronization from ObjectRuntime.go is discarded here,
	// because the pointer will be decremented immediately after this function returns,
	// and someone will be left holding onto a non-locked pointer.
	pointer := value.ffiObject.incrementPointer("*SdkBuilder")
	defer value.ffiObject.decrementPointer()
	return pointer

}

func (c FfiConverterSdkBuilder) Write(writer io.Writer, value *SdkBuilder) {
	writeUint64(writer, uint64(uintptr(c.Lower(value))))
}

type FfiDestroyerSdkBuilder struct{}

func (_ FfiDestroyerSdkBuilder) Destroy(value *SdkBuilder) {
	value.Destroy()
}

// Trait for persistent storage
type Storage interface {
	DeleteCachedItem(key string) error
	GetCachedItem(key string) (*string, error)
	SetCachedItem(key string, value string) error
	// Lists payments with optional filters and pagination
	//
	// # Arguments
	//
	// * `list_payments_request` - The request to list payments
	//
	// # Returns
	//
	// A vector of payments or a `StorageError`
	ListPayments(request StorageListPaymentsRequest) ([]Payment, error)
	// Inserts a payment into storage
	//
	// # Arguments
	//
	// * `payment` - The payment to insert
	//
	// # Returns
	//
	// Success or a `StorageError`
	InsertPayment(payment Payment) error
	// Inserts payment metadata into storage
	//
	// # Arguments
	//
	// * `payment_id` - The ID of the payment
	// * `metadata` - The metadata to insert
	//
	// # Returns
	//
	// Success or a `StorageError`
	InsertPaymentMetadata(paymentId string, metadata PaymentMetadata) error
	// Gets a payment by its ID
	// # Arguments
	//
	// * `id` - The ID of the payment to retrieve
	//
	// # Returns
	//
	// The payment if found or None if not found
	GetPaymentById(id string) (Payment, error)
	// Gets a payment by its invoice
	// # Arguments
	//
	// * `invoice` - The invoice of the payment to retrieve
	// # Returns
	//
	// The payment if found or None if not found
	GetPaymentByInvoice(invoice string) (*Payment, error)
	// Gets payments that have any of the specified parent payment IDs.
	// Used to load related payments for a set of parent payments.
	//
	// # Arguments
	//
	// * `parent_payment_ids` - The IDs of the parent payments
	//
	// # Returns
	//
	// A map of `parent_payment_id` -> Vec<Payment> or a `StorageError`
	GetPaymentsByParentIds(parentPaymentIds []string) (map[string][]Payment, error)
	// Add a deposit to storage (upsert: updates `is_mature` and `amount_sats` on conflict)
	// # Arguments
	//
	// * `txid` - The transaction ID of the deposit
	// * `vout` - The output index of the deposit
	// * `amount_sats` - The amount of the deposit in sats
	// * `is_mature` - Whether the deposit UTXO has enough confirmations to be claimable
	//
	// # Returns
	//
	// Success or a `StorageError`
	AddDeposit(txid string, vout uint32, amountSats uint64, isMature bool) error
	// Removes an unclaimed deposit from storage
	// # Arguments
	//
	// * `txid` - The transaction ID of the deposit
	// * `vout` - The output index of the deposit
	//
	// # Returns
	//
	// Success or a `StorageError`
	DeleteDeposit(txid string, vout uint32) error
	// Lists all unclaimed deposits from storage
	// # Returns
	//
	// A vector of `DepositInfo` or a `StorageError`
	ListDeposits() ([]DepositInfo, error)
	// Updates or inserts unclaimed deposit details
	// # Arguments
	//
	// * `txid` - The transaction ID of the deposit
	// * `vout` - The output index of the deposit
	// * `payload` - The payload for the update
	//
	// # Returns
	//
	// Success or a `StorageError`
	UpdateDeposit(txid string, vout uint32, payload UpdateDepositPayload) error
	SetLnurlMetadata(metadata []SetLnurlMetadataItem) error
	// Lists contacts from storage with optional pagination
	ListContacts(request ListContactsRequest) ([]Contact, error)
	// Gets a single contact by its ID
	GetContact(id string) (Contact, error)
	// Inserts or updates a contact in storage (upsert by id).
	// Preserves `created_at` on update.
	InsertContact(contact Contact) error
	// Deletes a contact by its ID
	DeleteContact(id string) error
	AddOutgoingChange(record UnversionedRecordChange) (uint64, error)
	CompleteOutgoingSync(record Record, localRevision uint64) error
	GetPendingOutgoingChanges(limit uint32) ([]OutgoingChange, error)
	// Get the last committed sync revision.
	//
	// The `sync_revision` table tracks the highest revision that has been committed
	// (i.e. acknowledged by the server or received from it). It does NOT include
	// pending outgoing queue ids. This value is used by the sync protocol to
	// request changes from the server.
	GetLastRevision() (uint64, error)
	// Insert incoming records from remote sync
	InsertIncomingRecords(records []Record) error
	// Delete an incoming record after it has been processed
	DeleteIncomingRecord(record Record) error
	// Get incoming records that need to be processed, up to the specified limit
	GetIncomingRecords(limit uint32) ([]IncomingChange, error)
	// Get the latest outgoing record if any exists
	GetLatestOutgoingChange() (*OutgoingChange, error)
	// Update the sync state record from an incoming record
	UpdateRecordFromIncoming(record Record) error
}

// Trait for persistent storage
type StorageImpl struct {
	ffiObject FfiObject
}

func (_self *StorageImpl) DeleteCachedItem(key string) error {
	_pointer := _self.ffiObject.incrementPointer("Storage")
	defer _self.ffiObject.decrementPointer()
	_, err := uniffiRustCallAsync[StorageError](
		FfiConverterStorageErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) struct{} {
			C.ffi_breez_sdk_spark_rust_future_complete_void(handle, status)
			return struct{}{}
		},
		// liftFn
		func(_ struct{}) struct{} { return struct{}{} },
		C.uniffi_breez_sdk_spark_fn_method_storage_delete_cached_item(
			_pointer, FfiConverterStringINSTANCE.Lower(key)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_void(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_void(handle)
		},
	)

	if err == nil {
		return nil
	}

	return err
}

func (_self *StorageImpl) GetCachedItem(key string) (*string, error) {
	_pointer := _self.ffiObject.incrementPointer("Storage")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[StorageError](
		FfiConverterStorageErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) *string {
			return FfiConverterOptionalStringINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_storage_get_cached_item(
			_pointer, FfiConverterStringINSTANCE.Lower(key)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

func (_self *StorageImpl) SetCachedItem(key string, value string) error {
	_pointer := _self.ffiObject.incrementPointer("Storage")
	defer _self.ffiObject.decrementPointer()
	_, err := uniffiRustCallAsync[StorageError](
		FfiConverterStorageErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) struct{} {
			C.ffi_breez_sdk_spark_rust_future_complete_void(handle, status)
			return struct{}{}
		},
		// liftFn
		func(_ struct{}) struct{} { return struct{}{} },
		C.uniffi_breez_sdk_spark_fn_method_storage_set_cached_item(
			_pointer, FfiConverterStringINSTANCE.Lower(key), FfiConverterStringINSTANCE.Lower(value)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_void(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_void(handle)
		},
	)

	if err == nil {
		return nil
	}

	return err
}

// Lists payments with optional filters and pagination
//
// # Arguments
//
// * `list_payments_request` - The request to list payments
//
// # Returns
//
// A vector of payments or a `StorageError`
func (_self *StorageImpl) ListPayments(request StorageListPaymentsRequest) ([]Payment, error) {
	_pointer := _self.ffiObject.incrementPointer("Storage")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[StorageError](
		FfiConverterStorageErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) []Payment {
			return FfiConverterSequencePaymentINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_storage_list_payments(
			_pointer, FfiConverterStorageListPaymentsRequestINSTANCE.Lower(request)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// Inserts a payment into storage
//
// # Arguments
//
// * `payment` - The payment to insert
//
// # Returns
//
// Success or a `StorageError`
func (_self *StorageImpl) InsertPayment(payment Payment) error {
	_pointer := _self.ffiObject.incrementPointer("Storage")
	defer _self.ffiObject.decrementPointer()
	_, err := uniffiRustCallAsync[StorageError](
		FfiConverterStorageErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) struct{} {
			C.ffi_breez_sdk_spark_rust_future_complete_void(handle, status)
			return struct{}{}
		},
		// liftFn
		func(_ struct{}) struct{} { return struct{}{} },
		C.uniffi_breez_sdk_spark_fn_method_storage_insert_payment(
			_pointer, FfiConverterPaymentINSTANCE.Lower(payment)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_void(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_void(handle)
		},
	)

	if err == nil {
		return nil
	}

	return err
}

// Inserts payment metadata into storage
//
// # Arguments
//
// * `payment_id` - The ID of the payment
// * `metadata` - The metadata to insert
//
// # Returns
//
// Success or a `StorageError`
func (_self *StorageImpl) InsertPaymentMetadata(paymentId string, metadata PaymentMetadata) error {
	_pointer := _self.ffiObject.incrementPointer("Storage")
	defer _self.ffiObject.decrementPointer()
	_, err := uniffiRustCallAsync[StorageError](
		FfiConverterStorageErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) struct{} {
			C.ffi_breez_sdk_spark_rust_future_complete_void(handle, status)
			return struct{}{}
		},
		// liftFn
		func(_ struct{}) struct{} { return struct{}{} },
		C.uniffi_breez_sdk_spark_fn_method_storage_insert_payment_metadata(
			_pointer, FfiConverterStringINSTANCE.Lower(paymentId), FfiConverterPaymentMetadataINSTANCE.Lower(metadata)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_void(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_void(handle)
		},
	)

	if err == nil {
		return nil
	}

	return err
}

// Gets a payment by its ID
// # Arguments
//
// * `id` - The ID of the payment to retrieve
//
// # Returns
//
// The payment if found or None if not found
func (_self *StorageImpl) GetPaymentById(id string) (Payment, error) {
	_pointer := _self.ffiObject.incrementPointer("Storage")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[StorageError](
		FfiConverterStorageErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) Payment {
			return FfiConverterPaymentINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_storage_get_payment_by_id(
			_pointer, FfiConverterStringINSTANCE.Lower(id)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// Gets a payment by its invoice
// # Arguments
//
// * `invoice` - The invoice of the payment to retrieve
// # Returns
//
// The payment if found or None if not found
func (_self *StorageImpl) GetPaymentByInvoice(invoice string) (*Payment, error) {
	_pointer := _self.ffiObject.incrementPointer("Storage")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[StorageError](
		FfiConverterStorageErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) *Payment {
			return FfiConverterOptionalPaymentINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_storage_get_payment_by_invoice(
			_pointer, FfiConverterStringINSTANCE.Lower(invoice)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// Gets payments that have any of the specified parent payment IDs.
// Used to load related payments for a set of parent payments.
//
// # Arguments
//
// * `parent_payment_ids` - The IDs of the parent payments
//
// # Returns
//
// A map of `parent_payment_id` -> Vec<Payment> or a `StorageError`
func (_self *StorageImpl) GetPaymentsByParentIds(parentPaymentIds []string) (map[string][]Payment, error) {
	_pointer := _self.ffiObject.incrementPointer("Storage")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[StorageError](
		FfiConverterStorageErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) map[string][]Payment {
			return FfiConverterMapStringSequencePaymentINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_storage_get_payments_by_parent_ids(
			_pointer, FfiConverterSequenceStringINSTANCE.Lower(parentPaymentIds)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// Add a deposit to storage (upsert: updates `is_mature` and `amount_sats` on conflict)
// # Arguments
//
// * `txid` - The transaction ID of the deposit
// * `vout` - The output index of the deposit
// * `amount_sats` - The amount of the deposit in sats
// * `is_mature` - Whether the deposit UTXO has enough confirmations to be claimable
//
// # Returns
//
// Success or a `StorageError`
func (_self *StorageImpl) AddDeposit(txid string, vout uint32, amountSats uint64, isMature bool) error {
	_pointer := _self.ffiObject.incrementPointer("Storage")
	defer _self.ffiObject.decrementPointer()
	_, err := uniffiRustCallAsync[StorageError](
		FfiConverterStorageErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) struct{} {
			C.ffi_breez_sdk_spark_rust_future_complete_void(handle, status)
			return struct{}{}
		},
		// liftFn
		func(_ struct{}) struct{} { return struct{}{} },
		C.uniffi_breez_sdk_spark_fn_method_storage_add_deposit(
			_pointer, FfiConverterStringINSTANCE.Lower(txid), FfiConverterUint32INSTANCE.Lower(vout), FfiConverterUint64INSTANCE.Lower(amountSats), FfiConverterBoolINSTANCE.Lower(isMature)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_void(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_void(handle)
		},
	)

	if err == nil {
		return nil
	}

	return err
}

// Removes an unclaimed deposit from storage
// # Arguments
//
// * `txid` - The transaction ID of the deposit
// * `vout` - The output index of the deposit
//
// # Returns
//
// Success or a `StorageError`
func (_self *StorageImpl) DeleteDeposit(txid string, vout uint32) error {
	_pointer := _self.ffiObject.incrementPointer("Storage")
	defer _self.ffiObject.decrementPointer()
	_, err := uniffiRustCallAsync[StorageError](
		FfiConverterStorageErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) struct{} {
			C.ffi_breez_sdk_spark_rust_future_complete_void(handle, status)
			return struct{}{}
		},
		// liftFn
		func(_ struct{}) struct{} { return struct{}{} },
		C.uniffi_breez_sdk_spark_fn_method_storage_delete_deposit(
			_pointer, FfiConverterStringINSTANCE.Lower(txid), FfiConverterUint32INSTANCE.Lower(vout)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_void(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_void(handle)
		},
	)

	if err == nil {
		return nil
	}

	return err
}

// Lists all unclaimed deposits from storage
// # Returns
//
// A vector of `DepositInfo` or a `StorageError`
func (_self *StorageImpl) ListDeposits() ([]DepositInfo, error) {
	_pointer := _self.ffiObject.incrementPointer("Storage")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[StorageError](
		FfiConverterStorageErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) []DepositInfo {
			return FfiConverterSequenceDepositInfoINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_storage_list_deposits(
			_pointer),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// Updates or inserts unclaimed deposit details
// # Arguments
//
// * `txid` - The transaction ID of the deposit
// * `vout` - The output index of the deposit
// * `payload` - The payload for the update
//
// # Returns
//
// Success or a `StorageError`
func (_self *StorageImpl) UpdateDeposit(txid string, vout uint32, payload UpdateDepositPayload) error {
	_pointer := _self.ffiObject.incrementPointer("Storage")
	defer _self.ffiObject.decrementPointer()
	_, err := uniffiRustCallAsync[StorageError](
		FfiConverterStorageErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) struct{} {
			C.ffi_breez_sdk_spark_rust_future_complete_void(handle, status)
			return struct{}{}
		},
		// liftFn
		func(_ struct{}) struct{} { return struct{}{} },
		C.uniffi_breez_sdk_spark_fn_method_storage_update_deposit(
			_pointer, FfiConverterStringINSTANCE.Lower(txid), FfiConverterUint32INSTANCE.Lower(vout), FfiConverterUpdateDepositPayloadINSTANCE.Lower(payload)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_void(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_void(handle)
		},
	)

	if err == nil {
		return nil
	}

	return err
}

func (_self *StorageImpl) SetLnurlMetadata(metadata []SetLnurlMetadataItem) error {
	_pointer := _self.ffiObject.incrementPointer("Storage")
	defer _self.ffiObject.decrementPointer()
	_, err := uniffiRustCallAsync[StorageError](
		FfiConverterStorageErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) struct{} {
			C.ffi_breez_sdk_spark_rust_future_complete_void(handle, status)
			return struct{}{}
		},
		// liftFn
		func(_ struct{}) struct{} { return struct{}{} },
		C.uniffi_breez_sdk_spark_fn_method_storage_set_lnurl_metadata(
			_pointer, FfiConverterSequenceSetLnurlMetadataItemINSTANCE.Lower(metadata)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_void(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_void(handle)
		},
	)

	if err == nil {
		return nil
	}

	return err
}

// Lists contacts from storage with optional pagination
func (_self *StorageImpl) ListContacts(request ListContactsRequest) ([]Contact, error) {
	_pointer := _self.ffiObject.incrementPointer("Storage")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[StorageError](
		FfiConverterStorageErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) []Contact {
			return FfiConverterSequenceContactINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_storage_list_contacts(
			_pointer, FfiConverterListContactsRequestINSTANCE.Lower(request)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// Gets a single contact by its ID
func (_self *StorageImpl) GetContact(id string) (Contact, error) {
	_pointer := _self.ffiObject.incrementPointer("Storage")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[StorageError](
		FfiConverterStorageErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) Contact {
			return FfiConverterContactINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_storage_get_contact(
			_pointer, FfiConverterStringINSTANCE.Lower(id)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// Inserts or updates a contact in storage (upsert by id).
// Preserves `created_at` on update.
func (_self *StorageImpl) InsertContact(contact Contact) error {
	_pointer := _self.ffiObject.incrementPointer("Storage")
	defer _self.ffiObject.decrementPointer()
	_, err := uniffiRustCallAsync[StorageError](
		FfiConverterStorageErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) struct{} {
			C.ffi_breez_sdk_spark_rust_future_complete_void(handle, status)
			return struct{}{}
		},
		// liftFn
		func(_ struct{}) struct{} { return struct{}{} },
		C.uniffi_breez_sdk_spark_fn_method_storage_insert_contact(
			_pointer, FfiConverterContactINSTANCE.Lower(contact)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_void(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_void(handle)
		},
	)

	if err == nil {
		return nil
	}

	return err
}

// Deletes a contact by its ID
func (_self *StorageImpl) DeleteContact(id string) error {
	_pointer := _self.ffiObject.incrementPointer("Storage")
	defer _self.ffiObject.decrementPointer()
	_, err := uniffiRustCallAsync[StorageError](
		FfiConverterStorageErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) struct{} {
			C.ffi_breez_sdk_spark_rust_future_complete_void(handle, status)
			return struct{}{}
		},
		// liftFn
		func(_ struct{}) struct{} { return struct{}{} },
		C.uniffi_breez_sdk_spark_fn_method_storage_delete_contact(
			_pointer, FfiConverterStringINSTANCE.Lower(id)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_void(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_void(handle)
		},
	)

	if err == nil {
		return nil
	}

	return err
}

func (_self *StorageImpl) AddOutgoingChange(record UnversionedRecordChange) (uint64, error) {
	_pointer := _self.ffiObject.incrementPointer("Storage")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[StorageError](
		FfiConverterStorageErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) C.uint64_t {
			res := C.ffi_breez_sdk_spark_rust_future_complete_u64(handle, status)
			return res
		},
		// liftFn
		func(ffi C.uint64_t) uint64 {
			return FfiConverterUint64INSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_storage_add_outgoing_change(
			_pointer, FfiConverterUnversionedRecordChangeINSTANCE.Lower(record)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_u64(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_u64(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

func (_self *StorageImpl) CompleteOutgoingSync(record Record, localRevision uint64) error {
	_pointer := _self.ffiObject.incrementPointer("Storage")
	defer _self.ffiObject.decrementPointer()
	_, err := uniffiRustCallAsync[StorageError](
		FfiConverterStorageErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) struct{} {
			C.ffi_breez_sdk_spark_rust_future_complete_void(handle, status)
			return struct{}{}
		},
		// liftFn
		func(_ struct{}) struct{} { return struct{}{} },
		C.uniffi_breez_sdk_spark_fn_method_storage_complete_outgoing_sync(
			_pointer, FfiConverterRecordINSTANCE.Lower(record), FfiConverterUint64INSTANCE.Lower(localRevision)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_void(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_void(handle)
		},
	)

	if err == nil {
		return nil
	}

	return err
}

func (_self *StorageImpl) GetPendingOutgoingChanges(limit uint32) ([]OutgoingChange, error) {
	_pointer := _self.ffiObject.incrementPointer("Storage")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[StorageError](
		FfiConverterStorageErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) []OutgoingChange {
			return FfiConverterSequenceOutgoingChangeINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_storage_get_pending_outgoing_changes(
			_pointer, FfiConverterUint32INSTANCE.Lower(limit)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// Get the last committed sync revision.
//
// The `sync_revision` table tracks the highest revision that has been committed
// (i.e. acknowledged by the server or received from it). It does NOT include
// pending outgoing queue ids. This value is used by the sync protocol to
// request changes from the server.
func (_self *StorageImpl) GetLastRevision() (uint64, error) {
	_pointer := _self.ffiObject.incrementPointer("Storage")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[StorageError](
		FfiConverterStorageErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) C.uint64_t {
			res := C.ffi_breez_sdk_spark_rust_future_complete_u64(handle, status)
			return res
		},
		// liftFn
		func(ffi C.uint64_t) uint64 {
			return FfiConverterUint64INSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_storage_get_last_revision(
			_pointer),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_u64(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_u64(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// Insert incoming records from remote sync
func (_self *StorageImpl) InsertIncomingRecords(records []Record) error {
	_pointer := _self.ffiObject.incrementPointer("Storage")
	defer _self.ffiObject.decrementPointer()
	_, err := uniffiRustCallAsync[StorageError](
		FfiConverterStorageErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) struct{} {
			C.ffi_breez_sdk_spark_rust_future_complete_void(handle, status)
			return struct{}{}
		},
		// liftFn
		func(_ struct{}) struct{} { return struct{}{} },
		C.uniffi_breez_sdk_spark_fn_method_storage_insert_incoming_records(
			_pointer, FfiConverterSequenceRecordINSTANCE.Lower(records)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_void(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_void(handle)
		},
	)

	if err == nil {
		return nil
	}

	return err
}

// Delete an incoming record after it has been processed
func (_self *StorageImpl) DeleteIncomingRecord(record Record) error {
	_pointer := _self.ffiObject.incrementPointer("Storage")
	defer _self.ffiObject.decrementPointer()
	_, err := uniffiRustCallAsync[StorageError](
		FfiConverterStorageErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) struct{} {
			C.ffi_breez_sdk_spark_rust_future_complete_void(handle, status)
			return struct{}{}
		},
		// liftFn
		func(_ struct{}) struct{} { return struct{}{} },
		C.uniffi_breez_sdk_spark_fn_method_storage_delete_incoming_record(
			_pointer, FfiConverterRecordINSTANCE.Lower(record)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_void(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_void(handle)
		},
	)

	if err == nil {
		return nil
	}

	return err
}

// Get incoming records that need to be processed, up to the specified limit
func (_self *StorageImpl) GetIncomingRecords(limit uint32) ([]IncomingChange, error) {
	_pointer := _self.ffiObject.incrementPointer("Storage")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[StorageError](
		FfiConverterStorageErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) []IncomingChange {
			return FfiConverterSequenceIncomingChangeINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_storage_get_incoming_records(
			_pointer, FfiConverterUint32INSTANCE.Lower(limit)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// Get the latest outgoing record if any exists
func (_self *StorageImpl) GetLatestOutgoingChange() (*OutgoingChange, error) {
	_pointer := _self.ffiObject.incrementPointer("Storage")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[StorageError](
		FfiConverterStorageErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) *OutgoingChange {
			return FfiConverterOptionalOutgoingChangeINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_storage_get_latest_outgoing_change(
			_pointer),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// Update the sync state record from an incoming record
func (_self *StorageImpl) UpdateRecordFromIncoming(record Record) error {
	_pointer := _self.ffiObject.incrementPointer("Storage")
	defer _self.ffiObject.decrementPointer()
	_, err := uniffiRustCallAsync[StorageError](
		FfiConverterStorageErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) struct{} {
			C.ffi_breez_sdk_spark_rust_future_complete_void(handle, status)
			return struct{}{}
		},
		// liftFn
		func(_ struct{}) struct{} { return struct{}{} },
		C.uniffi_breez_sdk_spark_fn_method_storage_update_record_from_incoming(
			_pointer, FfiConverterRecordINSTANCE.Lower(record)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_void(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_void(handle)
		},
	)

	if err == nil {
		return nil
	}

	return err
}
func (object *StorageImpl) Destroy() {
	runtime.SetFinalizer(object, nil)
	object.ffiObject.destroy()
}

type FfiConverterStorage struct {
	handleMap *concurrentHandleMap[Storage]
}

var FfiConverterStorageINSTANCE = FfiConverterStorage{
	handleMap: newConcurrentHandleMap[Storage](),
}

func (c FfiConverterStorage) Lift(pointer unsafe.Pointer) Storage {
	result := &StorageImpl{
		newFfiObject(
			pointer,
			func(pointer unsafe.Pointer, status *C.RustCallStatus) unsafe.Pointer {
				return C.uniffi_breez_sdk_spark_fn_clone_storage(pointer, status)
			},
			func(pointer unsafe.Pointer, status *C.RustCallStatus) {
				C.uniffi_breez_sdk_spark_fn_free_storage(pointer, status)
			},
		),
	}
	runtime.SetFinalizer(result, (*StorageImpl).Destroy)
	return result
}

func (c FfiConverterStorage) Read(reader io.Reader) Storage {
	return c.Lift(unsafe.Pointer(uintptr(readUint64(reader))))
}

func (c FfiConverterStorage) Lower(value Storage) unsafe.Pointer {
	// TODO: this is bad - all synchronization from ObjectRuntime.go is discarded here,
	// because the pointer will be decremented immediately after this function returns,
	// and someone will be left holding onto a non-locked pointer.
	pointer := unsafe.Pointer(uintptr(c.handleMap.insert(value)))
	return pointer

}

func (c FfiConverterStorage) Write(writer io.Writer, value Storage) {
	writeUint64(writer, uint64(uintptr(c.Lower(value))))
}

type FfiDestroyerStorage struct{}

func (_ FfiDestroyerStorage) Destroy(value Storage) {
	if val, ok := value.(*StorageImpl); ok {
		val.Destroy()
	} else {
		panic("Expected *StorageImpl")
	}
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod0
func breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod0(uniffiHandle C.uint64_t, key C.RustBuffer, uniffiFutureCallback C.UniffiForeignFutureCompleteVoid, uniffiCallbackData C.uint64_t, uniffiOutReturn *C.UniffiForeignFuture) {
	handle := uint64(uniffiHandle)
	uniffiObj, ok := FfiConverterStorageINSTANCE.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}

	result := make(chan C.UniffiForeignFutureStructVoid, 1)
	cancel := make(chan struct{}, 1)
	guardHandle := cgo.NewHandle(cancel)
	*uniffiOutReturn = C.UniffiForeignFuture{
		handle: C.uint64_t(guardHandle),
		free:   C.UniffiForeignFutureFree(C.breez_sdk_spark_uniffiFreeGorutine),
	}

	// Wait for compleation or cancel
	go func() {
		select {
		case <-cancel:
		case res := <-result:
			C.call_UniffiForeignFutureCompleteVoid(uniffiFutureCallback, uniffiCallbackData, res)
		}
	}()

	// Eval callback asynchroniously
	go func() {
		asyncResult := &C.UniffiForeignFutureStructVoid{}
		callStatus := &asyncResult.callStatus
		defer func() {
			result <- *asyncResult
		}()

		err :=
			uniffiObj.DeleteCachedItem(
				FfiConverterStringINSTANCE.Lift(GoRustBuffer{
					inner: key,
				}),
			)

		if err != nil {
			var actualError *StorageError
			if errors.As(err, &actualError) {
				if actualError != nil {
					*callStatus = C.RustCallStatus{
						code:     C.int8_t(uniffiCallbackResultError),
						errorBuf: FfiConverterStorageErrorINSTANCE.Lower(actualError),
					}
					return
				}
			} else {
				*callStatus = C.RustCallStatus{
					code: C.int8_t(uniffiCallbackUnexpectedResultError),
				}
				return
			}
		}

	}()
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod1
func breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod1(uniffiHandle C.uint64_t, key C.RustBuffer, uniffiFutureCallback C.UniffiForeignFutureCompleteRustBuffer, uniffiCallbackData C.uint64_t, uniffiOutReturn *C.UniffiForeignFuture) {
	handle := uint64(uniffiHandle)
	uniffiObj, ok := FfiConverterStorageINSTANCE.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}

	result := make(chan C.UniffiForeignFutureStructRustBuffer, 1)
	cancel := make(chan struct{}, 1)
	guardHandle := cgo.NewHandle(cancel)
	*uniffiOutReturn = C.UniffiForeignFuture{
		handle: C.uint64_t(guardHandle),
		free:   C.UniffiForeignFutureFree(C.breez_sdk_spark_uniffiFreeGorutine),
	}

	// Wait for compleation or cancel
	go func() {
		select {
		case <-cancel:
		case res := <-result:
			C.call_UniffiForeignFutureCompleteRustBuffer(uniffiFutureCallback, uniffiCallbackData, res)
		}
	}()

	// Eval callback asynchroniously
	go func() {
		asyncResult := &C.UniffiForeignFutureStructRustBuffer{}
		uniffiOutReturn := &asyncResult.returnValue
		callStatus := &asyncResult.callStatus
		defer func() {
			result <- *asyncResult
		}()

		res, err :=
			uniffiObj.GetCachedItem(
				FfiConverterStringINSTANCE.Lift(GoRustBuffer{
					inner: key,
				}),
			)

		if err != nil {
			var actualError *StorageError
			if errors.As(err, &actualError) {
				if actualError != nil {
					*callStatus = C.RustCallStatus{
						code:     C.int8_t(uniffiCallbackResultError),
						errorBuf: FfiConverterStorageErrorINSTANCE.Lower(actualError),
					}
					return
				}
			} else {
				*callStatus = C.RustCallStatus{
					code: C.int8_t(uniffiCallbackUnexpectedResultError),
				}
				return
			}
		}

		*uniffiOutReturn = FfiConverterOptionalStringINSTANCE.Lower(res)
	}()
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod2
func breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod2(uniffiHandle C.uint64_t, key C.RustBuffer, value C.RustBuffer, uniffiFutureCallback C.UniffiForeignFutureCompleteVoid, uniffiCallbackData C.uint64_t, uniffiOutReturn *C.UniffiForeignFuture) {
	handle := uint64(uniffiHandle)
	uniffiObj, ok := FfiConverterStorageINSTANCE.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}

	result := make(chan C.UniffiForeignFutureStructVoid, 1)
	cancel := make(chan struct{}, 1)
	guardHandle := cgo.NewHandle(cancel)
	*uniffiOutReturn = C.UniffiForeignFuture{
		handle: C.uint64_t(guardHandle),
		free:   C.UniffiForeignFutureFree(C.breez_sdk_spark_uniffiFreeGorutine),
	}

	// Wait for compleation or cancel
	go func() {
		select {
		case <-cancel:
		case res := <-result:
			C.call_UniffiForeignFutureCompleteVoid(uniffiFutureCallback, uniffiCallbackData, res)
		}
	}()

	// Eval callback asynchroniously
	go func() {
		asyncResult := &C.UniffiForeignFutureStructVoid{}
		callStatus := &asyncResult.callStatus
		defer func() {
			result <- *asyncResult
		}()

		err :=
			uniffiObj.SetCachedItem(
				FfiConverterStringINSTANCE.Lift(GoRustBuffer{
					inner: key,
				}),
				FfiConverterStringINSTANCE.Lift(GoRustBuffer{
					inner: value,
				}),
			)

		if err != nil {
			var actualError *StorageError
			if errors.As(err, &actualError) {
				if actualError != nil {
					*callStatus = C.RustCallStatus{
						code:     C.int8_t(uniffiCallbackResultError),
						errorBuf: FfiConverterStorageErrorINSTANCE.Lower(actualError),
					}
					return
				}
			} else {
				*callStatus = C.RustCallStatus{
					code: C.int8_t(uniffiCallbackUnexpectedResultError),
				}
				return
			}
		}

	}()
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod3
func breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod3(uniffiHandle C.uint64_t, request C.RustBuffer, uniffiFutureCallback C.UniffiForeignFutureCompleteRustBuffer, uniffiCallbackData C.uint64_t, uniffiOutReturn *C.UniffiForeignFuture) {
	handle := uint64(uniffiHandle)
	uniffiObj, ok := FfiConverterStorageINSTANCE.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}

	result := make(chan C.UniffiForeignFutureStructRustBuffer, 1)
	cancel := make(chan struct{}, 1)
	guardHandle := cgo.NewHandle(cancel)
	*uniffiOutReturn = C.UniffiForeignFuture{
		handle: C.uint64_t(guardHandle),
		free:   C.UniffiForeignFutureFree(C.breez_sdk_spark_uniffiFreeGorutine),
	}

	// Wait for compleation or cancel
	go func() {
		select {
		case <-cancel:
		case res := <-result:
			C.call_UniffiForeignFutureCompleteRustBuffer(uniffiFutureCallback, uniffiCallbackData, res)
		}
	}()

	// Eval callback asynchroniously
	go func() {
		asyncResult := &C.UniffiForeignFutureStructRustBuffer{}
		uniffiOutReturn := &asyncResult.returnValue
		callStatus := &asyncResult.callStatus
		defer func() {
			result <- *asyncResult
		}()

		res, err :=
			uniffiObj.ListPayments(
				FfiConverterStorageListPaymentsRequestINSTANCE.Lift(GoRustBuffer{
					inner: request,
				}),
			)

		if err != nil {
			var actualError *StorageError
			if errors.As(err, &actualError) {
				if actualError != nil {
					*callStatus = C.RustCallStatus{
						code:     C.int8_t(uniffiCallbackResultError),
						errorBuf: FfiConverterStorageErrorINSTANCE.Lower(actualError),
					}
					return
				}
			} else {
				*callStatus = C.RustCallStatus{
					code: C.int8_t(uniffiCallbackUnexpectedResultError),
				}
				return
			}
		}

		*uniffiOutReturn = FfiConverterSequencePaymentINSTANCE.Lower(res)
	}()
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod4
func breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod4(uniffiHandle C.uint64_t, payment C.RustBuffer, uniffiFutureCallback C.UniffiForeignFutureCompleteVoid, uniffiCallbackData C.uint64_t, uniffiOutReturn *C.UniffiForeignFuture) {
	handle := uint64(uniffiHandle)
	uniffiObj, ok := FfiConverterStorageINSTANCE.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}

	result := make(chan C.UniffiForeignFutureStructVoid, 1)
	cancel := make(chan struct{}, 1)
	guardHandle := cgo.NewHandle(cancel)
	*uniffiOutReturn = C.UniffiForeignFuture{
		handle: C.uint64_t(guardHandle),
		free:   C.UniffiForeignFutureFree(C.breez_sdk_spark_uniffiFreeGorutine),
	}

	// Wait for compleation or cancel
	go func() {
		select {
		case <-cancel:
		case res := <-result:
			C.call_UniffiForeignFutureCompleteVoid(uniffiFutureCallback, uniffiCallbackData, res)
		}
	}()

	// Eval callback asynchroniously
	go func() {
		asyncResult := &C.UniffiForeignFutureStructVoid{}
		callStatus := &asyncResult.callStatus
		defer func() {
			result <- *asyncResult
		}()

		err :=
			uniffiObj.InsertPayment(
				FfiConverterPaymentINSTANCE.Lift(GoRustBuffer{
					inner: payment,
				}),
			)

		if err != nil {
			var actualError *StorageError
			if errors.As(err, &actualError) {
				if actualError != nil {
					*callStatus = C.RustCallStatus{
						code:     C.int8_t(uniffiCallbackResultError),
						errorBuf: FfiConverterStorageErrorINSTANCE.Lower(actualError),
					}
					return
				}
			} else {
				*callStatus = C.RustCallStatus{
					code: C.int8_t(uniffiCallbackUnexpectedResultError),
				}
				return
			}
		}

	}()
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod5
func breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod5(uniffiHandle C.uint64_t, paymentId C.RustBuffer, metadata C.RustBuffer, uniffiFutureCallback C.UniffiForeignFutureCompleteVoid, uniffiCallbackData C.uint64_t, uniffiOutReturn *C.UniffiForeignFuture) {
	handle := uint64(uniffiHandle)
	uniffiObj, ok := FfiConverterStorageINSTANCE.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}

	result := make(chan C.UniffiForeignFutureStructVoid, 1)
	cancel := make(chan struct{}, 1)
	guardHandle := cgo.NewHandle(cancel)
	*uniffiOutReturn = C.UniffiForeignFuture{
		handle: C.uint64_t(guardHandle),
		free:   C.UniffiForeignFutureFree(C.breez_sdk_spark_uniffiFreeGorutine),
	}

	// Wait for compleation or cancel
	go func() {
		select {
		case <-cancel:
		case res := <-result:
			C.call_UniffiForeignFutureCompleteVoid(uniffiFutureCallback, uniffiCallbackData, res)
		}
	}()

	// Eval callback asynchroniously
	go func() {
		asyncResult := &C.UniffiForeignFutureStructVoid{}
		callStatus := &asyncResult.callStatus
		defer func() {
			result <- *asyncResult
		}()

		err :=
			uniffiObj.InsertPaymentMetadata(
				FfiConverterStringINSTANCE.Lift(GoRustBuffer{
					inner: paymentId,
				}),
				FfiConverterPaymentMetadataINSTANCE.Lift(GoRustBuffer{
					inner: metadata,
				}),
			)

		if err != nil {
			var actualError *StorageError
			if errors.As(err, &actualError) {
				if actualError != nil {
					*callStatus = C.RustCallStatus{
						code:     C.int8_t(uniffiCallbackResultError),
						errorBuf: FfiConverterStorageErrorINSTANCE.Lower(actualError),
					}
					return
				}
			} else {
				*callStatus = C.RustCallStatus{
					code: C.int8_t(uniffiCallbackUnexpectedResultError),
				}
				return
			}
		}

	}()
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod6
func breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod6(uniffiHandle C.uint64_t, id C.RustBuffer, uniffiFutureCallback C.UniffiForeignFutureCompleteRustBuffer, uniffiCallbackData C.uint64_t, uniffiOutReturn *C.UniffiForeignFuture) {
	handle := uint64(uniffiHandle)
	uniffiObj, ok := FfiConverterStorageINSTANCE.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}

	result := make(chan C.UniffiForeignFutureStructRustBuffer, 1)
	cancel := make(chan struct{}, 1)
	guardHandle := cgo.NewHandle(cancel)
	*uniffiOutReturn = C.UniffiForeignFuture{
		handle: C.uint64_t(guardHandle),
		free:   C.UniffiForeignFutureFree(C.breez_sdk_spark_uniffiFreeGorutine),
	}

	// Wait for compleation or cancel
	go func() {
		select {
		case <-cancel:
		case res := <-result:
			C.call_UniffiForeignFutureCompleteRustBuffer(uniffiFutureCallback, uniffiCallbackData, res)
		}
	}()

	// Eval callback asynchroniously
	go func() {
		asyncResult := &C.UniffiForeignFutureStructRustBuffer{}
		uniffiOutReturn := &asyncResult.returnValue
		callStatus := &asyncResult.callStatus
		defer func() {
			result <- *asyncResult
		}()

		res, err :=
			uniffiObj.GetPaymentById(
				FfiConverterStringINSTANCE.Lift(GoRustBuffer{
					inner: id,
				}),
			)

		if err != nil {
			var actualError *StorageError
			if errors.As(err, &actualError) {
				if actualError != nil {
					*callStatus = C.RustCallStatus{
						code:     C.int8_t(uniffiCallbackResultError),
						errorBuf: FfiConverterStorageErrorINSTANCE.Lower(actualError),
					}
					return
				}
			} else {
				*callStatus = C.RustCallStatus{
					code: C.int8_t(uniffiCallbackUnexpectedResultError),
				}
				return
			}
		}

		*uniffiOutReturn = FfiConverterPaymentINSTANCE.Lower(res)
	}()
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod7
func breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod7(uniffiHandle C.uint64_t, invoice C.RustBuffer, uniffiFutureCallback C.UniffiForeignFutureCompleteRustBuffer, uniffiCallbackData C.uint64_t, uniffiOutReturn *C.UniffiForeignFuture) {
	handle := uint64(uniffiHandle)
	uniffiObj, ok := FfiConverterStorageINSTANCE.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}

	result := make(chan C.UniffiForeignFutureStructRustBuffer, 1)
	cancel := make(chan struct{}, 1)
	guardHandle := cgo.NewHandle(cancel)
	*uniffiOutReturn = C.UniffiForeignFuture{
		handle: C.uint64_t(guardHandle),
		free:   C.UniffiForeignFutureFree(C.breez_sdk_spark_uniffiFreeGorutine),
	}

	// Wait for compleation or cancel
	go func() {
		select {
		case <-cancel:
		case res := <-result:
			C.call_UniffiForeignFutureCompleteRustBuffer(uniffiFutureCallback, uniffiCallbackData, res)
		}
	}()

	// Eval callback asynchroniously
	go func() {
		asyncResult := &C.UniffiForeignFutureStructRustBuffer{}
		uniffiOutReturn := &asyncResult.returnValue
		callStatus := &asyncResult.callStatus
		defer func() {
			result <- *asyncResult
		}()

		res, err :=
			uniffiObj.GetPaymentByInvoice(
				FfiConverterStringINSTANCE.Lift(GoRustBuffer{
					inner: invoice,
				}),
			)

		if err != nil {
			var actualError *StorageError
			if errors.As(err, &actualError) {
				if actualError != nil {
					*callStatus = C.RustCallStatus{
						code:     C.int8_t(uniffiCallbackResultError),
						errorBuf: FfiConverterStorageErrorINSTANCE.Lower(actualError),
					}
					return
				}
			} else {
				*callStatus = C.RustCallStatus{
					code: C.int8_t(uniffiCallbackUnexpectedResultError),
				}
				return
			}
		}

		*uniffiOutReturn = FfiConverterOptionalPaymentINSTANCE.Lower(res)
	}()
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod8
func breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod8(uniffiHandle C.uint64_t, parentPaymentIds C.RustBuffer, uniffiFutureCallback C.UniffiForeignFutureCompleteRustBuffer, uniffiCallbackData C.uint64_t, uniffiOutReturn *C.UniffiForeignFuture) {
	handle := uint64(uniffiHandle)
	uniffiObj, ok := FfiConverterStorageINSTANCE.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}

	result := make(chan C.UniffiForeignFutureStructRustBuffer, 1)
	cancel := make(chan struct{}, 1)
	guardHandle := cgo.NewHandle(cancel)
	*uniffiOutReturn = C.UniffiForeignFuture{
		handle: C.uint64_t(guardHandle),
		free:   C.UniffiForeignFutureFree(C.breez_sdk_spark_uniffiFreeGorutine),
	}

	// Wait for compleation or cancel
	go func() {
		select {
		case <-cancel:
		case res := <-result:
			C.call_UniffiForeignFutureCompleteRustBuffer(uniffiFutureCallback, uniffiCallbackData, res)
		}
	}()

	// Eval callback asynchroniously
	go func() {
		asyncResult := &C.UniffiForeignFutureStructRustBuffer{}
		uniffiOutReturn := &asyncResult.returnValue
		callStatus := &asyncResult.callStatus
		defer func() {
			result <- *asyncResult
		}()

		res, err :=
			uniffiObj.GetPaymentsByParentIds(
				FfiConverterSequenceStringINSTANCE.Lift(GoRustBuffer{
					inner: parentPaymentIds,
				}),
			)

		if err != nil {
			var actualError *StorageError
			if errors.As(err, &actualError) {
				if actualError != nil {
					*callStatus = C.RustCallStatus{
						code:     C.int8_t(uniffiCallbackResultError),
						errorBuf: FfiConverterStorageErrorINSTANCE.Lower(actualError),
					}
					return
				}
			} else {
				*callStatus = C.RustCallStatus{
					code: C.int8_t(uniffiCallbackUnexpectedResultError),
				}
				return
			}
		}

		*uniffiOutReturn = FfiConverterMapStringSequencePaymentINSTANCE.Lower(res)
	}()
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod9
func breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod9(uniffiHandle C.uint64_t, txid C.RustBuffer, vout C.uint32_t, amountSats C.uint64_t, isMature C.int8_t, uniffiFutureCallback C.UniffiForeignFutureCompleteVoid, uniffiCallbackData C.uint64_t, uniffiOutReturn *C.UniffiForeignFuture) {
	handle := uint64(uniffiHandle)
	uniffiObj, ok := FfiConverterStorageINSTANCE.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}

	result := make(chan C.UniffiForeignFutureStructVoid, 1)
	cancel := make(chan struct{}, 1)
	guardHandle := cgo.NewHandle(cancel)
	*uniffiOutReturn = C.UniffiForeignFuture{
		handle: C.uint64_t(guardHandle),
		free:   C.UniffiForeignFutureFree(C.breez_sdk_spark_uniffiFreeGorutine),
	}

	// Wait for compleation or cancel
	go func() {
		select {
		case <-cancel:
		case res := <-result:
			C.call_UniffiForeignFutureCompleteVoid(uniffiFutureCallback, uniffiCallbackData, res)
		}
	}()

	// Eval callback asynchroniously
	go func() {
		asyncResult := &C.UniffiForeignFutureStructVoid{}
		callStatus := &asyncResult.callStatus
		defer func() {
			result <- *asyncResult
		}()

		err :=
			uniffiObj.AddDeposit(
				FfiConverterStringINSTANCE.Lift(GoRustBuffer{
					inner: txid,
				}),
				FfiConverterUint32INSTANCE.Lift(vout),
				FfiConverterUint64INSTANCE.Lift(amountSats),
				FfiConverterBoolINSTANCE.Lift(isMature),
			)

		if err != nil {
			var actualError *StorageError
			if errors.As(err, &actualError) {
				if actualError != nil {
					*callStatus = C.RustCallStatus{
						code:     C.int8_t(uniffiCallbackResultError),
						errorBuf: FfiConverterStorageErrorINSTANCE.Lower(actualError),
					}
					return
				}
			} else {
				*callStatus = C.RustCallStatus{
					code: C.int8_t(uniffiCallbackUnexpectedResultError),
				}
				return
			}
		}

	}()
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod10
func breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod10(uniffiHandle C.uint64_t, txid C.RustBuffer, vout C.uint32_t, uniffiFutureCallback C.UniffiForeignFutureCompleteVoid, uniffiCallbackData C.uint64_t, uniffiOutReturn *C.UniffiForeignFuture) {
	handle := uint64(uniffiHandle)
	uniffiObj, ok := FfiConverterStorageINSTANCE.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}

	result := make(chan C.UniffiForeignFutureStructVoid, 1)
	cancel := make(chan struct{}, 1)
	guardHandle := cgo.NewHandle(cancel)
	*uniffiOutReturn = C.UniffiForeignFuture{
		handle: C.uint64_t(guardHandle),
		free:   C.UniffiForeignFutureFree(C.breez_sdk_spark_uniffiFreeGorutine),
	}

	// Wait for compleation or cancel
	go func() {
		select {
		case <-cancel:
		case res := <-result:
			C.call_UniffiForeignFutureCompleteVoid(uniffiFutureCallback, uniffiCallbackData, res)
		}
	}()

	// Eval callback asynchroniously
	go func() {
		asyncResult := &C.UniffiForeignFutureStructVoid{}
		callStatus := &asyncResult.callStatus
		defer func() {
			result <- *asyncResult
		}()

		err :=
			uniffiObj.DeleteDeposit(
				FfiConverterStringINSTANCE.Lift(GoRustBuffer{
					inner: txid,
				}),
				FfiConverterUint32INSTANCE.Lift(vout),
			)

		if err != nil {
			var actualError *StorageError
			if errors.As(err, &actualError) {
				if actualError != nil {
					*callStatus = C.RustCallStatus{
						code:     C.int8_t(uniffiCallbackResultError),
						errorBuf: FfiConverterStorageErrorINSTANCE.Lower(actualError),
					}
					return
				}
			} else {
				*callStatus = C.RustCallStatus{
					code: C.int8_t(uniffiCallbackUnexpectedResultError),
				}
				return
			}
		}

	}()
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod11
func breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod11(uniffiHandle C.uint64_t, uniffiFutureCallback C.UniffiForeignFutureCompleteRustBuffer, uniffiCallbackData C.uint64_t, uniffiOutReturn *C.UniffiForeignFuture) {
	handle := uint64(uniffiHandle)
	uniffiObj, ok := FfiConverterStorageINSTANCE.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}

	result := make(chan C.UniffiForeignFutureStructRustBuffer, 1)
	cancel := make(chan struct{}, 1)
	guardHandle := cgo.NewHandle(cancel)
	*uniffiOutReturn = C.UniffiForeignFuture{
		handle: C.uint64_t(guardHandle),
		free:   C.UniffiForeignFutureFree(C.breez_sdk_spark_uniffiFreeGorutine),
	}

	// Wait for compleation or cancel
	go func() {
		select {
		case <-cancel:
		case res := <-result:
			C.call_UniffiForeignFutureCompleteRustBuffer(uniffiFutureCallback, uniffiCallbackData, res)
		}
	}()

	// Eval callback asynchroniously
	go func() {
		asyncResult := &C.UniffiForeignFutureStructRustBuffer{}
		uniffiOutReturn := &asyncResult.returnValue
		callStatus := &asyncResult.callStatus
		defer func() {
			result <- *asyncResult
		}()

		res, err :=
			uniffiObj.ListDeposits()

		if err != nil {
			var actualError *StorageError
			if errors.As(err, &actualError) {
				if actualError != nil {
					*callStatus = C.RustCallStatus{
						code:     C.int8_t(uniffiCallbackResultError),
						errorBuf: FfiConverterStorageErrorINSTANCE.Lower(actualError),
					}
					return
				}
			} else {
				*callStatus = C.RustCallStatus{
					code: C.int8_t(uniffiCallbackUnexpectedResultError),
				}
				return
			}
		}

		*uniffiOutReturn = FfiConverterSequenceDepositInfoINSTANCE.Lower(res)
	}()
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod12
func breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod12(uniffiHandle C.uint64_t, txid C.RustBuffer, vout C.uint32_t, payload C.RustBuffer, uniffiFutureCallback C.UniffiForeignFutureCompleteVoid, uniffiCallbackData C.uint64_t, uniffiOutReturn *C.UniffiForeignFuture) {
	handle := uint64(uniffiHandle)
	uniffiObj, ok := FfiConverterStorageINSTANCE.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}

	result := make(chan C.UniffiForeignFutureStructVoid, 1)
	cancel := make(chan struct{}, 1)
	guardHandle := cgo.NewHandle(cancel)
	*uniffiOutReturn = C.UniffiForeignFuture{
		handle: C.uint64_t(guardHandle),
		free:   C.UniffiForeignFutureFree(C.breez_sdk_spark_uniffiFreeGorutine),
	}

	// Wait for compleation or cancel
	go func() {
		select {
		case <-cancel:
		case res := <-result:
			C.call_UniffiForeignFutureCompleteVoid(uniffiFutureCallback, uniffiCallbackData, res)
		}
	}()

	// Eval callback asynchroniously
	go func() {
		asyncResult := &C.UniffiForeignFutureStructVoid{}
		callStatus := &asyncResult.callStatus
		defer func() {
			result <- *asyncResult
		}()

		err :=
			uniffiObj.UpdateDeposit(
				FfiConverterStringINSTANCE.Lift(GoRustBuffer{
					inner: txid,
				}),
				FfiConverterUint32INSTANCE.Lift(vout),
				FfiConverterUpdateDepositPayloadINSTANCE.Lift(GoRustBuffer{
					inner: payload,
				}),
			)

		if err != nil {
			var actualError *StorageError
			if errors.As(err, &actualError) {
				if actualError != nil {
					*callStatus = C.RustCallStatus{
						code:     C.int8_t(uniffiCallbackResultError),
						errorBuf: FfiConverterStorageErrorINSTANCE.Lower(actualError),
					}
					return
				}
			} else {
				*callStatus = C.RustCallStatus{
					code: C.int8_t(uniffiCallbackUnexpectedResultError),
				}
				return
			}
		}

	}()
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod13
func breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod13(uniffiHandle C.uint64_t, metadata C.RustBuffer, uniffiFutureCallback C.UniffiForeignFutureCompleteVoid, uniffiCallbackData C.uint64_t, uniffiOutReturn *C.UniffiForeignFuture) {
	handle := uint64(uniffiHandle)
	uniffiObj, ok := FfiConverterStorageINSTANCE.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}

	result := make(chan C.UniffiForeignFutureStructVoid, 1)
	cancel := make(chan struct{}, 1)
	guardHandle := cgo.NewHandle(cancel)
	*uniffiOutReturn = C.UniffiForeignFuture{
		handle: C.uint64_t(guardHandle),
		free:   C.UniffiForeignFutureFree(C.breez_sdk_spark_uniffiFreeGorutine),
	}

	// Wait for compleation or cancel
	go func() {
		select {
		case <-cancel:
		case res := <-result:
			C.call_UniffiForeignFutureCompleteVoid(uniffiFutureCallback, uniffiCallbackData, res)
		}
	}()

	// Eval callback asynchroniously
	go func() {
		asyncResult := &C.UniffiForeignFutureStructVoid{}
		callStatus := &asyncResult.callStatus
		defer func() {
			result <- *asyncResult
		}()

		err :=
			uniffiObj.SetLnurlMetadata(
				FfiConverterSequenceSetLnurlMetadataItemINSTANCE.Lift(GoRustBuffer{
					inner: metadata,
				}),
			)

		if err != nil {
			var actualError *StorageError
			if errors.As(err, &actualError) {
				if actualError != nil {
					*callStatus = C.RustCallStatus{
						code:     C.int8_t(uniffiCallbackResultError),
						errorBuf: FfiConverterStorageErrorINSTANCE.Lower(actualError),
					}
					return
				}
			} else {
				*callStatus = C.RustCallStatus{
					code: C.int8_t(uniffiCallbackUnexpectedResultError),
				}
				return
			}
		}

	}()
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod14
func breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod14(uniffiHandle C.uint64_t, request C.RustBuffer, uniffiFutureCallback C.UniffiForeignFutureCompleteRustBuffer, uniffiCallbackData C.uint64_t, uniffiOutReturn *C.UniffiForeignFuture) {
	handle := uint64(uniffiHandle)
	uniffiObj, ok := FfiConverterStorageINSTANCE.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}

	result := make(chan C.UniffiForeignFutureStructRustBuffer, 1)
	cancel := make(chan struct{}, 1)
	guardHandle := cgo.NewHandle(cancel)
	*uniffiOutReturn = C.UniffiForeignFuture{
		handle: C.uint64_t(guardHandle),
		free:   C.UniffiForeignFutureFree(C.breez_sdk_spark_uniffiFreeGorutine),
	}

	// Wait for compleation or cancel
	go func() {
		select {
		case <-cancel:
		case res := <-result:
			C.call_UniffiForeignFutureCompleteRustBuffer(uniffiFutureCallback, uniffiCallbackData, res)
		}
	}()

	// Eval callback asynchroniously
	go func() {
		asyncResult := &C.UniffiForeignFutureStructRustBuffer{}
		uniffiOutReturn := &asyncResult.returnValue
		callStatus := &asyncResult.callStatus
		defer func() {
			result <- *asyncResult
		}()

		res, err :=
			uniffiObj.ListContacts(
				FfiConverterListContactsRequestINSTANCE.Lift(GoRustBuffer{
					inner: request,
				}),
			)

		if err != nil {
			var actualError *StorageError
			if errors.As(err, &actualError) {
				if actualError != nil {
					*callStatus = C.RustCallStatus{
						code:     C.int8_t(uniffiCallbackResultError),
						errorBuf: FfiConverterStorageErrorINSTANCE.Lower(actualError),
					}
					return
				}
			} else {
				*callStatus = C.RustCallStatus{
					code: C.int8_t(uniffiCallbackUnexpectedResultError),
				}
				return
			}
		}

		*uniffiOutReturn = FfiConverterSequenceContactINSTANCE.Lower(res)
	}()
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod15
func breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod15(uniffiHandle C.uint64_t, id C.RustBuffer, uniffiFutureCallback C.UniffiForeignFutureCompleteRustBuffer, uniffiCallbackData C.uint64_t, uniffiOutReturn *C.UniffiForeignFuture) {
	handle := uint64(uniffiHandle)
	uniffiObj, ok := FfiConverterStorageINSTANCE.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}

	result := make(chan C.UniffiForeignFutureStructRustBuffer, 1)
	cancel := make(chan struct{}, 1)
	guardHandle := cgo.NewHandle(cancel)
	*uniffiOutReturn = C.UniffiForeignFuture{
		handle: C.uint64_t(guardHandle),
		free:   C.UniffiForeignFutureFree(C.breez_sdk_spark_uniffiFreeGorutine),
	}

	// Wait for compleation or cancel
	go func() {
		select {
		case <-cancel:
		case res := <-result:
			C.call_UniffiForeignFutureCompleteRustBuffer(uniffiFutureCallback, uniffiCallbackData, res)
		}
	}()

	// Eval callback asynchroniously
	go func() {
		asyncResult := &C.UniffiForeignFutureStructRustBuffer{}
		uniffiOutReturn := &asyncResult.returnValue
		callStatus := &asyncResult.callStatus
		defer func() {
			result <- *asyncResult
		}()

		res, err :=
			uniffiObj.GetContact(
				FfiConverterStringINSTANCE.Lift(GoRustBuffer{
					inner: id,
				}),
			)

		if err != nil {
			var actualError *StorageError
			if errors.As(err, &actualError) {
				if actualError != nil {
					*callStatus = C.RustCallStatus{
						code:     C.int8_t(uniffiCallbackResultError),
						errorBuf: FfiConverterStorageErrorINSTANCE.Lower(actualError),
					}
					return
				}
			} else {
				*callStatus = C.RustCallStatus{
					code: C.int8_t(uniffiCallbackUnexpectedResultError),
				}
				return
			}
		}

		*uniffiOutReturn = FfiConverterContactINSTANCE.Lower(res)
	}()
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod16
func breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod16(uniffiHandle C.uint64_t, contact C.RustBuffer, uniffiFutureCallback C.UniffiForeignFutureCompleteVoid, uniffiCallbackData C.uint64_t, uniffiOutReturn *C.UniffiForeignFuture) {
	handle := uint64(uniffiHandle)
	uniffiObj, ok := FfiConverterStorageINSTANCE.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}

	result := make(chan C.UniffiForeignFutureStructVoid, 1)
	cancel := make(chan struct{}, 1)
	guardHandle := cgo.NewHandle(cancel)
	*uniffiOutReturn = C.UniffiForeignFuture{
		handle: C.uint64_t(guardHandle),
		free:   C.UniffiForeignFutureFree(C.breez_sdk_spark_uniffiFreeGorutine),
	}

	// Wait for compleation or cancel
	go func() {
		select {
		case <-cancel:
		case res := <-result:
			C.call_UniffiForeignFutureCompleteVoid(uniffiFutureCallback, uniffiCallbackData, res)
		}
	}()

	// Eval callback asynchroniously
	go func() {
		asyncResult := &C.UniffiForeignFutureStructVoid{}
		callStatus := &asyncResult.callStatus
		defer func() {
			result <- *asyncResult
		}()

		err :=
			uniffiObj.InsertContact(
				FfiConverterContactINSTANCE.Lift(GoRustBuffer{
					inner: contact,
				}),
			)

		if err != nil {
			var actualError *StorageError
			if errors.As(err, &actualError) {
				if actualError != nil {
					*callStatus = C.RustCallStatus{
						code:     C.int8_t(uniffiCallbackResultError),
						errorBuf: FfiConverterStorageErrorINSTANCE.Lower(actualError),
					}
					return
				}
			} else {
				*callStatus = C.RustCallStatus{
					code: C.int8_t(uniffiCallbackUnexpectedResultError),
				}
				return
			}
		}

	}()
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod17
func breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod17(uniffiHandle C.uint64_t, id C.RustBuffer, uniffiFutureCallback C.UniffiForeignFutureCompleteVoid, uniffiCallbackData C.uint64_t, uniffiOutReturn *C.UniffiForeignFuture) {
	handle := uint64(uniffiHandle)
	uniffiObj, ok := FfiConverterStorageINSTANCE.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}

	result := make(chan C.UniffiForeignFutureStructVoid, 1)
	cancel := make(chan struct{}, 1)
	guardHandle := cgo.NewHandle(cancel)
	*uniffiOutReturn = C.UniffiForeignFuture{
		handle: C.uint64_t(guardHandle),
		free:   C.UniffiForeignFutureFree(C.breez_sdk_spark_uniffiFreeGorutine),
	}

	// Wait for compleation or cancel
	go func() {
		select {
		case <-cancel:
		case res := <-result:
			C.call_UniffiForeignFutureCompleteVoid(uniffiFutureCallback, uniffiCallbackData, res)
		}
	}()

	// Eval callback asynchroniously
	go func() {
		asyncResult := &C.UniffiForeignFutureStructVoid{}
		callStatus := &asyncResult.callStatus
		defer func() {
			result <- *asyncResult
		}()

		err :=
			uniffiObj.DeleteContact(
				FfiConverterStringINSTANCE.Lift(GoRustBuffer{
					inner: id,
				}),
			)

		if err != nil {
			var actualError *StorageError
			if errors.As(err, &actualError) {
				if actualError != nil {
					*callStatus = C.RustCallStatus{
						code:     C.int8_t(uniffiCallbackResultError),
						errorBuf: FfiConverterStorageErrorINSTANCE.Lower(actualError),
					}
					return
				}
			} else {
				*callStatus = C.RustCallStatus{
					code: C.int8_t(uniffiCallbackUnexpectedResultError),
				}
				return
			}
		}

	}()
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod18
func breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod18(uniffiHandle C.uint64_t, record C.RustBuffer, uniffiFutureCallback C.UniffiForeignFutureCompleteU64, uniffiCallbackData C.uint64_t, uniffiOutReturn *C.UniffiForeignFuture) {
	handle := uint64(uniffiHandle)
	uniffiObj, ok := FfiConverterStorageINSTANCE.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}

	result := make(chan C.UniffiForeignFutureStructU64, 1)
	cancel := make(chan struct{}, 1)
	guardHandle := cgo.NewHandle(cancel)
	*uniffiOutReturn = C.UniffiForeignFuture{
		handle: C.uint64_t(guardHandle),
		free:   C.UniffiForeignFutureFree(C.breez_sdk_spark_uniffiFreeGorutine),
	}

	// Wait for compleation or cancel
	go func() {
		select {
		case <-cancel:
		case res := <-result:
			C.call_UniffiForeignFutureCompleteU64(uniffiFutureCallback, uniffiCallbackData, res)
		}
	}()

	// Eval callback asynchroniously
	go func() {
		asyncResult := &C.UniffiForeignFutureStructU64{}
		uniffiOutReturn := &asyncResult.returnValue
		callStatus := &asyncResult.callStatus
		defer func() {
			result <- *asyncResult
		}()

		res, err :=
			uniffiObj.AddOutgoingChange(
				FfiConverterUnversionedRecordChangeINSTANCE.Lift(GoRustBuffer{
					inner: record,
				}),
			)

		if err != nil {
			var actualError *StorageError
			if errors.As(err, &actualError) {
				if actualError != nil {
					*callStatus = C.RustCallStatus{
						code:     C.int8_t(uniffiCallbackResultError),
						errorBuf: FfiConverterStorageErrorINSTANCE.Lower(actualError),
					}
					return
				}
			} else {
				*callStatus = C.RustCallStatus{
					code: C.int8_t(uniffiCallbackUnexpectedResultError),
				}
				return
			}
		}

		*uniffiOutReturn = FfiConverterUint64INSTANCE.Lower(res)
	}()
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod19
func breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod19(uniffiHandle C.uint64_t, record C.RustBuffer, localRevision C.uint64_t, uniffiFutureCallback C.UniffiForeignFutureCompleteVoid, uniffiCallbackData C.uint64_t, uniffiOutReturn *C.UniffiForeignFuture) {
	handle := uint64(uniffiHandle)
	uniffiObj, ok := FfiConverterStorageINSTANCE.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}

	result := make(chan C.UniffiForeignFutureStructVoid, 1)
	cancel := make(chan struct{}, 1)
	guardHandle := cgo.NewHandle(cancel)
	*uniffiOutReturn = C.UniffiForeignFuture{
		handle: C.uint64_t(guardHandle),
		free:   C.UniffiForeignFutureFree(C.breez_sdk_spark_uniffiFreeGorutine),
	}

	// Wait for compleation or cancel
	go func() {
		select {
		case <-cancel:
		case res := <-result:
			C.call_UniffiForeignFutureCompleteVoid(uniffiFutureCallback, uniffiCallbackData, res)
		}
	}()

	// Eval callback asynchroniously
	go func() {
		asyncResult := &C.UniffiForeignFutureStructVoid{}
		callStatus := &asyncResult.callStatus
		defer func() {
			result <- *asyncResult
		}()

		err :=
			uniffiObj.CompleteOutgoingSync(
				FfiConverterRecordINSTANCE.Lift(GoRustBuffer{
					inner: record,
				}),
				FfiConverterUint64INSTANCE.Lift(localRevision),
			)

		if err != nil {
			var actualError *StorageError
			if errors.As(err, &actualError) {
				if actualError != nil {
					*callStatus = C.RustCallStatus{
						code:     C.int8_t(uniffiCallbackResultError),
						errorBuf: FfiConverterStorageErrorINSTANCE.Lower(actualError),
					}
					return
				}
			} else {
				*callStatus = C.RustCallStatus{
					code: C.int8_t(uniffiCallbackUnexpectedResultError),
				}
				return
			}
		}

	}()
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod20
func breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod20(uniffiHandle C.uint64_t, limit C.uint32_t, uniffiFutureCallback C.UniffiForeignFutureCompleteRustBuffer, uniffiCallbackData C.uint64_t, uniffiOutReturn *C.UniffiForeignFuture) {
	handle := uint64(uniffiHandle)
	uniffiObj, ok := FfiConverterStorageINSTANCE.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}

	result := make(chan C.UniffiForeignFutureStructRustBuffer, 1)
	cancel := make(chan struct{}, 1)
	guardHandle := cgo.NewHandle(cancel)
	*uniffiOutReturn = C.UniffiForeignFuture{
		handle: C.uint64_t(guardHandle),
		free:   C.UniffiForeignFutureFree(C.breez_sdk_spark_uniffiFreeGorutine),
	}

	// Wait for compleation or cancel
	go func() {
		select {
		case <-cancel:
		case res := <-result:
			C.call_UniffiForeignFutureCompleteRustBuffer(uniffiFutureCallback, uniffiCallbackData, res)
		}
	}()

	// Eval callback asynchroniously
	go func() {
		asyncResult := &C.UniffiForeignFutureStructRustBuffer{}
		uniffiOutReturn := &asyncResult.returnValue
		callStatus := &asyncResult.callStatus
		defer func() {
			result <- *asyncResult
		}()

		res, err :=
			uniffiObj.GetPendingOutgoingChanges(
				FfiConverterUint32INSTANCE.Lift(limit),
			)

		if err != nil {
			var actualError *StorageError
			if errors.As(err, &actualError) {
				if actualError != nil {
					*callStatus = C.RustCallStatus{
						code:     C.int8_t(uniffiCallbackResultError),
						errorBuf: FfiConverterStorageErrorINSTANCE.Lower(actualError),
					}
					return
				}
			} else {
				*callStatus = C.RustCallStatus{
					code: C.int8_t(uniffiCallbackUnexpectedResultError),
				}
				return
			}
		}

		*uniffiOutReturn = FfiConverterSequenceOutgoingChangeINSTANCE.Lower(res)
	}()
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod21
func breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod21(uniffiHandle C.uint64_t, uniffiFutureCallback C.UniffiForeignFutureCompleteU64, uniffiCallbackData C.uint64_t, uniffiOutReturn *C.UniffiForeignFuture) {
	handle := uint64(uniffiHandle)
	uniffiObj, ok := FfiConverterStorageINSTANCE.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}

	result := make(chan C.UniffiForeignFutureStructU64, 1)
	cancel := make(chan struct{}, 1)
	guardHandle := cgo.NewHandle(cancel)
	*uniffiOutReturn = C.UniffiForeignFuture{
		handle: C.uint64_t(guardHandle),
		free:   C.UniffiForeignFutureFree(C.breez_sdk_spark_uniffiFreeGorutine),
	}

	// Wait for compleation or cancel
	go func() {
		select {
		case <-cancel:
		case res := <-result:
			C.call_UniffiForeignFutureCompleteU64(uniffiFutureCallback, uniffiCallbackData, res)
		}
	}()

	// Eval callback asynchroniously
	go func() {
		asyncResult := &C.UniffiForeignFutureStructU64{}
		uniffiOutReturn := &asyncResult.returnValue
		callStatus := &asyncResult.callStatus
		defer func() {
			result <- *asyncResult
		}()

		res, err :=
			uniffiObj.GetLastRevision()

		if err != nil {
			var actualError *StorageError
			if errors.As(err, &actualError) {
				if actualError != nil {
					*callStatus = C.RustCallStatus{
						code:     C.int8_t(uniffiCallbackResultError),
						errorBuf: FfiConverterStorageErrorINSTANCE.Lower(actualError),
					}
					return
				}
			} else {
				*callStatus = C.RustCallStatus{
					code: C.int8_t(uniffiCallbackUnexpectedResultError),
				}
				return
			}
		}

		*uniffiOutReturn = FfiConverterUint64INSTANCE.Lower(res)
	}()
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod22
func breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod22(uniffiHandle C.uint64_t, records C.RustBuffer, uniffiFutureCallback C.UniffiForeignFutureCompleteVoid, uniffiCallbackData C.uint64_t, uniffiOutReturn *C.UniffiForeignFuture) {
	handle := uint64(uniffiHandle)
	uniffiObj, ok := FfiConverterStorageINSTANCE.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}

	result := make(chan C.UniffiForeignFutureStructVoid, 1)
	cancel := make(chan struct{}, 1)
	guardHandle := cgo.NewHandle(cancel)
	*uniffiOutReturn = C.UniffiForeignFuture{
		handle: C.uint64_t(guardHandle),
		free:   C.UniffiForeignFutureFree(C.breez_sdk_spark_uniffiFreeGorutine),
	}

	// Wait for compleation or cancel
	go func() {
		select {
		case <-cancel:
		case res := <-result:
			C.call_UniffiForeignFutureCompleteVoid(uniffiFutureCallback, uniffiCallbackData, res)
		}
	}()

	// Eval callback asynchroniously
	go func() {
		asyncResult := &C.UniffiForeignFutureStructVoid{}
		callStatus := &asyncResult.callStatus
		defer func() {
			result <- *asyncResult
		}()

		err :=
			uniffiObj.InsertIncomingRecords(
				FfiConverterSequenceRecordINSTANCE.Lift(GoRustBuffer{
					inner: records,
				}),
			)

		if err != nil {
			var actualError *StorageError
			if errors.As(err, &actualError) {
				if actualError != nil {
					*callStatus = C.RustCallStatus{
						code:     C.int8_t(uniffiCallbackResultError),
						errorBuf: FfiConverterStorageErrorINSTANCE.Lower(actualError),
					}
					return
				}
			} else {
				*callStatus = C.RustCallStatus{
					code: C.int8_t(uniffiCallbackUnexpectedResultError),
				}
				return
			}
		}

	}()
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod23
func breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod23(uniffiHandle C.uint64_t, record C.RustBuffer, uniffiFutureCallback C.UniffiForeignFutureCompleteVoid, uniffiCallbackData C.uint64_t, uniffiOutReturn *C.UniffiForeignFuture) {
	handle := uint64(uniffiHandle)
	uniffiObj, ok := FfiConverterStorageINSTANCE.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}

	result := make(chan C.UniffiForeignFutureStructVoid, 1)
	cancel := make(chan struct{}, 1)
	guardHandle := cgo.NewHandle(cancel)
	*uniffiOutReturn = C.UniffiForeignFuture{
		handle: C.uint64_t(guardHandle),
		free:   C.UniffiForeignFutureFree(C.breez_sdk_spark_uniffiFreeGorutine),
	}

	// Wait for compleation or cancel
	go func() {
		select {
		case <-cancel:
		case res := <-result:
			C.call_UniffiForeignFutureCompleteVoid(uniffiFutureCallback, uniffiCallbackData, res)
		}
	}()

	// Eval callback asynchroniously
	go func() {
		asyncResult := &C.UniffiForeignFutureStructVoid{}
		callStatus := &asyncResult.callStatus
		defer func() {
			result <- *asyncResult
		}()

		err :=
			uniffiObj.DeleteIncomingRecord(
				FfiConverterRecordINSTANCE.Lift(GoRustBuffer{
					inner: record,
				}),
			)

		if err != nil {
			var actualError *StorageError
			if errors.As(err, &actualError) {
				if actualError != nil {
					*callStatus = C.RustCallStatus{
						code:     C.int8_t(uniffiCallbackResultError),
						errorBuf: FfiConverterStorageErrorINSTANCE.Lower(actualError),
					}
					return
				}
			} else {
				*callStatus = C.RustCallStatus{
					code: C.int8_t(uniffiCallbackUnexpectedResultError),
				}
				return
			}
		}

	}()
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod24
func breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod24(uniffiHandle C.uint64_t, limit C.uint32_t, uniffiFutureCallback C.UniffiForeignFutureCompleteRustBuffer, uniffiCallbackData C.uint64_t, uniffiOutReturn *C.UniffiForeignFuture) {
	handle := uint64(uniffiHandle)
	uniffiObj, ok := FfiConverterStorageINSTANCE.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}

	result := make(chan C.UniffiForeignFutureStructRustBuffer, 1)
	cancel := make(chan struct{}, 1)
	guardHandle := cgo.NewHandle(cancel)
	*uniffiOutReturn = C.UniffiForeignFuture{
		handle: C.uint64_t(guardHandle),
		free:   C.UniffiForeignFutureFree(C.breez_sdk_spark_uniffiFreeGorutine),
	}

	// Wait for compleation or cancel
	go func() {
		select {
		case <-cancel:
		case res := <-result:
			C.call_UniffiForeignFutureCompleteRustBuffer(uniffiFutureCallback, uniffiCallbackData, res)
		}
	}()

	// Eval callback asynchroniously
	go func() {
		asyncResult := &C.UniffiForeignFutureStructRustBuffer{}
		uniffiOutReturn := &asyncResult.returnValue
		callStatus := &asyncResult.callStatus
		defer func() {
			result <- *asyncResult
		}()

		res, err :=
			uniffiObj.GetIncomingRecords(
				FfiConverterUint32INSTANCE.Lift(limit),
			)

		if err != nil {
			var actualError *StorageError
			if errors.As(err, &actualError) {
				if actualError != nil {
					*callStatus = C.RustCallStatus{
						code:     C.int8_t(uniffiCallbackResultError),
						errorBuf: FfiConverterStorageErrorINSTANCE.Lower(actualError),
					}
					return
				}
			} else {
				*callStatus = C.RustCallStatus{
					code: C.int8_t(uniffiCallbackUnexpectedResultError),
				}
				return
			}
		}

		*uniffiOutReturn = FfiConverterSequenceIncomingChangeINSTANCE.Lower(res)
	}()
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod25
func breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod25(uniffiHandle C.uint64_t, uniffiFutureCallback C.UniffiForeignFutureCompleteRustBuffer, uniffiCallbackData C.uint64_t, uniffiOutReturn *C.UniffiForeignFuture) {
	handle := uint64(uniffiHandle)
	uniffiObj, ok := FfiConverterStorageINSTANCE.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}

	result := make(chan C.UniffiForeignFutureStructRustBuffer, 1)
	cancel := make(chan struct{}, 1)
	guardHandle := cgo.NewHandle(cancel)
	*uniffiOutReturn = C.UniffiForeignFuture{
		handle: C.uint64_t(guardHandle),
		free:   C.UniffiForeignFutureFree(C.breez_sdk_spark_uniffiFreeGorutine),
	}

	// Wait for compleation or cancel
	go func() {
		select {
		case <-cancel:
		case res := <-result:
			C.call_UniffiForeignFutureCompleteRustBuffer(uniffiFutureCallback, uniffiCallbackData, res)
		}
	}()

	// Eval callback asynchroniously
	go func() {
		asyncResult := &C.UniffiForeignFutureStructRustBuffer{}
		uniffiOutReturn := &asyncResult.returnValue
		callStatus := &asyncResult.callStatus
		defer func() {
			result <- *asyncResult
		}()

		res, err :=
			uniffiObj.GetLatestOutgoingChange()

		if err != nil {
			var actualError *StorageError
			if errors.As(err, &actualError) {
				if actualError != nil {
					*callStatus = C.RustCallStatus{
						code:     C.int8_t(uniffiCallbackResultError),
						errorBuf: FfiConverterStorageErrorINSTANCE.Lower(actualError),
					}
					return
				}
			} else {
				*callStatus = C.RustCallStatus{
					code: C.int8_t(uniffiCallbackUnexpectedResultError),
				}
				return
			}
		}

		*uniffiOutReturn = FfiConverterOptionalOutgoingChangeINSTANCE.Lower(res)
	}()
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod26
func breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod26(uniffiHandle C.uint64_t, record C.RustBuffer, uniffiFutureCallback C.UniffiForeignFutureCompleteVoid, uniffiCallbackData C.uint64_t, uniffiOutReturn *C.UniffiForeignFuture) {
	handle := uint64(uniffiHandle)
	uniffiObj, ok := FfiConverterStorageINSTANCE.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}

	result := make(chan C.UniffiForeignFutureStructVoid, 1)
	cancel := make(chan struct{}, 1)
	guardHandle := cgo.NewHandle(cancel)
	*uniffiOutReturn = C.UniffiForeignFuture{
		handle: C.uint64_t(guardHandle),
		free:   C.UniffiForeignFutureFree(C.breez_sdk_spark_uniffiFreeGorutine),
	}

	// Wait for compleation or cancel
	go func() {
		select {
		case <-cancel:
		case res := <-result:
			C.call_UniffiForeignFutureCompleteVoid(uniffiFutureCallback, uniffiCallbackData, res)
		}
	}()

	// Eval callback asynchroniously
	go func() {
		asyncResult := &C.UniffiForeignFutureStructVoid{}
		callStatus := &asyncResult.callStatus
		defer func() {
			result <- *asyncResult
		}()

		err :=
			uniffiObj.UpdateRecordFromIncoming(
				FfiConverterRecordINSTANCE.Lift(GoRustBuffer{
					inner: record,
				}),
			)

		if err != nil {
			var actualError *StorageError
			if errors.As(err, &actualError) {
				if actualError != nil {
					*callStatus = C.RustCallStatus{
						code:     C.int8_t(uniffiCallbackResultError),
						errorBuf: FfiConverterStorageErrorINSTANCE.Lower(actualError),
					}
					return
				}
			} else {
				*callStatus = C.RustCallStatus{
					code: C.int8_t(uniffiCallbackUnexpectedResultError),
				}
				return
			}
		}

	}()
}

var UniffiVTableCallbackInterfaceStorageINSTANCE = C.UniffiVTableCallbackInterfaceStorage{
	deleteCachedItem:          (C.UniffiCallbackInterfaceStorageMethod0)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod0),
	getCachedItem:             (C.UniffiCallbackInterfaceStorageMethod1)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod1),
	setCachedItem:             (C.UniffiCallbackInterfaceStorageMethod2)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod2),
	listPayments:              (C.UniffiCallbackInterfaceStorageMethod3)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod3),
	insertPayment:             (C.UniffiCallbackInterfaceStorageMethod4)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod4),
	insertPaymentMetadata:     (C.UniffiCallbackInterfaceStorageMethod5)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod5),
	getPaymentById:            (C.UniffiCallbackInterfaceStorageMethod6)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod6),
	getPaymentByInvoice:       (C.UniffiCallbackInterfaceStorageMethod7)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod7),
	getPaymentsByParentIds:    (C.UniffiCallbackInterfaceStorageMethod8)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod8),
	addDeposit:                (C.UniffiCallbackInterfaceStorageMethod9)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod9),
	deleteDeposit:             (C.UniffiCallbackInterfaceStorageMethod10)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod10),
	listDeposits:              (C.UniffiCallbackInterfaceStorageMethod11)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod11),
	updateDeposit:             (C.UniffiCallbackInterfaceStorageMethod12)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod12),
	setLnurlMetadata:          (C.UniffiCallbackInterfaceStorageMethod13)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod13),
	listContacts:              (C.UniffiCallbackInterfaceStorageMethod14)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod14),
	getContact:                (C.UniffiCallbackInterfaceStorageMethod15)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod15),
	insertContact:             (C.UniffiCallbackInterfaceStorageMethod16)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod16),
	deleteContact:             (C.UniffiCallbackInterfaceStorageMethod17)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod17),
	addOutgoingChange:         (C.UniffiCallbackInterfaceStorageMethod18)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod18),
	completeOutgoingSync:      (C.UniffiCallbackInterfaceStorageMethod19)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod19),
	getPendingOutgoingChanges: (C.UniffiCallbackInterfaceStorageMethod20)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod20),
	getLastRevision:           (C.UniffiCallbackInterfaceStorageMethod21)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod21),
	insertIncomingRecords:     (C.UniffiCallbackInterfaceStorageMethod22)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod22),
	deleteIncomingRecord:      (C.UniffiCallbackInterfaceStorageMethod23)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod23),
	getIncomingRecords:        (C.UniffiCallbackInterfaceStorageMethod24)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod24),
	getLatestOutgoingChange:   (C.UniffiCallbackInterfaceStorageMethod25)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod25),
	updateRecordFromIncoming:  (C.UniffiCallbackInterfaceStorageMethod26)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageMethod26),

	uniffiFree: (C.UniffiCallbackInterfaceFree)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageFree),
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageFree
func breez_sdk_spark_cgo_dispatchCallbackInterfaceStorageFree(handle C.uint64_t) {
	FfiConverterStorageINSTANCE.handleMap.remove(uint64(handle))
}

func (c FfiConverterStorage) register() {
	C.uniffi_breez_sdk_spark_fn_init_callback_vtable_storage(&UniffiVTableCallbackInterfaceStorageINSTANCE)
}

type TokenIssuerInterface interface {
	// Burns supply of the issuer token
	//
	// # Arguments
	//
	// * `request`: The request containing the amount of the supply to burn
	//
	// # Returns
	//
	// Result containing either:
	// * `Payment` - The payment representing the burn transaction
	// * `SdkError` - If there was an error during the burn process
	BurnIssuerToken(request BurnIssuerTokenRequest) (Payment, error)
	// Creates a new issuer token
	//
	// # Arguments
	//
	// * `request`: The request containing the token parameters
	//
	// # Returns
	//
	// Result containing either:
	// * `TokenMetadata` - The metadata of the created token
	// * `SdkError` - If there was an error during the token creation
	CreateIssuerToken(request CreateIssuerTokenRequest) (TokenMetadata, error)
	// Freezes tokens held at the specified address
	//
	// # Arguments
	//
	// * `request`: The request containing the spark address where the tokens to be frozen are held
	//
	// # Returns
	//
	// Result containing either:
	// * `FreezeIssuerTokenResponse` - The response containing details of the freeze operation
	// * `SdkError` - If there was an error during the freeze process
	FreezeIssuerToken(request FreezeIssuerTokenRequest) (FreezeIssuerTokenResponse, error)
	// Gets the issuer token balance
	//
	// # Returns
	//
	// Result containing either:
	// * `TokenBalance` - The balance of the issuer token
	// * `SdkError` - If there was an error during the retrieval or no issuer token exists
	GetIssuerTokenBalance() (TokenBalance, error)
	// Gets the issuer token metadata
	//
	// # Returns
	//
	// Result containing either:
	// * `TokenMetadata` - The metadata of the issuer token
	// * `SdkError` - If there was an error during the retrieval or no issuer token exists
	GetIssuerTokenMetadata() (TokenMetadata, error)
	// Mints supply for the issuer token
	//
	// # Arguments
	//
	// * `request`: The request contiaining the amount of the supply to mint
	//
	// # Returns
	//
	// Result containing either:
	// * `Payment` - The payment representing the minting transaction
	// * `SdkError` - If there was an error during the minting process
	MintIssuerToken(request MintIssuerTokenRequest) (Payment, error)
	// Unfreezes tokens held at the specified address
	//
	// # Arguments
	//
	// * `request`: The request containing the spark address where the tokens to be unfrozen are held
	//
	// # Returns
	//
	// Result containing either:
	// * `UnfreezeIssuerTokenResponse` - The response containing details of the unfreeze operation
	// * `SdkError` - If there was an error during the unfreeze process
	UnfreezeIssuerToken(request UnfreezeIssuerTokenRequest) (UnfreezeIssuerTokenResponse, error)
}
type TokenIssuer struct {
	ffiObject FfiObject
}

// Burns supply of the issuer token
//
// # Arguments
//
// * `request`: The request containing the amount of the supply to burn
//
// # Returns
//
// Result containing either:
// * `Payment` - The payment representing the burn transaction
// * `SdkError` - If there was an error during the burn process
func (_self *TokenIssuer) BurnIssuerToken(request BurnIssuerTokenRequest) (Payment, error) {
	_pointer := _self.ffiObject.incrementPointer("*TokenIssuer")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[SdkError](
		FfiConverterSdkErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) Payment {
			return FfiConverterPaymentINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_tokenissuer_burn_issuer_token(
			_pointer, FfiConverterBurnIssuerTokenRequestINSTANCE.Lower(request)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// Creates a new issuer token
//
// # Arguments
//
// * `request`: The request containing the token parameters
//
// # Returns
//
// Result containing either:
// * `TokenMetadata` - The metadata of the created token
// * `SdkError` - If there was an error during the token creation
func (_self *TokenIssuer) CreateIssuerToken(request CreateIssuerTokenRequest) (TokenMetadata, error) {
	_pointer := _self.ffiObject.incrementPointer("*TokenIssuer")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[SdkError](
		FfiConverterSdkErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) TokenMetadata {
			return FfiConverterTokenMetadataINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_tokenissuer_create_issuer_token(
			_pointer, FfiConverterCreateIssuerTokenRequestINSTANCE.Lower(request)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// Freezes tokens held at the specified address
//
// # Arguments
//
// * `request`: The request containing the spark address where the tokens to be frozen are held
//
// # Returns
//
// Result containing either:
// * `FreezeIssuerTokenResponse` - The response containing details of the freeze operation
// * `SdkError` - If there was an error during the freeze process
func (_self *TokenIssuer) FreezeIssuerToken(request FreezeIssuerTokenRequest) (FreezeIssuerTokenResponse, error) {
	_pointer := _self.ffiObject.incrementPointer("*TokenIssuer")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[SdkError](
		FfiConverterSdkErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) FreezeIssuerTokenResponse {
			return FfiConverterFreezeIssuerTokenResponseINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_tokenissuer_freeze_issuer_token(
			_pointer, FfiConverterFreezeIssuerTokenRequestINSTANCE.Lower(request)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// Gets the issuer token balance
//
// # Returns
//
// Result containing either:
// * `TokenBalance` - The balance of the issuer token
// * `SdkError` - If there was an error during the retrieval or no issuer token exists
func (_self *TokenIssuer) GetIssuerTokenBalance() (TokenBalance, error) {
	_pointer := _self.ffiObject.incrementPointer("*TokenIssuer")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[SdkError](
		FfiConverterSdkErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) TokenBalance {
			return FfiConverterTokenBalanceINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_tokenissuer_get_issuer_token_balance(
			_pointer),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// Gets the issuer token metadata
//
// # Returns
//
// Result containing either:
// * `TokenMetadata` - The metadata of the issuer token
// * `SdkError` - If there was an error during the retrieval or no issuer token exists
func (_self *TokenIssuer) GetIssuerTokenMetadata() (TokenMetadata, error) {
	_pointer := _self.ffiObject.incrementPointer("*TokenIssuer")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[SdkError](
		FfiConverterSdkErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) TokenMetadata {
			return FfiConverterTokenMetadataINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_tokenissuer_get_issuer_token_metadata(
			_pointer),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// Mints supply for the issuer token
//
// # Arguments
//
// * `request`: The request contiaining the amount of the supply to mint
//
// # Returns
//
// Result containing either:
// * `Payment` - The payment representing the minting transaction
// * `SdkError` - If there was an error during the minting process
func (_self *TokenIssuer) MintIssuerToken(request MintIssuerTokenRequest) (Payment, error) {
	_pointer := _self.ffiObject.incrementPointer("*TokenIssuer")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[SdkError](
		FfiConverterSdkErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) Payment {
			return FfiConverterPaymentINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_tokenissuer_mint_issuer_token(
			_pointer, FfiConverterMintIssuerTokenRequestINSTANCE.Lower(request)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// Unfreezes tokens held at the specified address
//
// # Arguments
//
// * `request`: The request containing the spark address where the tokens to be unfrozen are held
//
// # Returns
//
// Result containing either:
// * `UnfreezeIssuerTokenResponse` - The response containing details of the unfreeze operation
// * `SdkError` - If there was an error during the unfreeze process
func (_self *TokenIssuer) UnfreezeIssuerToken(request UnfreezeIssuerTokenRequest) (UnfreezeIssuerTokenResponse, error) {
	_pointer := _self.ffiObject.incrementPointer("*TokenIssuer")
	defer _self.ffiObject.decrementPointer()
	res, err := uniffiRustCallAsync[SdkError](
		FfiConverterSdkErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) UnfreezeIssuerTokenResponse {
			return FfiConverterUnfreezeIssuerTokenResponseINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_method_tokenissuer_unfreeze_issuer_token(
			_pointer, FfiConverterUnfreezeIssuerTokenRequestINSTANCE.Lower(request)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}
func (object *TokenIssuer) Destroy() {
	runtime.SetFinalizer(object, nil)
	object.ffiObject.destroy()
}

type FfiConverterTokenIssuer struct{}

var FfiConverterTokenIssuerINSTANCE = FfiConverterTokenIssuer{}

func (c FfiConverterTokenIssuer) Lift(pointer unsafe.Pointer) *TokenIssuer {
	result := &TokenIssuer{
		newFfiObject(
			pointer,
			func(pointer unsafe.Pointer, status *C.RustCallStatus) unsafe.Pointer {
				return C.uniffi_breez_sdk_spark_fn_clone_tokenissuer(pointer, status)
			},
			func(pointer unsafe.Pointer, status *C.RustCallStatus) {
				C.uniffi_breez_sdk_spark_fn_free_tokenissuer(pointer, status)
			},
		),
	}
	runtime.SetFinalizer(result, (*TokenIssuer).Destroy)
	return result
}

func (c FfiConverterTokenIssuer) Read(reader io.Reader) *TokenIssuer {
	return c.Lift(unsafe.Pointer(uintptr(readUint64(reader))))
}

func (c FfiConverterTokenIssuer) Lower(value *TokenIssuer) unsafe.Pointer {
	// TODO: this is bad - all synchronization from ObjectRuntime.go is discarded here,
	// because the pointer will be decremented immediately after this function returns,
	// and someone will be left holding onto a non-locked pointer.
	pointer := value.ffiObject.incrementPointer("*TokenIssuer")
	defer value.ffiObject.decrementPointer()
	return pointer

}

func (c FfiConverterTokenIssuer) Write(writer io.Writer, value *TokenIssuer) {
	writeUint64(writer, uint64(uintptr(c.Lower(value))))
}

type FfiDestroyerTokenIssuer struct{}

func (_ FfiDestroyerTokenIssuer) Destroy(value *TokenIssuer) {
	value.Destroy()
}

// Request to add a new contact.
type AddContactRequest struct {
	Name string
	// A Lightning address (user@domain).
	PaymentIdentifier string
}

func (r *AddContactRequest) Destroy() {
	FfiDestroyerString{}.Destroy(r.Name)
	FfiDestroyerString{}.Destroy(r.PaymentIdentifier)
}

type FfiConverterAddContactRequest struct{}

var FfiConverterAddContactRequestINSTANCE = FfiConverterAddContactRequest{}

func (c FfiConverterAddContactRequest) Lift(rb RustBufferI) AddContactRequest {
	return LiftFromRustBuffer[AddContactRequest](c, rb)
}

func (c FfiConverterAddContactRequest) Read(reader io.Reader) AddContactRequest {
	return AddContactRequest{
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterStringINSTANCE.Read(reader),
	}
}

func (c FfiConverterAddContactRequest) Lower(value AddContactRequest) C.RustBuffer {
	return LowerIntoRustBuffer[AddContactRequest](c, value)
}

func (c FfiConverterAddContactRequest) LowerExternal(value AddContactRequest) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[AddContactRequest](c, value))
}

func (c FfiConverterAddContactRequest) Write(writer io.Writer, value AddContactRequest) {
	FfiConverterStringINSTANCE.Write(writer, value.Name)
	FfiConverterStringINSTANCE.Write(writer, value.PaymentIdentifier)
}

type FfiDestroyerAddContactRequest struct{}

func (_ FfiDestroyerAddContactRequest) Destroy(value AddContactRequest) {
	value.Destroy()
}

// Payload of the AES success action, as received from the LNURL endpoint
//
// See [`AesSuccessActionDataDecrypted`] for a similar wrapper containing the decrypted payload
type AesSuccessActionData struct {
	// Contents description, up to 144 characters
	Description string
	// Base64, AES-encrypted data where encryption key is payment preimage, up to 4kb of characters
	Ciphertext string
	// Base64, initialization vector, exactly 24 characters
	Iv string
}

func (r *AesSuccessActionData) Destroy() {
	FfiDestroyerString{}.Destroy(r.Description)
	FfiDestroyerString{}.Destroy(r.Ciphertext)
	FfiDestroyerString{}.Destroy(r.Iv)
}

type FfiConverterAesSuccessActionData struct{}

var FfiConverterAesSuccessActionDataINSTANCE = FfiConverterAesSuccessActionData{}

func (c FfiConverterAesSuccessActionData) Lift(rb RustBufferI) AesSuccessActionData {
	return LiftFromRustBuffer[AesSuccessActionData](c, rb)
}

func (c FfiConverterAesSuccessActionData) Read(reader io.Reader) AesSuccessActionData {
	return AesSuccessActionData{
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterStringINSTANCE.Read(reader),
	}
}

func (c FfiConverterAesSuccessActionData) Lower(value AesSuccessActionData) C.RustBuffer {
	return LowerIntoRustBuffer[AesSuccessActionData](c, value)
}

func (c FfiConverterAesSuccessActionData) LowerExternal(value AesSuccessActionData) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[AesSuccessActionData](c, value))
}

func (c FfiConverterAesSuccessActionData) Write(writer io.Writer, value AesSuccessActionData) {
	FfiConverterStringINSTANCE.Write(writer, value.Description)
	FfiConverterStringINSTANCE.Write(writer, value.Ciphertext)
	FfiConverterStringINSTANCE.Write(writer, value.Iv)
}

type FfiDestroyerAesSuccessActionData struct{}

func (_ FfiDestroyerAesSuccessActionData) Destroy(value AesSuccessActionData) {
	value.Destroy()
}

// Wrapper for the decrypted [`AesSuccessActionData`] payload
type AesSuccessActionDataDecrypted struct {
	// Contents description, up to 144 characters
	Description string
	// Decrypted content
	Plaintext string
}

func (r *AesSuccessActionDataDecrypted) Destroy() {
	FfiDestroyerString{}.Destroy(r.Description)
	FfiDestroyerString{}.Destroy(r.Plaintext)
}

type FfiConverterAesSuccessActionDataDecrypted struct{}

var FfiConverterAesSuccessActionDataDecryptedINSTANCE = FfiConverterAesSuccessActionDataDecrypted{}

func (c FfiConverterAesSuccessActionDataDecrypted) Lift(rb RustBufferI) AesSuccessActionDataDecrypted {
	return LiftFromRustBuffer[AesSuccessActionDataDecrypted](c, rb)
}

func (c FfiConverterAesSuccessActionDataDecrypted) Read(reader io.Reader) AesSuccessActionDataDecrypted {
	return AesSuccessActionDataDecrypted{
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterStringINSTANCE.Read(reader),
	}
}

func (c FfiConverterAesSuccessActionDataDecrypted) Lower(value AesSuccessActionDataDecrypted) C.RustBuffer {
	return LowerIntoRustBuffer[AesSuccessActionDataDecrypted](c, value)
}

func (c FfiConverterAesSuccessActionDataDecrypted) LowerExternal(value AesSuccessActionDataDecrypted) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[AesSuccessActionDataDecrypted](c, value))
}

func (c FfiConverterAesSuccessActionDataDecrypted) Write(writer io.Writer, value AesSuccessActionDataDecrypted) {
	FfiConverterStringINSTANCE.Write(writer, value.Description)
	FfiConverterStringINSTANCE.Write(writer, value.Plaintext)
}

type FfiDestroyerAesSuccessActionDataDecrypted struct{}

func (_ FfiDestroyerAesSuccessActionDataDecrypted) Destroy(value AesSuccessActionDataDecrypted) {
	value.Destroy()
}

type Bip21Details struct {
	AmountSat      *uint64
	AssetId        *string
	Uri            string
	Extras         []Bip21Extra
	Label          *string
	Message        *string
	PaymentMethods []InputType
}

func (r *Bip21Details) Destroy() {
	FfiDestroyerOptionalUint64{}.Destroy(r.AmountSat)
	FfiDestroyerOptionalString{}.Destroy(r.AssetId)
	FfiDestroyerString{}.Destroy(r.Uri)
	FfiDestroyerSequenceBip21Extra{}.Destroy(r.Extras)
	FfiDestroyerOptionalString{}.Destroy(r.Label)
	FfiDestroyerOptionalString{}.Destroy(r.Message)
	FfiDestroyerSequenceInputType{}.Destroy(r.PaymentMethods)
}

type FfiConverterBip21Details struct{}

var FfiConverterBip21DetailsINSTANCE = FfiConverterBip21Details{}

func (c FfiConverterBip21Details) Lift(rb RustBufferI) Bip21Details {
	return LiftFromRustBuffer[Bip21Details](c, rb)
}

func (c FfiConverterBip21Details) Read(reader io.Reader) Bip21Details {
	return Bip21Details{
		FfiConverterOptionalUint64INSTANCE.Read(reader),
		FfiConverterOptionalStringINSTANCE.Read(reader),
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterSequenceBip21ExtraINSTANCE.Read(reader),
		FfiConverterOptionalStringINSTANCE.Read(reader),
		FfiConverterOptionalStringINSTANCE.Read(reader),
		FfiConverterSequenceInputTypeINSTANCE.Read(reader),
	}
}

func (c FfiConverterBip21Details) Lower(value Bip21Details) C.RustBuffer {
	return LowerIntoRustBuffer[Bip21Details](c, value)
}

func (c FfiConverterBip21Details) LowerExternal(value Bip21Details) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[Bip21Details](c, value))
}

func (c FfiConverterBip21Details) Write(writer io.Writer, value Bip21Details) {
	FfiConverterOptionalUint64INSTANCE.Write(writer, value.AmountSat)
	FfiConverterOptionalStringINSTANCE.Write(writer, value.AssetId)
	FfiConverterStringINSTANCE.Write(writer, value.Uri)
	FfiConverterSequenceBip21ExtraINSTANCE.Write(writer, value.Extras)
	FfiConverterOptionalStringINSTANCE.Write(writer, value.Label)
	FfiConverterOptionalStringINSTANCE.Write(writer, value.Message)
	FfiConverterSequenceInputTypeINSTANCE.Write(writer, value.PaymentMethods)
}

type FfiDestroyerBip21Details struct{}

func (_ FfiDestroyerBip21Details) Destroy(value Bip21Details) {
	value.Destroy()
}

type Bip21Extra struct {
	Key   string
	Value string
}

func (r *Bip21Extra) Destroy() {
	FfiDestroyerString{}.Destroy(r.Key)
	FfiDestroyerString{}.Destroy(r.Value)
}

type FfiConverterBip21Extra struct{}

var FfiConverterBip21ExtraINSTANCE = FfiConverterBip21Extra{}

func (c FfiConverterBip21Extra) Lift(rb RustBufferI) Bip21Extra {
	return LiftFromRustBuffer[Bip21Extra](c, rb)
}

func (c FfiConverterBip21Extra) Read(reader io.Reader) Bip21Extra {
	return Bip21Extra{
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterStringINSTANCE.Read(reader),
	}
}

func (c FfiConverterBip21Extra) Lower(value Bip21Extra) C.RustBuffer {
	return LowerIntoRustBuffer[Bip21Extra](c, value)
}

func (c FfiConverterBip21Extra) LowerExternal(value Bip21Extra) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[Bip21Extra](c, value))
}

func (c FfiConverterBip21Extra) Write(writer io.Writer, value Bip21Extra) {
	FfiConverterStringINSTANCE.Write(writer, value.Key)
	FfiConverterStringINSTANCE.Write(writer, value.Value)
}

type FfiDestroyerBip21Extra struct{}

func (_ FfiDestroyerBip21Extra) Destroy(value Bip21Extra) {
	value.Destroy()
}

type BitcoinAddressDetails struct {
	Address string
	Network BitcoinNetwork
	Source  PaymentRequestSource
}

func (r *BitcoinAddressDetails) Destroy() {
	FfiDestroyerString{}.Destroy(r.Address)
	FfiDestroyerBitcoinNetwork{}.Destroy(r.Network)
	FfiDestroyerPaymentRequestSource{}.Destroy(r.Source)
}

type FfiConverterBitcoinAddressDetails struct{}

var FfiConverterBitcoinAddressDetailsINSTANCE = FfiConverterBitcoinAddressDetails{}

func (c FfiConverterBitcoinAddressDetails) Lift(rb RustBufferI) BitcoinAddressDetails {
	return LiftFromRustBuffer[BitcoinAddressDetails](c, rb)
}

func (c FfiConverterBitcoinAddressDetails) Read(reader io.Reader) BitcoinAddressDetails {
	return BitcoinAddressDetails{
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterBitcoinNetworkINSTANCE.Read(reader),
		FfiConverterPaymentRequestSourceINSTANCE.Read(reader),
	}
}

func (c FfiConverterBitcoinAddressDetails) Lower(value BitcoinAddressDetails) C.RustBuffer {
	return LowerIntoRustBuffer[BitcoinAddressDetails](c, value)
}

func (c FfiConverterBitcoinAddressDetails) LowerExternal(value BitcoinAddressDetails) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[BitcoinAddressDetails](c, value))
}

func (c FfiConverterBitcoinAddressDetails) Write(writer io.Writer, value BitcoinAddressDetails) {
	FfiConverterStringINSTANCE.Write(writer, value.Address)
	FfiConverterBitcoinNetworkINSTANCE.Write(writer, value.Network)
	FfiConverterPaymentRequestSourceINSTANCE.Write(writer, value.Source)
}

type FfiDestroyerBitcoinAddressDetails struct{}

func (_ FfiDestroyerBitcoinAddressDetails) Destroy(value BitcoinAddressDetails) {
	value.Destroy()
}

type Bolt11Invoice struct {
	Bolt11 string
	Source PaymentRequestSource
}

func (r *Bolt11Invoice) Destroy() {
	FfiDestroyerString{}.Destroy(r.Bolt11)
	FfiDestroyerPaymentRequestSource{}.Destroy(r.Source)
}

type FfiConverterBolt11Invoice struct{}

var FfiConverterBolt11InvoiceINSTANCE = FfiConverterBolt11Invoice{}

func (c FfiConverterBolt11Invoice) Lift(rb RustBufferI) Bolt11Invoice {
	return LiftFromRustBuffer[Bolt11Invoice](c, rb)
}

func (c FfiConverterBolt11Invoice) Read(reader io.Reader) Bolt11Invoice {
	return Bolt11Invoice{
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterPaymentRequestSourceINSTANCE.Read(reader),
	}
}

func (c FfiConverterBolt11Invoice) Lower(value Bolt11Invoice) C.RustBuffer {
	return LowerIntoRustBuffer[Bolt11Invoice](c, value)
}

func (c FfiConverterBolt11Invoice) LowerExternal(value Bolt11Invoice) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[Bolt11Invoice](c, value))
}

func (c FfiConverterBolt11Invoice) Write(writer io.Writer, value Bolt11Invoice) {
	FfiConverterStringINSTANCE.Write(writer, value.Bolt11)
	FfiConverterPaymentRequestSourceINSTANCE.Write(writer, value.Source)
}

type FfiDestroyerBolt11Invoice struct{}

func (_ FfiDestroyerBolt11Invoice) Destroy(value Bolt11Invoice) {
	value.Destroy()
}

type Bolt11InvoiceDetails struct {
	AmountMsat              *uint64
	Description             *string
	DescriptionHash         *string
	Expiry                  uint64
	Invoice                 Bolt11Invoice
	MinFinalCltvExpiryDelta uint64
	Network                 BitcoinNetwork
	PayeePubkey             string
	PaymentHash             string
	PaymentSecret           string
	RoutingHints            []Bolt11RouteHint
	Timestamp               uint64
}

func (r *Bolt11InvoiceDetails) Destroy() {
	FfiDestroyerOptionalUint64{}.Destroy(r.AmountMsat)
	FfiDestroyerOptionalString{}.Destroy(r.Description)
	FfiDestroyerOptionalString{}.Destroy(r.DescriptionHash)
	FfiDestroyerUint64{}.Destroy(r.Expiry)
	FfiDestroyerBolt11Invoice{}.Destroy(r.Invoice)
	FfiDestroyerUint64{}.Destroy(r.MinFinalCltvExpiryDelta)
	FfiDestroyerBitcoinNetwork{}.Destroy(r.Network)
	FfiDestroyerString{}.Destroy(r.PayeePubkey)
	FfiDestroyerString{}.Destroy(r.PaymentHash)
	FfiDestroyerString{}.Destroy(r.PaymentSecret)
	FfiDestroyerSequenceBolt11RouteHint{}.Destroy(r.RoutingHints)
	FfiDestroyerUint64{}.Destroy(r.Timestamp)
}

type FfiConverterBolt11InvoiceDetails struct{}

var FfiConverterBolt11InvoiceDetailsINSTANCE = FfiConverterBolt11InvoiceDetails{}

func (c FfiConverterBolt11InvoiceDetails) Lift(rb RustBufferI) Bolt11InvoiceDetails {
	return LiftFromRustBuffer[Bolt11InvoiceDetails](c, rb)
}

func (c FfiConverterBolt11InvoiceDetails) Read(reader io.Reader) Bolt11InvoiceDetails {
	return Bolt11InvoiceDetails{
		FfiConverterOptionalUint64INSTANCE.Read(reader),
		FfiConverterOptionalStringINSTANCE.Read(reader),
		FfiConverterOptionalStringINSTANCE.Read(reader),
		FfiConverterUint64INSTANCE.Read(reader),
		FfiConverterBolt11InvoiceINSTANCE.Read(reader),
		FfiConverterUint64INSTANCE.Read(reader),
		FfiConverterBitcoinNetworkINSTANCE.Read(reader),
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterSequenceBolt11RouteHintINSTANCE.Read(reader),
		FfiConverterUint64INSTANCE.Read(reader),
	}
}

func (c FfiConverterBolt11InvoiceDetails) Lower(value Bolt11InvoiceDetails) C.RustBuffer {
	return LowerIntoRustBuffer[Bolt11InvoiceDetails](c, value)
}

func (c FfiConverterBolt11InvoiceDetails) LowerExternal(value Bolt11InvoiceDetails) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[Bolt11InvoiceDetails](c, value))
}

func (c FfiConverterBolt11InvoiceDetails) Write(writer io.Writer, value Bolt11InvoiceDetails) {
	FfiConverterOptionalUint64INSTANCE.Write(writer, value.AmountMsat)
	FfiConverterOptionalStringINSTANCE.Write(writer, value.Description)
	FfiConverterOptionalStringINSTANCE.Write(writer, value.DescriptionHash)
	FfiConverterUint64INSTANCE.Write(writer, value.Expiry)
	FfiConverterBolt11InvoiceINSTANCE.Write(writer, value.Invoice)
	FfiConverterUint64INSTANCE.Write(writer, value.MinFinalCltvExpiryDelta)
	FfiConverterBitcoinNetworkINSTANCE.Write(writer, value.Network)
	FfiConverterStringINSTANCE.Write(writer, value.PayeePubkey)
	FfiConverterStringINSTANCE.Write(writer, value.PaymentHash)
	FfiConverterStringINSTANCE.Write(writer, value.PaymentSecret)
	FfiConverterSequenceBolt11RouteHintINSTANCE.Write(writer, value.RoutingHints)
	FfiConverterUint64INSTANCE.Write(writer, value.Timestamp)
}

type FfiDestroyerBolt11InvoiceDetails struct{}

func (_ FfiDestroyerBolt11InvoiceDetails) Destroy(value Bolt11InvoiceDetails) {
	value.Destroy()
}

type Bolt11RouteHint struct {
	Hops []Bolt11RouteHintHop
}

func (r *Bolt11RouteHint) Destroy() {
	FfiDestroyerSequenceBolt11RouteHintHop{}.Destroy(r.Hops)
}

type FfiConverterBolt11RouteHint struct{}

var FfiConverterBolt11RouteHintINSTANCE = FfiConverterBolt11RouteHint{}

func (c FfiConverterBolt11RouteHint) Lift(rb RustBufferI) Bolt11RouteHint {
	return LiftFromRustBuffer[Bolt11RouteHint](c, rb)
}

func (c FfiConverterBolt11RouteHint) Read(reader io.Reader) Bolt11RouteHint {
	return Bolt11RouteHint{
		FfiConverterSequenceBolt11RouteHintHopINSTANCE.Read(reader),
	}
}

func (c FfiConverterBolt11RouteHint) Lower(value Bolt11RouteHint) C.RustBuffer {
	return LowerIntoRustBuffer[Bolt11RouteHint](c, value)
}

func (c FfiConverterBolt11RouteHint) LowerExternal(value Bolt11RouteHint) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[Bolt11RouteHint](c, value))
}

func (c FfiConverterBolt11RouteHint) Write(writer io.Writer, value Bolt11RouteHint) {
	FfiConverterSequenceBolt11RouteHintHopINSTANCE.Write(writer, value.Hops)
}

type FfiDestroyerBolt11RouteHint struct{}

func (_ FfiDestroyerBolt11RouteHint) Destroy(value Bolt11RouteHint) {
	value.Destroy()
}

type Bolt11RouteHintHop struct {
	// The `node_id` of the non-target end of the route
	SrcNodeId string
	// The `short_channel_id` of this channel
	ShortChannelId string
	// The fees which must be paid to use this channel
	FeesBaseMsat               uint32
	FeesProportionalMillionths uint32
	// The difference in CLTV values between this node and the next node.
	CltvExpiryDelta uint16
	// The minimum value, in msat, which must be relayed to the next hop.
	HtlcMinimumMsat *uint64
	// The maximum value in msat available for routing with a single HTLC.
	HtlcMaximumMsat *uint64
}

func (r *Bolt11RouteHintHop) Destroy() {
	FfiDestroyerString{}.Destroy(r.SrcNodeId)
	FfiDestroyerString{}.Destroy(r.ShortChannelId)
	FfiDestroyerUint32{}.Destroy(r.FeesBaseMsat)
	FfiDestroyerUint32{}.Destroy(r.FeesProportionalMillionths)
	FfiDestroyerUint16{}.Destroy(r.CltvExpiryDelta)
	FfiDestroyerOptionalUint64{}.Destroy(r.HtlcMinimumMsat)
	FfiDestroyerOptionalUint64{}.Destroy(r.HtlcMaximumMsat)
}

type FfiConverterBolt11RouteHintHop struct{}

var FfiConverterBolt11RouteHintHopINSTANCE = FfiConverterBolt11RouteHintHop{}

func (c FfiConverterBolt11RouteHintHop) Lift(rb RustBufferI) Bolt11RouteHintHop {
	return LiftFromRustBuffer[Bolt11RouteHintHop](c, rb)
}

func (c FfiConverterBolt11RouteHintHop) Read(reader io.Reader) Bolt11RouteHintHop {
	return Bolt11RouteHintHop{
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterUint32INSTANCE.Read(reader),
		FfiConverterUint32INSTANCE.Read(reader),
		FfiConverterUint16INSTANCE.Read(reader),
		FfiConverterOptionalUint64INSTANCE.Read(reader),
		FfiConverterOptionalUint64INSTANCE.Read(reader),
	}
}

func (c FfiConverterBolt11RouteHintHop) Lower(value Bolt11RouteHintHop) C.RustBuffer {
	return LowerIntoRustBuffer[Bolt11RouteHintHop](c, value)
}

func (c FfiConverterBolt11RouteHintHop) LowerExternal(value Bolt11RouteHintHop) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[Bolt11RouteHintHop](c, value))
}

func (c FfiConverterBolt11RouteHintHop) Write(writer io.Writer, value Bolt11RouteHintHop) {
	FfiConverterStringINSTANCE.Write(writer, value.SrcNodeId)
	FfiConverterStringINSTANCE.Write(writer, value.ShortChannelId)
	FfiConverterUint32INSTANCE.Write(writer, value.FeesBaseMsat)
	FfiConverterUint32INSTANCE.Write(writer, value.FeesProportionalMillionths)
	FfiConverterUint16INSTANCE.Write(writer, value.CltvExpiryDelta)
	FfiConverterOptionalUint64INSTANCE.Write(writer, value.HtlcMinimumMsat)
	FfiConverterOptionalUint64INSTANCE.Write(writer, value.HtlcMaximumMsat)
}

type FfiDestroyerBolt11RouteHintHop struct{}

func (_ FfiDestroyerBolt11RouteHintHop) Destroy(value Bolt11RouteHintHop) {
	value.Destroy()
}

type Bolt12Invoice struct {
	Invoice string
	Source  PaymentRequestSource
}

func (r *Bolt12Invoice) Destroy() {
	FfiDestroyerString{}.Destroy(r.Invoice)
	FfiDestroyerPaymentRequestSource{}.Destroy(r.Source)
}

type FfiConverterBolt12Invoice struct{}

var FfiConverterBolt12InvoiceINSTANCE = FfiConverterBolt12Invoice{}

func (c FfiConverterBolt12Invoice) Lift(rb RustBufferI) Bolt12Invoice {
	return LiftFromRustBuffer[Bolt12Invoice](c, rb)
}

func (c FfiConverterBolt12Invoice) Read(reader io.Reader) Bolt12Invoice {
	return Bolt12Invoice{
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterPaymentRequestSourceINSTANCE.Read(reader),
	}
}

func (c FfiConverterBolt12Invoice) Lower(value Bolt12Invoice) C.RustBuffer {
	return LowerIntoRustBuffer[Bolt12Invoice](c, value)
}

func (c FfiConverterBolt12Invoice) LowerExternal(value Bolt12Invoice) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[Bolt12Invoice](c, value))
}

func (c FfiConverterBolt12Invoice) Write(writer io.Writer, value Bolt12Invoice) {
	FfiConverterStringINSTANCE.Write(writer, value.Invoice)
	FfiConverterPaymentRequestSourceINSTANCE.Write(writer, value.Source)
}

type FfiDestroyerBolt12Invoice struct{}

func (_ FfiDestroyerBolt12Invoice) Destroy(value Bolt12Invoice) {
	value.Destroy()
}

type Bolt12InvoiceDetails struct {
	AmountMsat uint64
	Invoice    Bolt12Invoice
}

func (r *Bolt12InvoiceDetails) Destroy() {
	FfiDestroyerUint64{}.Destroy(r.AmountMsat)
	FfiDestroyerBolt12Invoice{}.Destroy(r.Invoice)
}

type FfiConverterBolt12InvoiceDetails struct{}

var FfiConverterBolt12InvoiceDetailsINSTANCE = FfiConverterBolt12InvoiceDetails{}

func (c FfiConverterBolt12InvoiceDetails) Lift(rb RustBufferI) Bolt12InvoiceDetails {
	return LiftFromRustBuffer[Bolt12InvoiceDetails](c, rb)
}

func (c FfiConverterBolt12InvoiceDetails) Read(reader io.Reader) Bolt12InvoiceDetails {
	return Bolt12InvoiceDetails{
		FfiConverterUint64INSTANCE.Read(reader),
		FfiConverterBolt12InvoiceINSTANCE.Read(reader),
	}
}

func (c FfiConverterBolt12InvoiceDetails) Lower(value Bolt12InvoiceDetails) C.RustBuffer {
	return LowerIntoRustBuffer[Bolt12InvoiceDetails](c, value)
}

func (c FfiConverterBolt12InvoiceDetails) LowerExternal(value Bolt12InvoiceDetails) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[Bolt12InvoiceDetails](c, value))
}

func (c FfiConverterBolt12InvoiceDetails) Write(writer io.Writer, value Bolt12InvoiceDetails) {
	FfiConverterUint64INSTANCE.Write(writer, value.AmountMsat)
	FfiConverterBolt12InvoiceINSTANCE.Write(writer, value.Invoice)
}

type FfiDestroyerBolt12InvoiceDetails struct{}

func (_ FfiDestroyerBolt12InvoiceDetails) Destroy(value Bolt12InvoiceDetails) {
	value.Destroy()
}

type Bolt12InvoiceRequestDetails struct {
}

func (r *Bolt12InvoiceRequestDetails) Destroy() {
}

type FfiConverterBolt12InvoiceRequestDetails struct{}

var FfiConverterBolt12InvoiceRequestDetailsINSTANCE = FfiConverterBolt12InvoiceRequestDetails{}

func (c FfiConverterBolt12InvoiceRequestDetails) Lift(rb RustBufferI) Bolt12InvoiceRequestDetails {
	return LiftFromRustBuffer[Bolt12InvoiceRequestDetails](c, rb)
}

func (c FfiConverterBolt12InvoiceRequestDetails) Read(reader io.Reader) Bolt12InvoiceRequestDetails {
	return Bolt12InvoiceRequestDetails{}
}

func (c FfiConverterBolt12InvoiceRequestDetails) Lower(value Bolt12InvoiceRequestDetails) C.RustBuffer {
	return LowerIntoRustBuffer[Bolt12InvoiceRequestDetails](c, value)
}

func (c FfiConverterBolt12InvoiceRequestDetails) LowerExternal(value Bolt12InvoiceRequestDetails) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[Bolt12InvoiceRequestDetails](c, value))
}

func (c FfiConverterBolt12InvoiceRequestDetails) Write(writer io.Writer, value Bolt12InvoiceRequestDetails) {
}

type FfiDestroyerBolt12InvoiceRequestDetails struct{}

func (_ FfiDestroyerBolt12InvoiceRequestDetails) Destroy(value Bolt12InvoiceRequestDetails) {
	value.Destroy()
}

type Bolt12Offer struct {
	Offer  string
	Source PaymentRequestSource
}

func (r *Bolt12Offer) Destroy() {
	FfiDestroyerString{}.Destroy(r.Offer)
	FfiDestroyerPaymentRequestSource{}.Destroy(r.Source)
}

type FfiConverterBolt12Offer struct{}

var FfiConverterBolt12OfferINSTANCE = FfiConverterBolt12Offer{}

func (c FfiConverterBolt12Offer) Lift(rb RustBufferI) Bolt12Offer {
	return LiftFromRustBuffer[Bolt12Offer](c, rb)
}

func (c FfiConverterBolt12Offer) Read(reader io.Reader) Bolt12Offer {
	return Bolt12Offer{
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterPaymentRequestSourceINSTANCE.Read(reader),
	}
}

func (c FfiConverterBolt12Offer) Lower(value Bolt12Offer) C.RustBuffer {
	return LowerIntoRustBuffer[Bolt12Offer](c, value)
}

func (c FfiConverterBolt12Offer) LowerExternal(value Bolt12Offer) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[Bolt12Offer](c, value))
}

func (c FfiConverterBolt12Offer) Write(writer io.Writer, value Bolt12Offer) {
	FfiConverterStringINSTANCE.Write(writer, value.Offer)
	FfiConverterPaymentRequestSourceINSTANCE.Write(writer, value.Source)
}

type FfiDestroyerBolt12Offer struct{}

func (_ FfiDestroyerBolt12Offer) Destroy(value Bolt12Offer) {
	value.Destroy()
}

type Bolt12OfferBlindedPath struct {
	BlindedHops []string
}

func (r *Bolt12OfferBlindedPath) Destroy() {
	FfiDestroyerSequenceString{}.Destroy(r.BlindedHops)
}

type FfiConverterBolt12OfferBlindedPath struct{}

var FfiConverterBolt12OfferBlindedPathINSTANCE = FfiConverterBolt12OfferBlindedPath{}

func (c FfiConverterBolt12OfferBlindedPath) Lift(rb RustBufferI) Bolt12OfferBlindedPath {
	return LiftFromRustBuffer[Bolt12OfferBlindedPath](c, rb)
}

func (c FfiConverterBolt12OfferBlindedPath) Read(reader io.Reader) Bolt12OfferBlindedPath {
	return Bolt12OfferBlindedPath{
		FfiConverterSequenceStringINSTANCE.Read(reader),
	}
}

func (c FfiConverterBolt12OfferBlindedPath) Lower(value Bolt12OfferBlindedPath) C.RustBuffer {
	return LowerIntoRustBuffer[Bolt12OfferBlindedPath](c, value)
}

func (c FfiConverterBolt12OfferBlindedPath) LowerExternal(value Bolt12OfferBlindedPath) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[Bolt12OfferBlindedPath](c, value))
}

func (c FfiConverterBolt12OfferBlindedPath) Write(writer io.Writer, value Bolt12OfferBlindedPath) {
	FfiConverterSequenceStringINSTANCE.Write(writer, value.BlindedHops)
}

type FfiDestroyerBolt12OfferBlindedPath struct{}

func (_ FfiDestroyerBolt12OfferBlindedPath) Destroy(value Bolt12OfferBlindedPath) {
	value.Destroy()
}

type Bolt12OfferDetails struct {
	AbsoluteExpiry *uint64
	Chains         []string
	Description    *string
	Issuer         *string
	MinAmount      *Amount
	Offer          Bolt12Offer
	Paths          []Bolt12OfferBlindedPath
	SigningPubkey  *string
}

func (r *Bolt12OfferDetails) Destroy() {
	FfiDestroyerOptionalUint64{}.Destroy(r.AbsoluteExpiry)
	FfiDestroyerSequenceString{}.Destroy(r.Chains)
	FfiDestroyerOptionalString{}.Destroy(r.Description)
	FfiDestroyerOptionalString{}.Destroy(r.Issuer)
	FfiDestroyerOptionalAmount{}.Destroy(r.MinAmount)
	FfiDestroyerBolt12Offer{}.Destroy(r.Offer)
	FfiDestroyerSequenceBolt12OfferBlindedPath{}.Destroy(r.Paths)
	FfiDestroyerOptionalString{}.Destroy(r.SigningPubkey)
}

type FfiConverterBolt12OfferDetails struct{}

var FfiConverterBolt12OfferDetailsINSTANCE = FfiConverterBolt12OfferDetails{}

func (c FfiConverterBolt12OfferDetails) Lift(rb RustBufferI) Bolt12OfferDetails {
	return LiftFromRustBuffer[Bolt12OfferDetails](c, rb)
}

func (c FfiConverterBolt12OfferDetails) Read(reader io.Reader) Bolt12OfferDetails {
	return Bolt12OfferDetails{
		FfiConverterOptionalUint64INSTANCE.Read(reader),
		FfiConverterSequenceStringINSTANCE.Read(reader),
		FfiConverterOptionalStringINSTANCE.Read(reader),
		FfiConverterOptionalStringINSTANCE.Read(reader),
		FfiConverterOptionalAmountINSTANCE.Read(reader),
		FfiConverterBolt12OfferINSTANCE.Read(reader),
		FfiConverterSequenceBolt12OfferBlindedPathINSTANCE.Read(reader),
		FfiConverterOptionalStringINSTANCE.Read(reader),
	}
}

func (c FfiConverterBolt12OfferDetails) Lower(value Bolt12OfferDetails) C.RustBuffer {
	return LowerIntoRustBuffer[Bolt12OfferDetails](c, value)
}

func (c FfiConverterBolt12OfferDetails) LowerExternal(value Bolt12OfferDetails) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[Bolt12OfferDetails](c, value))
}

func (c FfiConverterBolt12OfferDetails) Write(writer io.Writer, value Bolt12OfferDetails) {
	FfiConverterOptionalUint64INSTANCE.Write(writer, value.AbsoluteExpiry)
	FfiConverterSequenceStringINSTANCE.Write(writer, value.Chains)
	FfiConverterOptionalStringINSTANCE.Write(writer, value.Description)
	FfiConverterOptionalStringINSTANCE.Write(writer, value.Issuer)
	FfiConverterOptionalAmountINSTANCE.Write(writer, value.MinAmount)
	FfiConverterBolt12OfferINSTANCE.Write(writer, value.Offer)
	FfiConverterSequenceBolt12OfferBlindedPathINSTANCE.Write(writer, value.Paths)
	FfiConverterOptionalStringINSTANCE.Write(writer, value.SigningPubkey)
}

type FfiDestroyerBolt12OfferDetails struct{}

func (_ FfiDestroyerBolt12OfferDetails) Destroy(value Bolt12OfferDetails) {
	value.Destroy()
}

type BurnIssuerTokenRequest struct {
	Amount u128
}

func (r *BurnIssuerTokenRequest) Destroy() {
	FfiDestroyerTypeu128{}.Destroy(r.Amount)
}

type FfiConverterBurnIssuerTokenRequest struct{}

var FfiConverterBurnIssuerTokenRequestINSTANCE = FfiConverterBurnIssuerTokenRequest{}

func (c FfiConverterBurnIssuerTokenRequest) Lift(rb RustBufferI) BurnIssuerTokenRequest {
	return LiftFromRustBuffer[BurnIssuerTokenRequest](c, rb)
}

func (c FfiConverterBurnIssuerTokenRequest) Read(reader io.Reader) BurnIssuerTokenRequest {
	return BurnIssuerTokenRequest{
		FfiConverterTypeu128INSTANCE.Read(reader),
	}
}

func (c FfiConverterBurnIssuerTokenRequest) Lower(value BurnIssuerTokenRequest) C.RustBuffer {
	return LowerIntoRustBuffer[BurnIssuerTokenRequest](c, value)
}

func (c FfiConverterBurnIssuerTokenRequest) LowerExternal(value BurnIssuerTokenRequest) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[BurnIssuerTokenRequest](c, value))
}

func (c FfiConverterBurnIssuerTokenRequest) Write(writer io.Writer, value BurnIssuerTokenRequest) {
	FfiConverterTypeu128INSTANCE.Write(writer, value.Amount)
}

type FfiDestroyerBurnIssuerTokenRequest struct{}

func (_ FfiDestroyerBurnIssuerTokenRequest) Destroy(value BurnIssuerTokenRequest) {
	value.Destroy()
}

// Response containing a URL to complete the Bitcoin purchase
type BuyBitcoinResponse struct {
	// The URL to open in a browser to complete the purchase
	Url string
}

func (r *BuyBitcoinResponse) Destroy() {
	FfiDestroyerString{}.Destroy(r.Url)
}

type FfiConverterBuyBitcoinResponse struct{}

var FfiConverterBuyBitcoinResponseINSTANCE = FfiConverterBuyBitcoinResponse{}

func (c FfiConverterBuyBitcoinResponse) Lift(rb RustBufferI) BuyBitcoinResponse {
	return LiftFromRustBuffer[BuyBitcoinResponse](c, rb)
}

func (c FfiConverterBuyBitcoinResponse) Read(reader io.Reader) BuyBitcoinResponse {
	return BuyBitcoinResponse{
		FfiConverterStringINSTANCE.Read(reader),
	}
}

func (c FfiConverterBuyBitcoinResponse) Lower(value BuyBitcoinResponse) C.RustBuffer {
	return LowerIntoRustBuffer[BuyBitcoinResponse](c, value)
}

func (c FfiConverterBuyBitcoinResponse) LowerExternal(value BuyBitcoinResponse) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[BuyBitcoinResponse](c, value))
}

func (c FfiConverterBuyBitcoinResponse) Write(writer io.Writer, value BuyBitcoinResponse) {
	FfiConverterStringINSTANCE.Write(writer, value.Url)
}

type FfiDestroyerBuyBitcoinResponse struct{}

func (_ FfiDestroyerBuyBitcoinResponse) Destroy(value BuyBitcoinResponse) {
	value.Destroy()
}

type CheckLightningAddressRequest struct {
	Username string
}

func (r *CheckLightningAddressRequest) Destroy() {
	FfiDestroyerString{}.Destroy(r.Username)
}

type FfiConverterCheckLightningAddressRequest struct{}

var FfiConverterCheckLightningAddressRequestINSTANCE = FfiConverterCheckLightningAddressRequest{}

func (c FfiConverterCheckLightningAddressRequest) Lift(rb RustBufferI) CheckLightningAddressRequest {
	return LiftFromRustBuffer[CheckLightningAddressRequest](c, rb)
}

func (c FfiConverterCheckLightningAddressRequest) Read(reader io.Reader) CheckLightningAddressRequest {
	return CheckLightningAddressRequest{
		FfiConverterStringINSTANCE.Read(reader),
	}
}

func (c FfiConverterCheckLightningAddressRequest) Lower(value CheckLightningAddressRequest) C.RustBuffer {
	return LowerIntoRustBuffer[CheckLightningAddressRequest](c, value)
}

func (c FfiConverterCheckLightningAddressRequest) LowerExternal(value CheckLightningAddressRequest) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[CheckLightningAddressRequest](c, value))
}

func (c FfiConverterCheckLightningAddressRequest) Write(writer io.Writer, value CheckLightningAddressRequest) {
	FfiConverterStringINSTANCE.Write(writer, value.Username)
}

type FfiDestroyerCheckLightningAddressRequest struct{}

func (_ FfiDestroyerCheckLightningAddressRequest) Destroy(value CheckLightningAddressRequest) {
	value.Destroy()
}

type CheckMessageRequest struct {
	// The message that was signed
	Message string
	// The public key that signed the message
	Pubkey string
	// The DER or compact hex encoded signature
	Signature string
}

func (r *CheckMessageRequest) Destroy() {
	FfiDestroyerString{}.Destroy(r.Message)
	FfiDestroyerString{}.Destroy(r.Pubkey)
	FfiDestroyerString{}.Destroy(r.Signature)
}

type FfiConverterCheckMessageRequest struct{}

var FfiConverterCheckMessageRequestINSTANCE = FfiConverterCheckMessageRequest{}

func (c FfiConverterCheckMessageRequest) Lift(rb RustBufferI) CheckMessageRequest {
	return LiftFromRustBuffer[CheckMessageRequest](c, rb)
}

func (c FfiConverterCheckMessageRequest) Read(reader io.Reader) CheckMessageRequest {
	return CheckMessageRequest{
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterStringINSTANCE.Read(reader),
	}
}

func (c FfiConverterCheckMessageRequest) Lower(value CheckMessageRequest) C.RustBuffer {
	return LowerIntoRustBuffer[CheckMessageRequest](c, value)
}

func (c FfiConverterCheckMessageRequest) LowerExternal(value CheckMessageRequest) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[CheckMessageRequest](c, value))
}

func (c FfiConverterCheckMessageRequest) Write(writer io.Writer, value CheckMessageRequest) {
	FfiConverterStringINSTANCE.Write(writer, value.Message)
	FfiConverterStringINSTANCE.Write(writer, value.Pubkey)
	FfiConverterStringINSTANCE.Write(writer, value.Signature)
}

type FfiDestroyerCheckMessageRequest struct{}

func (_ FfiDestroyerCheckMessageRequest) Destroy(value CheckMessageRequest) {
	value.Destroy()
}

type CheckMessageResponse struct {
	IsValid bool
}

func (r *CheckMessageResponse) Destroy() {
	FfiDestroyerBool{}.Destroy(r.IsValid)
}

type FfiConverterCheckMessageResponse struct{}

var FfiConverterCheckMessageResponseINSTANCE = FfiConverterCheckMessageResponse{}

func (c FfiConverterCheckMessageResponse) Lift(rb RustBufferI) CheckMessageResponse {
	return LiftFromRustBuffer[CheckMessageResponse](c, rb)
}

func (c FfiConverterCheckMessageResponse) Read(reader io.Reader) CheckMessageResponse {
	return CheckMessageResponse{
		FfiConverterBoolINSTANCE.Read(reader),
	}
}

func (c FfiConverterCheckMessageResponse) Lower(value CheckMessageResponse) C.RustBuffer {
	return LowerIntoRustBuffer[CheckMessageResponse](c, value)
}

func (c FfiConverterCheckMessageResponse) LowerExternal(value CheckMessageResponse) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[CheckMessageResponse](c, value))
}

func (c FfiConverterCheckMessageResponse) Write(writer io.Writer, value CheckMessageResponse) {
	FfiConverterBoolINSTANCE.Write(writer, value.IsValid)
}

type FfiDestroyerCheckMessageResponse struct{}

func (_ FfiDestroyerCheckMessageResponse) Destroy(value CheckMessageResponse) {
	value.Destroy()
}

type ClaimDepositRequest struct {
	Txid   string
	Vout   uint32
	MaxFee *MaxFee
}

func (r *ClaimDepositRequest) Destroy() {
	FfiDestroyerString{}.Destroy(r.Txid)
	FfiDestroyerUint32{}.Destroy(r.Vout)
	FfiDestroyerOptionalMaxFee{}.Destroy(r.MaxFee)
}

type FfiConverterClaimDepositRequest struct{}

var FfiConverterClaimDepositRequestINSTANCE = FfiConverterClaimDepositRequest{}

func (c FfiConverterClaimDepositRequest) Lift(rb RustBufferI) ClaimDepositRequest {
	return LiftFromRustBuffer[ClaimDepositRequest](c, rb)
}

func (c FfiConverterClaimDepositRequest) Read(reader io.Reader) ClaimDepositRequest {
	return ClaimDepositRequest{
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterUint32INSTANCE.Read(reader),
		FfiConverterOptionalMaxFeeINSTANCE.Read(reader),
	}
}

func (c FfiConverterClaimDepositRequest) Lower(value ClaimDepositRequest) C.RustBuffer {
	return LowerIntoRustBuffer[ClaimDepositRequest](c, value)
}

func (c FfiConverterClaimDepositRequest) LowerExternal(value ClaimDepositRequest) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[ClaimDepositRequest](c, value))
}

func (c FfiConverterClaimDepositRequest) Write(writer io.Writer, value ClaimDepositRequest) {
	FfiConverterStringINSTANCE.Write(writer, value.Txid)
	FfiConverterUint32INSTANCE.Write(writer, value.Vout)
	FfiConverterOptionalMaxFeeINSTANCE.Write(writer, value.MaxFee)
}

type FfiDestroyerClaimDepositRequest struct{}

func (_ FfiDestroyerClaimDepositRequest) Destroy(value ClaimDepositRequest) {
	value.Destroy()
}

type ClaimDepositResponse struct {
	Payment Payment
}

func (r *ClaimDepositResponse) Destroy() {
	FfiDestroyerPayment{}.Destroy(r.Payment)
}

type FfiConverterClaimDepositResponse struct{}

var FfiConverterClaimDepositResponseINSTANCE = FfiConverterClaimDepositResponse{}

func (c FfiConverterClaimDepositResponse) Lift(rb RustBufferI) ClaimDepositResponse {
	return LiftFromRustBuffer[ClaimDepositResponse](c, rb)
}

func (c FfiConverterClaimDepositResponse) Read(reader io.Reader) ClaimDepositResponse {
	return ClaimDepositResponse{
		FfiConverterPaymentINSTANCE.Read(reader),
	}
}

func (c FfiConverterClaimDepositResponse) Lower(value ClaimDepositResponse) C.RustBuffer {
	return LowerIntoRustBuffer[ClaimDepositResponse](c, value)
}

func (c FfiConverterClaimDepositResponse) LowerExternal(value ClaimDepositResponse) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[ClaimDepositResponse](c, value))
}

func (c FfiConverterClaimDepositResponse) Write(writer io.Writer, value ClaimDepositResponse) {
	FfiConverterPaymentINSTANCE.Write(writer, value.Payment)
}

type FfiDestroyerClaimDepositResponse struct{}

func (_ FfiDestroyerClaimDepositResponse) Destroy(value ClaimDepositResponse) {
	value.Destroy()
}

type ClaimHtlcPaymentRequest struct {
	Preimage string
}

func (r *ClaimHtlcPaymentRequest) Destroy() {
	FfiDestroyerString{}.Destroy(r.Preimage)
}

type FfiConverterClaimHtlcPaymentRequest struct{}

var FfiConverterClaimHtlcPaymentRequestINSTANCE = FfiConverterClaimHtlcPaymentRequest{}

func (c FfiConverterClaimHtlcPaymentRequest) Lift(rb RustBufferI) ClaimHtlcPaymentRequest {
	return LiftFromRustBuffer[ClaimHtlcPaymentRequest](c, rb)
}

func (c FfiConverterClaimHtlcPaymentRequest) Read(reader io.Reader) ClaimHtlcPaymentRequest {
	return ClaimHtlcPaymentRequest{
		FfiConverterStringINSTANCE.Read(reader),
	}
}

func (c FfiConverterClaimHtlcPaymentRequest) Lower(value ClaimHtlcPaymentRequest) C.RustBuffer {
	return LowerIntoRustBuffer[ClaimHtlcPaymentRequest](c, value)
}

func (c FfiConverterClaimHtlcPaymentRequest) LowerExternal(value ClaimHtlcPaymentRequest) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[ClaimHtlcPaymentRequest](c, value))
}

func (c FfiConverterClaimHtlcPaymentRequest) Write(writer io.Writer, value ClaimHtlcPaymentRequest) {
	FfiConverterStringINSTANCE.Write(writer, value.Preimage)
}

type FfiDestroyerClaimHtlcPaymentRequest struct{}

func (_ FfiDestroyerClaimHtlcPaymentRequest) Destroy(value ClaimHtlcPaymentRequest) {
	value.Destroy()
}

type ClaimHtlcPaymentResponse struct {
	Payment Payment
}

func (r *ClaimHtlcPaymentResponse) Destroy() {
	FfiDestroyerPayment{}.Destroy(r.Payment)
}

type FfiConverterClaimHtlcPaymentResponse struct{}

var FfiConverterClaimHtlcPaymentResponseINSTANCE = FfiConverterClaimHtlcPaymentResponse{}

func (c FfiConverterClaimHtlcPaymentResponse) Lift(rb RustBufferI) ClaimHtlcPaymentResponse {
	return LiftFromRustBuffer[ClaimHtlcPaymentResponse](c, rb)
}

func (c FfiConverterClaimHtlcPaymentResponse) Read(reader io.Reader) ClaimHtlcPaymentResponse {
	return ClaimHtlcPaymentResponse{
		FfiConverterPaymentINSTANCE.Read(reader),
	}
}

func (c FfiConverterClaimHtlcPaymentResponse) Lower(value ClaimHtlcPaymentResponse) C.RustBuffer {
	return LowerIntoRustBuffer[ClaimHtlcPaymentResponse](c, value)
}

func (c FfiConverterClaimHtlcPaymentResponse) LowerExternal(value ClaimHtlcPaymentResponse) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[ClaimHtlcPaymentResponse](c, value))
}

func (c FfiConverterClaimHtlcPaymentResponse) Write(writer io.Writer, value ClaimHtlcPaymentResponse) {
	FfiConverterPaymentINSTANCE.Write(writer, value.Payment)
}

type FfiDestroyerClaimHtlcPaymentResponse struct{}

func (_ FfiDestroyerClaimHtlcPaymentResponse) Destroy(value ClaimHtlcPaymentResponse) {
	value.Destroy()
}

type Config struct {
	ApiKey             *string
	Network            Network
	SyncIntervalSecs   uint32
	MaxDepositClaimFee *MaxFee
	// The domain used for receiving through lnurl-pay and lightning address.
	LnurlDomain *string
	// When this is set to `true` we will prefer to use spark payments over
	// lightning when sending and receiving. This has the benefit of lower fees
	// but is at the cost of privacy.
	PreferSparkOverLightning bool
	// A set of external input parsers that are used by [`BreezSdk::parse`](crate::sdk::BreezSdk::parse) when the input
	// is not recognized. See [`ExternalInputParser`] for more details on how to configure
	// external parsing.
	ExternalInputParsers *[]ExternalInputParser
	// The SDK includes some default external input parsers
	// ([`DEFAULT_EXTERNAL_INPUT_PARSERS`]).
	// Set this to false in order to prevent their use.
	UseDefaultExternalInputParsers bool
	// Url to use for the real-time sync server. Defaults to the Breez real-time sync server.
	RealTimeSyncServerUrl *string
	// Whether the Spark private mode is enabled by default.
	//
	// If set to true, the Spark private mode will be enabled on the first initialization of the SDK.
	// If set to false, no changes will be made to the Spark private mode.
	PrivateEnabledDefault bool
	// Configuration for leaf optimization.
	//
	// Leaf optimization controls the denominations of leaves that are held in the wallet.
	// Fewer, bigger leaves allow for more funds to be exited unilaterally.
	// More leaves allow payments to be made without needing a swap, reducing payment latency.
	OptimizationConfig OptimizationConfig
	// Configuration for automatic conversion of Bitcoin to stable tokens.
	//
	// When set, received sats will be automatically converted to the specified token
	// once the balance exceeds the threshold.
	StableBalanceConfig *StableBalanceConfig
	// Maximum number of concurrent transfer claims.
	//
	// Default is 4. Increase for server environments with high incoming payment volume.
	MaxConcurrentClaims uint32
	// Optional custom Spark environment configuration.
	//
	// When set, overrides the default Spark operator pool, service provider,
	// threshold, and token settings. Use this to connect to alternative Spark
	// deployments (e.g. dev/staging environments).
	SparkConfig *SparkConfig
}

func (r *Config) Destroy() {
	FfiDestroyerOptionalString{}.Destroy(r.ApiKey)
	FfiDestroyerNetwork{}.Destroy(r.Network)
	FfiDestroyerUint32{}.Destroy(r.SyncIntervalSecs)
	FfiDestroyerOptionalMaxFee{}.Destroy(r.MaxDepositClaimFee)
	FfiDestroyerOptionalString{}.Destroy(r.LnurlDomain)
	FfiDestroyerBool{}.Destroy(r.PreferSparkOverLightning)
	FfiDestroyerOptionalSequenceExternalInputParser{}.Destroy(r.ExternalInputParsers)
	FfiDestroyerBool{}.Destroy(r.UseDefaultExternalInputParsers)
	FfiDestroyerOptionalString{}.Destroy(r.RealTimeSyncServerUrl)
	FfiDestroyerBool{}.Destroy(r.PrivateEnabledDefault)
	FfiDestroyerOptimizationConfig{}.Destroy(r.OptimizationConfig)
	FfiDestroyerOptionalStableBalanceConfig{}.Destroy(r.StableBalanceConfig)
	FfiDestroyerUint32{}.Destroy(r.MaxConcurrentClaims)
	FfiDestroyerOptionalSparkConfig{}.Destroy(r.SparkConfig)
}

type FfiConverterConfig struct{}

var FfiConverterConfigINSTANCE = FfiConverterConfig{}

func (c FfiConverterConfig) Lift(rb RustBufferI) Config {
	return LiftFromRustBuffer[Config](c, rb)
}

func (c FfiConverterConfig) Read(reader io.Reader) Config {
	return Config{
		FfiConverterOptionalStringINSTANCE.Read(reader),
		FfiConverterNetworkINSTANCE.Read(reader),
		FfiConverterUint32INSTANCE.Read(reader),
		FfiConverterOptionalMaxFeeINSTANCE.Read(reader),
		FfiConverterOptionalStringINSTANCE.Read(reader),
		FfiConverterBoolINSTANCE.Read(reader),
		FfiConverterOptionalSequenceExternalInputParserINSTANCE.Read(reader),
		FfiConverterBoolINSTANCE.Read(reader),
		FfiConverterOptionalStringINSTANCE.Read(reader),
		FfiConverterBoolINSTANCE.Read(reader),
		FfiConverterOptimizationConfigINSTANCE.Read(reader),
		FfiConverterOptionalStableBalanceConfigINSTANCE.Read(reader),
		FfiConverterUint32INSTANCE.Read(reader),
		FfiConverterOptionalSparkConfigINSTANCE.Read(reader),
	}
}

func (c FfiConverterConfig) Lower(value Config) C.RustBuffer {
	return LowerIntoRustBuffer[Config](c, value)
}

func (c FfiConverterConfig) LowerExternal(value Config) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[Config](c, value))
}

func (c FfiConverterConfig) Write(writer io.Writer, value Config) {
	FfiConverterOptionalStringINSTANCE.Write(writer, value.ApiKey)
	FfiConverterNetworkINSTANCE.Write(writer, value.Network)
	FfiConverterUint32INSTANCE.Write(writer, value.SyncIntervalSecs)
	FfiConverterOptionalMaxFeeINSTANCE.Write(writer, value.MaxDepositClaimFee)
	FfiConverterOptionalStringINSTANCE.Write(writer, value.LnurlDomain)
	FfiConverterBoolINSTANCE.Write(writer, value.PreferSparkOverLightning)
	FfiConverterOptionalSequenceExternalInputParserINSTANCE.Write(writer, value.ExternalInputParsers)
	FfiConverterBoolINSTANCE.Write(writer, value.UseDefaultExternalInputParsers)
	FfiConverterOptionalStringINSTANCE.Write(writer, value.RealTimeSyncServerUrl)
	FfiConverterBoolINSTANCE.Write(writer, value.PrivateEnabledDefault)
	FfiConverterOptimizationConfigINSTANCE.Write(writer, value.OptimizationConfig)
	FfiConverterOptionalStableBalanceConfigINSTANCE.Write(writer, value.StableBalanceConfig)
	FfiConverterUint32INSTANCE.Write(writer, value.MaxConcurrentClaims)
	FfiConverterOptionalSparkConfigINSTANCE.Write(writer, value.SparkConfig)
}

type FfiDestroyerConfig struct{}

func (_ FfiDestroyerConfig) Destroy(value Config) {
	value.Destroy()
}

type ConnectRequest struct {
	Config     Config
	Seed       Seed
	StorageDir string
}

func (r *ConnectRequest) Destroy() {
	FfiDestroyerConfig{}.Destroy(r.Config)
	FfiDestroyerSeed{}.Destroy(r.Seed)
	FfiDestroyerString{}.Destroy(r.StorageDir)
}

type FfiConverterConnectRequest struct{}

var FfiConverterConnectRequestINSTANCE = FfiConverterConnectRequest{}

func (c FfiConverterConnectRequest) Lift(rb RustBufferI) ConnectRequest {
	return LiftFromRustBuffer[ConnectRequest](c, rb)
}

func (c FfiConverterConnectRequest) Read(reader io.Reader) ConnectRequest {
	return ConnectRequest{
		FfiConverterConfigINSTANCE.Read(reader),
		FfiConverterSeedINSTANCE.Read(reader),
		FfiConverterStringINSTANCE.Read(reader),
	}
}

func (c FfiConverterConnectRequest) Lower(value ConnectRequest) C.RustBuffer {
	return LowerIntoRustBuffer[ConnectRequest](c, value)
}

func (c FfiConverterConnectRequest) LowerExternal(value ConnectRequest) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[ConnectRequest](c, value))
}

func (c FfiConverterConnectRequest) Write(writer io.Writer, value ConnectRequest) {
	FfiConverterConfigINSTANCE.Write(writer, value.Config)
	FfiConverterSeedINSTANCE.Write(writer, value.Seed)
	FfiConverterStringINSTANCE.Write(writer, value.StorageDir)
}

type FfiDestroyerConnectRequest struct{}

func (_ FfiDestroyerConnectRequest) Destroy(value ConnectRequest) {
	value.Destroy()
}

// Request object for connecting to the Spark network using an external signer.
//
// This allows using a custom signer implementation instead of providing a seed directly.
type ConnectWithSignerRequest struct {
	Config     Config
	Signer     ExternalSigner
	StorageDir string
}

func (r *ConnectWithSignerRequest) Destroy() {
	FfiDestroyerConfig{}.Destroy(r.Config)
	FfiDestroyerExternalSigner{}.Destroy(r.Signer)
	FfiDestroyerString{}.Destroy(r.StorageDir)
}

type FfiConverterConnectWithSignerRequest struct{}

var FfiConverterConnectWithSignerRequestINSTANCE = FfiConverterConnectWithSignerRequest{}

func (c FfiConverterConnectWithSignerRequest) Lift(rb RustBufferI) ConnectWithSignerRequest {
	return LiftFromRustBuffer[ConnectWithSignerRequest](c, rb)
}

func (c FfiConverterConnectWithSignerRequest) Read(reader io.Reader) ConnectWithSignerRequest {
	return ConnectWithSignerRequest{
		FfiConverterConfigINSTANCE.Read(reader),
		FfiConverterExternalSignerINSTANCE.Read(reader),
		FfiConverterStringINSTANCE.Read(reader),
	}
}

func (c FfiConverterConnectWithSignerRequest) Lower(value ConnectWithSignerRequest) C.RustBuffer {
	return LowerIntoRustBuffer[ConnectWithSignerRequest](c, value)
}

func (c FfiConverterConnectWithSignerRequest) LowerExternal(value ConnectWithSignerRequest) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[ConnectWithSignerRequest](c, value))
}

func (c FfiConverterConnectWithSignerRequest) Write(writer io.Writer, value ConnectWithSignerRequest) {
	FfiConverterConfigINSTANCE.Write(writer, value.Config)
	FfiConverterExternalSignerINSTANCE.Write(writer, value.Signer)
	FfiConverterStringINSTANCE.Write(writer, value.StorageDir)
}

type FfiDestroyerConnectWithSignerRequest struct{}

func (_ FfiDestroyerConnectWithSignerRequest) Destroy(value ConnectWithSignerRequest) {
	value.Destroy()
}

// A contact entry containing a name and payment identifier.
type Contact struct {
	Id   string
	Name string
	// A Lightning address (user@domain).
	PaymentIdentifier string
	CreatedAt         uint64
	UpdatedAt         uint64
}

func (r *Contact) Destroy() {
	FfiDestroyerString{}.Destroy(r.Id)
	FfiDestroyerString{}.Destroy(r.Name)
	FfiDestroyerString{}.Destroy(r.PaymentIdentifier)
	FfiDestroyerUint64{}.Destroy(r.CreatedAt)
	FfiDestroyerUint64{}.Destroy(r.UpdatedAt)
}

type FfiConverterContact struct{}

var FfiConverterContactINSTANCE = FfiConverterContact{}

func (c FfiConverterContact) Lift(rb RustBufferI) Contact {
	return LiftFromRustBuffer[Contact](c, rb)
}

func (c FfiConverterContact) Read(reader io.Reader) Contact {
	return Contact{
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterUint64INSTANCE.Read(reader),
		FfiConverterUint64INSTANCE.Read(reader),
	}
}

func (c FfiConverterContact) Lower(value Contact) C.RustBuffer {
	return LowerIntoRustBuffer[Contact](c, value)
}

func (c FfiConverterContact) LowerExternal(value Contact) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[Contact](c, value))
}

func (c FfiConverterContact) Write(writer io.Writer, value Contact) {
	FfiConverterStringINSTANCE.Write(writer, value.Id)
	FfiConverterStringINSTANCE.Write(writer, value.Name)
	FfiConverterStringINSTANCE.Write(writer, value.PaymentIdentifier)
	FfiConverterUint64INSTANCE.Write(writer, value.CreatedAt)
	FfiConverterUint64INSTANCE.Write(writer, value.UpdatedAt)
}

type FfiDestroyerContact struct{}

func (_ FfiDestroyerContact) Destroy(value Contact) {
	value.Destroy()
}

// Outlines the steps involved in a conversion.
//
// Built progressively: `status` is available immediately from payment metadata,
// while `from`/`to` steps are enriched later from child payments.
type ConversionDetails struct {
	// Current status of the conversion
	Status ConversionStatus
	// The send step of the conversion (e.g., sats sent to Flashnet)
	From *ConversionStep
	// The receive step of the conversion (e.g., tokens received from Flashnet)
	To *ConversionStep
}

func (r *ConversionDetails) Destroy() {
	FfiDestroyerConversionStatus{}.Destroy(r.Status)
	FfiDestroyerOptionalConversionStep{}.Destroy(r.From)
	FfiDestroyerOptionalConversionStep{}.Destroy(r.To)
}

type FfiConverterConversionDetails struct{}

var FfiConverterConversionDetailsINSTANCE = FfiConverterConversionDetails{}

func (c FfiConverterConversionDetails) Lift(rb RustBufferI) ConversionDetails {
	return LiftFromRustBuffer[ConversionDetails](c, rb)
}

func (c FfiConverterConversionDetails) Read(reader io.Reader) ConversionDetails {
	return ConversionDetails{
		FfiConverterConversionStatusINSTANCE.Read(reader),
		FfiConverterOptionalConversionStepINSTANCE.Read(reader),
		FfiConverterOptionalConversionStepINSTANCE.Read(reader),
	}
}

func (c FfiConverterConversionDetails) Lower(value ConversionDetails) C.RustBuffer {
	return LowerIntoRustBuffer[ConversionDetails](c, value)
}

func (c FfiConverterConversionDetails) LowerExternal(value ConversionDetails) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[ConversionDetails](c, value))
}

func (c FfiConverterConversionDetails) Write(writer io.Writer, value ConversionDetails) {
	FfiConverterConversionStatusINSTANCE.Write(writer, value.Status)
	FfiConverterOptionalConversionStepINSTANCE.Write(writer, value.From)
	FfiConverterOptionalConversionStepINSTANCE.Write(writer, value.To)
}

type FfiDestroyerConversionDetails struct{}

func (_ FfiDestroyerConversionDetails) Destroy(value ConversionDetails) {
	value.Destroy()
}

// Response from estimating a conversion, used when preparing a payment that requires conversion
type ConversionEstimate struct {
	// The conversion options used for the estimate
	Options ConversionOptions
	// The input amount for the conversion.
	// For `FromBitcoin`: the satoshis required to produce the desired token output.
	// For `ToBitcoin`: the token amount being converted.
	AmountIn u128
	// The estimated output amount from the conversion.
	// For `FromBitcoin`: the estimated token amount received.
	// For `ToBitcoin`: the estimated satoshis received.
	AmountOut u128
	// The fee estimated for the conversion.
	// Denominated in satoshis if converting from Bitcoin, otherwise in the token base units.
	Fee u128
	// The reason the conversion amount was adjusted, if applicable.
	AmountAdjustment *AmountAdjustmentReason
}

func (r *ConversionEstimate) Destroy() {
	FfiDestroyerConversionOptions{}.Destroy(r.Options)
	FfiDestroyerTypeu128{}.Destroy(r.AmountIn)
	FfiDestroyerTypeu128{}.Destroy(r.AmountOut)
	FfiDestroyerTypeu128{}.Destroy(r.Fee)
	FfiDestroyerOptionalAmountAdjustmentReason{}.Destroy(r.AmountAdjustment)
}

type FfiConverterConversionEstimate struct{}

var FfiConverterConversionEstimateINSTANCE = FfiConverterConversionEstimate{}

func (c FfiConverterConversionEstimate) Lift(rb RustBufferI) ConversionEstimate {
	return LiftFromRustBuffer[ConversionEstimate](c, rb)
}

func (c FfiConverterConversionEstimate) Read(reader io.Reader) ConversionEstimate {
	return ConversionEstimate{
		FfiConverterConversionOptionsINSTANCE.Read(reader),
		FfiConverterTypeu128INSTANCE.Read(reader),
		FfiConverterTypeu128INSTANCE.Read(reader),
		FfiConverterTypeu128INSTANCE.Read(reader),
		FfiConverterOptionalAmountAdjustmentReasonINSTANCE.Read(reader),
	}
}

func (c FfiConverterConversionEstimate) Lower(value ConversionEstimate) C.RustBuffer {
	return LowerIntoRustBuffer[ConversionEstimate](c, value)
}

func (c FfiConverterConversionEstimate) LowerExternal(value ConversionEstimate) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[ConversionEstimate](c, value))
}

func (c FfiConverterConversionEstimate) Write(writer io.Writer, value ConversionEstimate) {
	FfiConverterConversionOptionsINSTANCE.Write(writer, value.Options)
	FfiConverterTypeu128INSTANCE.Write(writer, value.AmountIn)
	FfiConverterTypeu128INSTANCE.Write(writer, value.AmountOut)
	FfiConverterTypeu128INSTANCE.Write(writer, value.Fee)
	FfiConverterOptionalAmountAdjustmentReasonINSTANCE.Write(writer, value.AmountAdjustment)
}

type FfiDestroyerConversionEstimate struct{}

func (_ FfiDestroyerConversionEstimate) Destroy(value ConversionEstimate) {
	value.Destroy()
}

type ConversionInfo struct {
	// The pool id associated with the conversion
	PoolId string
	// The conversion id shared by both sides of the conversion
	ConversionId string
	// The status of the conversion
	Status ConversionStatus
	// The fee paid for the conversion
	// Denominated in satoshis if converting from Bitcoin, otherwise in the token base units.
	Fee *u128
	// The purpose of the conversion
	Purpose *ConversionPurpose
	// The reason the conversion amount was adjusted, if applicable.
	AmountAdjustment *AmountAdjustmentReason
}

func (r *ConversionInfo) Destroy() {
	FfiDestroyerString{}.Destroy(r.PoolId)
	FfiDestroyerString{}.Destroy(r.ConversionId)
	FfiDestroyerConversionStatus{}.Destroy(r.Status)
	FfiDestroyerOptionalTypeu128{}.Destroy(r.Fee)
	FfiDestroyerOptionalConversionPurpose{}.Destroy(r.Purpose)
	FfiDestroyerOptionalAmountAdjustmentReason{}.Destroy(r.AmountAdjustment)
}

type FfiConverterConversionInfo struct{}

var FfiConverterConversionInfoINSTANCE = FfiConverterConversionInfo{}

func (c FfiConverterConversionInfo) Lift(rb RustBufferI) ConversionInfo {
	return LiftFromRustBuffer[ConversionInfo](c, rb)
}

func (c FfiConverterConversionInfo) Read(reader io.Reader) ConversionInfo {
	return ConversionInfo{
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterConversionStatusINSTANCE.Read(reader),
		FfiConverterOptionalTypeu128INSTANCE.Read(reader),
		FfiConverterOptionalConversionPurposeINSTANCE.Read(reader),
		FfiConverterOptionalAmountAdjustmentReasonINSTANCE.Read(reader),
	}
}

func (c FfiConverterConversionInfo) Lower(value ConversionInfo) C.RustBuffer {
	return LowerIntoRustBuffer[ConversionInfo](c, value)
}

func (c FfiConverterConversionInfo) LowerExternal(value ConversionInfo) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[ConversionInfo](c, value))
}

func (c FfiConverterConversionInfo) Write(writer io.Writer, value ConversionInfo) {
	FfiConverterStringINSTANCE.Write(writer, value.PoolId)
	FfiConverterStringINSTANCE.Write(writer, value.ConversionId)
	FfiConverterConversionStatusINSTANCE.Write(writer, value.Status)
	FfiConverterOptionalTypeu128INSTANCE.Write(writer, value.Fee)
	FfiConverterOptionalConversionPurposeINSTANCE.Write(writer, value.Purpose)
	FfiConverterOptionalAmountAdjustmentReasonINSTANCE.Write(writer, value.AmountAdjustment)
}

type FfiDestroyerConversionInfo struct{}

func (_ FfiDestroyerConversionInfo) Destroy(value ConversionInfo) {
	value.Destroy()
}

// Options for conversion when fulfilling a payment. When set, the SDK will
// perform a conversion before fulfilling the payment. If not set, the payment
// will only be fulfilled if the wallet has sufficient balance of the required asset.
type ConversionOptions struct {
	// The type of conversion to perform when fulfilling the payment
	ConversionType ConversionType
	// The optional maximum slippage in basis points (1/100 of a percent) allowed when
	// a conversion is needed to fulfill the payment. Defaults to 10 bps (0.1%) if not set.
	// The conversion will fail if the actual amount received is less than
	// `estimated_amount * (1 - max_slippage_bps / 10_000)`.
	MaxSlippageBps *uint32
	// The optional timeout in seconds to wait for the conversion to complete
	// when fulfilling the payment. This timeout only concerns waiting for the received
	// payment of the conversion. If the timeout is reached before the conversion
	// is complete, the payment will fail. Defaults to 30 seconds if not set.
	CompletionTimeoutSecs *uint32
}

func (r *ConversionOptions) Destroy() {
	FfiDestroyerConversionType{}.Destroy(r.ConversionType)
	FfiDestroyerOptionalUint32{}.Destroy(r.MaxSlippageBps)
	FfiDestroyerOptionalUint32{}.Destroy(r.CompletionTimeoutSecs)
}

type FfiConverterConversionOptions struct{}

var FfiConverterConversionOptionsINSTANCE = FfiConverterConversionOptions{}

func (c FfiConverterConversionOptions) Lift(rb RustBufferI) ConversionOptions {
	return LiftFromRustBuffer[ConversionOptions](c, rb)
}

func (c FfiConverterConversionOptions) Read(reader io.Reader) ConversionOptions {
	return ConversionOptions{
		FfiConverterConversionTypeINSTANCE.Read(reader),
		FfiConverterOptionalUint32INSTANCE.Read(reader),
		FfiConverterOptionalUint32INSTANCE.Read(reader),
	}
}

func (c FfiConverterConversionOptions) Lower(value ConversionOptions) C.RustBuffer {
	return LowerIntoRustBuffer[ConversionOptions](c, value)
}

func (c FfiConverterConversionOptions) LowerExternal(value ConversionOptions) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[ConversionOptions](c, value))
}

func (c FfiConverterConversionOptions) Write(writer io.Writer, value ConversionOptions) {
	FfiConverterConversionTypeINSTANCE.Write(writer, value.ConversionType)
	FfiConverterOptionalUint32INSTANCE.Write(writer, value.MaxSlippageBps)
	FfiConverterOptionalUint32INSTANCE.Write(writer, value.CompletionTimeoutSecs)
}

type FfiDestroyerConversionOptions struct{}

func (_ FfiDestroyerConversionOptions) Destroy(value ConversionOptions) {
	value.Destroy()
}

// A single step in a conversion
type ConversionStep struct {
	// The underlying payment id of the conversion step
	PaymentId string
	// Payment amount in satoshis or token base units
	Amount u128
	// Fee paid in satoshis or token base units
	// This represents the payment fee + the conversion fee
	Fee u128
	// Method of payment
	Method PaymentMethod
	// Token metadata if a token is used for payment
	TokenMetadata *TokenMetadata
	// The reason the conversion amount was adjusted, if applicable.
	AmountAdjustment *AmountAdjustmentReason
}

func (r *ConversionStep) Destroy() {
	FfiDestroyerString{}.Destroy(r.PaymentId)
	FfiDestroyerTypeu128{}.Destroy(r.Amount)
	FfiDestroyerTypeu128{}.Destroy(r.Fee)
	FfiDestroyerPaymentMethod{}.Destroy(r.Method)
	FfiDestroyerOptionalTokenMetadata{}.Destroy(r.TokenMetadata)
	FfiDestroyerOptionalAmountAdjustmentReason{}.Destroy(r.AmountAdjustment)
}

type FfiConverterConversionStep struct{}

var FfiConverterConversionStepINSTANCE = FfiConverterConversionStep{}

func (c FfiConverterConversionStep) Lift(rb RustBufferI) ConversionStep {
	return LiftFromRustBuffer[ConversionStep](c, rb)
}

func (c FfiConverterConversionStep) Read(reader io.Reader) ConversionStep {
	return ConversionStep{
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterTypeu128INSTANCE.Read(reader),
		FfiConverterTypeu128INSTANCE.Read(reader),
		FfiConverterPaymentMethodINSTANCE.Read(reader),
		FfiConverterOptionalTokenMetadataINSTANCE.Read(reader),
		FfiConverterOptionalAmountAdjustmentReasonINSTANCE.Read(reader),
	}
}

func (c FfiConverterConversionStep) Lower(value ConversionStep) C.RustBuffer {
	return LowerIntoRustBuffer[ConversionStep](c, value)
}

func (c FfiConverterConversionStep) LowerExternal(value ConversionStep) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[ConversionStep](c, value))
}

func (c FfiConverterConversionStep) Write(writer io.Writer, value ConversionStep) {
	FfiConverterStringINSTANCE.Write(writer, value.PaymentId)
	FfiConverterTypeu128INSTANCE.Write(writer, value.Amount)
	FfiConverterTypeu128INSTANCE.Write(writer, value.Fee)
	FfiConverterPaymentMethodINSTANCE.Write(writer, value.Method)
	FfiConverterOptionalTokenMetadataINSTANCE.Write(writer, value.TokenMetadata)
	FfiConverterOptionalAmountAdjustmentReasonINSTANCE.Write(writer, value.AmountAdjustment)
}

type FfiDestroyerConversionStep struct{}

func (_ FfiDestroyerConversionStep) Destroy(value ConversionStep) {
	value.Destroy()
}

type CreateIssuerTokenRequest struct {
	Name        string
	Ticker      string
	Decimals    uint32
	IsFreezable bool
	MaxSupply   u128
}

func (r *CreateIssuerTokenRequest) Destroy() {
	FfiDestroyerString{}.Destroy(r.Name)
	FfiDestroyerString{}.Destroy(r.Ticker)
	FfiDestroyerUint32{}.Destroy(r.Decimals)
	FfiDestroyerBool{}.Destroy(r.IsFreezable)
	FfiDestroyerTypeu128{}.Destroy(r.MaxSupply)
}

type FfiConverterCreateIssuerTokenRequest struct{}

var FfiConverterCreateIssuerTokenRequestINSTANCE = FfiConverterCreateIssuerTokenRequest{}

func (c FfiConverterCreateIssuerTokenRequest) Lift(rb RustBufferI) CreateIssuerTokenRequest {
	return LiftFromRustBuffer[CreateIssuerTokenRequest](c, rb)
}

func (c FfiConverterCreateIssuerTokenRequest) Read(reader io.Reader) CreateIssuerTokenRequest {
	return CreateIssuerTokenRequest{
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterUint32INSTANCE.Read(reader),
		FfiConverterBoolINSTANCE.Read(reader),
		FfiConverterTypeu128INSTANCE.Read(reader),
	}
}

func (c FfiConverterCreateIssuerTokenRequest) Lower(value CreateIssuerTokenRequest) C.RustBuffer {
	return LowerIntoRustBuffer[CreateIssuerTokenRequest](c, value)
}

func (c FfiConverterCreateIssuerTokenRequest) LowerExternal(value CreateIssuerTokenRequest) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[CreateIssuerTokenRequest](c, value))
}

func (c FfiConverterCreateIssuerTokenRequest) Write(writer io.Writer, value CreateIssuerTokenRequest) {
	FfiConverterStringINSTANCE.Write(writer, value.Name)
	FfiConverterStringINSTANCE.Write(writer, value.Ticker)
	FfiConverterUint32INSTANCE.Write(writer, value.Decimals)
	FfiConverterBoolINSTANCE.Write(writer, value.IsFreezable)
	FfiConverterTypeu128INSTANCE.Write(writer, value.MaxSupply)
}

type FfiDestroyerCreateIssuerTokenRequest struct{}

func (_ FfiDestroyerCreateIssuerTokenRequest) Destroy(value CreateIssuerTokenRequest) {
	value.Destroy()
}

type Credentials struct {
	Username string
	Password string
}

func (r *Credentials) Destroy() {
	FfiDestroyerString{}.Destroy(r.Username)
	FfiDestroyerString{}.Destroy(r.Password)
}

type FfiConverterCredentials struct{}

var FfiConverterCredentialsINSTANCE = FfiConverterCredentials{}

func (c FfiConverterCredentials) Lift(rb RustBufferI) Credentials {
	return LiftFromRustBuffer[Credentials](c, rb)
}

func (c FfiConverterCredentials) Read(reader io.Reader) Credentials {
	return Credentials{
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterStringINSTANCE.Read(reader),
	}
}

func (c FfiConverterCredentials) Lower(value Credentials) C.RustBuffer {
	return LowerIntoRustBuffer[Credentials](c, value)
}

func (c FfiConverterCredentials) LowerExternal(value Credentials) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[Credentials](c, value))
}

func (c FfiConverterCredentials) Write(writer io.Writer, value Credentials) {
	FfiConverterStringINSTANCE.Write(writer, value.Username)
	FfiConverterStringINSTANCE.Write(writer, value.Password)
}

type FfiDestroyerCredentials struct{}

func (_ FfiDestroyerCredentials) Destroy(value Credentials) {
	value.Destroy()
}

// Details about a supported currency in the fiat rate feed
type CurrencyInfo struct {
	Name            string
	FractionSize    uint32
	Spacing         *uint32
	Symbol          *Symbol
	UniqSymbol      *Symbol
	LocalizedName   []LocalizedName
	LocaleOverrides []LocaleOverrides
}

func (r *CurrencyInfo) Destroy() {
	FfiDestroyerString{}.Destroy(r.Name)
	FfiDestroyerUint32{}.Destroy(r.FractionSize)
	FfiDestroyerOptionalUint32{}.Destroy(r.Spacing)
	FfiDestroyerOptionalSymbol{}.Destroy(r.Symbol)
	FfiDestroyerOptionalSymbol{}.Destroy(r.UniqSymbol)
	FfiDestroyerSequenceLocalizedName{}.Destroy(r.LocalizedName)
	FfiDestroyerSequenceLocaleOverrides{}.Destroy(r.LocaleOverrides)
}

type FfiConverterCurrencyInfo struct{}

var FfiConverterCurrencyInfoINSTANCE = FfiConverterCurrencyInfo{}

func (c FfiConverterCurrencyInfo) Lift(rb RustBufferI) CurrencyInfo {
	return LiftFromRustBuffer[CurrencyInfo](c, rb)
}

func (c FfiConverterCurrencyInfo) Read(reader io.Reader) CurrencyInfo {
	return CurrencyInfo{
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterUint32INSTANCE.Read(reader),
		FfiConverterOptionalUint32INSTANCE.Read(reader),
		FfiConverterOptionalSymbolINSTANCE.Read(reader),
		FfiConverterOptionalSymbolINSTANCE.Read(reader),
		FfiConverterSequenceLocalizedNameINSTANCE.Read(reader),
		FfiConverterSequenceLocaleOverridesINSTANCE.Read(reader),
	}
}

func (c FfiConverterCurrencyInfo) Lower(value CurrencyInfo) C.RustBuffer {
	return LowerIntoRustBuffer[CurrencyInfo](c, value)
}

func (c FfiConverterCurrencyInfo) LowerExternal(value CurrencyInfo) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[CurrencyInfo](c, value))
}

func (c FfiConverterCurrencyInfo) Write(writer io.Writer, value CurrencyInfo) {
	FfiConverterStringINSTANCE.Write(writer, value.Name)
	FfiConverterUint32INSTANCE.Write(writer, value.FractionSize)
	FfiConverterOptionalUint32INSTANCE.Write(writer, value.Spacing)
	FfiConverterOptionalSymbolINSTANCE.Write(writer, value.Symbol)
	FfiConverterOptionalSymbolINSTANCE.Write(writer, value.UniqSymbol)
	FfiConverterSequenceLocalizedNameINSTANCE.Write(writer, value.LocalizedName)
	FfiConverterSequenceLocaleOverridesINSTANCE.Write(writer, value.LocaleOverrides)
}

type FfiDestroyerCurrencyInfo struct{}

func (_ FfiDestroyerCurrencyInfo) Destroy(value CurrencyInfo) {
	value.Destroy()
}

type DepositInfo struct {
	Txid       string
	Vout       uint32
	AmountSats uint64
	IsMature   bool
	RefundTx   *string
	RefundTxId *string
	ClaimError *DepositClaimError
}

func (r *DepositInfo) Destroy() {
	FfiDestroyerString{}.Destroy(r.Txid)
	FfiDestroyerUint32{}.Destroy(r.Vout)
	FfiDestroyerUint64{}.Destroy(r.AmountSats)
	FfiDestroyerBool{}.Destroy(r.IsMature)
	FfiDestroyerOptionalString{}.Destroy(r.RefundTx)
	FfiDestroyerOptionalString{}.Destroy(r.RefundTxId)
	FfiDestroyerOptionalDepositClaimError{}.Destroy(r.ClaimError)
}

type FfiConverterDepositInfo struct{}

var FfiConverterDepositInfoINSTANCE = FfiConverterDepositInfo{}

func (c FfiConverterDepositInfo) Lift(rb RustBufferI) DepositInfo {
	return LiftFromRustBuffer[DepositInfo](c, rb)
}

func (c FfiConverterDepositInfo) Read(reader io.Reader) DepositInfo {
	return DepositInfo{
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterUint32INSTANCE.Read(reader),
		FfiConverterUint64INSTANCE.Read(reader),
		FfiConverterBoolINSTANCE.Read(reader),
		FfiConverterOptionalStringINSTANCE.Read(reader),
		FfiConverterOptionalStringINSTANCE.Read(reader),
		FfiConverterOptionalDepositClaimErrorINSTANCE.Read(reader),
	}
}

func (c FfiConverterDepositInfo) Lower(value DepositInfo) C.RustBuffer {
	return LowerIntoRustBuffer[DepositInfo](c, value)
}

func (c FfiConverterDepositInfo) LowerExternal(value DepositInfo) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[DepositInfo](c, value))
}

func (c FfiConverterDepositInfo) Write(writer io.Writer, value DepositInfo) {
	FfiConverterStringINSTANCE.Write(writer, value.Txid)
	FfiConverterUint32INSTANCE.Write(writer, value.Vout)
	FfiConverterUint64INSTANCE.Write(writer, value.AmountSats)
	FfiConverterBoolINSTANCE.Write(writer, value.IsMature)
	FfiConverterOptionalStringINSTANCE.Write(writer, value.RefundTx)
	FfiConverterOptionalStringINSTANCE.Write(writer, value.RefundTxId)
	FfiConverterOptionalDepositClaimErrorINSTANCE.Write(writer, value.ClaimError)
}

type FfiDestroyerDepositInfo struct{}

func (_ FfiDestroyerDepositInfo) Destroy(value DepositInfo) {
	value.Destroy()
}

// FFI-safe representation of an ECDSA signature (64 bytes)
type EcdsaSignatureBytes struct {
	Bytes []byte
}

func (r *EcdsaSignatureBytes) Destroy() {
	FfiDestroyerBytes{}.Destroy(r.Bytes)
}

type FfiConverterEcdsaSignatureBytes struct{}

var FfiConverterEcdsaSignatureBytesINSTANCE = FfiConverterEcdsaSignatureBytes{}

func (c FfiConverterEcdsaSignatureBytes) Lift(rb RustBufferI) EcdsaSignatureBytes {
	return LiftFromRustBuffer[EcdsaSignatureBytes](c, rb)
}

func (c FfiConverterEcdsaSignatureBytes) Read(reader io.Reader) EcdsaSignatureBytes {
	return EcdsaSignatureBytes{
		FfiConverterBytesINSTANCE.Read(reader),
	}
}

func (c FfiConverterEcdsaSignatureBytes) Lower(value EcdsaSignatureBytes) C.RustBuffer {
	return LowerIntoRustBuffer[EcdsaSignatureBytes](c, value)
}

func (c FfiConverterEcdsaSignatureBytes) LowerExternal(value EcdsaSignatureBytes) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[EcdsaSignatureBytes](c, value))
}

func (c FfiConverterEcdsaSignatureBytes) Write(writer io.Writer, value EcdsaSignatureBytes) {
	FfiConverterBytesINSTANCE.Write(writer, value.Bytes)
}

type FfiDestroyerEcdsaSignatureBytes struct{}

func (_ FfiDestroyerEcdsaSignatureBytes) Destroy(value EcdsaSignatureBytes) {
	value.Destroy()
}

// FFI-safe representation of `spark_wallet::AggregateFrostRequest`
type ExternalAggregateFrostRequest struct {
	// The message that was signed
	Message []byte
	// Statechain signatures as a list of identifier-signature pairs
	StatechainSignatures []IdentifierSignaturePair
	// Statechain public keys as a list of identifier-publickey pairs
	StatechainPublicKeys []IdentifierPublicKeyPair
	// The verifying key (33 bytes compressed)
	VerifyingKey []byte
	// Statechain commitments as a list of identifier-commitment pairs
	StatechainCommitments []IdentifierCommitmentPair
	// The self commitment
	SelfCommitment ExternalSigningCommitments
	// The public key (33 bytes compressed)
	PublicKey []byte
	// The self signature share
	SelfSignature ExternalFrostSignatureShare
	// Optional adaptor public key (33 bytes compressed)
	AdaptorPublicKey *[]byte
}

func (r *ExternalAggregateFrostRequest) Destroy() {
	FfiDestroyerBytes{}.Destroy(r.Message)
	FfiDestroyerSequenceIdentifierSignaturePair{}.Destroy(r.StatechainSignatures)
	FfiDestroyerSequenceIdentifierPublicKeyPair{}.Destroy(r.StatechainPublicKeys)
	FfiDestroyerBytes{}.Destroy(r.VerifyingKey)
	FfiDestroyerSequenceIdentifierCommitmentPair{}.Destroy(r.StatechainCommitments)
	FfiDestroyerExternalSigningCommitments{}.Destroy(r.SelfCommitment)
	FfiDestroyerBytes{}.Destroy(r.PublicKey)
	FfiDestroyerExternalFrostSignatureShare{}.Destroy(r.SelfSignature)
	FfiDestroyerOptionalBytes{}.Destroy(r.AdaptorPublicKey)
}

type FfiConverterExternalAggregateFrostRequest struct{}

var FfiConverterExternalAggregateFrostRequestINSTANCE = FfiConverterExternalAggregateFrostRequest{}

func (c FfiConverterExternalAggregateFrostRequest) Lift(rb RustBufferI) ExternalAggregateFrostRequest {
	return LiftFromRustBuffer[ExternalAggregateFrostRequest](c, rb)
}

func (c FfiConverterExternalAggregateFrostRequest) Read(reader io.Reader) ExternalAggregateFrostRequest {
	return ExternalAggregateFrostRequest{
		FfiConverterBytesINSTANCE.Read(reader),
		FfiConverterSequenceIdentifierSignaturePairINSTANCE.Read(reader),
		FfiConverterSequenceIdentifierPublicKeyPairINSTANCE.Read(reader),
		FfiConverterBytesINSTANCE.Read(reader),
		FfiConverterSequenceIdentifierCommitmentPairINSTANCE.Read(reader),
		FfiConverterExternalSigningCommitmentsINSTANCE.Read(reader),
		FfiConverterBytesINSTANCE.Read(reader),
		FfiConverterExternalFrostSignatureShareINSTANCE.Read(reader),
		FfiConverterOptionalBytesINSTANCE.Read(reader),
	}
}

func (c FfiConverterExternalAggregateFrostRequest) Lower(value ExternalAggregateFrostRequest) C.RustBuffer {
	return LowerIntoRustBuffer[ExternalAggregateFrostRequest](c, value)
}

func (c FfiConverterExternalAggregateFrostRequest) LowerExternal(value ExternalAggregateFrostRequest) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[ExternalAggregateFrostRequest](c, value))
}

func (c FfiConverterExternalAggregateFrostRequest) Write(writer io.Writer, value ExternalAggregateFrostRequest) {
	FfiConverterBytesINSTANCE.Write(writer, value.Message)
	FfiConverterSequenceIdentifierSignaturePairINSTANCE.Write(writer, value.StatechainSignatures)
	FfiConverterSequenceIdentifierPublicKeyPairINSTANCE.Write(writer, value.StatechainPublicKeys)
	FfiConverterBytesINSTANCE.Write(writer, value.VerifyingKey)
	FfiConverterSequenceIdentifierCommitmentPairINSTANCE.Write(writer, value.StatechainCommitments)
	FfiConverterExternalSigningCommitmentsINSTANCE.Write(writer, value.SelfCommitment)
	FfiConverterBytesINSTANCE.Write(writer, value.PublicKey)
	FfiConverterExternalFrostSignatureShareINSTANCE.Write(writer, value.SelfSignature)
	FfiConverterOptionalBytesINSTANCE.Write(writer, value.AdaptorPublicKey)
}

type FfiDestroyerExternalAggregateFrostRequest struct{}

func (_ FfiDestroyerExternalAggregateFrostRequest) Destroy(value ExternalAggregateFrostRequest) {
	value.Destroy()
}

// FFI-safe representation of `spark_wallet::EncryptedSecret`
type ExternalEncryptedSecret struct {
	// The encrypted ciphertext
	Ciphertext []byte
}

func (r *ExternalEncryptedSecret) Destroy() {
	FfiDestroyerBytes{}.Destroy(r.Ciphertext)
}

type FfiConverterExternalEncryptedSecret struct{}

var FfiConverterExternalEncryptedSecretINSTANCE = FfiConverterExternalEncryptedSecret{}

func (c FfiConverterExternalEncryptedSecret) Lift(rb RustBufferI) ExternalEncryptedSecret {
	return LiftFromRustBuffer[ExternalEncryptedSecret](c, rb)
}

func (c FfiConverterExternalEncryptedSecret) Read(reader io.Reader) ExternalEncryptedSecret {
	return ExternalEncryptedSecret{
		FfiConverterBytesINSTANCE.Read(reader),
	}
}

func (c FfiConverterExternalEncryptedSecret) Lower(value ExternalEncryptedSecret) C.RustBuffer {
	return LowerIntoRustBuffer[ExternalEncryptedSecret](c, value)
}

func (c FfiConverterExternalEncryptedSecret) LowerExternal(value ExternalEncryptedSecret) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[ExternalEncryptedSecret](c, value))
}

func (c FfiConverterExternalEncryptedSecret) Write(writer io.Writer, value ExternalEncryptedSecret) {
	FfiConverterBytesINSTANCE.Write(writer, value.Ciphertext)
}

type FfiDestroyerExternalEncryptedSecret struct{}

func (_ FfiDestroyerExternalEncryptedSecret) Destroy(value ExternalEncryptedSecret) {
	value.Destroy()
}

// FFI-safe representation of `spark_wallet::FrostSigningCommitmentsWithNonces`
type ExternalFrostCommitments struct {
	// Serialized hiding nonce commitment (variable length, typically 33 bytes compressed point)
	HidingCommitment []byte
	// Serialized binding nonce commitment (variable length, typically 33 bytes compressed point)
	BindingCommitment []byte
	// Encrypted nonces ciphertext
	NoncesCiphertext []byte
}

func (r *ExternalFrostCommitments) Destroy() {
	FfiDestroyerBytes{}.Destroy(r.HidingCommitment)
	FfiDestroyerBytes{}.Destroy(r.BindingCommitment)
	FfiDestroyerBytes{}.Destroy(r.NoncesCiphertext)
}

type FfiConverterExternalFrostCommitments struct{}

var FfiConverterExternalFrostCommitmentsINSTANCE = FfiConverterExternalFrostCommitments{}

func (c FfiConverterExternalFrostCommitments) Lift(rb RustBufferI) ExternalFrostCommitments {
	return LiftFromRustBuffer[ExternalFrostCommitments](c, rb)
}

func (c FfiConverterExternalFrostCommitments) Read(reader io.Reader) ExternalFrostCommitments {
	return ExternalFrostCommitments{
		FfiConverterBytesINSTANCE.Read(reader),
		FfiConverterBytesINSTANCE.Read(reader),
		FfiConverterBytesINSTANCE.Read(reader),
	}
}

func (c FfiConverterExternalFrostCommitments) Lower(value ExternalFrostCommitments) C.RustBuffer {
	return LowerIntoRustBuffer[ExternalFrostCommitments](c, value)
}

func (c FfiConverterExternalFrostCommitments) LowerExternal(value ExternalFrostCommitments) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[ExternalFrostCommitments](c, value))
}

func (c FfiConverterExternalFrostCommitments) Write(writer io.Writer, value ExternalFrostCommitments) {
	FfiConverterBytesINSTANCE.Write(writer, value.HidingCommitment)
	FfiConverterBytesINSTANCE.Write(writer, value.BindingCommitment)
	FfiConverterBytesINSTANCE.Write(writer, value.NoncesCiphertext)
}

type FfiDestroyerExternalFrostCommitments struct{}

func (_ FfiDestroyerExternalFrostCommitments) Destroy(value ExternalFrostCommitments) {
	value.Destroy()
}

// FFI-safe representation of `frost_secp256k1_tr::Signature`
type ExternalFrostSignature struct {
	// Serialized Frost signature bytes (64 bytes)
	Bytes []byte
}

func (r *ExternalFrostSignature) Destroy() {
	FfiDestroyerBytes{}.Destroy(r.Bytes)
}

type FfiConverterExternalFrostSignature struct{}

var FfiConverterExternalFrostSignatureINSTANCE = FfiConverterExternalFrostSignature{}

func (c FfiConverterExternalFrostSignature) Lift(rb RustBufferI) ExternalFrostSignature {
	return LiftFromRustBuffer[ExternalFrostSignature](c, rb)
}

func (c FfiConverterExternalFrostSignature) Read(reader io.Reader) ExternalFrostSignature {
	return ExternalFrostSignature{
		FfiConverterBytesINSTANCE.Read(reader),
	}
}

func (c FfiConverterExternalFrostSignature) Lower(value ExternalFrostSignature) C.RustBuffer {
	return LowerIntoRustBuffer[ExternalFrostSignature](c, value)
}

func (c FfiConverterExternalFrostSignature) LowerExternal(value ExternalFrostSignature) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[ExternalFrostSignature](c, value))
}

func (c FfiConverterExternalFrostSignature) Write(writer io.Writer, value ExternalFrostSignature) {
	FfiConverterBytesINSTANCE.Write(writer, value.Bytes)
}

type FfiDestroyerExternalFrostSignature struct{}

func (_ FfiDestroyerExternalFrostSignature) Destroy(value ExternalFrostSignature) {
	value.Destroy()
}

// FFI-safe representation of `frost_secp256k1_tr::round2::SignatureShare`
type ExternalFrostSignatureShare struct {
	// Serialized signature share bytes (variable length, typically 32 bytes)
	Bytes []byte
}

func (r *ExternalFrostSignatureShare) Destroy() {
	FfiDestroyerBytes{}.Destroy(r.Bytes)
}

type FfiConverterExternalFrostSignatureShare struct{}

var FfiConverterExternalFrostSignatureShareINSTANCE = FfiConverterExternalFrostSignatureShare{}

func (c FfiConverterExternalFrostSignatureShare) Lift(rb RustBufferI) ExternalFrostSignatureShare {
	return LiftFromRustBuffer[ExternalFrostSignatureShare](c, rb)
}

func (c FfiConverterExternalFrostSignatureShare) Read(reader io.Reader) ExternalFrostSignatureShare {
	return ExternalFrostSignatureShare{
		FfiConverterBytesINSTANCE.Read(reader),
	}
}

func (c FfiConverterExternalFrostSignatureShare) Lower(value ExternalFrostSignatureShare) C.RustBuffer {
	return LowerIntoRustBuffer[ExternalFrostSignatureShare](c, value)
}

func (c FfiConverterExternalFrostSignatureShare) LowerExternal(value ExternalFrostSignatureShare) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[ExternalFrostSignatureShare](c, value))
}

func (c FfiConverterExternalFrostSignatureShare) Write(writer io.Writer, value ExternalFrostSignatureShare) {
	FfiConverterBytesINSTANCE.Write(writer, value.Bytes)
}

type FfiDestroyerExternalFrostSignatureShare struct{}

func (_ FfiDestroyerExternalFrostSignatureShare) Destroy(value ExternalFrostSignatureShare) {
	value.Destroy()
}

// FFI-safe representation of `frost_secp256k1_tr::Identifier`
type ExternalIdentifier struct {
	// Serialized identifier bytes
	Bytes []byte
}

func (r *ExternalIdentifier) Destroy() {
	FfiDestroyerBytes{}.Destroy(r.Bytes)
}

type FfiConverterExternalIdentifier struct{}

var FfiConverterExternalIdentifierINSTANCE = FfiConverterExternalIdentifier{}

func (c FfiConverterExternalIdentifier) Lift(rb RustBufferI) ExternalIdentifier {
	return LiftFromRustBuffer[ExternalIdentifier](c, rb)
}

func (c FfiConverterExternalIdentifier) Read(reader io.Reader) ExternalIdentifier {
	return ExternalIdentifier{
		FfiConverterBytesINSTANCE.Read(reader),
	}
}

func (c FfiConverterExternalIdentifier) Lower(value ExternalIdentifier) C.RustBuffer {
	return LowerIntoRustBuffer[ExternalIdentifier](c, value)
}

func (c FfiConverterExternalIdentifier) LowerExternal(value ExternalIdentifier) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[ExternalIdentifier](c, value))
}

func (c FfiConverterExternalIdentifier) Write(writer io.Writer, value ExternalIdentifier) {
	FfiConverterBytesINSTANCE.Write(writer, value.Bytes)
}

type FfiDestroyerExternalIdentifier struct{}

func (_ FfiDestroyerExternalIdentifier) Destroy(value ExternalIdentifier) {
	value.Destroy()
}

// Configuration for an external input parser
type ExternalInputParser struct {
	// An arbitrary parser provider id
	ProviderId string
	// The external parser will be used when an input conforms to this regex
	InputRegex string
	// The URL of the parser containing a placeholder `<input>` that will be replaced with the
	// input to be parsed. The input is sanitized using percent encoding.
	ParserUrl string
}

func (r *ExternalInputParser) Destroy() {
	FfiDestroyerString{}.Destroy(r.ProviderId)
	FfiDestroyerString{}.Destroy(r.InputRegex)
	FfiDestroyerString{}.Destroy(r.ParserUrl)
}

type FfiConverterExternalInputParser struct{}

var FfiConverterExternalInputParserINSTANCE = FfiConverterExternalInputParser{}

func (c FfiConverterExternalInputParser) Lift(rb RustBufferI) ExternalInputParser {
	return LiftFromRustBuffer[ExternalInputParser](c, rb)
}

func (c FfiConverterExternalInputParser) Read(reader io.Reader) ExternalInputParser {
	return ExternalInputParser{
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterStringINSTANCE.Read(reader),
	}
}

func (c FfiConverterExternalInputParser) Lower(value ExternalInputParser) C.RustBuffer {
	return LowerIntoRustBuffer[ExternalInputParser](c, value)
}

func (c FfiConverterExternalInputParser) LowerExternal(value ExternalInputParser) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[ExternalInputParser](c, value))
}

func (c FfiConverterExternalInputParser) Write(writer io.Writer, value ExternalInputParser) {
	FfiConverterStringINSTANCE.Write(writer, value.ProviderId)
	FfiConverterStringINSTANCE.Write(writer, value.InputRegex)
	FfiConverterStringINSTANCE.Write(writer, value.ParserUrl)
}

type FfiDestroyerExternalInputParser struct{}

func (_ FfiDestroyerExternalInputParser) Destroy(value ExternalInputParser) {
	value.Destroy()
}

// FFI-safe representation of `k256::Scalar` (32 bytes)
type ExternalScalar struct {
	// The 32-byte scalar value
	Bytes []byte
}

func (r *ExternalScalar) Destroy() {
	FfiDestroyerBytes{}.Destroy(r.Bytes)
}

type FfiConverterExternalScalar struct{}

var FfiConverterExternalScalarINSTANCE = FfiConverterExternalScalar{}

func (c FfiConverterExternalScalar) Lift(rb RustBufferI) ExternalScalar {
	return LiftFromRustBuffer[ExternalScalar](c, rb)
}

func (c FfiConverterExternalScalar) Read(reader io.Reader) ExternalScalar {
	return ExternalScalar{
		FfiConverterBytesINSTANCE.Read(reader),
	}
}

func (c FfiConverterExternalScalar) Lower(value ExternalScalar) C.RustBuffer {
	return LowerIntoRustBuffer[ExternalScalar](c, value)
}

func (c FfiConverterExternalScalar) LowerExternal(value ExternalScalar) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[ExternalScalar](c, value))
}

func (c FfiConverterExternalScalar) Write(writer io.Writer, value ExternalScalar) {
	FfiConverterBytesINSTANCE.Write(writer, value.Bytes)
}

type FfiDestroyerExternalScalar struct{}

func (_ FfiDestroyerExternalScalar) Destroy(value ExternalScalar) {
	value.Destroy()
}

// FFI-safe representation of `spark_wallet::SecretShare`
type ExternalSecretShare struct {
	// Number of shares required to recover the secret
	Threshold uint32
	// Index (x-coordinate) of the share as 32 bytes
	Index ExternalScalar
	// Share value (y-coordinate) as 32 bytes
	Share ExternalScalar
}

func (r *ExternalSecretShare) Destroy() {
	FfiDestroyerUint32{}.Destroy(r.Threshold)
	FfiDestroyerExternalScalar{}.Destroy(r.Index)
	FfiDestroyerExternalScalar{}.Destroy(r.Share)
}

type FfiConverterExternalSecretShare struct{}

var FfiConverterExternalSecretShareINSTANCE = FfiConverterExternalSecretShare{}

func (c FfiConverterExternalSecretShare) Lift(rb RustBufferI) ExternalSecretShare {
	return LiftFromRustBuffer[ExternalSecretShare](c, rb)
}

func (c FfiConverterExternalSecretShare) Read(reader io.Reader) ExternalSecretShare {
	return ExternalSecretShare{
		FfiConverterUint32INSTANCE.Read(reader),
		FfiConverterExternalScalarINSTANCE.Read(reader),
		FfiConverterExternalScalarINSTANCE.Read(reader),
	}
}

func (c FfiConverterExternalSecretShare) Lower(value ExternalSecretShare) C.RustBuffer {
	return LowerIntoRustBuffer[ExternalSecretShare](c, value)
}

func (c FfiConverterExternalSecretShare) LowerExternal(value ExternalSecretShare) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[ExternalSecretShare](c, value))
}

func (c FfiConverterExternalSecretShare) Write(writer io.Writer, value ExternalSecretShare) {
	FfiConverterUint32INSTANCE.Write(writer, value.Threshold)
	FfiConverterExternalScalarINSTANCE.Write(writer, value.Index)
	FfiConverterExternalScalarINSTANCE.Write(writer, value.Share)
}

type FfiDestroyerExternalSecretShare struct{}

func (_ FfiDestroyerExternalSecretShare) Destroy(value ExternalSecretShare) {
	value.Destroy()
}

// FFI-safe representation of `spark_wallet::SignFrostRequest`
type ExternalSignFrostRequest struct {
	// The message to sign
	Message []byte
	// The public key (33 bytes compressed)
	PublicKey []byte
	// The private key source
	Secret ExternalSecretSource
	// The verifying key (33 bytes compressed)
	VerifyingKey []byte
	// The self nonce commitment
	SelfNonceCommitment ExternalFrostCommitments
	// Statechain commitments as a list of identifier-commitment pairs
	StatechainCommitments []IdentifierCommitmentPair
	// Optional adaptor public key (33 bytes compressed)
	AdaptorPublicKey *[]byte
}

func (r *ExternalSignFrostRequest) Destroy() {
	FfiDestroyerBytes{}.Destroy(r.Message)
	FfiDestroyerBytes{}.Destroy(r.PublicKey)
	FfiDestroyerExternalSecretSource{}.Destroy(r.Secret)
	FfiDestroyerBytes{}.Destroy(r.VerifyingKey)
	FfiDestroyerExternalFrostCommitments{}.Destroy(r.SelfNonceCommitment)
	FfiDestroyerSequenceIdentifierCommitmentPair{}.Destroy(r.StatechainCommitments)
	FfiDestroyerOptionalBytes{}.Destroy(r.AdaptorPublicKey)
}

type FfiConverterExternalSignFrostRequest struct{}

var FfiConverterExternalSignFrostRequestINSTANCE = FfiConverterExternalSignFrostRequest{}

func (c FfiConverterExternalSignFrostRequest) Lift(rb RustBufferI) ExternalSignFrostRequest {
	return LiftFromRustBuffer[ExternalSignFrostRequest](c, rb)
}

func (c FfiConverterExternalSignFrostRequest) Read(reader io.Reader) ExternalSignFrostRequest {
	return ExternalSignFrostRequest{
		FfiConverterBytesINSTANCE.Read(reader),
		FfiConverterBytesINSTANCE.Read(reader),
		FfiConverterExternalSecretSourceINSTANCE.Read(reader),
		FfiConverterBytesINSTANCE.Read(reader),
		FfiConverterExternalFrostCommitmentsINSTANCE.Read(reader),
		FfiConverterSequenceIdentifierCommitmentPairINSTANCE.Read(reader),
		FfiConverterOptionalBytesINSTANCE.Read(reader),
	}
}

func (c FfiConverterExternalSignFrostRequest) Lower(value ExternalSignFrostRequest) C.RustBuffer {
	return LowerIntoRustBuffer[ExternalSignFrostRequest](c, value)
}

func (c FfiConverterExternalSignFrostRequest) LowerExternal(value ExternalSignFrostRequest) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[ExternalSignFrostRequest](c, value))
}

func (c FfiConverterExternalSignFrostRequest) Write(writer io.Writer, value ExternalSignFrostRequest) {
	FfiConverterBytesINSTANCE.Write(writer, value.Message)
	FfiConverterBytesINSTANCE.Write(writer, value.PublicKey)
	FfiConverterExternalSecretSourceINSTANCE.Write(writer, value.Secret)
	FfiConverterBytesINSTANCE.Write(writer, value.VerifyingKey)
	FfiConverterExternalFrostCommitmentsINSTANCE.Write(writer, value.SelfNonceCommitment)
	FfiConverterSequenceIdentifierCommitmentPairINSTANCE.Write(writer, value.StatechainCommitments)
	FfiConverterOptionalBytesINSTANCE.Write(writer, value.AdaptorPublicKey)
}

type FfiDestroyerExternalSignFrostRequest struct{}

func (_ FfiDestroyerExternalSignFrostRequest) Destroy(value ExternalSignFrostRequest) {
	value.Destroy()
}

// FFI-safe representation of `frost_secp256k1_tr::round1::SigningCommitments`
type ExternalSigningCommitments struct {
	// Serialized hiding nonce commitment
	Hiding []byte
	// Serialized binding nonce commitment
	Binding []byte
}

func (r *ExternalSigningCommitments) Destroy() {
	FfiDestroyerBytes{}.Destroy(r.Hiding)
	FfiDestroyerBytes{}.Destroy(r.Binding)
}

type FfiConverterExternalSigningCommitments struct{}

var FfiConverterExternalSigningCommitmentsINSTANCE = FfiConverterExternalSigningCommitments{}

func (c FfiConverterExternalSigningCommitments) Lift(rb RustBufferI) ExternalSigningCommitments {
	return LiftFromRustBuffer[ExternalSigningCommitments](c, rb)
}

func (c FfiConverterExternalSigningCommitments) Read(reader io.Reader) ExternalSigningCommitments {
	return ExternalSigningCommitments{
		FfiConverterBytesINSTANCE.Read(reader),
		FfiConverterBytesINSTANCE.Read(reader),
	}
}

func (c FfiConverterExternalSigningCommitments) Lower(value ExternalSigningCommitments) C.RustBuffer {
	return LowerIntoRustBuffer[ExternalSigningCommitments](c, value)
}

func (c FfiConverterExternalSigningCommitments) LowerExternal(value ExternalSigningCommitments) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[ExternalSigningCommitments](c, value))
}

func (c FfiConverterExternalSigningCommitments) Write(writer io.Writer, value ExternalSigningCommitments) {
	FfiConverterBytesINSTANCE.Write(writer, value.Hiding)
	FfiConverterBytesINSTANCE.Write(writer, value.Binding)
}

type FfiDestroyerExternalSigningCommitments struct{}

func (_ FfiDestroyerExternalSigningCommitments) Destroy(value ExternalSigningCommitments) {
	value.Destroy()
}

// FFI-safe representation of `spark_wallet::TreeNodeId`
type ExternalTreeNodeId struct {
	// The tree node identifier as a string
	Id string
}

func (r *ExternalTreeNodeId) Destroy() {
	FfiDestroyerString{}.Destroy(r.Id)
}

type FfiConverterExternalTreeNodeId struct{}

var FfiConverterExternalTreeNodeIdINSTANCE = FfiConverterExternalTreeNodeId{}

func (c FfiConverterExternalTreeNodeId) Lift(rb RustBufferI) ExternalTreeNodeId {
	return LiftFromRustBuffer[ExternalTreeNodeId](c, rb)
}

func (c FfiConverterExternalTreeNodeId) Read(reader io.Reader) ExternalTreeNodeId {
	return ExternalTreeNodeId{
		FfiConverterStringINSTANCE.Read(reader),
	}
}

func (c FfiConverterExternalTreeNodeId) Lower(value ExternalTreeNodeId) C.RustBuffer {
	return LowerIntoRustBuffer[ExternalTreeNodeId](c, value)
}

func (c FfiConverterExternalTreeNodeId) LowerExternal(value ExternalTreeNodeId) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[ExternalTreeNodeId](c, value))
}

func (c FfiConverterExternalTreeNodeId) Write(writer io.Writer, value ExternalTreeNodeId) {
	FfiConverterStringINSTANCE.Write(writer, value.Id)
}

type FfiDestroyerExternalTreeNodeId struct{}

func (_ FfiDestroyerExternalTreeNodeId) Destroy(value ExternalTreeNodeId) {
	value.Destroy()
}

// FFI-safe representation of `spark_wallet::VerifiableSecretShare`
type ExternalVerifiableSecretShare struct {
	// Base secret share containing threshold, index, and share value
	SecretShare ExternalSecretShare
	// Cryptographic proofs for share verification (each proof is 33 bytes compressed public key)
	Proofs [][]byte
}

func (r *ExternalVerifiableSecretShare) Destroy() {
	FfiDestroyerExternalSecretShare{}.Destroy(r.SecretShare)
	FfiDestroyerSequenceBytes{}.Destroy(r.Proofs)
}

type FfiConverterExternalVerifiableSecretShare struct{}

var FfiConverterExternalVerifiableSecretShareINSTANCE = FfiConverterExternalVerifiableSecretShare{}

func (c FfiConverterExternalVerifiableSecretShare) Lift(rb RustBufferI) ExternalVerifiableSecretShare {
	return LiftFromRustBuffer[ExternalVerifiableSecretShare](c, rb)
}

func (c FfiConverterExternalVerifiableSecretShare) Read(reader io.Reader) ExternalVerifiableSecretShare {
	return ExternalVerifiableSecretShare{
		FfiConverterExternalSecretShareINSTANCE.Read(reader),
		FfiConverterSequenceBytesINSTANCE.Read(reader),
	}
}

func (c FfiConverterExternalVerifiableSecretShare) Lower(value ExternalVerifiableSecretShare) C.RustBuffer {
	return LowerIntoRustBuffer[ExternalVerifiableSecretShare](c, value)
}

func (c FfiConverterExternalVerifiableSecretShare) LowerExternal(value ExternalVerifiableSecretShare) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[ExternalVerifiableSecretShare](c, value))
}

func (c FfiConverterExternalVerifiableSecretShare) Write(writer io.Writer, value ExternalVerifiableSecretShare) {
	FfiConverterExternalSecretShareINSTANCE.Write(writer, value.SecretShare)
	FfiConverterSequenceBytesINSTANCE.Write(writer, value.Proofs)
}

type FfiDestroyerExternalVerifiableSecretShare struct{}

func (_ FfiDestroyerExternalVerifiableSecretShare) Destroy(value ExternalVerifiableSecretShare) {
	value.Destroy()
}

type FetchConversionLimitsRequest struct {
	// The type of conversion, either from or to Bitcoin.
	ConversionType ConversionType
	// The token identifier when converting to a token.
	TokenIdentifier *string
}

func (r *FetchConversionLimitsRequest) Destroy() {
	FfiDestroyerConversionType{}.Destroy(r.ConversionType)
	FfiDestroyerOptionalString{}.Destroy(r.TokenIdentifier)
}

type FfiConverterFetchConversionLimitsRequest struct{}

var FfiConverterFetchConversionLimitsRequestINSTANCE = FfiConverterFetchConversionLimitsRequest{}

func (c FfiConverterFetchConversionLimitsRequest) Lift(rb RustBufferI) FetchConversionLimitsRequest {
	return LiftFromRustBuffer[FetchConversionLimitsRequest](c, rb)
}

func (c FfiConverterFetchConversionLimitsRequest) Read(reader io.Reader) FetchConversionLimitsRequest {
	return FetchConversionLimitsRequest{
		FfiConverterConversionTypeINSTANCE.Read(reader),
		FfiConverterOptionalStringINSTANCE.Read(reader),
	}
}

func (c FfiConverterFetchConversionLimitsRequest) Lower(value FetchConversionLimitsRequest) C.RustBuffer {
	return LowerIntoRustBuffer[FetchConversionLimitsRequest](c, value)
}

func (c FfiConverterFetchConversionLimitsRequest) LowerExternal(value FetchConversionLimitsRequest) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[FetchConversionLimitsRequest](c, value))
}

func (c FfiConverterFetchConversionLimitsRequest) Write(writer io.Writer, value FetchConversionLimitsRequest) {
	FfiConverterConversionTypeINSTANCE.Write(writer, value.ConversionType)
	FfiConverterOptionalStringINSTANCE.Write(writer, value.TokenIdentifier)
}

type FfiDestroyerFetchConversionLimitsRequest struct{}

func (_ FfiDestroyerFetchConversionLimitsRequest) Destroy(value FetchConversionLimitsRequest) {
	value.Destroy()
}

type FetchConversionLimitsResponse struct {
	// The minimum amount to be converted.
	// Denominated in satoshis if converting from Bitcoin, otherwise in the token base units.
	MinFromAmount *u128
	// The minimum amount to be received from the conversion.
	// Denominated in satoshis if converting to Bitcoin, otherwise in the token base units.
	MinToAmount *u128
}

func (r *FetchConversionLimitsResponse) Destroy() {
	FfiDestroyerOptionalTypeu128{}.Destroy(r.MinFromAmount)
	FfiDestroyerOptionalTypeu128{}.Destroy(r.MinToAmount)
}

type FfiConverterFetchConversionLimitsResponse struct{}

var FfiConverterFetchConversionLimitsResponseINSTANCE = FfiConverterFetchConversionLimitsResponse{}

func (c FfiConverterFetchConversionLimitsResponse) Lift(rb RustBufferI) FetchConversionLimitsResponse {
	return LiftFromRustBuffer[FetchConversionLimitsResponse](c, rb)
}

func (c FfiConverterFetchConversionLimitsResponse) Read(reader io.Reader) FetchConversionLimitsResponse {
	return FetchConversionLimitsResponse{
		FfiConverterOptionalTypeu128INSTANCE.Read(reader),
		FfiConverterOptionalTypeu128INSTANCE.Read(reader),
	}
}

func (c FfiConverterFetchConversionLimitsResponse) Lower(value FetchConversionLimitsResponse) C.RustBuffer {
	return LowerIntoRustBuffer[FetchConversionLimitsResponse](c, value)
}

func (c FfiConverterFetchConversionLimitsResponse) LowerExternal(value FetchConversionLimitsResponse) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[FetchConversionLimitsResponse](c, value))
}

func (c FfiConverterFetchConversionLimitsResponse) Write(writer io.Writer, value FetchConversionLimitsResponse) {
	FfiConverterOptionalTypeu128INSTANCE.Write(writer, value.MinFromAmount)
	FfiConverterOptionalTypeu128INSTANCE.Write(writer, value.MinToAmount)
}

type FfiDestroyerFetchConversionLimitsResponse struct{}

func (_ FfiDestroyerFetchConversionLimitsResponse) Destroy(value FetchConversionLimitsResponse) {
	value.Destroy()
}

// Wrapper around the [`CurrencyInfo`] of a fiat currency
type FiatCurrency struct {
	Id   string
	Info CurrencyInfo
}

func (r *FiatCurrency) Destroy() {
	FfiDestroyerString{}.Destroy(r.Id)
	FfiDestroyerCurrencyInfo{}.Destroy(r.Info)
}

type FfiConverterFiatCurrency struct{}

var FfiConverterFiatCurrencyINSTANCE = FfiConverterFiatCurrency{}

func (c FfiConverterFiatCurrency) Lift(rb RustBufferI) FiatCurrency {
	return LiftFromRustBuffer[FiatCurrency](c, rb)
}

func (c FfiConverterFiatCurrency) Read(reader io.Reader) FiatCurrency {
	return FiatCurrency{
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterCurrencyInfoINSTANCE.Read(reader),
	}
}

func (c FfiConverterFiatCurrency) Lower(value FiatCurrency) C.RustBuffer {
	return LowerIntoRustBuffer[FiatCurrency](c, value)
}

func (c FfiConverterFiatCurrency) LowerExternal(value FiatCurrency) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[FiatCurrency](c, value))
}

func (c FfiConverterFiatCurrency) Write(writer io.Writer, value FiatCurrency) {
	FfiConverterStringINSTANCE.Write(writer, value.Id)
	FfiConverterCurrencyInfoINSTANCE.Write(writer, value.Info)
}

type FfiDestroyerFiatCurrency struct{}

func (_ FfiDestroyerFiatCurrency) Destroy(value FiatCurrency) {
	value.Destroy()
}

type FreezeIssuerTokenRequest struct {
	Address string
}

func (r *FreezeIssuerTokenRequest) Destroy() {
	FfiDestroyerString{}.Destroy(r.Address)
}

type FfiConverterFreezeIssuerTokenRequest struct{}

var FfiConverterFreezeIssuerTokenRequestINSTANCE = FfiConverterFreezeIssuerTokenRequest{}

func (c FfiConverterFreezeIssuerTokenRequest) Lift(rb RustBufferI) FreezeIssuerTokenRequest {
	return LiftFromRustBuffer[FreezeIssuerTokenRequest](c, rb)
}

func (c FfiConverterFreezeIssuerTokenRequest) Read(reader io.Reader) FreezeIssuerTokenRequest {
	return FreezeIssuerTokenRequest{
		FfiConverterStringINSTANCE.Read(reader),
	}
}

func (c FfiConverterFreezeIssuerTokenRequest) Lower(value FreezeIssuerTokenRequest) C.RustBuffer {
	return LowerIntoRustBuffer[FreezeIssuerTokenRequest](c, value)
}

func (c FfiConverterFreezeIssuerTokenRequest) LowerExternal(value FreezeIssuerTokenRequest) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[FreezeIssuerTokenRequest](c, value))
}

func (c FfiConverterFreezeIssuerTokenRequest) Write(writer io.Writer, value FreezeIssuerTokenRequest) {
	FfiConverterStringINSTANCE.Write(writer, value.Address)
}

type FfiDestroyerFreezeIssuerTokenRequest struct{}

func (_ FfiDestroyerFreezeIssuerTokenRequest) Destroy(value FreezeIssuerTokenRequest) {
	value.Destroy()
}

type FreezeIssuerTokenResponse struct {
	ImpactedOutputIds   []string
	ImpactedTokenAmount u128
}

func (r *FreezeIssuerTokenResponse) Destroy() {
	FfiDestroyerSequenceString{}.Destroy(r.ImpactedOutputIds)
	FfiDestroyerTypeu128{}.Destroy(r.ImpactedTokenAmount)
}

type FfiConverterFreezeIssuerTokenResponse struct{}

var FfiConverterFreezeIssuerTokenResponseINSTANCE = FfiConverterFreezeIssuerTokenResponse{}

func (c FfiConverterFreezeIssuerTokenResponse) Lift(rb RustBufferI) FreezeIssuerTokenResponse {
	return LiftFromRustBuffer[FreezeIssuerTokenResponse](c, rb)
}

func (c FfiConverterFreezeIssuerTokenResponse) Read(reader io.Reader) FreezeIssuerTokenResponse {
	return FreezeIssuerTokenResponse{
		FfiConverterSequenceStringINSTANCE.Read(reader),
		FfiConverterTypeu128INSTANCE.Read(reader),
	}
}

func (c FfiConverterFreezeIssuerTokenResponse) Lower(value FreezeIssuerTokenResponse) C.RustBuffer {
	return LowerIntoRustBuffer[FreezeIssuerTokenResponse](c, value)
}

func (c FfiConverterFreezeIssuerTokenResponse) LowerExternal(value FreezeIssuerTokenResponse) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[FreezeIssuerTokenResponse](c, value))
}

func (c FfiConverterFreezeIssuerTokenResponse) Write(writer io.Writer, value FreezeIssuerTokenResponse) {
	FfiConverterSequenceStringINSTANCE.Write(writer, value.ImpactedOutputIds)
	FfiConverterTypeu128INSTANCE.Write(writer, value.ImpactedTokenAmount)
}

type FfiDestroyerFreezeIssuerTokenResponse struct{}

func (_ FfiDestroyerFreezeIssuerTokenResponse) Destroy(value FreezeIssuerTokenResponse) {
	value.Destroy()
}

// Request to get the balance of the wallet
type GetInfoRequest struct {
	EnsureSynced *bool
}

func (r *GetInfoRequest) Destroy() {
	FfiDestroyerOptionalBool{}.Destroy(r.EnsureSynced)
}

type FfiConverterGetInfoRequest struct{}

var FfiConverterGetInfoRequestINSTANCE = FfiConverterGetInfoRequest{}

func (c FfiConverterGetInfoRequest) Lift(rb RustBufferI) GetInfoRequest {
	return LiftFromRustBuffer[GetInfoRequest](c, rb)
}

func (c FfiConverterGetInfoRequest) Read(reader io.Reader) GetInfoRequest {
	return GetInfoRequest{
		FfiConverterOptionalBoolINSTANCE.Read(reader),
	}
}

func (c FfiConverterGetInfoRequest) Lower(value GetInfoRequest) C.RustBuffer {
	return LowerIntoRustBuffer[GetInfoRequest](c, value)
}

func (c FfiConverterGetInfoRequest) LowerExternal(value GetInfoRequest) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[GetInfoRequest](c, value))
}

func (c FfiConverterGetInfoRequest) Write(writer io.Writer, value GetInfoRequest) {
	FfiConverterOptionalBoolINSTANCE.Write(writer, value.EnsureSynced)
}

type FfiDestroyerGetInfoRequest struct{}

func (_ FfiDestroyerGetInfoRequest) Destroy(value GetInfoRequest) {
	value.Destroy()
}

// Response containing the balance of the wallet
type GetInfoResponse struct {
	// The identity public key of the wallet as a hex string
	IdentityPubkey string
	// The balance in satoshis
	BalanceSats uint64
	// The balances of the tokens in the wallet keyed by the token identifier
	TokenBalances map[string]TokenBalance
}

func (r *GetInfoResponse) Destroy() {
	FfiDestroyerString{}.Destroy(r.IdentityPubkey)
	FfiDestroyerUint64{}.Destroy(r.BalanceSats)
	FfiDestroyerMapStringTokenBalance{}.Destroy(r.TokenBalances)
}

type FfiConverterGetInfoResponse struct{}

var FfiConverterGetInfoResponseINSTANCE = FfiConverterGetInfoResponse{}

func (c FfiConverterGetInfoResponse) Lift(rb RustBufferI) GetInfoResponse {
	return LiftFromRustBuffer[GetInfoResponse](c, rb)
}

func (c FfiConverterGetInfoResponse) Read(reader io.Reader) GetInfoResponse {
	return GetInfoResponse{
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterUint64INSTANCE.Read(reader),
		FfiConverterMapStringTokenBalanceINSTANCE.Read(reader),
	}
}

func (c FfiConverterGetInfoResponse) Lower(value GetInfoResponse) C.RustBuffer {
	return LowerIntoRustBuffer[GetInfoResponse](c, value)
}

func (c FfiConverterGetInfoResponse) LowerExternal(value GetInfoResponse) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[GetInfoResponse](c, value))
}

func (c FfiConverterGetInfoResponse) Write(writer io.Writer, value GetInfoResponse) {
	FfiConverterStringINSTANCE.Write(writer, value.IdentityPubkey)
	FfiConverterUint64INSTANCE.Write(writer, value.BalanceSats)
	FfiConverterMapStringTokenBalanceINSTANCE.Write(writer, value.TokenBalances)
}

type FfiDestroyerGetInfoResponse struct{}

func (_ FfiDestroyerGetInfoResponse) Destroy(value GetInfoResponse) {
	value.Destroy()
}

type GetPaymentRequest struct {
	PaymentId string
}

func (r *GetPaymentRequest) Destroy() {
	FfiDestroyerString{}.Destroy(r.PaymentId)
}

type FfiConverterGetPaymentRequest struct{}

var FfiConverterGetPaymentRequestINSTANCE = FfiConverterGetPaymentRequest{}

func (c FfiConverterGetPaymentRequest) Lift(rb RustBufferI) GetPaymentRequest {
	return LiftFromRustBuffer[GetPaymentRequest](c, rb)
}

func (c FfiConverterGetPaymentRequest) Read(reader io.Reader) GetPaymentRequest {
	return GetPaymentRequest{
		FfiConverterStringINSTANCE.Read(reader),
	}
}

func (c FfiConverterGetPaymentRequest) Lower(value GetPaymentRequest) C.RustBuffer {
	return LowerIntoRustBuffer[GetPaymentRequest](c, value)
}

func (c FfiConverterGetPaymentRequest) LowerExternal(value GetPaymentRequest) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[GetPaymentRequest](c, value))
}

func (c FfiConverterGetPaymentRequest) Write(writer io.Writer, value GetPaymentRequest) {
	FfiConverterStringINSTANCE.Write(writer, value.PaymentId)
}

type FfiDestroyerGetPaymentRequest struct{}

func (_ FfiDestroyerGetPaymentRequest) Destroy(value GetPaymentRequest) {
	value.Destroy()
}

type GetPaymentResponse struct {
	Payment Payment
}

func (r *GetPaymentResponse) Destroy() {
	FfiDestroyerPayment{}.Destroy(r.Payment)
}

type FfiConverterGetPaymentResponse struct{}

var FfiConverterGetPaymentResponseINSTANCE = FfiConverterGetPaymentResponse{}

func (c FfiConverterGetPaymentResponse) Lift(rb RustBufferI) GetPaymentResponse {
	return LiftFromRustBuffer[GetPaymentResponse](c, rb)
}

func (c FfiConverterGetPaymentResponse) Read(reader io.Reader) GetPaymentResponse {
	return GetPaymentResponse{
		FfiConverterPaymentINSTANCE.Read(reader),
	}
}

func (c FfiConverterGetPaymentResponse) Lower(value GetPaymentResponse) C.RustBuffer {
	return LowerIntoRustBuffer[GetPaymentResponse](c, value)
}

func (c FfiConverterGetPaymentResponse) LowerExternal(value GetPaymentResponse) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[GetPaymentResponse](c, value))
}

func (c FfiConverterGetPaymentResponse) Write(writer io.Writer, value GetPaymentResponse) {
	FfiConverterPaymentINSTANCE.Write(writer, value.Payment)
}

type FfiDestroyerGetPaymentResponse struct{}

func (_ FfiDestroyerGetPaymentResponse) Destroy(value GetPaymentResponse) {
	value.Destroy()
}

type GetTokensMetadataRequest struct {
	TokenIdentifiers []string
}

func (r *GetTokensMetadataRequest) Destroy() {
	FfiDestroyerSequenceString{}.Destroy(r.TokenIdentifiers)
}

type FfiConverterGetTokensMetadataRequest struct{}

var FfiConverterGetTokensMetadataRequestINSTANCE = FfiConverterGetTokensMetadataRequest{}

func (c FfiConverterGetTokensMetadataRequest) Lift(rb RustBufferI) GetTokensMetadataRequest {
	return LiftFromRustBuffer[GetTokensMetadataRequest](c, rb)
}

func (c FfiConverterGetTokensMetadataRequest) Read(reader io.Reader) GetTokensMetadataRequest {
	return GetTokensMetadataRequest{
		FfiConverterSequenceStringINSTANCE.Read(reader),
	}
}

func (c FfiConverterGetTokensMetadataRequest) Lower(value GetTokensMetadataRequest) C.RustBuffer {
	return LowerIntoRustBuffer[GetTokensMetadataRequest](c, value)
}

func (c FfiConverterGetTokensMetadataRequest) LowerExternal(value GetTokensMetadataRequest) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[GetTokensMetadataRequest](c, value))
}

func (c FfiConverterGetTokensMetadataRequest) Write(writer io.Writer, value GetTokensMetadataRequest) {
	FfiConverterSequenceStringINSTANCE.Write(writer, value.TokenIdentifiers)
}

type FfiDestroyerGetTokensMetadataRequest struct{}

func (_ FfiDestroyerGetTokensMetadataRequest) Destroy(value GetTokensMetadataRequest) {
	value.Destroy()
}

type GetTokensMetadataResponse struct {
	TokensMetadata []TokenMetadata
}

func (r *GetTokensMetadataResponse) Destroy() {
	FfiDestroyerSequenceTokenMetadata{}.Destroy(r.TokensMetadata)
}

type FfiConverterGetTokensMetadataResponse struct{}

var FfiConverterGetTokensMetadataResponseINSTANCE = FfiConverterGetTokensMetadataResponse{}

func (c FfiConverterGetTokensMetadataResponse) Lift(rb RustBufferI) GetTokensMetadataResponse {
	return LiftFromRustBuffer[GetTokensMetadataResponse](c, rb)
}

func (c FfiConverterGetTokensMetadataResponse) Read(reader io.Reader) GetTokensMetadataResponse {
	return GetTokensMetadataResponse{
		FfiConverterSequenceTokenMetadataINSTANCE.Read(reader),
	}
}

func (c FfiConverterGetTokensMetadataResponse) Lower(value GetTokensMetadataResponse) C.RustBuffer {
	return LowerIntoRustBuffer[GetTokensMetadataResponse](c, value)
}

func (c FfiConverterGetTokensMetadataResponse) LowerExternal(value GetTokensMetadataResponse) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[GetTokensMetadataResponse](c, value))
}

func (c FfiConverterGetTokensMetadataResponse) Write(writer io.Writer, value GetTokensMetadataResponse) {
	FfiConverterSequenceTokenMetadataINSTANCE.Write(writer, value.TokensMetadata)
}

type FfiDestroyerGetTokensMetadataResponse struct{}

func (_ FfiDestroyerGetTokensMetadataResponse) Destroy(value GetTokensMetadataResponse) {
	value.Destroy()
}

type HashedMessageBytes struct {
	Bytes []byte
}

func (r *HashedMessageBytes) Destroy() {
	FfiDestroyerBytes{}.Destroy(r.Bytes)
}

type FfiConverterHashedMessageBytes struct{}

var FfiConverterHashedMessageBytesINSTANCE = FfiConverterHashedMessageBytes{}

func (c FfiConverterHashedMessageBytes) Lift(rb RustBufferI) HashedMessageBytes {
	return LiftFromRustBuffer[HashedMessageBytes](c, rb)
}

func (c FfiConverterHashedMessageBytes) Read(reader io.Reader) HashedMessageBytes {
	return HashedMessageBytes{
		FfiConverterBytesINSTANCE.Read(reader),
	}
}

func (c FfiConverterHashedMessageBytes) Lower(value HashedMessageBytes) C.RustBuffer {
	return LowerIntoRustBuffer[HashedMessageBytes](c, value)
}

func (c FfiConverterHashedMessageBytes) LowerExternal(value HashedMessageBytes) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[HashedMessageBytes](c, value))
}

func (c FfiConverterHashedMessageBytes) Write(writer io.Writer, value HashedMessageBytes) {
	FfiConverterBytesINSTANCE.Write(writer, value.Bytes)
}

type FfiDestroyerHashedMessageBytes struct{}

func (_ FfiDestroyerHashedMessageBytes) Destroy(value HashedMessageBytes) {
	value.Destroy()
}

// FFI-safe wrapper for (Identifier, `SigningCommitments`) pair
type IdentifierCommitmentPair struct {
	Identifier ExternalIdentifier
	Commitment ExternalSigningCommitments
}

func (r *IdentifierCommitmentPair) Destroy() {
	FfiDestroyerExternalIdentifier{}.Destroy(r.Identifier)
	FfiDestroyerExternalSigningCommitments{}.Destroy(r.Commitment)
}

type FfiConverterIdentifierCommitmentPair struct{}

var FfiConverterIdentifierCommitmentPairINSTANCE = FfiConverterIdentifierCommitmentPair{}

func (c FfiConverterIdentifierCommitmentPair) Lift(rb RustBufferI) IdentifierCommitmentPair {
	return LiftFromRustBuffer[IdentifierCommitmentPair](c, rb)
}

func (c FfiConverterIdentifierCommitmentPair) Read(reader io.Reader) IdentifierCommitmentPair {
	return IdentifierCommitmentPair{
		FfiConverterExternalIdentifierINSTANCE.Read(reader),
		FfiConverterExternalSigningCommitmentsINSTANCE.Read(reader),
	}
}

func (c FfiConverterIdentifierCommitmentPair) Lower(value IdentifierCommitmentPair) C.RustBuffer {
	return LowerIntoRustBuffer[IdentifierCommitmentPair](c, value)
}

func (c FfiConverterIdentifierCommitmentPair) LowerExternal(value IdentifierCommitmentPair) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[IdentifierCommitmentPair](c, value))
}

func (c FfiConverterIdentifierCommitmentPair) Write(writer io.Writer, value IdentifierCommitmentPair) {
	FfiConverterExternalIdentifierINSTANCE.Write(writer, value.Identifier)
	FfiConverterExternalSigningCommitmentsINSTANCE.Write(writer, value.Commitment)
}

type FfiDestroyerIdentifierCommitmentPair struct{}

func (_ FfiDestroyerIdentifierCommitmentPair) Destroy(value IdentifierCommitmentPair) {
	value.Destroy()
}

// FFI-safe wrapper for (Identifier, `PublicKey`) pair
type IdentifierPublicKeyPair struct {
	Identifier ExternalIdentifier
	PublicKey  []byte
}

func (r *IdentifierPublicKeyPair) Destroy() {
	FfiDestroyerExternalIdentifier{}.Destroy(r.Identifier)
	FfiDestroyerBytes{}.Destroy(r.PublicKey)
}

type FfiConverterIdentifierPublicKeyPair struct{}

var FfiConverterIdentifierPublicKeyPairINSTANCE = FfiConverterIdentifierPublicKeyPair{}

func (c FfiConverterIdentifierPublicKeyPair) Lift(rb RustBufferI) IdentifierPublicKeyPair {
	return LiftFromRustBuffer[IdentifierPublicKeyPair](c, rb)
}

func (c FfiConverterIdentifierPublicKeyPair) Read(reader io.Reader) IdentifierPublicKeyPair {
	return IdentifierPublicKeyPair{
		FfiConverterExternalIdentifierINSTANCE.Read(reader),
		FfiConverterBytesINSTANCE.Read(reader),
	}
}

func (c FfiConverterIdentifierPublicKeyPair) Lower(value IdentifierPublicKeyPair) C.RustBuffer {
	return LowerIntoRustBuffer[IdentifierPublicKeyPair](c, value)
}

func (c FfiConverterIdentifierPublicKeyPair) LowerExternal(value IdentifierPublicKeyPair) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[IdentifierPublicKeyPair](c, value))
}

func (c FfiConverterIdentifierPublicKeyPair) Write(writer io.Writer, value IdentifierPublicKeyPair) {
	FfiConverterExternalIdentifierINSTANCE.Write(writer, value.Identifier)
	FfiConverterBytesINSTANCE.Write(writer, value.PublicKey)
}

type FfiDestroyerIdentifierPublicKeyPair struct{}

func (_ FfiDestroyerIdentifierPublicKeyPair) Destroy(value IdentifierPublicKeyPair) {
	value.Destroy()
}

// FFI-safe wrapper for (Identifier, `SignatureShare`) pair
type IdentifierSignaturePair struct {
	Identifier ExternalIdentifier
	Signature  ExternalFrostSignatureShare
}

func (r *IdentifierSignaturePair) Destroy() {
	FfiDestroyerExternalIdentifier{}.Destroy(r.Identifier)
	FfiDestroyerExternalFrostSignatureShare{}.Destroy(r.Signature)
}

type FfiConverterIdentifierSignaturePair struct{}

var FfiConverterIdentifierSignaturePairINSTANCE = FfiConverterIdentifierSignaturePair{}

func (c FfiConverterIdentifierSignaturePair) Lift(rb RustBufferI) IdentifierSignaturePair {
	return LiftFromRustBuffer[IdentifierSignaturePair](c, rb)
}

func (c FfiConverterIdentifierSignaturePair) Read(reader io.Reader) IdentifierSignaturePair {
	return IdentifierSignaturePair{
		FfiConverterExternalIdentifierINSTANCE.Read(reader),
		FfiConverterExternalFrostSignatureShareINSTANCE.Read(reader),
	}
}

func (c FfiConverterIdentifierSignaturePair) Lower(value IdentifierSignaturePair) C.RustBuffer {
	return LowerIntoRustBuffer[IdentifierSignaturePair](c, value)
}

func (c FfiConverterIdentifierSignaturePair) LowerExternal(value IdentifierSignaturePair) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[IdentifierSignaturePair](c, value))
}

func (c FfiConverterIdentifierSignaturePair) Write(writer io.Writer, value IdentifierSignaturePair) {
	FfiConverterExternalIdentifierINSTANCE.Write(writer, value.Identifier)
	FfiConverterExternalFrostSignatureShareINSTANCE.Write(writer, value.Signature)
}

type FfiDestroyerIdentifierSignaturePair struct{}

func (_ FfiDestroyerIdentifierSignaturePair) Destroy(value IdentifierSignaturePair) {
	value.Destroy()
}

type IncomingChange struct {
	NewState Record
	OldState *Record
}

func (r *IncomingChange) Destroy() {
	FfiDestroyerRecord{}.Destroy(r.NewState)
	FfiDestroyerOptionalRecord{}.Destroy(r.OldState)
}

type FfiConverterIncomingChange struct{}

var FfiConverterIncomingChangeINSTANCE = FfiConverterIncomingChange{}

func (c FfiConverterIncomingChange) Lift(rb RustBufferI) IncomingChange {
	return LiftFromRustBuffer[IncomingChange](c, rb)
}

func (c FfiConverterIncomingChange) Read(reader io.Reader) IncomingChange {
	return IncomingChange{
		FfiConverterRecordINSTANCE.Read(reader),
		FfiConverterOptionalRecordINSTANCE.Read(reader),
	}
}

func (c FfiConverterIncomingChange) Lower(value IncomingChange) C.RustBuffer {
	return LowerIntoRustBuffer[IncomingChange](c, value)
}

func (c FfiConverterIncomingChange) LowerExternal(value IncomingChange) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[IncomingChange](c, value))
}

func (c FfiConverterIncomingChange) Write(writer io.Writer, value IncomingChange) {
	FfiConverterRecordINSTANCE.Write(writer, value.NewState)
	FfiConverterOptionalRecordINSTANCE.Write(writer, value.OldState)
}

type FfiDestroyerIncomingChange struct{}

func (_ FfiDestroyerIncomingChange) Destroy(value IncomingChange) {
	value.Destroy()
}

// Configuration for key set derivation.
//
// This struct encapsulates the parameters needed for BIP32 key derivation.
type KeySetConfig struct {
	// The key set type which determines the derivation path
	KeySetType KeySetType
	// Controls the structure of the BIP derivation path
	UseAddressIndex bool
	// Optional account number for key derivation
	AccountNumber *uint32
}

func (r *KeySetConfig) Destroy() {
	FfiDestroyerKeySetType{}.Destroy(r.KeySetType)
	FfiDestroyerBool{}.Destroy(r.UseAddressIndex)
	FfiDestroyerOptionalUint32{}.Destroy(r.AccountNumber)
}

type FfiConverterKeySetConfig struct{}

var FfiConverterKeySetConfigINSTANCE = FfiConverterKeySetConfig{}

func (c FfiConverterKeySetConfig) Lift(rb RustBufferI) KeySetConfig {
	return LiftFromRustBuffer[KeySetConfig](c, rb)
}

func (c FfiConverterKeySetConfig) Read(reader io.Reader) KeySetConfig {
	return KeySetConfig{
		FfiConverterKeySetTypeINSTANCE.Read(reader),
		FfiConverterBoolINSTANCE.Read(reader),
		FfiConverterOptionalUint32INSTANCE.Read(reader),
	}
}

func (c FfiConverterKeySetConfig) Lower(value KeySetConfig) C.RustBuffer {
	return LowerIntoRustBuffer[KeySetConfig](c, value)
}

func (c FfiConverterKeySetConfig) LowerExternal(value KeySetConfig) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[KeySetConfig](c, value))
}

func (c FfiConverterKeySetConfig) Write(writer io.Writer, value KeySetConfig) {
	FfiConverterKeySetTypeINSTANCE.Write(writer, value.KeySetType)
	FfiConverterBoolINSTANCE.Write(writer, value.UseAddressIndex)
	FfiConverterOptionalUint32INSTANCE.Write(writer, value.AccountNumber)
}

type FfiDestroyerKeySetConfig struct{}

func (_ FfiDestroyerKeySetConfig) Destroy(value KeySetConfig) {
	value.Destroy()
}

type LightningAddressDetails struct {
	Address    string
	PayRequest LnurlPayRequestDetails
}

func (r *LightningAddressDetails) Destroy() {
	FfiDestroyerString{}.Destroy(r.Address)
	FfiDestroyerLnurlPayRequestDetails{}.Destroy(r.PayRequest)
}

type FfiConverterLightningAddressDetails struct{}

var FfiConverterLightningAddressDetailsINSTANCE = FfiConverterLightningAddressDetails{}

func (c FfiConverterLightningAddressDetails) Lift(rb RustBufferI) LightningAddressDetails {
	return LiftFromRustBuffer[LightningAddressDetails](c, rb)
}

func (c FfiConverterLightningAddressDetails) Read(reader io.Reader) LightningAddressDetails {
	return LightningAddressDetails{
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterLnurlPayRequestDetailsINSTANCE.Read(reader),
	}
}

func (c FfiConverterLightningAddressDetails) Lower(value LightningAddressDetails) C.RustBuffer {
	return LowerIntoRustBuffer[LightningAddressDetails](c, value)
}

func (c FfiConverterLightningAddressDetails) LowerExternal(value LightningAddressDetails) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[LightningAddressDetails](c, value))
}

func (c FfiConverterLightningAddressDetails) Write(writer io.Writer, value LightningAddressDetails) {
	FfiConverterStringINSTANCE.Write(writer, value.Address)
	FfiConverterLnurlPayRequestDetailsINSTANCE.Write(writer, value.PayRequest)
}

type FfiDestroyerLightningAddressDetails struct{}

func (_ FfiDestroyerLightningAddressDetails) Destroy(value LightningAddressDetails) {
	value.Destroy()
}

type LightningAddressInfo struct {
	Description      string
	LightningAddress string
	Lnurl            LnurlInfo
	Username         string
}

func (r *LightningAddressInfo) Destroy() {
	FfiDestroyerString{}.Destroy(r.Description)
	FfiDestroyerString{}.Destroy(r.LightningAddress)
	FfiDestroyerLnurlInfo{}.Destroy(r.Lnurl)
	FfiDestroyerString{}.Destroy(r.Username)
}

type FfiConverterLightningAddressInfo struct{}

var FfiConverterLightningAddressInfoINSTANCE = FfiConverterLightningAddressInfo{}

func (c FfiConverterLightningAddressInfo) Lift(rb RustBufferI) LightningAddressInfo {
	return LiftFromRustBuffer[LightningAddressInfo](c, rb)
}

func (c FfiConverterLightningAddressInfo) Read(reader io.Reader) LightningAddressInfo {
	return LightningAddressInfo{
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterLnurlInfoINSTANCE.Read(reader),
		FfiConverterStringINSTANCE.Read(reader),
	}
}

func (c FfiConverterLightningAddressInfo) Lower(value LightningAddressInfo) C.RustBuffer {
	return LowerIntoRustBuffer[LightningAddressInfo](c, value)
}

func (c FfiConverterLightningAddressInfo) LowerExternal(value LightningAddressInfo) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[LightningAddressInfo](c, value))
}

func (c FfiConverterLightningAddressInfo) Write(writer io.Writer, value LightningAddressInfo) {
	FfiConverterStringINSTANCE.Write(writer, value.Description)
	FfiConverterStringINSTANCE.Write(writer, value.LightningAddress)
	FfiConverterLnurlInfoINSTANCE.Write(writer, value.Lnurl)
	FfiConverterStringINSTANCE.Write(writer, value.Username)
}

type FfiDestroyerLightningAddressInfo struct{}

func (_ FfiDestroyerLightningAddressInfo) Destroy(value LightningAddressInfo) {
	value.Destroy()
}

// Request to list contacts with optional pagination.
type ListContactsRequest struct {
	Offset *uint32
	Limit  *uint32
}

func (r *ListContactsRequest) Destroy() {
	FfiDestroyerOptionalUint32{}.Destroy(r.Offset)
	FfiDestroyerOptionalUint32{}.Destroy(r.Limit)
}

type FfiConverterListContactsRequest struct{}

var FfiConverterListContactsRequestINSTANCE = FfiConverterListContactsRequest{}

func (c FfiConverterListContactsRequest) Lift(rb RustBufferI) ListContactsRequest {
	return LiftFromRustBuffer[ListContactsRequest](c, rb)
}

func (c FfiConverterListContactsRequest) Read(reader io.Reader) ListContactsRequest {
	return ListContactsRequest{
		FfiConverterOptionalUint32INSTANCE.Read(reader),
		FfiConverterOptionalUint32INSTANCE.Read(reader),
	}
}

func (c FfiConverterListContactsRequest) Lower(value ListContactsRequest) C.RustBuffer {
	return LowerIntoRustBuffer[ListContactsRequest](c, value)
}

func (c FfiConverterListContactsRequest) LowerExternal(value ListContactsRequest) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[ListContactsRequest](c, value))
}

func (c FfiConverterListContactsRequest) Write(writer io.Writer, value ListContactsRequest) {
	FfiConverterOptionalUint32INSTANCE.Write(writer, value.Offset)
	FfiConverterOptionalUint32INSTANCE.Write(writer, value.Limit)
}

type FfiDestroyerListContactsRequest struct{}

func (_ FfiDestroyerListContactsRequest) Destroy(value ListContactsRequest) {
	value.Destroy()
}

// Response from listing fiat currencies
type ListFiatCurrenciesResponse struct {
	// The list of fiat currencies
	Currencies []FiatCurrency
}

func (r *ListFiatCurrenciesResponse) Destroy() {
	FfiDestroyerSequenceFiatCurrency{}.Destroy(r.Currencies)
}

type FfiConverterListFiatCurrenciesResponse struct{}

var FfiConverterListFiatCurrenciesResponseINSTANCE = FfiConverterListFiatCurrenciesResponse{}

func (c FfiConverterListFiatCurrenciesResponse) Lift(rb RustBufferI) ListFiatCurrenciesResponse {
	return LiftFromRustBuffer[ListFiatCurrenciesResponse](c, rb)
}

func (c FfiConverterListFiatCurrenciesResponse) Read(reader io.Reader) ListFiatCurrenciesResponse {
	return ListFiatCurrenciesResponse{
		FfiConverterSequenceFiatCurrencyINSTANCE.Read(reader),
	}
}

func (c FfiConverterListFiatCurrenciesResponse) Lower(value ListFiatCurrenciesResponse) C.RustBuffer {
	return LowerIntoRustBuffer[ListFiatCurrenciesResponse](c, value)
}

func (c FfiConverterListFiatCurrenciesResponse) LowerExternal(value ListFiatCurrenciesResponse) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[ListFiatCurrenciesResponse](c, value))
}

func (c FfiConverterListFiatCurrenciesResponse) Write(writer io.Writer, value ListFiatCurrenciesResponse) {
	FfiConverterSequenceFiatCurrencyINSTANCE.Write(writer, value.Currencies)
}

type FfiDestroyerListFiatCurrenciesResponse struct{}

func (_ FfiDestroyerListFiatCurrenciesResponse) Destroy(value ListFiatCurrenciesResponse) {
	value.Destroy()
}

// Response from listing fiat rates
type ListFiatRatesResponse struct {
	// The list of fiat rates
	Rates []Rate
}

func (r *ListFiatRatesResponse) Destroy() {
	FfiDestroyerSequenceRate{}.Destroy(r.Rates)
}

type FfiConverterListFiatRatesResponse struct{}

var FfiConverterListFiatRatesResponseINSTANCE = FfiConverterListFiatRatesResponse{}

func (c FfiConverterListFiatRatesResponse) Lift(rb RustBufferI) ListFiatRatesResponse {
	return LiftFromRustBuffer[ListFiatRatesResponse](c, rb)
}

func (c FfiConverterListFiatRatesResponse) Read(reader io.Reader) ListFiatRatesResponse {
	return ListFiatRatesResponse{
		FfiConverterSequenceRateINSTANCE.Read(reader),
	}
}

func (c FfiConverterListFiatRatesResponse) Lower(value ListFiatRatesResponse) C.RustBuffer {
	return LowerIntoRustBuffer[ListFiatRatesResponse](c, value)
}

func (c FfiConverterListFiatRatesResponse) LowerExternal(value ListFiatRatesResponse) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[ListFiatRatesResponse](c, value))
}

func (c FfiConverterListFiatRatesResponse) Write(writer io.Writer, value ListFiatRatesResponse) {
	FfiConverterSequenceRateINSTANCE.Write(writer, value.Rates)
}

type FfiDestroyerListFiatRatesResponse struct{}

func (_ FfiDestroyerListFiatRatesResponse) Destroy(value ListFiatRatesResponse) {
	value.Destroy()
}

// Request to list payments with optional filters and pagination
type ListPaymentsRequest struct {
	TypeFilter   *[]PaymentType
	StatusFilter *[]PaymentStatus
	AssetFilter  *AssetFilter
	// Only include payments matching at least one of these payment details filters
	PaymentDetailsFilter *[]PaymentDetailsFilter
	// Only include payments created after this timestamp (inclusive)
	FromTimestamp *uint64
	// Only include payments created before this timestamp (exclusive)
	ToTimestamp *uint64
	// Number of records to skip
	Offset *uint32
	// Maximum number of records to return
	Limit         *uint32
	SortAscending *bool
}

func (r *ListPaymentsRequest) Destroy() {
	FfiDestroyerOptionalSequencePaymentType{}.Destroy(r.TypeFilter)
	FfiDestroyerOptionalSequencePaymentStatus{}.Destroy(r.StatusFilter)
	FfiDestroyerOptionalAssetFilter{}.Destroy(r.AssetFilter)
	FfiDestroyerOptionalSequencePaymentDetailsFilter{}.Destroy(r.PaymentDetailsFilter)
	FfiDestroyerOptionalUint64{}.Destroy(r.FromTimestamp)
	FfiDestroyerOptionalUint64{}.Destroy(r.ToTimestamp)
	FfiDestroyerOptionalUint32{}.Destroy(r.Offset)
	FfiDestroyerOptionalUint32{}.Destroy(r.Limit)
	FfiDestroyerOptionalBool{}.Destroy(r.SortAscending)
}

type FfiConverterListPaymentsRequest struct{}

var FfiConverterListPaymentsRequestINSTANCE = FfiConverterListPaymentsRequest{}

func (c FfiConverterListPaymentsRequest) Lift(rb RustBufferI) ListPaymentsRequest {
	return LiftFromRustBuffer[ListPaymentsRequest](c, rb)
}

func (c FfiConverterListPaymentsRequest) Read(reader io.Reader) ListPaymentsRequest {
	return ListPaymentsRequest{
		FfiConverterOptionalSequencePaymentTypeINSTANCE.Read(reader),
		FfiConverterOptionalSequencePaymentStatusINSTANCE.Read(reader),
		FfiConverterOptionalAssetFilterINSTANCE.Read(reader),
		FfiConverterOptionalSequencePaymentDetailsFilterINSTANCE.Read(reader),
		FfiConverterOptionalUint64INSTANCE.Read(reader),
		FfiConverterOptionalUint64INSTANCE.Read(reader),
		FfiConverterOptionalUint32INSTANCE.Read(reader),
		FfiConverterOptionalUint32INSTANCE.Read(reader),
		FfiConverterOptionalBoolINSTANCE.Read(reader),
	}
}

func (c FfiConverterListPaymentsRequest) Lower(value ListPaymentsRequest) C.RustBuffer {
	return LowerIntoRustBuffer[ListPaymentsRequest](c, value)
}

func (c FfiConverterListPaymentsRequest) LowerExternal(value ListPaymentsRequest) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[ListPaymentsRequest](c, value))
}

func (c FfiConverterListPaymentsRequest) Write(writer io.Writer, value ListPaymentsRequest) {
	FfiConverterOptionalSequencePaymentTypeINSTANCE.Write(writer, value.TypeFilter)
	FfiConverterOptionalSequencePaymentStatusINSTANCE.Write(writer, value.StatusFilter)
	FfiConverterOptionalAssetFilterINSTANCE.Write(writer, value.AssetFilter)
	FfiConverterOptionalSequencePaymentDetailsFilterINSTANCE.Write(writer, value.PaymentDetailsFilter)
	FfiConverterOptionalUint64INSTANCE.Write(writer, value.FromTimestamp)
	FfiConverterOptionalUint64INSTANCE.Write(writer, value.ToTimestamp)
	FfiConverterOptionalUint32INSTANCE.Write(writer, value.Offset)
	FfiConverterOptionalUint32INSTANCE.Write(writer, value.Limit)
	FfiConverterOptionalBoolINSTANCE.Write(writer, value.SortAscending)
}

type FfiDestroyerListPaymentsRequest struct{}

func (_ FfiDestroyerListPaymentsRequest) Destroy(value ListPaymentsRequest) {
	value.Destroy()
}

// Response from listing payments
type ListPaymentsResponse struct {
	// The list of payments
	Payments []Payment
}

func (r *ListPaymentsResponse) Destroy() {
	FfiDestroyerSequencePayment{}.Destroy(r.Payments)
}

type FfiConverterListPaymentsResponse struct{}

var FfiConverterListPaymentsResponseINSTANCE = FfiConverterListPaymentsResponse{}

func (c FfiConverterListPaymentsResponse) Lift(rb RustBufferI) ListPaymentsResponse {
	return LiftFromRustBuffer[ListPaymentsResponse](c, rb)
}

func (c FfiConverterListPaymentsResponse) Read(reader io.Reader) ListPaymentsResponse {
	return ListPaymentsResponse{
		FfiConverterSequencePaymentINSTANCE.Read(reader),
	}
}

func (c FfiConverterListPaymentsResponse) Lower(value ListPaymentsResponse) C.RustBuffer {
	return LowerIntoRustBuffer[ListPaymentsResponse](c, value)
}

func (c FfiConverterListPaymentsResponse) LowerExternal(value ListPaymentsResponse) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[ListPaymentsResponse](c, value))
}

func (c FfiConverterListPaymentsResponse) Write(writer io.Writer, value ListPaymentsResponse) {
	FfiConverterSequencePaymentINSTANCE.Write(writer, value.Payments)
}

type FfiDestroyerListPaymentsResponse struct{}

func (_ FfiDestroyerListPaymentsResponse) Destroy(value ListPaymentsResponse) {
	value.Destroy()
}

type ListUnclaimedDepositsRequest struct {
}

func (r *ListUnclaimedDepositsRequest) Destroy() {
}

type FfiConverterListUnclaimedDepositsRequest struct{}

var FfiConverterListUnclaimedDepositsRequestINSTANCE = FfiConverterListUnclaimedDepositsRequest{}

func (c FfiConverterListUnclaimedDepositsRequest) Lift(rb RustBufferI) ListUnclaimedDepositsRequest {
	return LiftFromRustBuffer[ListUnclaimedDepositsRequest](c, rb)
}

func (c FfiConverterListUnclaimedDepositsRequest) Read(reader io.Reader) ListUnclaimedDepositsRequest {
	return ListUnclaimedDepositsRequest{}
}

func (c FfiConverterListUnclaimedDepositsRequest) Lower(value ListUnclaimedDepositsRequest) C.RustBuffer {
	return LowerIntoRustBuffer[ListUnclaimedDepositsRequest](c, value)
}

func (c FfiConverterListUnclaimedDepositsRequest) LowerExternal(value ListUnclaimedDepositsRequest) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[ListUnclaimedDepositsRequest](c, value))
}

func (c FfiConverterListUnclaimedDepositsRequest) Write(writer io.Writer, value ListUnclaimedDepositsRequest) {
}

type FfiDestroyerListUnclaimedDepositsRequest struct{}

func (_ FfiDestroyerListUnclaimedDepositsRequest) Destroy(value ListUnclaimedDepositsRequest) {
	value.Destroy()
}

type ListUnclaimedDepositsResponse struct {
	Deposits []DepositInfo
}

func (r *ListUnclaimedDepositsResponse) Destroy() {
	FfiDestroyerSequenceDepositInfo{}.Destroy(r.Deposits)
}

type FfiConverterListUnclaimedDepositsResponse struct{}

var FfiConverterListUnclaimedDepositsResponseINSTANCE = FfiConverterListUnclaimedDepositsResponse{}

func (c FfiConverterListUnclaimedDepositsResponse) Lift(rb RustBufferI) ListUnclaimedDepositsResponse {
	return LiftFromRustBuffer[ListUnclaimedDepositsResponse](c, rb)
}

func (c FfiConverterListUnclaimedDepositsResponse) Read(reader io.Reader) ListUnclaimedDepositsResponse {
	return ListUnclaimedDepositsResponse{
		FfiConverterSequenceDepositInfoINSTANCE.Read(reader),
	}
}

func (c FfiConverterListUnclaimedDepositsResponse) Lower(value ListUnclaimedDepositsResponse) C.RustBuffer {
	return LowerIntoRustBuffer[ListUnclaimedDepositsResponse](c, value)
}

func (c FfiConverterListUnclaimedDepositsResponse) LowerExternal(value ListUnclaimedDepositsResponse) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[ListUnclaimedDepositsResponse](c, value))
}

func (c FfiConverterListUnclaimedDepositsResponse) Write(writer io.Writer, value ListUnclaimedDepositsResponse) {
	FfiConverterSequenceDepositInfoINSTANCE.Write(writer, value.Deposits)
}

type FfiDestroyerListUnclaimedDepositsResponse struct{}

func (_ FfiDestroyerListUnclaimedDepositsResponse) Destroy(value ListUnclaimedDepositsResponse) {
	value.Destroy()
}

// Wrapped in a [`InputType::LnurlAuth`], this is the result of [`parse`](breez_sdk_common::input::parse) when given a LNURL-auth endpoint.
//
// It represents the endpoint's parameters for the LNURL workflow.
//
// See <https://github.com/lnurl/luds/blob/luds/04.md>
type LnurlAuthRequestDetails struct {
	// Hex encoded 32 bytes of challenge
	K1 string
	// When available, one of: register, login, link, auth
	Action *string
	// Indicates the domain of the LNURL-auth service, to be shown to the user when asking for
	// auth confirmation, as per LUD-04 spec.
	Domain string
	// Indicates the URL of the LNURL-auth service, including the query arguments. This will be
	// extended with the signed challenge and the linking key, then called in the second step of the workflow.
	Url string
}

func (r *LnurlAuthRequestDetails) Destroy() {
	FfiDestroyerString{}.Destroy(r.K1)
	FfiDestroyerOptionalString{}.Destroy(r.Action)
	FfiDestroyerString{}.Destroy(r.Domain)
	FfiDestroyerString{}.Destroy(r.Url)
}

type FfiConverterLnurlAuthRequestDetails struct{}

var FfiConverterLnurlAuthRequestDetailsINSTANCE = FfiConverterLnurlAuthRequestDetails{}

func (c FfiConverterLnurlAuthRequestDetails) Lift(rb RustBufferI) LnurlAuthRequestDetails {
	return LiftFromRustBuffer[LnurlAuthRequestDetails](c, rb)
}

func (c FfiConverterLnurlAuthRequestDetails) Read(reader io.Reader) LnurlAuthRequestDetails {
	return LnurlAuthRequestDetails{
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterOptionalStringINSTANCE.Read(reader),
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterStringINSTANCE.Read(reader),
	}
}

func (c FfiConverterLnurlAuthRequestDetails) Lower(value LnurlAuthRequestDetails) C.RustBuffer {
	return LowerIntoRustBuffer[LnurlAuthRequestDetails](c, value)
}

func (c FfiConverterLnurlAuthRequestDetails) LowerExternal(value LnurlAuthRequestDetails) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[LnurlAuthRequestDetails](c, value))
}

func (c FfiConverterLnurlAuthRequestDetails) Write(writer io.Writer, value LnurlAuthRequestDetails) {
	FfiConverterStringINSTANCE.Write(writer, value.K1)
	FfiConverterOptionalStringINSTANCE.Write(writer, value.Action)
	FfiConverterStringINSTANCE.Write(writer, value.Domain)
	FfiConverterStringINSTANCE.Write(writer, value.Url)
}

type FfiDestroyerLnurlAuthRequestDetails struct{}

func (_ FfiDestroyerLnurlAuthRequestDetails) Destroy(value LnurlAuthRequestDetails) {
	value.Destroy()
}

// LNURL error details
type LnurlErrorDetails struct {
	Reason string
}

func (r *LnurlErrorDetails) Destroy() {
	FfiDestroyerString{}.Destroy(r.Reason)
}

type FfiConverterLnurlErrorDetails struct{}

var FfiConverterLnurlErrorDetailsINSTANCE = FfiConverterLnurlErrorDetails{}

func (c FfiConverterLnurlErrorDetails) Lift(rb RustBufferI) LnurlErrorDetails {
	return LiftFromRustBuffer[LnurlErrorDetails](c, rb)
}

func (c FfiConverterLnurlErrorDetails) Read(reader io.Reader) LnurlErrorDetails {
	return LnurlErrorDetails{
		FfiConverterStringINSTANCE.Read(reader),
	}
}

func (c FfiConverterLnurlErrorDetails) Lower(value LnurlErrorDetails) C.RustBuffer {
	return LowerIntoRustBuffer[LnurlErrorDetails](c, value)
}

func (c FfiConverterLnurlErrorDetails) LowerExternal(value LnurlErrorDetails) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[LnurlErrorDetails](c, value))
}

func (c FfiConverterLnurlErrorDetails) Write(writer io.Writer, value LnurlErrorDetails) {
	FfiConverterStringINSTANCE.Write(writer, value.Reason)
}

type FfiDestroyerLnurlErrorDetails struct{}

func (_ FfiDestroyerLnurlErrorDetails) Destroy(value LnurlErrorDetails) {
	value.Destroy()
}

type LnurlInfo struct {
	Url    string
	Bech32 string
}

func (r *LnurlInfo) Destroy() {
	FfiDestroyerString{}.Destroy(r.Url)
	FfiDestroyerString{}.Destroy(r.Bech32)
}

type FfiConverterLnurlInfo struct{}

var FfiConverterLnurlInfoINSTANCE = FfiConverterLnurlInfo{}

func (c FfiConverterLnurlInfo) Lift(rb RustBufferI) LnurlInfo {
	return LiftFromRustBuffer[LnurlInfo](c, rb)
}

func (c FfiConverterLnurlInfo) Read(reader io.Reader) LnurlInfo {
	return LnurlInfo{
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterStringINSTANCE.Read(reader),
	}
}

func (c FfiConverterLnurlInfo) Lower(value LnurlInfo) C.RustBuffer {
	return LowerIntoRustBuffer[LnurlInfo](c, value)
}

func (c FfiConverterLnurlInfo) LowerExternal(value LnurlInfo) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[LnurlInfo](c, value))
}

func (c FfiConverterLnurlInfo) Write(writer io.Writer, value LnurlInfo) {
	FfiConverterStringINSTANCE.Write(writer, value.Url)
	FfiConverterStringINSTANCE.Write(writer, value.Bech32)
}

type FfiDestroyerLnurlInfo struct{}

func (_ FfiDestroyerLnurlInfo) Destroy(value LnurlInfo) {
	value.Destroy()
}

// Represents the payment LNURL info
type LnurlPayInfo struct {
	LnAddress              *string
	Comment                *string
	Domain                 *string
	Metadata               *string
	ProcessedSuccessAction *SuccessActionProcessed
	RawSuccessAction       *SuccessAction
}

func (r *LnurlPayInfo) Destroy() {
	FfiDestroyerOptionalString{}.Destroy(r.LnAddress)
	FfiDestroyerOptionalString{}.Destroy(r.Comment)
	FfiDestroyerOptionalString{}.Destroy(r.Domain)
	FfiDestroyerOptionalString{}.Destroy(r.Metadata)
	FfiDestroyerOptionalSuccessActionProcessed{}.Destroy(r.ProcessedSuccessAction)
	FfiDestroyerOptionalSuccessAction{}.Destroy(r.RawSuccessAction)
}

type FfiConverterLnurlPayInfo struct{}

var FfiConverterLnurlPayInfoINSTANCE = FfiConverterLnurlPayInfo{}

func (c FfiConverterLnurlPayInfo) Lift(rb RustBufferI) LnurlPayInfo {
	return LiftFromRustBuffer[LnurlPayInfo](c, rb)
}

func (c FfiConverterLnurlPayInfo) Read(reader io.Reader) LnurlPayInfo {
	return LnurlPayInfo{
		FfiConverterOptionalStringINSTANCE.Read(reader),
		FfiConverterOptionalStringINSTANCE.Read(reader),
		FfiConverterOptionalStringINSTANCE.Read(reader),
		FfiConverterOptionalStringINSTANCE.Read(reader),
		FfiConverterOptionalSuccessActionProcessedINSTANCE.Read(reader),
		FfiConverterOptionalSuccessActionINSTANCE.Read(reader),
	}
}

func (c FfiConverterLnurlPayInfo) Lower(value LnurlPayInfo) C.RustBuffer {
	return LowerIntoRustBuffer[LnurlPayInfo](c, value)
}

func (c FfiConverterLnurlPayInfo) LowerExternal(value LnurlPayInfo) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[LnurlPayInfo](c, value))
}

func (c FfiConverterLnurlPayInfo) Write(writer io.Writer, value LnurlPayInfo) {
	FfiConverterOptionalStringINSTANCE.Write(writer, value.LnAddress)
	FfiConverterOptionalStringINSTANCE.Write(writer, value.Comment)
	FfiConverterOptionalStringINSTANCE.Write(writer, value.Domain)
	FfiConverterOptionalStringINSTANCE.Write(writer, value.Metadata)
	FfiConverterOptionalSuccessActionProcessedINSTANCE.Write(writer, value.ProcessedSuccessAction)
	FfiConverterOptionalSuccessActionINSTANCE.Write(writer, value.RawSuccessAction)
}

type FfiDestroyerLnurlPayInfo struct{}

func (_ FfiDestroyerLnurlPayInfo) Destroy(value LnurlPayInfo) {
	value.Destroy()
}

type LnurlPayRequest struct {
	PrepareResponse PrepareLnurlPayResponse
	// If set, providing the same idempotency key for multiple requests will ensure that only one
	// payment is made. If an idempotency key is re-used, the same payment will be returned.
	// The idempotency key must be a valid UUID.
	IdempotencyKey *string
}

func (r *LnurlPayRequest) Destroy() {
	FfiDestroyerPrepareLnurlPayResponse{}.Destroy(r.PrepareResponse)
	FfiDestroyerOptionalString{}.Destroy(r.IdempotencyKey)
}

type FfiConverterLnurlPayRequest struct{}

var FfiConverterLnurlPayRequestINSTANCE = FfiConverterLnurlPayRequest{}

func (c FfiConverterLnurlPayRequest) Lift(rb RustBufferI) LnurlPayRequest {
	return LiftFromRustBuffer[LnurlPayRequest](c, rb)
}

func (c FfiConverterLnurlPayRequest) Read(reader io.Reader) LnurlPayRequest {
	return LnurlPayRequest{
		FfiConverterPrepareLnurlPayResponseINSTANCE.Read(reader),
		FfiConverterOptionalStringINSTANCE.Read(reader),
	}
}

func (c FfiConverterLnurlPayRequest) Lower(value LnurlPayRequest) C.RustBuffer {
	return LowerIntoRustBuffer[LnurlPayRequest](c, value)
}

func (c FfiConverterLnurlPayRequest) LowerExternal(value LnurlPayRequest) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[LnurlPayRequest](c, value))
}

func (c FfiConverterLnurlPayRequest) Write(writer io.Writer, value LnurlPayRequest) {
	FfiConverterPrepareLnurlPayResponseINSTANCE.Write(writer, value.PrepareResponse)
	FfiConverterOptionalStringINSTANCE.Write(writer, value.IdempotencyKey)
}

type FfiDestroyerLnurlPayRequest struct{}

func (_ FfiDestroyerLnurlPayRequest) Destroy(value LnurlPayRequest) {
	value.Destroy()
}

type LnurlPayRequestDetails struct {
	Callback string
	// The minimum amount, in millisats, that this LNURL-pay endpoint accepts
	MinSendable uint64
	// The maximum amount, in millisats, that this LNURL-pay endpoint accepts
	MaxSendable uint64
	// As per LUD-06, `metadata` is a raw string (e.g. a json representation of the inner map).
	// Use `metadata_vec()` to get the parsed items.
	MetadataStr string
	// The comment length accepted by this endpoint
	//
	// See <https://github.com/lnurl/luds/blob/luds/12.md>
	CommentAllowed uint16
	// Indicates the domain of the LNURL-pay service, to be shown to the user when asking for
	// payment input, as per LUD-06 spec.
	//
	// Note: this is not the domain of the callback, but the domain of the LNURL-pay endpoint.
	Domain string
	Url    string
	// Optional lightning address if that was used to resolve the lnurl.
	Address *string
	// Value indicating whether the recipient supports Nostr Zaps through NIP-57.
	//
	// See <https://github.com/nostr-protocol/nips/blob/master/57.md>
	AllowsNostr *bool
	// Optional recipient's lnurl provider's Nostr pubkey for NIP-57. If it exists it should be a
	// valid BIP 340 public key in hex.
	//
	// See <https://github.com/nostr-protocol/nips/blob/master/57.md>
	// See <https://github.com/bitcoin/bips/blob/master/bip-0340.mediawiki>
	NostrPubkey *string
}

func (r *LnurlPayRequestDetails) Destroy() {
	FfiDestroyerString{}.Destroy(r.Callback)
	FfiDestroyerUint64{}.Destroy(r.MinSendable)
	FfiDestroyerUint64{}.Destroy(r.MaxSendable)
	FfiDestroyerString{}.Destroy(r.MetadataStr)
	FfiDestroyerUint16{}.Destroy(r.CommentAllowed)
	FfiDestroyerString{}.Destroy(r.Domain)
	FfiDestroyerString{}.Destroy(r.Url)
	FfiDestroyerOptionalString{}.Destroy(r.Address)
	FfiDestroyerOptionalBool{}.Destroy(r.AllowsNostr)
	FfiDestroyerOptionalString{}.Destroy(r.NostrPubkey)
}

type FfiConverterLnurlPayRequestDetails struct{}

var FfiConverterLnurlPayRequestDetailsINSTANCE = FfiConverterLnurlPayRequestDetails{}

func (c FfiConverterLnurlPayRequestDetails) Lift(rb RustBufferI) LnurlPayRequestDetails {
	return LiftFromRustBuffer[LnurlPayRequestDetails](c, rb)
}

func (c FfiConverterLnurlPayRequestDetails) Read(reader io.Reader) LnurlPayRequestDetails {
	return LnurlPayRequestDetails{
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterUint64INSTANCE.Read(reader),
		FfiConverterUint64INSTANCE.Read(reader),
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterUint16INSTANCE.Read(reader),
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterOptionalStringINSTANCE.Read(reader),
		FfiConverterOptionalBoolINSTANCE.Read(reader),
		FfiConverterOptionalStringINSTANCE.Read(reader),
	}
}

func (c FfiConverterLnurlPayRequestDetails) Lower(value LnurlPayRequestDetails) C.RustBuffer {
	return LowerIntoRustBuffer[LnurlPayRequestDetails](c, value)
}

func (c FfiConverterLnurlPayRequestDetails) LowerExternal(value LnurlPayRequestDetails) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[LnurlPayRequestDetails](c, value))
}

func (c FfiConverterLnurlPayRequestDetails) Write(writer io.Writer, value LnurlPayRequestDetails) {
	FfiConverterStringINSTANCE.Write(writer, value.Callback)
	FfiConverterUint64INSTANCE.Write(writer, value.MinSendable)
	FfiConverterUint64INSTANCE.Write(writer, value.MaxSendable)
	FfiConverterStringINSTANCE.Write(writer, value.MetadataStr)
	FfiConverterUint16INSTANCE.Write(writer, value.CommentAllowed)
	FfiConverterStringINSTANCE.Write(writer, value.Domain)
	FfiConverterStringINSTANCE.Write(writer, value.Url)
	FfiConverterOptionalStringINSTANCE.Write(writer, value.Address)
	FfiConverterOptionalBoolINSTANCE.Write(writer, value.AllowsNostr)
	FfiConverterOptionalStringINSTANCE.Write(writer, value.NostrPubkey)
}

type FfiDestroyerLnurlPayRequestDetails struct{}

func (_ FfiDestroyerLnurlPayRequestDetails) Destroy(value LnurlPayRequestDetails) {
	value.Destroy()
}

type LnurlPayResponse struct {
	Payment       Payment
	SuccessAction *SuccessActionProcessed
}

func (r *LnurlPayResponse) Destroy() {
	FfiDestroyerPayment{}.Destroy(r.Payment)
	FfiDestroyerOptionalSuccessActionProcessed{}.Destroy(r.SuccessAction)
}

type FfiConverterLnurlPayResponse struct{}

var FfiConverterLnurlPayResponseINSTANCE = FfiConverterLnurlPayResponse{}

func (c FfiConverterLnurlPayResponse) Lift(rb RustBufferI) LnurlPayResponse {
	return LiftFromRustBuffer[LnurlPayResponse](c, rb)
}

func (c FfiConverterLnurlPayResponse) Read(reader io.Reader) LnurlPayResponse {
	return LnurlPayResponse{
		FfiConverterPaymentINSTANCE.Read(reader),
		FfiConverterOptionalSuccessActionProcessedINSTANCE.Read(reader),
	}
}

func (c FfiConverterLnurlPayResponse) Lower(value LnurlPayResponse) C.RustBuffer {
	return LowerIntoRustBuffer[LnurlPayResponse](c, value)
}

func (c FfiConverterLnurlPayResponse) LowerExternal(value LnurlPayResponse) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[LnurlPayResponse](c, value))
}

func (c FfiConverterLnurlPayResponse) Write(writer io.Writer, value LnurlPayResponse) {
	FfiConverterPaymentINSTANCE.Write(writer, value.Payment)
	FfiConverterOptionalSuccessActionProcessedINSTANCE.Write(writer, value.SuccessAction)
}

type FfiDestroyerLnurlPayResponse struct{}

func (_ FfiDestroyerLnurlPayResponse) Destroy(value LnurlPayResponse) {
	value.Destroy()
}

type LnurlReceiveMetadata struct {
	NostrZapRequest *string
	NostrZapReceipt *string
	SenderComment   *string
}

func (r *LnurlReceiveMetadata) Destroy() {
	FfiDestroyerOptionalString{}.Destroy(r.NostrZapRequest)
	FfiDestroyerOptionalString{}.Destroy(r.NostrZapReceipt)
	FfiDestroyerOptionalString{}.Destroy(r.SenderComment)
}

type FfiConverterLnurlReceiveMetadata struct{}

var FfiConverterLnurlReceiveMetadataINSTANCE = FfiConverterLnurlReceiveMetadata{}

func (c FfiConverterLnurlReceiveMetadata) Lift(rb RustBufferI) LnurlReceiveMetadata {
	return LiftFromRustBuffer[LnurlReceiveMetadata](c, rb)
}

func (c FfiConverterLnurlReceiveMetadata) Read(reader io.Reader) LnurlReceiveMetadata {
	return LnurlReceiveMetadata{
		FfiConverterOptionalStringINSTANCE.Read(reader),
		FfiConverterOptionalStringINSTANCE.Read(reader),
		FfiConverterOptionalStringINSTANCE.Read(reader),
	}
}

func (c FfiConverterLnurlReceiveMetadata) Lower(value LnurlReceiveMetadata) C.RustBuffer {
	return LowerIntoRustBuffer[LnurlReceiveMetadata](c, value)
}

func (c FfiConverterLnurlReceiveMetadata) LowerExternal(value LnurlReceiveMetadata) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[LnurlReceiveMetadata](c, value))
}

func (c FfiConverterLnurlReceiveMetadata) Write(writer io.Writer, value LnurlReceiveMetadata) {
	FfiConverterOptionalStringINSTANCE.Write(writer, value.NostrZapRequest)
	FfiConverterOptionalStringINSTANCE.Write(writer, value.NostrZapReceipt)
	FfiConverterOptionalStringINSTANCE.Write(writer, value.SenderComment)
}

type FfiDestroyerLnurlReceiveMetadata struct{}

func (_ FfiDestroyerLnurlReceiveMetadata) Destroy(value LnurlReceiveMetadata) {
	value.Destroy()
}

// Represents the withdraw LNURL info
type LnurlWithdrawInfo struct {
	WithdrawUrl string
}

func (r *LnurlWithdrawInfo) Destroy() {
	FfiDestroyerString{}.Destroy(r.WithdrawUrl)
}

type FfiConverterLnurlWithdrawInfo struct{}

var FfiConverterLnurlWithdrawInfoINSTANCE = FfiConverterLnurlWithdrawInfo{}

func (c FfiConverterLnurlWithdrawInfo) Lift(rb RustBufferI) LnurlWithdrawInfo {
	return LiftFromRustBuffer[LnurlWithdrawInfo](c, rb)
}

func (c FfiConverterLnurlWithdrawInfo) Read(reader io.Reader) LnurlWithdrawInfo {
	return LnurlWithdrawInfo{
		FfiConverterStringINSTANCE.Read(reader),
	}
}

func (c FfiConverterLnurlWithdrawInfo) Lower(value LnurlWithdrawInfo) C.RustBuffer {
	return LowerIntoRustBuffer[LnurlWithdrawInfo](c, value)
}

func (c FfiConverterLnurlWithdrawInfo) LowerExternal(value LnurlWithdrawInfo) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[LnurlWithdrawInfo](c, value))
}

func (c FfiConverterLnurlWithdrawInfo) Write(writer io.Writer, value LnurlWithdrawInfo) {
	FfiConverterStringINSTANCE.Write(writer, value.WithdrawUrl)
}

type FfiDestroyerLnurlWithdrawInfo struct{}

func (_ FfiDestroyerLnurlWithdrawInfo) Destroy(value LnurlWithdrawInfo) {
	value.Destroy()
}

type LnurlWithdrawRequest struct {
	// The amount to withdraw in satoshis
	// Must be within the min and max withdrawable limits
	AmountSats      uint64
	WithdrawRequest LnurlWithdrawRequestDetails
	// If set, the function will return the payment if it is still pending after this
	// number of seconds. If unset, the function will return immediately after
	// initiating the LNURL withdraw.
	CompletionTimeoutSecs *uint32
}

func (r *LnurlWithdrawRequest) Destroy() {
	FfiDestroyerUint64{}.Destroy(r.AmountSats)
	FfiDestroyerLnurlWithdrawRequestDetails{}.Destroy(r.WithdrawRequest)
	FfiDestroyerOptionalUint32{}.Destroy(r.CompletionTimeoutSecs)
}

type FfiConverterLnurlWithdrawRequest struct{}

var FfiConverterLnurlWithdrawRequestINSTANCE = FfiConverterLnurlWithdrawRequest{}

func (c FfiConverterLnurlWithdrawRequest) Lift(rb RustBufferI) LnurlWithdrawRequest {
	return LiftFromRustBuffer[LnurlWithdrawRequest](c, rb)
}

func (c FfiConverterLnurlWithdrawRequest) Read(reader io.Reader) LnurlWithdrawRequest {
	return LnurlWithdrawRequest{
		FfiConverterUint64INSTANCE.Read(reader),
		FfiConverterLnurlWithdrawRequestDetailsINSTANCE.Read(reader),
		FfiConverterOptionalUint32INSTANCE.Read(reader),
	}
}

func (c FfiConverterLnurlWithdrawRequest) Lower(value LnurlWithdrawRequest) C.RustBuffer {
	return LowerIntoRustBuffer[LnurlWithdrawRequest](c, value)
}

func (c FfiConverterLnurlWithdrawRequest) LowerExternal(value LnurlWithdrawRequest) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[LnurlWithdrawRequest](c, value))
}

func (c FfiConverterLnurlWithdrawRequest) Write(writer io.Writer, value LnurlWithdrawRequest) {
	FfiConverterUint64INSTANCE.Write(writer, value.AmountSats)
	FfiConverterLnurlWithdrawRequestDetailsINSTANCE.Write(writer, value.WithdrawRequest)
	FfiConverterOptionalUint32INSTANCE.Write(writer, value.CompletionTimeoutSecs)
}

type FfiDestroyerLnurlWithdrawRequest struct{}

func (_ FfiDestroyerLnurlWithdrawRequest) Destroy(value LnurlWithdrawRequest) {
	value.Destroy()
}

type LnurlWithdrawRequestDetails struct {
	Callback           string
	K1                 string
	DefaultDescription string
	// The minimum amount, in millisats, that this LNURL-withdraw endpoint accepts
	MinWithdrawable uint64
	// The maximum amount, in millisats, that this LNURL-withdraw endpoint accepts
	MaxWithdrawable uint64
}

func (r *LnurlWithdrawRequestDetails) Destroy() {
	FfiDestroyerString{}.Destroy(r.Callback)
	FfiDestroyerString{}.Destroy(r.K1)
	FfiDestroyerString{}.Destroy(r.DefaultDescription)
	FfiDestroyerUint64{}.Destroy(r.MinWithdrawable)
	FfiDestroyerUint64{}.Destroy(r.MaxWithdrawable)
}

type FfiConverterLnurlWithdrawRequestDetails struct{}

var FfiConverterLnurlWithdrawRequestDetailsINSTANCE = FfiConverterLnurlWithdrawRequestDetails{}

func (c FfiConverterLnurlWithdrawRequestDetails) Lift(rb RustBufferI) LnurlWithdrawRequestDetails {
	return LiftFromRustBuffer[LnurlWithdrawRequestDetails](c, rb)
}

func (c FfiConverterLnurlWithdrawRequestDetails) Read(reader io.Reader) LnurlWithdrawRequestDetails {
	return LnurlWithdrawRequestDetails{
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterUint64INSTANCE.Read(reader),
		FfiConverterUint64INSTANCE.Read(reader),
	}
}

func (c FfiConverterLnurlWithdrawRequestDetails) Lower(value LnurlWithdrawRequestDetails) C.RustBuffer {
	return LowerIntoRustBuffer[LnurlWithdrawRequestDetails](c, value)
}

func (c FfiConverterLnurlWithdrawRequestDetails) LowerExternal(value LnurlWithdrawRequestDetails) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[LnurlWithdrawRequestDetails](c, value))
}

func (c FfiConverterLnurlWithdrawRequestDetails) Write(writer io.Writer, value LnurlWithdrawRequestDetails) {
	FfiConverterStringINSTANCE.Write(writer, value.Callback)
	FfiConverterStringINSTANCE.Write(writer, value.K1)
	FfiConverterStringINSTANCE.Write(writer, value.DefaultDescription)
	FfiConverterUint64INSTANCE.Write(writer, value.MinWithdrawable)
	FfiConverterUint64INSTANCE.Write(writer, value.MaxWithdrawable)
}

type FfiDestroyerLnurlWithdrawRequestDetails struct{}

func (_ FfiDestroyerLnurlWithdrawRequestDetails) Destroy(value LnurlWithdrawRequestDetails) {
	value.Destroy()
}

type LnurlWithdrawResponse struct {
	// The Lightning invoice generated for the LNURL withdraw
	PaymentRequest string
	Payment        *Payment
}

func (r *LnurlWithdrawResponse) Destroy() {
	FfiDestroyerString{}.Destroy(r.PaymentRequest)
	FfiDestroyerOptionalPayment{}.Destroy(r.Payment)
}

type FfiConverterLnurlWithdrawResponse struct{}

var FfiConverterLnurlWithdrawResponseINSTANCE = FfiConverterLnurlWithdrawResponse{}

func (c FfiConverterLnurlWithdrawResponse) Lift(rb RustBufferI) LnurlWithdrawResponse {
	return LiftFromRustBuffer[LnurlWithdrawResponse](c, rb)
}

func (c FfiConverterLnurlWithdrawResponse) Read(reader io.Reader) LnurlWithdrawResponse {
	return LnurlWithdrawResponse{
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterOptionalPaymentINSTANCE.Read(reader),
	}
}

func (c FfiConverterLnurlWithdrawResponse) Lower(value LnurlWithdrawResponse) C.RustBuffer {
	return LowerIntoRustBuffer[LnurlWithdrawResponse](c, value)
}

func (c FfiConverterLnurlWithdrawResponse) LowerExternal(value LnurlWithdrawResponse) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[LnurlWithdrawResponse](c, value))
}

func (c FfiConverterLnurlWithdrawResponse) Write(writer io.Writer, value LnurlWithdrawResponse) {
	FfiConverterStringINSTANCE.Write(writer, value.PaymentRequest)
	FfiConverterOptionalPaymentINSTANCE.Write(writer, value.Payment)
}

type FfiDestroyerLnurlWithdrawResponse struct{}

func (_ FfiDestroyerLnurlWithdrawResponse) Destroy(value LnurlWithdrawResponse) {
	value.Destroy()
}

// Locale-specific settings for the representation of a currency
type LocaleOverrides struct {
	Locale  string
	Spacing *uint32
	Symbol  Symbol
}

func (r *LocaleOverrides) Destroy() {
	FfiDestroyerString{}.Destroy(r.Locale)
	FfiDestroyerOptionalUint32{}.Destroy(r.Spacing)
	FfiDestroyerSymbol{}.Destroy(r.Symbol)
}

type FfiConverterLocaleOverrides struct{}

var FfiConverterLocaleOverridesINSTANCE = FfiConverterLocaleOverrides{}

func (c FfiConverterLocaleOverrides) Lift(rb RustBufferI) LocaleOverrides {
	return LiftFromRustBuffer[LocaleOverrides](c, rb)
}

func (c FfiConverterLocaleOverrides) Read(reader io.Reader) LocaleOverrides {
	return LocaleOverrides{
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterOptionalUint32INSTANCE.Read(reader),
		FfiConverterSymbolINSTANCE.Read(reader),
	}
}

func (c FfiConverterLocaleOverrides) Lower(value LocaleOverrides) C.RustBuffer {
	return LowerIntoRustBuffer[LocaleOverrides](c, value)
}

func (c FfiConverterLocaleOverrides) LowerExternal(value LocaleOverrides) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[LocaleOverrides](c, value))
}

func (c FfiConverterLocaleOverrides) Write(writer io.Writer, value LocaleOverrides) {
	FfiConverterStringINSTANCE.Write(writer, value.Locale)
	FfiConverterOptionalUint32INSTANCE.Write(writer, value.Spacing)
	FfiConverterSymbolINSTANCE.Write(writer, value.Symbol)
}

type FfiDestroyerLocaleOverrides struct{}

func (_ FfiDestroyerLocaleOverrides) Destroy(value LocaleOverrides) {
	value.Destroy()
}

// Localized name of a currency
type LocalizedName struct {
	Locale string
	Name   string
}

func (r *LocalizedName) Destroy() {
	FfiDestroyerString{}.Destroy(r.Locale)
	FfiDestroyerString{}.Destroy(r.Name)
}

type FfiConverterLocalizedName struct{}

var FfiConverterLocalizedNameINSTANCE = FfiConverterLocalizedName{}

func (c FfiConverterLocalizedName) Lift(rb RustBufferI) LocalizedName {
	return LiftFromRustBuffer[LocalizedName](c, rb)
}

func (c FfiConverterLocalizedName) Read(reader io.Reader) LocalizedName {
	return LocalizedName{
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterStringINSTANCE.Read(reader),
	}
}

func (c FfiConverterLocalizedName) Lower(value LocalizedName) C.RustBuffer {
	return LowerIntoRustBuffer[LocalizedName](c, value)
}

func (c FfiConverterLocalizedName) LowerExternal(value LocalizedName) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[LocalizedName](c, value))
}

func (c FfiConverterLocalizedName) Write(writer io.Writer, value LocalizedName) {
	FfiConverterStringINSTANCE.Write(writer, value.Locale)
	FfiConverterStringINSTANCE.Write(writer, value.Name)
}

type FfiDestroyerLocalizedName struct{}

func (_ FfiDestroyerLocalizedName) Destroy(value LocalizedName) {
	value.Destroy()
}

type LogEntry struct {
	Line  string
	Level string
}

func (r *LogEntry) Destroy() {
	FfiDestroyerString{}.Destroy(r.Line)
	FfiDestroyerString{}.Destroy(r.Level)
}

type FfiConverterLogEntry struct{}

var FfiConverterLogEntryINSTANCE = FfiConverterLogEntry{}

func (c FfiConverterLogEntry) Lift(rb RustBufferI) LogEntry {
	return LiftFromRustBuffer[LogEntry](c, rb)
}

func (c FfiConverterLogEntry) Read(reader io.Reader) LogEntry {
	return LogEntry{
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterStringINSTANCE.Read(reader),
	}
}

func (c FfiConverterLogEntry) Lower(value LogEntry) C.RustBuffer {
	return LowerIntoRustBuffer[LogEntry](c, value)
}

func (c FfiConverterLogEntry) LowerExternal(value LogEntry) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[LogEntry](c, value))
}

func (c FfiConverterLogEntry) Write(writer io.Writer, value LogEntry) {
	FfiConverterStringINSTANCE.Write(writer, value.Line)
	FfiConverterStringINSTANCE.Write(writer, value.Level)
}

type FfiDestroyerLogEntry struct{}

func (_ FfiDestroyerLogEntry) Destroy(value LogEntry) {
	value.Destroy()
}

// FFI-safe representation of a 32-byte message digest for ECDSA signing
type MessageBytes struct {
	Bytes []byte
}

func (r *MessageBytes) Destroy() {
	FfiDestroyerBytes{}.Destroy(r.Bytes)
}

type FfiConverterMessageBytes struct{}

var FfiConverterMessageBytesINSTANCE = FfiConverterMessageBytes{}

func (c FfiConverterMessageBytes) Lift(rb RustBufferI) MessageBytes {
	return LiftFromRustBuffer[MessageBytes](c, rb)
}

func (c FfiConverterMessageBytes) Read(reader io.Reader) MessageBytes {
	return MessageBytes{
		FfiConverterBytesINSTANCE.Read(reader),
	}
}

func (c FfiConverterMessageBytes) Lower(value MessageBytes) C.RustBuffer {
	return LowerIntoRustBuffer[MessageBytes](c, value)
}

func (c FfiConverterMessageBytes) LowerExternal(value MessageBytes) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[MessageBytes](c, value))
}

func (c FfiConverterMessageBytes) Write(writer io.Writer, value MessageBytes) {
	FfiConverterBytesINSTANCE.Write(writer, value.Bytes)
}

type FfiDestroyerMessageBytes struct{}

func (_ FfiDestroyerMessageBytes) Destroy(value MessageBytes) {
	value.Destroy()
}

type MessageSuccessActionData struct {
	Message string
}

func (r *MessageSuccessActionData) Destroy() {
	FfiDestroyerString{}.Destroy(r.Message)
}

type FfiConverterMessageSuccessActionData struct{}

var FfiConverterMessageSuccessActionDataINSTANCE = FfiConverterMessageSuccessActionData{}

func (c FfiConverterMessageSuccessActionData) Lift(rb RustBufferI) MessageSuccessActionData {
	return LiftFromRustBuffer[MessageSuccessActionData](c, rb)
}

func (c FfiConverterMessageSuccessActionData) Read(reader io.Reader) MessageSuccessActionData {
	return MessageSuccessActionData{
		FfiConverterStringINSTANCE.Read(reader),
	}
}

func (c FfiConverterMessageSuccessActionData) Lower(value MessageSuccessActionData) C.RustBuffer {
	return LowerIntoRustBuffer[MessageSuccessActionData](c, value)
}

func (c FfiConverterMessageSuccessActionData) LowerExternal(value MessageSuccessActionData) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[MessageSuccessActionData](c, value))
}

func (c FfiConverterMessageSuccessActionData) Write(writer io.Writer, value MessageSuccessActionData) {
	FfiConverterStringINSTANCE.Write(writer, value.Message)
}

type FfiDestroyerMessageSuccessActionData struct{}

func (_ FfiDestroyerMessageSuccessActionData) Destroy(value MessageSuccessActionData) {
	value.Destroy()
}

type MintIssuerTokenRequest struct {
	Amount u128
}

func (r *MintIssuerTokenRequest) Destroy() {
	FfiDestroyerTypeu128{}.Destroy(r.Amount)
}

type FfiConverterMintIssuerTokenRequest struct{}

var FfiConverterMintIssuerTokenRequestINSTANCE = FfiConverterMintIssuerTokenRequest{}

func (c FfiConverterMintIssuerTokenRequest) Lift(rb RustBufferI) MintIssuerTokenRequest {
	return LiftFromRustBuffer[MintIssuerTokenRequest](c, rb)
}

func (c FfiConverterMintIssuerTokenRequest) Read(reader io.Reader) MintIssuerTokenRequest {
	return MintIssuerTokenRequest{
		FfiConverterTypeu128INSTANCE.Read(reader),
	}
}

func (c FfiConverterMintIssuerTokenRequest) Lower(value MintIssuerTokenRequest) C.RustBuffer {
	return LowerIntoRustBuffer[MintIssuerTokenRequest](c, value)
}

func (c FfiConverterMintIssuerTokenRequest) LowerExternal(value MintIssuerTokenRequest) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[MintIssuerTokenRequest](c, value))
}

func (c FfiConverterMintIssuerTokenRequest) Write(writer io.Writer, value MintIssuerTokenRequest) {
	FfiConverterTypeu128INSTANCE.Write(writer, value.Amount)
}

type FfiDestroyerMintIssuerTokenRequest struct{}

func (_ FfiDestroyerMintIssuerTokenRequest) Destroy(value MintIssuerTokenRequest) {
	value.Destroy()
}

// Configuration for Nostr relay connections used in `Passkey`.
//
// Relay URLs are managed internally by the client:
// - Public relays are always included
// - Breez relay is added when `breez_api_key` is provided (enables NIP-42 auth)
type NostrRelayConfig struct {
	// Optional Breez API key for authenticated access to the Breez relay.
	// When provided, the Breez relay is added and NIP-42 authentication is enabled.
	BreezApiKey *string
	// Connection timeout in seconds. Defaults to 30 when `None`.
	TimeoutSecs *uint32
}

func (r *NostrRelayConfig) Destroy() {
	FfiDestroyerOptionalString{}.Destroy(r.BreezApiKey)
	FfiDestroyerOptionalUint32{}.Destroy(r.TimeoutSecs)
}

type FfiConverterNostrRelayConfig struct{}

var FfiConverterNostrRelayConfigINSTANCE = FfiConverterNostrRelayConfig{}

func (c FfiConverterNostrRelayConfig) Lift(rb RustBufferI) NostrRelayConfig {
	return LiftFromRustBuffer[NostrRelayConfig](c, rb)
}

func (c FfiConverterNostrRelayConfig) Read(reader io.Reader) NostrRelayConfig {
	return NostrRelayConfig{
		FfiConverterOptionalStringINSTANCE.Read(reader),
		FfiConverterOptionalUint32INSTANCE.Read(reader),
	}
}

func (c FfiConverterNostrRelayConfig) Lower(value NostrRelayConfig) C.RustBuffer {
	return LowerIntoRustBuffer[NostrRelayConfig](c, value)
}

func (c FfiConverterNostrRelayConfig) LowerExternal(value NostrRelayConfig) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[NostrRelayConfig](c, value))
}

func (c FfiConverterNostrRelayConfig) Write(writer io.Writer, value NostrRelayConfig) {
	FfiConverterOptionalStringINSTANCE.Write(writer, value.BreezApiKey)
	FfiConverterOptionalUint32INSTANCE.Write(writer, value.TimeoutSecs)
}

type FfiDestroyerNostrRelayConfig struct{}

func (_ FfiDestroyerNostrRelayConfig) Destroy(value NostrRelayConfig) {
	value.Destroy()
}

type OptimizationConfig struct {
	// Whether automatic leaf optimization is enabled.
	//
	// If set to true, the SDK will automatically optimize the leaf set when it changes.
	// Otherwise, the manual optimization API must be used to optimize the leaf set.
	//
	// Default value is true.
	AutoEnabled bool
	// The desired multiplicity for the leaf set.
	//
	// Setting this to 0 will optimize for maximizing unilateral exit.
	// Higher values will optimize for minimizing transfer swaps, with higher values
	// being more aggressive and allowing better TPS rates.
	//
	// For end-user wallets, values of 1-5 are recommended. Values above 5 are
	// intended for high-throughput server environments and are not recommended
	// for end-user wallets due to significantly higher unilateral exit costs.
	//
	// Default value is 1.
	Multiplicity uint8
}

func (r *OptimizationConfig) Destroy() {
	FfiDestroyerBool{}.Destroy(r.AutoEnabled)
	FfiDestroyerUint8{}.Destroy(r.Multiplicity)
}

type FfiConverterOptimizationConfig struct{}

var FfiConverterOptimizationConfigINSTANCE = FfiConverterOptimizationConfig{}

func (c FfiConverterOptimizationConfig) Lift(rb RustBufferI) OptimizationConfig {
	return LiftFromRustBuffer[OptimizationConfig](c, rb)
}

func (c FfiConverterOptimizationConfig) Read(reader io.Reader) OptimizationConfig {
	return OptimizationConfig{
		FfiConverterBoolINSTANCE.Read(reader),
		FfiConverterUint8INSTANCE.Read(reader),
	}
}

func (c FfiConverterOptimizationConfig) Lower(value OptimizationConfig) C.RustBuffer {
	return LowerIntoRustBuffer[OptimizationConfig](c, value)
}

func (c FfiConverterOptimizationConfig) LowerExternal(value OptimizationConfig) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[OptimizationConfig](c, value))
}

func (c FfiConverterOptimizationConfig) Write(writer io.Writer, value OptimizationConfig) {
	FfiConverterBoolINSTANCE.Write(writer, value.AutoEnabled)
	FfiConverterUint8INSTANCE.Write(writer, value.Multiplicity)
}

type FfiDestroyerOptimizationConfig struct{}

func (_ FfiDestroyerOptimizationConfig) Destroy(value OptimizationConfig) {
	value.Destroy()
}

type OptimizationProgress struct {
	IsRunning    bool
	CurrentRound uint32
	TotalRounds  uint32
}

func (r *OptimizationProgress) Destroy() {
	FfiDestroyerBool{}.Destroy(r.IsRunning)
	FfiDestroyerUint32{}.Destroy(r.CurrentRound)
	FfiDestroyerUint32{}.Destroy(r.TotalRounds)
}

type FfiConverterOptimizationProgress struct{}

var FfiConverterOptimizationProgressINSTANCE = FfiConverterOptimizationProgress{}

func (c FfiConverterOptimizationProgress) Lift(rb RustBufferI) OptimizationProgress {
	return LiftFromRustBuffer[OptimizationProgress](c, rb)
}

func (c FfiConverterOptimizationProgress) Read(reader io.Reader) OptimizationProgress {
	return OptimizationProgress{
		FfiConverterBoolINSTANCE.Read(reader),
		FfiConverterUint32INSTANCE.Read(reader),
		FfiConverterUint32INSTANCE.Read(reader),
	}
}

func (c FfiConverterOptimizationProgress) Lower(value OptimizationProgress) C.RustBuffer {
	return LowerIntoRustBuffer[OptimizationProgress](c, value)
}

func (c FfiConverterOptimizationProgress) LowerExternal(value OptimizationProgress) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[OptimizationProgress](c, value))
}

func (c FfiConverterOptimizationProgress) Write(writer io.Writer, value OptimizationProgress) {
	FfiConverterBoolINSTANCE.Write(writer, value.IsRunning)
	FfiConverterUint32INSTANCE.Write(writer, value.CurrentRound)
	FfiConverterUint32INSTANCE.Write(writer, value.TotalRounds)
}

type FfiDestroyerOptimizationProgress struct{}

func (_ FfiDestroyerOptimizationProgress) Destroy(value OptimizationProgress) {
	value.Destroy()
}

type OutgoingChange struct {
	Change RecordChange
	Parent *Record
}

func (r *OutgoingChange) Destroy() {
	FfiDestroyerRecordChange{}.Destroy(r.Change)
	FfiDestroyerOptionalRecord{}.Destroy(r.Parent)
}

type FfiConverterOutgoingChange struct{}

var FfiConverterOutgoingChangeINSTANCE = FfiConverterOutgoingChange{}

func (c FfiConverterOutgoingChange) Lift(rb RustBufferI) OutgoingChange {
	return LiftFromRustBuffer[OutgoingChange](c, rb)
}

func (c FfiConverterOutgoingChange) Read(reader io.Reader) OutgoingChange {
	return OutgoingChange{
		FfiConverterRecordChangeINSTANCE.Read(reader),
		FfiConverterOptionalRecordINSTANCE.Read(reader),
	}
}

func (c FfiConverterOutgoingChange) Lower(value OutgoingChange) C.RustBuffer {
	return LowerIntoRustBuffer[OutgoingChange](c, value)
}

func (c FfiConverterOutgoingChange) LowerExternal(value OutgoingChange) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[OutgoingChange](c, value))
}

func (c FfiConverterOutgoingChange) Write(writer io.Writer, value OutgoingChange) {
	FfiConverterRecordChangeINSTANCE.Write(writer, value.Change)
	FfiConverterOptionalRecordINSTANCE.Write(writer, value.Parent)
}

type FfiDestroyerOutgoingChange struct{}

func (_ FfiDestroyerOutgoingChange) Destroy(value OutgoingChange) {
	value.Destroy()
}

// Represents a payment (sent or received)
type Payment struct {
	// Unique identifier for the payment
	Id string
	// Type of payment (send or receive)
	PaymentType PaymentType
	// Status of the payment
	Status PaymentStatus
	// Amount in satoshis or token base units
	Amount u128
	// Fee paid in satoshis or token base units
	Fees u128
	// Timestamp of when the payment was created
	Timestamp uint64
	// Method of payment. Sometimes the payment details is empty so this field
	// is used to determine the payment method.
	Method PaymentMethod
	// Details of the payment
	Details *PaymentDetails
	// If set, this payment involved a conversion before the payment
	ConversionDetails *ConversionDetails
}

func (r *Payment) Destroy() {
	FfiDestroyerString{}.Destroy(r.Id)
	FfiDestroyerPaymentType{}.Destroy(r.PaymentType)
	FfiDestroyerPaymentStatus{}.Destroy(r.Status)
	FfiDestroyerTypeu128{}.Destroy(r.Amount)
	FfiDestroyerTypeu128{}.Destroy(r.Fees)
	FfiDestroyerUint64{}.Destroy(r.Timestamp)
	FfiDestroyerPaymentMethod{}.Destroy(r.Method)
	FfiDestroyerOptionalPaymentDetails{}.Destroy(r.Details)
	FfiDestroyerOptionalConversionDetails{}.Destroy(r.ConversionDetails)
}

type FfiConverterPayment struct{}

var FfiConverterPaymentINSTANCE = FfiConverterPayment{}

func (c FfiConverterPayment) Lift(rb RustBufferI) Payment {
	return LiftFromRustBuffer[Payment](c, rb)
}

func (c FfiConverterPayment) Read(reader io.Reader) Payment {
	return Payment{
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterPaymentTypeINSTANCE.Read(reader),
		FfiConverterPaymentStatusINSTANCE.Read(reader),
		FfiConverterTypeu128INSTANCE.Read(reader),
		FfiConverterTypeu128INSTANCE.Read(reader),
		FfiConverterUint64INSTANCE.Read(reader),
		FfiConverterPaymentMethodINSTANCE.Read(reader),
		FfiConverterOptionalPaymentDetailsINSTANCE.Read(reader),
		FfiConverterOptionalConversionDetailsINSTANCE.Read(reader),
	}
}

func (c FfiConverterPayment) Lower(value Payment) C.RustBuffer {
	return LowerIntoRustBuffer[Payment](c, value)
}

func (c FfiConverterPayment) LowerExternal(value Payment) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[Payment](c, value))
}

func (c FfiConverterPayment) Write(writer io.Writer, value Payment) {
	FfiConverterStringINSTANCE.Write(writer, value.Id)
	FfiConverterPaymentTypeINSTANCE.Write(writer, value.PaymentType)
	FfiConverterPaymentStatusINSTANCE.Write(writer, value.Status)
	FfiConverterTypeu128INSTANCE.Write(writer, value.Amount)
	FfiConverterTypeu128INSTANCE.Write(writer, value.Fees)
	FfiConverterUint64INSTANCE.Write(writer, value.Timestamp)
	FfiConverterPaymentMethodINSTANCE.Write(writer, value.Method)
	FfiConverterOptionalPaymentDetailsINSTANCE.Write(writer, value.Details)
	FfiConverterOptionalConversionDetailsINSTANCE.Write(writer, value.ConversionDetails)
}

type FfiDestroyerPayment struct{}

func (_ FfiDestroyerPayment) Destroy(value Payment) {
	value.Destroy()
}

// Metadata associated with a payment that cannot be extracted from the Spark operator.
type PaymentMetadata struct {
	ParentPaymentId   *string
	LnurlPayInfo      *LnurlPayInfo
	LnurlWithdrawInfo *LnurlWithdrawInfo
	LnurlDescription  *string
	ConversionInfo    *ConversionInfo
	ConversionStatus  *ConversionStatus
}

func (r *PaymentMetadata) Destroy() {
	FfiDestroyerOptionalString{}.Destroy(r.ParentPaymentId)
	FfiDestroyerOptionalLnurlPayInfo{}.Destroy(r.LnurlPayInfo)
	FfiDestroyerOptionalLnurlWithdrawInfo{}.Destroy(r.LnurlWithdrawInfo)
	FfiDestroyerOptionalString{}.Destroy(r.LnurlDescription)
	FfiDestroyerOptionalConversionInfo{}.Destroy(r.ConversionInfo)
	FfiDestroyerOptionalConversionStatus{}.Destroy(r.ConversionStatus)
}

type FfiConverterPaymentMetadata struct{}

var FfiConverterPaymentMetadataINSTANCE = FfiConverterPaymentMetadata{}

func (c FfiConverterPaymentMetadata) Lift(rb RustBufferI) PaymentMetadata {
	return LiftFromRustBuffer[PaymentMetadata](c, rb)
}

func (c FfiConverterPaymentMetadata) Read(reader io.Reader) PaymentMetadata {
	return PaymentMetadata{
		FfiConverterOptionalStringINSTANCE.Read(reader),
		FfiConverterOptionalLnurlPayInfoINSTANCE.Read(reader),
		FfiConverterOptionalLnurlWithdrawInfoINSTANCE.Read(reader),
		FfiConverterOptionalStringINSTANCE.Read(reader),
		FfiConverterOptionalConversionInfoINSTANCE.Read(reader),
		FfiConverterOptionalConversionStatusINSTANCE.Read(reader),
	}
}

func (c FfiConverterPaymentMetadata) Lower(value PaymentMetadata) C.RustBuffer {
	return LowerIntoRustBuffer[PaymentMetadata](c, value)
}

func (c FfiConverterPaymentMetadata) LowerExternal(value PaymentMetadata) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[PaymentMetadata](c, value))
}

func (c FfiConverterPaymentMetadata) Write(writer io.Writer, value PaymentMetadata) {
	FfiConverterOptionalStringINSTANCE.Write(writer, value.ParentPaymentId)
	FfiConverterOptionalLnurlPayInfoINSTANCE.Write(writer, value.LnurlPayInfo)
	FfiConverterOptionalLnurlWithdrawInfoINSTANCE.Write(writer, value.LnurlWithdrawInfo)
	FfiConverterOptionalStringINSTANCE.Write(writer, value.LnurlDescription)
	FfiConverterOptionalConversionInfoINSTANCE.Write(writer, value.ConversionInfo)
	FfiConverterOptionalConversionStatusINSTANCE.Write(writer, value.ConversionStatus)
}

type FfiDestroyerPaymentMetadata struct{}

func (_ FfiDestroyerPaymentMetadata) Destroy(value PaymentMetadata) {
	value.Destroy()
}

type PaymentRequestSource struct {
	Bip21Uri      *string
	Bip353Address *string
}

func (r *PaymentRequestSource) Destroy() {
	FfiDestroyerOptionalString{}.Destroy(r.Bip21Uri)
	FfiDestroyerOptionalString{}.Destroy(r.Bip353Address)
}

type FfiConverterPaymentRequestSource struct{}

var FfiConverterPaymentRequestSourceINSTANCE = FfiConverterPaymentRequestSource{}

func (c FfiConverterPaymentRequestSource) Lift(rb RustBufferI) PaymentRequestSource {
	return LiftFromRustBuffer[PaymentRequestSource](c, rb)
}

func (c FfiConverterPaymentRequestSource) Read(reader io.Reader) PaymentRequestSource {
	return PaymentRequestSource{
		FfiConverterOptionalStringINSTANCE.Read(reader),
		FfiConverterOptionalStringINSTANCE.Read(reader),
	}
}

func (c FfiConverterPaymentRequestSource) Lower(value PaymentRequestSource) C.RustBuffer {
	return LowerIntoRustBuffer[PaymentRequestSource](c, value)
}

func (c FfiConverterPaymentRequestSource) LowerExternal(value PaymentRequestSource) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[PaymentRequestSource](c, value))
}

func (c FfiConverterPaymentRequestSource) Write(writer io.Writer, value PaymentRequestSource) {
	FfiConverterOptionalStringINSTANCE.Write(writer, value.Bip21Uri)
	FfiConverterOptionalStringINSTANCE.Write(writer, value.Bip353Address)
}

type FfiDestroyerPaymentRequestSource struct{}

func (_ FfiDestroyerPaymentRequestSource) Destroy(value PaymentRequestSource) {
	value.Destroy()
}

// Configuration for `PostgreSQL` storage connection pool.
type PostgresStorageConfig struct {
	// `PostgreSQL` connection string (key-value or URI format).
	//
	// Supported formats:
	// - Key-value: `host=localhost user=postgres dbname=spark sslmode=require`
	// - URI: `postgres://user:password@host:port/dbname?sslmode=require`
	ConnectionString string
	// Maximum number of connections in the pool.
	// Default: `num_cpus * 4` (from deadpool).
	MaxPoolSize uint32
	// Timeout in seconds waiting for a connection from the pool.
	// `None` means wait indefinitely.
	WaitTimeoutSecs *uint64
	// Timeout in seconds for establishing a new connection.
	// `None` means no timeout.
	CreateTimeoutSecs *uint64
	// Timeout in seconds before recycling an idle connection.
	// `None` means connections are not recycled based on idle time.
	RecycleTimeoutSecs *uint64
	// Queue mode for retrieving connections from the pool.
	// Default: FIFO.
	QueueMode PoolQueueMode
	// Custom CA certificate(s) in PEM format for server verification.
	// If `None`, uses Mozilla's root certificate store (via webpki-roots).
	// Only used with `sslmode=verify-ca` or `sslmode=verify-full`.
	RootCaPem *string
}

func (r *PostgresStorageConfig) Destroy() {
	FfiDestroyerString{}.Destroy(r.ConnectionString)
	FfiDestroyerUint32{}.Destroy(r.MaxPoolSize)
	FfiDestroyerOptionalUint64{}.Destroy(r.WaitTimeoutSecs)
	FfiDestroyerOptionalUint64{}.Destroy(r.CreateTimeoutSecs)
	FfiDestroyerOptionalUint64{}.Destroy(r.RecycleTimeoutSecs)
	FfiDestroyerPoolQueueMode{}.Destroy(r.QueueMode)
	FfiDestroyerOptionalString{}.Destroy(r.RootCaPem)
}

type FfiConverterPostgresStorageConfig struct{}

var FfiConverterPostgresStorageConfigINSTANCE = FfiConverterPostgresStorageConfig{}

func (c FfiConverterPostgresStorageConfig) Lift(rb RustBufferI) PostgresStorageConfig {
	return LiftFromRustBuffer[PostgresStorageConfig](c, rb)
}

func (c FfiConverterPostgresStorageConfig) Read(reader io.Reader) PostgresStorageConfig {
	return PostgresStorageConfig{
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterUint32INSTANCE.Read(reader),
		FfiConverterOptionalUint64INSTANCE.Read(reader),
		FfiConverterOptionalUint64INSTANCE.Read(reader),
		FfiConverterOptionalUint64INSTANCE.Read(reader),
		FfiConverterPoolQueueModeINSTANCE.Read(reader),
		FfiConverterOptionalStringINSTANCE.Read(reader),
	}
}

func (c FfiConverterPostgresStorageConfig) Lower(value PostgresStorageConfig) C.RustBuffer {
	return LowerIntoRustBuffer[PostgresStorageConfig](c, value)
}

func (c FfiConverterPostgresStorageConfig) LowerExternal(value PostgresStorageConfig) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[PostgresStorageConfig](c, value))
}

func (c FfiConverterPostgresStorageConfig) Write(writer io.Writer, value PostgresStorageConfig) {
	FfiConverterStringINSTANCE.Write(writer, value.ConnectionString)
	FfiConverterUint32INSTANCE.Write(writer, value.MaxPoolSize)
	FfiConverterOptionalUint64INSTANCE.Write(writer, value.WaitTimeoutSecs)
	FfiConverterOptionalUint64INSTANCE.Write(writer, value.CreateTimeoutSecs)
	FfiConverterOptionalUint64INSTANCE.Write(writer, value.RecycleTimeoutSecs)
	FfiConverterPoolQueueModeINSTANCE.Write(writer, value.QueueMode)
	FfiConverterOptionalStringINSTANCE.Write(writer, value.RootCaPem)
}

type FfiDestroyerPostgresStorageConfig struct{}

func (_ FfiDestroyerPostgresStorageConfig) Destroy(value PostgresStorageConfig) {
	value.Destroy()
}

type PrepareLnurlPayRequest struct {
	// The amount to send. Denominated in satoshis, or in token base units
	// when `token_identifier` is set.
	Amount                   u128
	PayRequest               LnurlPayRequestDetails
	Comment                  *string
	ValidateSuccessActionUrl *bool
	// The token identifier when sending a token amount with conversion.
	TokenIdentifier *string
	// If provided, the payment will include a token conversion step before sending the payment
	ConversionOptions *ConversionOptions
	// How fees should be handled. Defaults to `FeesExcluded` (fees added on top).
	FeePolicy *FeePolicy
}

func (r *PrepareLnurlPayRequest) Destroy() {
	FfiDestroyerTypeu128{}.Destroy(r.Amount)
	FfiDestroyerLnurlPayRequestDetails{}.Destroy(r.PayRequest)
	FfiDestroyerOptionalString{}.Destroy(r.Comment)
	FfiDestroyerOptionalBool{}.Destroy(r.ValidateSuccessActionUrl)
	FfiDestroyerOptionalString{}.Destroy(r.TokenIdentifier)
	FfiDestroyerOptionalConversionOptions{}.Destroy(r.ConversionOptions)
	FfiDestroyerOptionalFeePolicy{}.Destroy(r.FeePolicy)
}

type FfiConverterPrepareLnurlPayRequest struct{}

var FfiConverterPrepareLnurlPayRequestINSTANCE = FfiConverterPrepareLnurlPayRequest{}

func (c FfiConverterPrepareLnurlPayRequest) Lift(rb RustBufferI) PrepareLnurlPayRequest {
	return LiftFromRustBuffer[PrepareLnurlPayRequest](c, rb)
}

func (c FfiConverterPrepareLnurlPayRequest) Read(reader io.Reader) PrepareLnurlPayRequest {
	return PrepareLnurlPayRequest{
		FfiConverterTypeu128INSTANCE.Read(reader),
		FfiConverterLnurlPayRequestDetailsINSTANCE.Read(reader),
		FfiConverterOptionalStringINSTANCE.Read(reader),
		FfiConverterOptionalBoolINSTANCE.Read(reader),
		FfiConverterOptionalStringINSTANCE.Read(reader),
		FfiConverterOptionalConversionOptionsINSTANCE.Read(reader),
		FfiConverterOptionalFeePolicyINSTANCE.Read(reader),
	}
}

func (c FfiConverterPrepareLnurlPayRequest) Lower(value PrepareLnurlPayRequest) C.RustBuffer {
	return LowerIntoRustBuffer[PrepareLnurlPayRequest](c, value)
}

func (c FfiConverterPrepareLnurlPayRequest) LowerExternal(value PrepareLnurlPayRequest) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[PrepareLnurlPayRequest](c, value))
}

func (c FfiConverterPrepareLnurlPayRequest) Write(writer io.Writer, value PrepareLnurlPayRequest) {
	FfiConverterTypeu128INSTANCE.Write(writer, value.Amount)
	FfiConverterLnurlPayRequestDetailsINSTANCE.Write(writer, value.PayRequest)
	FfiConverterOptionalStringINSTANCE.Write(writer, value.Comment)
	FfiConverterOptionalBoolINSTANCE.Write(writer, value.ValidateSuccessActionUrl)
	FfiConverterOptionalStringINSTANCE.Write(writer, value.TokenIdentifier)
	FfiConverterOptionalConversionOptionsINSTANCE.Write(writer, value.ConversionOptions)
	FfiConverterOptionalFeePolicyINSTANCE.Write(writer, value.FeePolicy)
}

type FfiDestroyerPrepareLnurlPayRequest struct{}

func (_ FfiDestroyerPrepareLnurlPayRequest) Destroy(value PrepareLnurlPayRequest) {
	value.Destroy()
}

type PrepareLnurlPayResponse struct {
	// The amount for the payment, always denominated in sats, even when a
	// `token_identifier` and conversion are present.
	// When a conversion is present, the token input amount is available in
	// `conversion_estimate.amount_in`.
	AmountSats uint64
	Comment    *string
	PayRequest LnurlPayRequestDetails
	// The fee in satoshis. For `FeesIncluded` operations, this represents the total fee
	// (including potential overpayment).
	FeeSats        uint64
	InvoiceDetails Bolt11InvoiceDetails
	SuccessAction  *SuccessAction
	// When set, the payment will include a token conversion step before sending the payment
	ConversionEstimate *ConversionEstimate
	// How fees are handled for this payment.
	FeePolicy FeePolicy
}

func (r *PrepareLnurlPayResponse) Destroy() {
	FfiDestroyerUint64{}.Destroy(r.AmountSats)
	FfiDestroyerOptionalString{}.Destroy(r.Comment)
	FfiDestroyerLnurlPayRequestDetails{}.Destroy(r.PayRequest)
	FfiDestroyerUint64{}.Destroy(r.FeeSats)
	FfiDestroyerBolt11InvoiceDetails{}.Destroy(r.InvoiceDetails)
	FfiDestroyerOptionalSuccessAction{}.Destroy(r.SuccessAction)
	FfiDestroyerOptionalConversionEstimate{}.Destroy(r.ConversionEstimate)
	FfiDestroyerFeePolicy{}.Destroy(r.FeePolicy)
}

type FfiConverterPrepareLnurlPayResponse struct{}

var FfiConverterPrepareLnurlPayResponseINSTANCE = FfiConverterPrepareLnurlPayResponse{}

func (c FfiConverterPrepareLnurlPayResponse) Lift(rb RustBufferI) PrepareLnurlPayResponse {
	return LiftFromRustBuffer[PrepareLnurlPayResponse](c, rb)
}

func (c FfiConverterPrepareLnurlPayResponse) Read(reader io.Reader) PrepareLnurlPayResponse {
	return PrepareLnurlPayResponse{
		FfiConverterUint64INSTANCE.Read(reader),
		FfiConverterOptionalStringINSTANCE.Read(reader),
		FfiConverterLnurlPayRequestDetailsINSTANCE.Read(reader),
		FfiConverterUint64INSTANCE.Read(reader),
		FfiConverterBolt11InvoiceDetailsINSTANCE.Read(reader),
		FfiConverterOptionalSuccessActionINSTANCE.Read(reader),
		FfiConverterOptionalConversionEstimateINSTANCE.Read(reader),
		FfiConverterFeePolicyINSTANCE.Read(reader),
	}
}

func (c FfiConverterPrepareLnurlPayResponse) Lower(value PrepareLnurlPayResponse) C.RustBuffer {
	return LowerIntoRustBuffer[PrepareLnurlPayResponse](c, value)
}

func (c FfiConverterPrepareLnurlPayResponse) LowerExternal(value PrepareLnurlPayResponse) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[PrepareLnurlPayResponse](c, value))
}

func (c FfiConverterPrepareLnurlPayResponse) Write(writer io.Writer, value PrepareLnurlPayResponse) {
	FfiConverterUint64INSTANCE.Write(writer, value.AmountSats)
	FfiConverterOptionalStringINSTANCE.Write(writer, value.Comment)
	FfiConverterLnurlPayRequestDetailsINSTANCE.Write(writer, value.PayRequest)
	FfiConverterUint64INSTANCE.Write(writer, value.FeeSats)
	FfiConverterBolt11InvoiceDetailsINSTANCE.Write(writer, value.InvoiceDetails)
	FfiConverterOptionalSuccessActionINSTANCE.Write(writer, value.SuccessAction)
	FfiConverterOptionalConversionEstimateINSTANCE.Write(writer, value.ConversionEstimate)
	FfiConverterFeePolicyINSTANCE.Write(writer, value.FeePolicy)
}

type FfiDestroyerPrepareLnurlPayResponse struct{}

func (_ FfiDestroyerPrepareLnurlPayResponse) Destroy(value PrepareLnurlPayResponse) {
	value.Destroy()
}

type PrepareSendPaymentRequest struct {
	PaymentRequest string
	// The amount to send.
	// Optional for payment requests with embedded amounts (e.g., Spark/Bolt11 invoices with amounts).
	// Required for Spark addresses, Bitcoin addresses, and amountless invoices.
	// Denominated in satoshis for Bitcoin payments, or token base units for token payments.
	Amount *u128
	// Optional token identifier for token payments.
	// Absence indicates that the payment is a Bitcoin payment.
	TokenIdentifier *string
	// If provided, the payment will include a conversion step before sending the payment
	ConversionOptions *ConversionOptions
	// How fees should be handled. Defaults to `FeesExcluded` (fees added on top).
	FeePolicy *FeePolicy
}

func (r *PrepareSendPaymentRequest) Destroy() {
	FfiDestroyerString{}.Destroy(r.PaymentRequest)
	FfiDestroyerOptionalTypeu128{}.Destroy(r.Amount)
	FfiDestroyerOptionalString{}.Destroy(r.TokenIdentifier)
	FfiDestroyerOptionalConversionOptions{}.Destroy(r.ConversionOptions)
	FfiDestroyerOptionalFeePolicy{}.Destroy(r.FeePolicy)
}

type FfiConverterPrepareSendPaymentRequest struct{}

var FfiConverterPrepareSendPaymentRequestINSTANCE = FfiConverterPrepareSendPaymentRequest{}

func (c FfiConverterPrepareSendPaymentRequest) Lift(rb RustBufferI) PrepareSendPaymentRequest {
	return LiftFromRustBuffer[PrepareSendPaymentRequest](c, rb)
}

func (c FfiConverterPrepareSendPaymentRequest) Read(reader io.Reader) PrepareSendPaymentRequest {
	return PrepareSendPaymentRequest{
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterOptionalTypeu128INSTANCE.Read(reader),
		FfiConverterOptionalStringINSTANCE.Read(reader),
		FfiConverterOptionalConversionOptionsINSTANCE.Read(reader),
		FfiConverterOptionalFeePolicyINSTANCE.Read(reader),
	}
}

func (c FfiConverterPrepareSendPaymentRequest) Lower(value PrepareSendPaymentRequest) C.RustBuffer {
	return LowerIntoRustBuffer[PrepareSendPaymentRequest](c, value)
}

func (c FfiConverterPrepareSendPaymentRequest) LowerExternal(value PrepareSendPaymentRequest) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[PrepareSendPaymentRequest](c, value))
}

func (c FfiConverterPrepareSendPaymentRequest) Write(writer io.Writer, value PrepareSendPaymentRequest) {
	FfiConverterStringINSTANCE.Write(writer, value.PaymentRequest)
	FfiConverterOptionalTypeu128INSTANCE.Write(writer, value.Amount)
	FfiConverterOptionalStringINSTANCE.Write(writer, value.TokenIdentifier)
	FfiConverterOptionalConversionOptionsINSTANCE.Write(writer, value.ConversionOptions)
	FfiConverterOptionalFeePolicyINSTANCE.Write(writer, value.FeePolicy)
}

type FfiDestroyerPrepareSendPaymentRequest struct{}

func (_ FfiDestroyerPrepareSendPaymentRequest) Destroy(value PrepareSendPaymentRequest) {
	value.Destroy()
}

type PrepareSendPaymentResponse struct {
	PaymentMethod SendPaymentMethod
	// The amount to be sent, denominated in satoshis for Bitcoin payments
	// (including token-to-Bitcoin conversions), or token base units for token payments.
	// When a conversion is present, the input amount is in
	// `conversion_estimate.amount_in`.
	Amount u128
	// Optional token identifier for token payments.
	// Absence indicates that the payment is a Bitcoin payment.
	TokenIdentifier *string
	// When set, the payment will include a conversion step before sending the payment
	ConversionEstimate *ConversionEstimate
	// How fees are handled for this payment.
	FeePolicy FeePolicy
}

func (r *PrepareSendPaymentResponse) Destroy() {
	FfiDestroyerSendPaymentMethod{}.Destroy(r.PaymentMethod)
	FfiDestroyerTypeu128{}.Destroy(r.Amount)
	FfiDestroyerOptionalString{}.Destroy(r.TokenIdentifier)
	FfiDestroyerOptionalConversionEstimate{}.Destroy(r.ConversionEstimate)
	FfiDestroyerFeePolicy{}.Destroy(r.FeePolicy)
}

type FfiConverterPrepareSendPaymentResponse struct{}

var FfiConverterPrepareSendPaymentResponseINSTANCE = FfiConverterPrepareSendPaymentResponse{}

func (c FfiConverterPrepareSendPaymentResponse) Lift(rb RustBufferI) PrepareSendPaymentResponse {
	return LiftFromRustBuffer[PrepareSendPaymentResponse](c, rb)
}

func (c FfiConverterPrepareSendPaymentResponse) Read(reader io.Reader) PrepareSendPaymentResponse {
	return PrepareSendPaymentResponse{
		FfiConverterSendPaymentMethodINSTANCE.Read(reader),
		FfiConverterTypeu128INSTANCE.Read(reader),
		FfiConverterOptionalStringINSTANCE.Read(reader),
		FfiConverterOptionalConversionEstimateINSTANCE.Read(reader),
		FfiConverterFeePolicyINSTANCE.Read(reader),
	}
}

func (c FfiConverterPrepareSendPaymentResponse) Lower(value PrepareSendPaymentResponse) C.RustBuffer {
	return LowerIntoRustBuffer[PrepareSendPaymentResponse](c, value)
}

func (c FfiConverterPrepareSendPaymentResponse) LowerExternal(value PrepareSendPaymentResponse) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[PrepareSendPaymentResponse](c, value))
}

func (c FfiConverterPrepareSendPaymentResponse) Write(writer io.Writer, value PrepareSendPaymentResponse) {
	FfiConverterSendPaymentMethodINSTANCE.Write(writer, value.PaymentMethod)
	FfiConverterTypeu128INSTANCE.Write(writer, value.Amount)
	FfiConverterOptionalStringINSTANCE.Write(writer, value.TokenIdentifier)
	FfiConverterOptionalConversionEstimateINSTANCE.Write(writer, value.ConversionEstimate)
	FfiConverterFeePolicyINSTANCE.Write(writer, value.FeePolicy)
}

type FfiDestroyerPrepareSendPaymentResponse struct{}

func (_ FfiDestroyerPrepareSendPaymentResponse) Destroy(value PrepareSendPaymentResponse) {
	value.Destroy()
}

type ProvisionalPayment struct {
	// Unique identifier for the payment
	PaymentId string
	// Amount in satoshis or token base units
	Amount u128
	// Details of the payment
	Details ProvisionalPaymentDetails
}

func (r *ProvisionalPayment) Destroy() {
	FfiDestroyerString{}.Destroy(r.PaymentId)
	FfiDestroyerTypeu128{}.Destroy(r.Amount)
	FfiDestroyerProvisionalPaymentDetails{}.Destroy(r.Details)
}

type FfiConverterProvisionalPayment struct{}

var FfiConverterProvisionalPaymentINSTANCE = FfiConverterProvisionalPayment{}

func (c FfiConverterProvisionalPayment) Lift(rb RustBufferI) ProvisionalPayment {
	return LiftFromRustBuffer[ProvisionalPayment](c, rb)
}

func (c FfiConverterProvisionalPayment) Read(reader io.Reader) ProvisionalPayment {
	return ProvisionalPayment{
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterTypeu128INSTANCE.Read(reader),
		FfiConverterProvisionalPaymentDetailsINSTANCE.Read(reader),
	}
}

func (c FfiConverterProvisionalPayment) Lower(value ProvisionalPayment) C.RustBuffer {
	return LowerIntoRustBuffer[ProvisionalPayment](c, value)
}

func (c FfiConverterProvisionalPayment) LowerExternal(value ProvisionalPayment) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[ProvisionalPayment](c, value))
}

func (c FfiConverterProvisionalPayment) Write(writer io.Writer, value ProvisionalPayment) {
	FfiConverterStringINSTANCE.Write(writer, value.PaymentId)
	FfiConverterTypeu128INSTANCE.Write(writer, value.Amount)
	FfiConverterProvisionalPaymentDetailsINSTANCE.Write(writer, value.Details)
}

type FfiDestroyerProvisionalPayment struct{}

func (_ FfiDestroyerProvisionalPayment) Destroy(value ProvisionalPayment) {
	value.Destroy()
}

// FFI-safe representation of a secp256k1 public key (33 bytes compressed)
type PublicKeyBytes struct {
	Bytes []byte
}

func (r *PublicKeyBytes) Destroy() {
	FfiDestroyerBytes{}.Destroy(r.Bytes)
}

type FfiConverterPublicKeyBytes struct{}

var FfiConverterPublicKeyBytesINSTANCE = FfiConverterPublicKeyBytes{}

func (c FfiConverterPublicKeyBytes) Lift(rb RustBufferI) PublicKeyBytes {
	return LiftFromRustBuffer[PublicKeyBytes](c, rb)
}

func (c FfiConverterPublicKeyBytes) Read(reader io.Reader) PublicKeyBytes {
	return PublicKeyBytes{
		FfiConverterBytesINSTANCE.Read(reader),
	}
}

func (c FfiConverterPublicKeyBytes) Lower(value PublicKeyBytes) C.RustBuffer {
	return LowerIntoRustBuffer[PublicKeyBytes](c, value)
}

func (c FfiConverterPublicKeyBytes) LowerExternal(value PublicKeyBytes) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[PublicKeyBytes](c, value))
}

func (c FfiConverterPublicKeyBytes) Write(writer io.Writer, value PublicKeyBytes) {
	FfiConverterBytesINSTANCE.Write(writer, value.Bytes)
}

type FfiDestroyerPublicKeyBytes struct{}

func (_ FfiDestroyerPublicKeyBytes) Destroy(value PublicKeyBytes) {
	value.Destroy()
}

// Denominator in an exchange rate
type Rate struct {
	Coin  string
	Value float64
}

func (r *Rate) Destroy() {
	FfiDestroyerString{}.Destroy(r.Coin)
	FfiDestroyerFloat64{}.Destroy(r.Value)
}

type FfiConverterRate struct{}

var FfiConverterRateINSTANCE = FfiConverterRate{}

func (c FfiConverterRate) Lift(rb RustBufferI) Rate {
	return LiftFromRustBuffer[Rate](c, rb)
}

func (c FfiConverterRate) Read(reader io.Reader) Rate {
	return Rate{
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterFloat64INSTANCE.Read(reader),
	}
}

func (c FfiConverterRate) Lower(value Rate) C.RustBuffer {
	return LowerIntoRustBuffer[Rate](c, value)
}

func (c FfiConverterRate) LowerExternal(value Rate) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[Rate](c, value))
}

func (c FfiConverterRate) Write(writer io.Writer, value Rate) {
	FfiConverterStringINSTANCE.Write(writer, value.Coin)
	FfiConverterFloat64INSTANCE.Write(writer, value.Value)
}

type FfiDestroyerRate struct{}

func (_ FfiDestroyerRate) Destroy(value Rate) {
	value.Destroy()
}

type ReceivePaymentRequest struct {
	PaymentMethod ReceivePaymentMethod
}

func (r *ReceivePaymentRequest) Destroy() {
	FfiDestroyerReceivePaymentMethod{}.Destroy(r.PaymentMethod)
}

type FfiConverterReceivePaymentRequest struct{}

var FfiConverterReceivePaymentRequestINSTANCE = FfiConverterReceivePaymentRequest{}

func (c FfiConverterReceivePaymentRequest) Lift(rb RustBufferI) ReceivePaymentRequest {
	return LiftFromRustBuffer[ReceivePaymentRequest](c, rb)
}

func (c FfiConverterReceivePaymentRequest) Read(reader io.Reader) ReceivePaymentRequest {
	return ReceivePaymentRequest{
		FfiConverterReceivePaymentMethodINSTANCE.Read(reader),
	}
}

func (c FfiConverterReceivePaymentRequest) Lower(value ReceivePaymentRequest) C.RustBuffer {
	return LowerIntoRustBuffer[ReceivePaymentRequest](c, value)
}

func (c FfiConverterReceivePaymentRequest) LowerExternal(value ReceivePaymentRequest) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[ReceivePaymentRequest](c, value))
}

func (c FfiConverterReceivePaymentRequest) Write(writer io.Writer, value ReceivePaymentRequest) {
	FfiConverterReceivePaymentMethodINSTANCE.Write(writer, value.PaymentMethod)
}

type FfiDestroyerReceivePaymentRequest struct{}

func (_ FfiDestroyerReceivePaymentRequest) Destroy(value ReceivePaymentRequest) {
	value.Destroy()
}

type ReceivePaymentResponse struct {
	PaymentRequest string
	// Fee to pay to receive the payment
	// Denominated in sats or token base units
	Fee u128
}

func (r *ReceivePaymentResponse) Destroy() {
	FfiDestroyerString{}.Destroy(r.PaymentRequest)
	FfiDestroyerTypeu128{}.Destroy(r.Fee)
}

type FfiConverterReceivePaymentResponse struct{}

var FfiConverterReceivePaymentResponseINSTANCE = FfiConverterReceivePaymentResponse{}

func (c FfiConverterReceivePaymentResponse) Lift(rb RustBufferI) ReceivePaymentResponse {
	return LiftFromRustBuffer[ReceivePaymentResponse](c, rb)
}

func (c FfiConverterReceivePaymentResponse) Read(reader io.Reader) ReceivePaymentResponse {
	return ReceivePaymentResponse{
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterTypeu128INSTANCE.Read(reader),
	}
}

func (c FfiConverterReceivePaymentResponse) Lower(value ReceivePaymentResponse) C.RustBuffer {
	return LowerIntoRustBuffer[ReceivePaymentResponse](c, value)
}

func (c FfiConverterReceivePaymentResponse) LowerExternal(value ReceivePaymentResponse) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[ReceivePaymentResponse](c, value))
}

func (c FfiConverterReceivePaymentResponse) Write(writer io.Writer, value ReceivePaymentResponse) {
	FfiConverterStringINSTANCE.Write(writer, value.PaymentRequest)
	FfiConverterTypeu128INSTANCE.Write(writer, value.Fee)
}

type FfiDestroyerReceivePaymentResponse struct{}

func (_ FfiDestroyerReceivePaymentResponse) Destroy(value ReceivePaymentResponse) {
	value.Destroy()
}

type RecommendedFees struct {
	FastestFee  uint64
	HalfHourFee uint64
	HourFee     uint64
	EconomyFee  uint64
	MinimumFee  uint64
}

func (r *RecommendedFees) Destroy() {
	FfiDestroyerUint64{}.Destroy(r.FastestFee)
	FfiDestroyerUint64{}.Destroy(r.HalfHourFee)
	FfiDestroyerUint64{}.Destroy(r.HourFee)
	FfiDestroyerUint64{}.Destroy(r.EconomyFee)
	FfiDestroyerUint64{}.Destroy(r.MinimumFee)
}

type FfiConverterRecommendedFees struct{}

var FfiConverterRecommendedFeesINSTANCE = FfiConverterRecommendedFees{}

func (c FfiConverterRecommendedFees) Lift(rb RustBufferI) RecommendedFees {
	return LiftFromRustBuffer[RecommendedFees](c, rb)
}

func (c FfiConverterRecommendedFees) Read(reader io.Reader) RecommendedFees {
	return RecommendedFees{
		FfiConverterUint64INSTANCE.Read(reader),
		FfiConverterUint64INSTANCE.Read(reader),
		FfiConverterUint64INSTANCE.Read(reader),
		FfiConverterUint64INSTANCE.Read(reader),
		FfiConverterUint64INSTANCE.Read(reader),
	}
}

func (c FfiConverterRecommendedFees) Lower(value RecommendedFees) C.RustBuffer {
	return LowerIntoRustBuffer[RecommendedFees](c, value)
}

func (c FfiConverterRecommendedFees) LowerExternal(value RecommendedFees) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[RecommendedFees](c, value))
}

func (c FfiConverterRecommendedFees) Write(writer io.Writer, value RecommendedFees) {
	FfiConverterUint64INSTANCE.Write(writer, value.FastestFee)
	FfiConverterUint64INSTANCE.Write(writer, value.HalfHourFee)
	FfiConverterUint64INSTANCE.Write(writer, value.HourFee)
	FfiConverterUint64INSTANCE.Write(writer, value.EconomyFee)
	FfiConverterUint64INSTANCE.Write(writer, value.MinimumFee)
}

type FfiDestroyerRecommendedFees struct{}

func (_ FfiDestroyerRecommendedFees) Destroy(value RecommendedFees) {
	value.Destroy()
}

type Record struct {
	Id            RecordId
	Revision      uint64
	SchemaVersion string
	Data          map[string]string
}

func (r *Record) Destroy() {
	FfiDestroyerRecordId{}.Destroy(r.Id)
	FfiDestroyerUint64{}.Destroy(r.Revision)
	FfiDestroyerString{}.Destroy(r.SchemaVersion)
	FfiDestroyerMapStringString{}.Destroy(r.Data)
}

type FfiConverterRecord struct{}

var FfiConverterRecordINSTANCE = FfiConverterRecord{}

func (c FfiConverterRecord) Lift(rb RustBufferI) Record {
	return LiftFromRustBuffer[Record](c, rb)
}

func (c FfiConverterRecord) Read(reader io.Reader) Record {
	return Record{
		FfiConverterRecordIdINSTANCE.Read(reader),
		FfiConverterUint64INSTANCE.Read(reader),
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterMapStringStringINSTANCE.Read(reader),
	}
}

func (c FfiConverterRecord) Lower(value Record) C.RustBuffer {
	return LowerIntoRustBuffer[Record](c, value)
}

func (c FfiConverterRecord) LowerExternal(value Record) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[Record](c, value))
}

func (c FfiConverterRecord) Write(writer io.Writer, value Record) {
	FfiConverterRecordIdINSTANCE.Write(writer, value.Id)
	FfiConverterUint64INSTANCE.Write(writer, value.Revision)
	FfiConverterStringINSTANCE.Write(writer, value.SchemaVersion)
	FfiConverterMapStringStringINSTANCE.Write(writer, value.Data)
}

type FfiDestroyerRecord struct{}

func (_ FfiDestroyerRecord) Destroy(value Record) {
	value.Destroy()
}

type RecordChange struct {
	Id            RecordId
	SchemaVersion string
	UpdatedFields map[string]string
	LocalRevision uint64
}

func (r *RecordChange) Destroy() {
	FfiDestroyerRecordId{}.Destroy(r.Id)
	FfiDestroyerString{}.Destroy(r.SchemaVersion)
	FfiDestroyerMapStringString{}.Destroy(r.UpdatedFields)
	FfiDestroyerUint64{}.Destroy(r.LocalRevision)
}

type FfiConverterRecordChange struct{}

var FfiConverterRecordChangeINSTANCE = FfiConverterRecordChange{}

func (c FfiConverterRecordChange) Lift(rb RustBufferI) RecordChange {
	return LiftFromRustBuffer[RecordChange](c, rb)
}

func (c FfiConverterRecordChange) Read(reader io.Reader) RecordChange {
	return RecordChange{
		FfiConverterRecordIdINSTANCE.Read(reader),
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterMapStringStringINSTANCE.Read(reader),
		FfiConverterUint64INSTANCE.Read(reader),
	}
}

func (c FfiConverterRecordChange) Lower(value RecordChange) C.RustBuffer {
	return LowerIntoRustBuffer[RecordChange](c, value)
}

func (c FfiConverterRecordChange) LowerExternal(value RecordChange) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[RecordChange](c, value))
}

func (c FfiConverterRecordChange) Write(writer io.Writer, value RecordChange) {
	FfiConverterRecordIdINSTANCE.Write(writer, value.Id)
	FfiConverterStringINSTANCE.Write(writer, value.SchemaVersion)
	FfiConverterMapStringStringINSTANCE.Write(writer, value.UpdatedFields)
	FfiConverterUint64INSTANCE.Write(writer, value.LocalRevision)
}

type FfiDestroyerRecordChange struct{}

func (_ FfiDestroyerRecordChange) Destroy(value RecordChange) {
	value.Destroy()
}

type RecordId struct {
	Type   string
	DataId string
}

func (r *RecordId) Destroy() {
	FfiDestroyerString{}.Destroy(r.Type)
	FfiDestroyerString{}.Destroy(r.DataId)
}

type FfiConverterRecordId struct{}

var FfiConverterRecordIdINSTANCE = FfiConverterRecordId{}

func (c FfiConverterRecordId) Lift(rb RustBufferI) RecordId {
	return LiftFromRustBuffer[RecordId](c, rb)
}

func (c FfiConverterRecordId) Read(reader io.Reader) RecordId {
	return RecordId{
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterStringINSTANCE.Read(reader),
	}
}

func (c FfiConverterRecordId) Lower(value RecordId) C.RustBuffer {
	return LowerIntoRustBuffer[RecordId](c, value)
}

func (c FfiConverterRecordId) LowerExternal(value RecordId) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[RecordId](c, value))
}

func (c FfiConverterRecordId) Write(writer io.Writer, value RecordId) {
	FfiConverterStringINSTANCE.Write(writer, value.Type)
	FfiConverterStringINSTANCE.Write(writer, value.DataId)
}

type FfiDestroyerRecordId struct{}

func (_ FfiDestroyerRecordId) Destroy(value RecordId) {
	value.Destroy()
}

// FFI-safe representation of a recoverable ECDSA signature (65 bytes: 1 recovery byte + 64 signature bytes)
type RecoverableEcdsaSignatureBytes struct {
	Bytes []byte
}

func (r *RecoverableEcdsaSignatureBytes) Destroy() {
	FfiDestroyerBytes{}.Destroy(r.Bytes)
}

type FfiConverterRecoverableEcdsaSignatureBytes struct{}

var FfiConverterRecoverableEcdsaSignatureBytesINSTANCE = FfiConverterRecoverableEcdsaSignatureBytes{}

func (c FfiConverterRecoverableEcdsaSignatureBytes) Lift(rb RustBufferI) RecoverableEcdsaSignatureBytes {
	return LiftFromRustBuffer[RecoverableEcdsaSignatureBytes](c, rb)
}

func (c FfiConverterRecoverableEcdsaSignatureBytes) Read(reader io.Reader) RecoverableEcdsaSignatureBytes {
	return RecoverableEcdsaSignatureBytes{
		FfiConverterBytesINSTANCE.Read(reader),
	}
}

func (c FfiConverterRecoverableEcdsaSignatureBytes) Lower(value RecoverableEcdsaSignatureBytes) C.RustBuffer {
	return LowerIntoRustBuffer[RecoverableEcdsaSignatureBytes](c, value)
}

func (c FfiConverterRecoverableEcdsaSignatureBytes) LowerExternal(value RecoverableEcdsaSignatureBytes) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[RecoverableEcdsaSignatureBytes](c, value))
}

func (c FfiConverterRecoverableEcdsaSignatureBytes) Write(writer io.Writer, value RecoverableEcdsaSignatureBytes) {
	FfiConverterBytesINSTANCE.Write(writer, value.Bytes)
}

type FfiDestroyerRecoverableEcdsaSignatureBytes struct{}

func (_ FfiDestroyerRecoverableEcdsaSignatureBytes) Destroy(value RecoverableEcdsaSignatureBytes) {
	value.Destroy()
}

type RefundDepositRequest struct {
	Txid               string
	Vout               uint32
	DestinationAddress string
	Fee                Fee
}

func (r *RefundDepositRequest) Destroy() {
	FfiDestroyerString{}.Destroy(r.Txid)
	FfiDestroyerUint32{}.Destroy(r.Vout)
	FfiDestroyerString{}.Destroy(r.DestinationAddress)
	FfiDestroyerFee{}.Destroy(r.Fee)
}

type FfiConverterRefundDepositRequest struct{}

var FfiConverterRefundDepositRequestINSTANCE = FfiConverterRefundDepositRequest{}

func (c FfiConverterRefundDepositRequest) Lift(rb RustBufferI) RefundDepositRequest {
	return LiftFromRustBuffer[RefundDepositRequest](c, rb)
}

func (c FfiConverterRefundDepositRequest) Read(reader io.Reader) RefundDepositRequest {
	return RefundDepositRequest{
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterUint32INSTANCE.Read(reader),
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterFeeINSTANCE.Read(reader),
	}
}

func (c FfiConverterRefundDepositRequest) Lower(value RefundDepositRequest) C.RustBuffer {
	return LowerIntoRustBuffer[RefundDepositRequest](c, value)
}

func (c FfiConverterRefundDepositRequest) LowerExternal(value RefundDepositRequest) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[RefundDepositRequest](c, value))
}

func (c FfiConverterRefundDepositRequest) Write(writer io.Writer, value RefundDepositRequest) {
	FfiConverterStringINSTANCE.Write(writer, value.Txid)
	FfiConverterUint32INSTANCE.Write(writer, value.Vout)
	FfiConverterStringINSTANCE.Write(writer, value.DestinationAddress)
	FfiConverterFeeINSTANCE.Write(writer, value.Fee)
}

type FfiDestroyerRefundDepositRequest struct{}

func (_ FfiDestroyerRefundDepositRequest) Destroy(value RefundDepositRequest) {
	value.Destroy()
}

type RefundDepositResponse struct {
	TxId  string
	TxHex string
}

func (r *RefundDepositResponse) Destroy() {
	FfiDestroyerString{}.Destroy(r.TxId)
	FfiDestroyerString{}.Destroy(r.TxHex)
}

type FfiConverterRefundDepositResponse struct{}

var FfiConverterRefundDepositResponseINSTANCE = FfiConverterRefundDepositResponse{}

func (c FfiConverterRefundDepositResponse) Lift(rb RustBufferI) RefundDepositResponse {
	return LiftFromRustBuffer[RefundDepositResponse](c, rb)
}

func (c FfiConverterRefundDepositResponse) Read(reader io.Reader) RefundDepositResponse {
	return RefundDepositResponse{
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterStringINSTANCE.Read(reader),
	}
}

func (c FfiConverterRefundDepositResponse) Lower(value RefundDepositResponse) C.RustBuffer {
	return LowerIntoRustBuffer[RefundDepositResponse](c, value)
}

func (c FfiConverterRefundDepositResponse) LowerExternal(value RefundDepositResponse) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[RefundDepositResponse](c, value))
}

func (c FfiConverterRefundDepositResponse) Write(writer io.Writer, value RefundDepositResponse) {
	FfiConverterStringINSTANCE.Write(writer, value.TxId)
	FfiConverterStringINSTANCE.Write(writer, value.TxHex)
}

type FfiDestroyerRefundDepositResponse struct{}

func (_ FfiDestroyerRefundDepositResponse) Destroy(value RefundDepositResponse) {
	value.Destroy()
}

type RegisterLightningAddressRequest struct {
	Username    string
	Description *string
}

func (r *RegisterLightningAddressRequest) Destroy() {
	FfiDestroyerString{}.Destroy(r.Username)
	FfiDestroyerOptionalString{}.Destroy(r.Description)
}

type FfiConverterRegisterLightningAddressRequest struct{}

var FfiConverterRegisterLightningAddressRequestINSTANCE = FfiConverterRegisterLightningAddressRequest{}

func (c FfiConverterRegisterLightningAddressRequest) Lift(rb RustBufferI) RegisterLightningAddressRequest {
	return LiftFromRustBuffer[RegisterLightningAddressRequest](c, rb)
}

func (c FfiConverterRegisterLightningAddressRequest) Read(reader io.Reader) RegisterLightningAddressRequest {
	return RegisterLightningAddressRequest{
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterOptionalStringINSTANCE.Read(reader),
	}
}

func (c FfiConverterRegisterLightningAddressRequest) Lower(value RegisterLightningAddressRequest) C.RustBuffer {
	return LowerIntoRustBuffer[RegisterLightningAddressRequest](c, value)
}

func (c FfiConverterRegisterLightningAddressRequest) LowerExternal(value RegisterLightningAddressRequest) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[RegisterLightningAddressRequest](c, value))
}

func (c FfiConverterRegisterLightningAddressRequest) Write(writer io.Writer, value RegisterLightningAddressRequest) {
	FfiConverterStringINSTANCE.Write(writer, value.Username)
	FfiConverterOptionalStringINSTANCE.Write(writer, value.Description)
}

type FfiDestroyerRegisterLightningAddressRequest struct{}

func (_ FfiDestroyerRegisterLightningAddressRequest) Destroy(value RegisterLightningAddressRequest) {
	value.Destroy()
}

// Request to register a new webhook.
type RegisterWebhookRequest struct {
	// The URL that will receive webhook notifications.
	Url string
	// A secret used for HMAC-SHA256 signature verification of webhook payloads.
	Secret string
	// The event types to subscribe to.
	EventTypes []WebhookEventType
}

func (r *RegisterWebhookRequest) Destroy() {
	FfiDestroyerString{}.Destroy(r.Url)
	FfiDestroyerString{}.Destroy(r.Secret)
	FfiDestroyerSequenceWebhookEventType{}.Destroy(r.EventTypes)
}

type FfiConverterRegisterWebhookRequest struct{}

var FfiConverterRegisterWebhookRequestINSTANCE = FfiConverterRegisterWebhookRequest{}

func (c FfiConverterRegisterWebhookRequest) Lift(rb RustBufferI) RegisterWebhookRequest {
	return LiftFromRustBuffer[RegisterWebhookRequest](c, rb)
}

func (c FfiConverterRegisterWebhookRequest) Read(reader io.Reader) RegisterWebhookRequest {
	return RegisterWebhookRequest{
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterSequenceWebhookEventTypeINSTANCE.Read(reader),
	}
}

func (c FfiConverterRegisterWebhookRequest) Lower(value RegisterWebhookRequest) C.RustBuffer {
	return LowerIntoRustBuffer[RegisterWebhookRequest](c, value)
}

func (c FfiConverterRegisterWebhookRequest) LowerExternal(value RegisterWebhookRequest) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[RegisterWebhookRequest](c, value))
}

func (c FfiConverterRegisterWebhookRequest) Write(writer io.Writer, value RegisterWebhookRequest) {
	FfiConverterStringINSTANCE.Write(writer, value.Url)
	FfiConverterStringINSTANCE.Write(writer, value.Secret)
	FfiConverterSequenceWebhookEventTypeINSTANCE.Write(writer, value.EventTypes)
}

type FfiDestroyerRegisterWebhookRequest struct{}

func (_ FfiDestroyerRegisterWebhookRequest) Destroy(value RegisterWebhookRequest) {
	value.Destroy()
}

// Response from registering a webhook.
type RegisterWebhookResponse struct {
	// The unique identifier of the newly registered webhook.
	WebhookId string
}

func (r *RegisterWebhookResponse) Destroy() {
	FfiDestroyerString{}.Destroy(r.WebhookId)
}

type FfiConverterRegisterWebhookResponse struct{}

var FfiConverterRegisterWebhookResponseINSTANCE = FfiConverterRegisterWebhookResponse{}

func (c FfiConverterRegisterWebhookResponse) Lift(rb RustBufferI) RegisterWebhookResponse {
	return LiftFromRustBuffer[RegisterWebhookResponse](c, rb)
}

func (c FfiConverterRegisterWebhookResponse) Read(reader io.Reader) RegisterWebhookResponse {
	return RegisterWebhookResponse{
		FfiConverterStringINSTANCE.Read(reader),
	}
}

func (c FfiConverterRegisterWebhookResponse) Lower(value RegisterWebhookResponse) C.RustBuffer {
	return LowerIntoRustBuffer[RegisterWebhookResponse](c, value)
}

func (c FfiConverterRegisterWebhookResponse) LowerExternal(value RegisterWebhookResponse) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[RegisterWebhookResponse](c, value))
}

func (c FfiConverterRegisterWebhookResponse) Write(writer io.Writer, value RegisterWebhookResponse) {
	FfiConverterStringINSTANCE.Write(writer, value.WebhookId)
}

type FfiDestroyerRegisterWebhookResponse struct{}

func (_ FfiDestroyerRegisterWebhookResponse) Destroy(value RegisterWebhookResponse) {
	value.Destroy()
}

type RestResponse struct {
	Status uint16
	Body   string
}

func (r *RestResponse) Destroy() {
	FfiDestroyerUint16{}.Destroy(r.Status)
	FfiDestroyerString{}.Destroy(r.Body)
}

type FfiConverterRestResponse struct{}

var FfiConverterRestResponseINSTANCE = FfiConverterRestResponse{}

func (c FfiConverterRestResponse) Lift(rb RustBufferI) RestResponse {
	return LiftFromRustBuffer[RestResponse](c, rb)
}

func (c FfiConverterRestResponse) Read(reader io.Reader) RestResponse {
	return RestResponse{
		FfiConverterUint16INSTANCE.Read(reader),
		FfiConverterStringINSTANCE.Read(reader),
	}
}

func (c FfiConverterRestResponse) Lower(value RestResponse) C.RustBuffer {
	return LowerIntoRustBuffer[RestResponse](c, value)
}

func (c FfiConverterRestResponse) LowerExternal(value RestResponse) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[RestResponse](c, value))
}

func (c FfiConverterRestResponse) Write(writer io.Writer, value RestResponse) {
	FfiConverterUint16INSTANCE.Write(writer, value.Status)
	FfiConverterStringINSTANCE.Write(writer, value.Body)
}

type FfiDestroyerRestResponse struct{}

func (_ FfiDestroyerRestResponse) Destroy(value RestResponse) {
	value.Destroy()
}

// FFI-safe representation of a Schnorr signature (64 bytes)
type SchnorrSignatureBytes struct {
	Bytes []byte
}

func (r *SchnorrSignatureBytes) Destroy() {
	FfiDestroyerBytes{}.Destroy(r.Bytes)
}

type FfiConverterSchnorrSignatureBytes struct{}

var FfiConverterSchnorrSignatureBytesINSTANCE = FfiConverterSchnorrSignatureBytes{}

func (c FfiConverterSchnorrSignatureBytes) Lift(rb RustBufferI) SchnorrSignatureBytes {
	return LiftFromRustBuffer[SchnorrSignatureBytes](c, rb)
}

func (c FfiConverterSchnorrSignatureBytes) Read(reader io.Reader) SchnorrSignatureBytes {
	return SchnorrSignatureBytes{
		FfiConverterBytesINSTANCE.Read(reader),
	}
}

func (c FfiConverterSchnorrSignatureBytes) Lower(value SchnorrSignatureBytes) C.RustBuffer {
	return LowerIntoRustBuffer[SchnorrSignatureBytes](c, value)
}

func (c FfiConverterSchnorrSignatureBytes) LowerExternal(value SchnorrSignatureBytes) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[SchnorrSignatureBytes](c, value))
}

func (c FfiConverterSchnorrSignatureBytes) Write(writer io.Writer, value SchnorrSignatureBytes) {
	FfiConverterBytesINSTANCE.Write(writer, value.Bytes)
}

type FfiDestroyerSchnorrSignatureBytes struct{}

func (_ FfiDestroyerSchnorrSignatureBytes) Destroy(value SchnorrSignatureBytes) {
	value.Destroy()
}

// FFI-safe representation of a private key (32 bytes)
type SecretBytes struct {
	Bytes []byte
}

func (r *SecretBytes) Destroy() {
	FfiDestroyerBytes{}.Destroy(r.Bytes)
}

type FfiConverterSecretBytes struct{}

var FfiConverterSecretBytesINSTANCE = FfiConverterSecretBytes{}

func (c FfiConverterSecretBytes) Lift(rb RustBufferI) SecretBytes {
	return LiftFromRustBuffer[SecretBytes](c, rb)
}

func (c FfiConverterSecretBytes) Read(reader io.Reader) SecretBytes {
	return SecretBytes{
		FfiConverterBytesINSTANCE.Read(reader),
	}
}

func (c FfiConverterSecretBytes) Lower(value SecretBytes) C.RustBuffer {
	return LowerIntoRustBuffer[SecretBytes](c, value)
}

func (c FfiConverterSecretBytes) LowerExternal(value SecretBytes) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[SecretBytes](c, value))
}

func (c FfiConverterSecretBytes) Write(writer io.Writer, value SecretBytes) {
	FfiConverterBytesINSTANCE.Write(writer, value.Bytes)
}

type FfiDestroyerSecretBytes struct{}

func (_ FfiDestroyerSecretBytes) Destroy(value SecretBytes) {
	value.Destroy()
}

type SendOnchainFeeQuote struct {
	Id          string
	ExpiresAt   uint64
	SpeedFast   SendOnchainSpeedFeeQuote
	SpeedMedium SendOnchainSpeedFeeQuote
	SpeedSlow   SendOnchainSpeedFeeQuote
}

func (r *SendOnchainFeeQuote) Destroy() {
	FfiDestroyerString{}.Destroy(r.Id)
	FfiDestroyerUint64{}.Destroy(r.ExpiresAt)
	FfiDestroyerSendOnchainSpeedFeeQuote{}.Destroy(r.SpeedFast)
	FfiDestroyerSendOnchainSpeedFeeQuote{}.Destroy(r.SpeedMedium)
	FfiDestroyerSendOnchainSpeedFeeQuote{}.Destroy(r.SpeedSlow)
}

type FfiConverterSendOnchainFeeQuote struct{}

var FfiConverterSendOnchainFeeQuoteINSTANCE = FfiConverterSendOnchainFeeQuote{}

func (c FfiConverterSendOnchainFeeQuote) Lift(rb RustBufferI) SendOnchainFeeQuote {
	return LiftFromRustBuffer[SendOnchainFeeQuote](c, rb)
}

func (c FfiConverterSendOnchainFeeQuote) Read(reader io.Reader) SendOnchainFeeQuote {
	return SendOnchainFeeQuote{
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterUint64INSTANCE.Read(reader),
		FfiConverterSendOnchainSpeedFeeQuoteINSTANCE.Read(reader),
		FfiConverterSendOnchainSpeedFeeQuoteINSTANCE.Read(reader),
		FfiConverterSendOnchainSpeedFeeQuoteINSTANCE.Read(reader),
	}
}

func (c FfiConverterSendOnchainFeeQuote) Lower(value SendOnchainFeeQuote) C.RustBuffer {
	return LowerIntoRustBuffer[SendOnchainFeeQuote](c, value)
}

func (c FfiConverterSendOnchainFeeQuote) LowerExternal(value SendOnchainFeeQuote) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[SendOnchainFeeQuote](c, value))
}

func (c FfiConverterSendOnchainFeeQuote) Write(writer io.Writer, value SendOnchainFeeQuote) {
	FfiConverterStringINSTANCE.Write(writer, value.Id)
	FfiConverterUint64INSTANCE.Write(writer, value.ExpiresAt)
	FfiConverterSendOnchainSpeedFeeQuoteINSTANCE.Write(writer, value.SpeedFast)
	FfiConverterSendOnchainSpeedFeeQuoteINSTANCE.Write(writer, value.SpeedMedium)
	FfiConverterSendOnchainSpeedFeeQuoteINSTANCE.Write(writer, value.SpeedSlow)
}

type FfiDestroyerSendOnchainFeeQuote struct{}

func (_ FfiDestroyerSendOnchainFeeQuote) Destroy(value SendOnchainFeeQuote) {
	value.Destroy()
}

type SendOnchainSpeedFeeQuote struct {
	UserFeeSat        uint64
	L1BroadcastFeeSat uint64
}

func (r *SendOnchainSpeedFeeQuote) Destroy() {
	FfiDestroyerUint64{}.Destroy(r.UserFeeSat)
	FfiDestroyerUint64{}.Destroy(r.L1BroadcastFeeSat)
}

type FfiConverterSendOnchainSpeedFeeQuote struct{}

var FfiConverterSendOnchainSpeedFeeQuoteINSTANCE = FfiConverterSendOnchainSpeedFeeQuote{}

func (c FfiConverterSendOnchainSpeedFeeQuote) Lift(rb RustBufferI) SendOnchainSpeedFeeQuote {
	return LiftFromRustBuffer[SendOnchainSpeedFeeQuote](c, rb)
}

func (c FfiConverterSendOnchainSpeedFeeQuote) Read(reader io.Reader) SendOnchainSpeedFeeQuote {
	return SendOnchainSpeedFeeQuote{
		FfiConverterUint64INSTANCE.Read(reader),
		FfiConverterUint64INSTANCE.Read(reader),
	}
}

func (c FfiConverterSendOnchainSpeedFeeQuote) Lower(value SendOnchainSpeedFeeQuote) C.RustBuffer {
	return LowerIntoRustBuffer[SendOnchainSpeedFeeQuote](c, value)
}

func (c FfiConverterSendOnchainSpeedFeeQuote) LowerExternal(value SendOnchainSpeedFeeQuote) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[SendOnchainSpeedFeeQuote](c, value))
}

func (c FfiConverterSendOnchainSpeedFeeQuote) Write(writer io.Writer, value SendOnchainSpeedFeeQuote) {
	FfiConverterUint64INSTANCE.Write(writer, value.UserFeeSat)
	FfiConverterUint64INSTANCE.Write(writer, value.L1BroadcastFeeSat)
}

type FfiDestroyerSendOnchainSpeedFeeQuote struct{}

func (_ FfiDestroyerSendOnchainSpeedFeeQuote) Destroy(value SendOnchainSpeedFeeQuote) {
	value.Destroy()
}

type SendPaymentRequest struct {
	PrepareResponse PrepareSendPaymentResponse
	Options         *SendPaymentOptions
	// The optional idempotency key for all Spark based transfers (excludes token payments).
	// If set, providing the same idempotency key for multiple requests will ensure that only one
	// payment is made. If an idempotency key is re-used, the same payment will be returned.
	// The idempotency key must be a valid UUID.
	IdempotencyKey *string
}

func (r *SendPaymentRequest) Destroy() {
	FfiDestroyerPrepareSendPaymentResponse{}.Destroy(r.PrepareResponse)
	FfiDestroyerOptionalSendPaymentOptions{}.Destroy(r.Options)
	FfiDestroyerOptionalString{}.Destroy(r.IdempotencyKey)
}

type FfiConverterSendPaymentRequest struct{}

var FfiConverterSendPaymentRequestINSTANCE = FfiConverterSendPaymentRequest{}

func (c FfiConverterSendPaymentRequest) Lift(rb RustBufferI) SendPaymentRequest {
	return LiftFromRustBuffer[SendPaymentRequest](c, rb)
}

func (c FfiConverterSendPaymentRequest) Read(reader io.Reader) SendPaymentRequest {
	return SendPaymentRequest{
		FfiConverterPrepareSendPaymentResponseINSTANCE.Read(reader),
		FfiConverterOptionalSendPaymentOptionsINSTANCE.Read(reader),
		FfiConverterOptionalStringINSTANCE.Read(reader),
	}
}

func (c FfiConverterSendPaymentRequest) Lower(value SendPaymentRequest) C.RustBuffer {
	return LowerIntoRustBuffer[SendPaymentRequest](c, value)
}

func (c FfiConverterSendPaymentRequest) LowerExternal(value SendPaymentRequest) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[SendPaymentRequest](c, value))
}

func (c FfiConverterSendPaymentRequest) Write(writer io.Writer, value SendPaymentRequest) {
	FfiConverterPrepareSendPaymentResponseINSTANCE.Write(writer, value.PrepareResponse)
	FfiConverterOptionalSendPaymentOptionsINSTANCE.Write(writer, value.Options)
	FfiConverterOptionalStringINSTANCE.Write(writer, value.IdempotencyKey)
}

type FfiDestroyerSendPaymentRequest struct{}

func (_ FfiDestroyerSendPaymentRequest) Destroy(value SendPaymentRequest) {
	value.Destroy()
}

type SendPaymentResponse struct {
	Payment Payment
}

func (r *SendPaymentResponse) Destroy() {
	FfiDestroyerPayment{}.Destroy(r.Payment)
}

type FfiConverterSendPaymentResponse struct{}

var FfiConverterSendPaymentResponseINSTANCE = FfiConverterSendPaymentResponse{}

func (c FfiConverterSendPaymentResponse) Lift(rb RustBufferI) SendPaymentResponse {
	return LiftFromRustBuffer[SendPaymentResponse](c, rb)
}

func (c FfiConverterSendPaymentResponse) Read(reader io.Reader) SendPaymentResponse {
	return SendPaymentResponse{
		FfiConverterPaymentINSTANCE.Read(reader),
	}
}

func (c FfiConverterSendPaymentResponse) Lower(value SendPaymentResponse) C.RustBuffer {
	return LowerIntoRustBuffer[SendPaymentResponse](c, value)
}

func (c FfiConverterSendPaymentResponse) LowerExternal(value SendPaymentResponse) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[SendPaymentResponse](c, value))
}

func (c FfiConverterSendPaymentResponse) Write(writer io.Writer, value SendPaymentResponse) {
	FfiConverterPaymentINSTANCE.Write(writer, value.Payment)
}

type FfiDestroyerSendPaymentResponse struct{}

func (_ FfiDestroyerSendPaymentResponse) Destroy(value SendPaymentResponse) {
	value.Destroy()
}

type SetLnurlMetadataItem struct {
	PaymentHash     string
	SenderComment   *string
	NostrZapRequest *string
	NostrZapReceipt *string
}

func (r *SetLnurlMetadataItem) Destroy() {
	FfiDestroyerString{}.Destroy(r.PaymentHash)
	FfiDestroyerOptionalString{}.Destroy(r.SenderComment)
	FfiDestroyerOptionalString{}.Destroy(r.NostrZapRequest)
	FfiDestroyerOptionalString{}.Destroy(r.NostrZapReceipt)
}

type FfiConverterSetLnurlMetadataItem struct{}

var FfiConverterSetLnurlMetadataItemINSTANCE = FfiConverterSetLnurlMetadataItem{}

func (c FfiConverterSetLnurlMetadataItem) Lift(rb RustBufferI) SetLnurlMetadataItem {
	return LiftFromRustBuffer[SetLnurlMetadataItem](c, rb)
}

func (c FfiConverterSetLnurlMetadataItem) Read(reader io.Reader) SetLnurlMetadataItem {
	return SetLnurlMetadataItem{
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterOptionalStringINSTANCE.Read(reader),
		FfiConverterOptionalStringINSTANCE.Read(reader),
		FfiConverterOptionalStringINSTANCE.Read(reader),
	}
}

func (c FfiConverterSetLnurlMetadataItem) Lower(value SetLnurlMetadataItem) C.RustBuffer {
	return LowerIntoRustBuffer[SetLnurlMetadataItem](c, value)
}

func (c FfiConverterSetLnurlMetadataItem) LowerExternal(value SetLnurlMetadataItem) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[SetLnurlMetadataItem](c, value))
}

func (c FfiConverterSetLnurlMetadataItem) Write(writer io.Writer, value SetLnurlMetadataItem) {
	FfiConverterStringINSTANCE.Write(writer, value.PaymentHash)
	FfiConverterOptionalStringINSTANCE.Write(writer, value.SenderComment)
	FfiConverterOptionalStringINSTANCE.Write(writer, value.NostrZapRequest)
	FfiConverterOptionalStringINSTANCE.Write(writer, value.NostrZapReceipt)
}

type FfiDestroyerSetLnurlMetadataItem struct{}

func (_ FfiDestroyerSetLnurlMetadataItem) Destroy(value SetLnurlMetadataItem) {
	value.Destroy()
}

type SignMessageRequest struct {
	Message string
	// If true, the signature will be encoded in compact format instead of DER format
	Compact bool
}

func (r *SignMessageRequest) Destroy() {
	FfiDestroyerString{}.Destroy(r.Message)
	FfiDestroyerBool{}.Destroy(r.Compact)
}

type FfiConverterSignMessageRequest struct{}

var FfiConverterSignMessageRequestINSTANCE = FfiConverterSignMessageRequest{}

func (c FfiConverterSignMessageRequest) Lift(rb RustBufferI) SignMessageRequest {
	return LiftFromRustBuffer[SignMessageRequest](c, rb)
}

func (c FfiConverterSignMessageRequest) Read(reader io.Reader) SignMessageRequest {
	return SignMessageRequest{
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterBoolINSTANCE.Read(reader),
	}
}

func (c FfiConverterSignMessageRequest) Lower(value SignMessageRequest) C.RustBuffer {
	return LowerIntoRustBuffer[SignMessageRequest](c, value)
}

func (c FfiConverterSignMessageRequest) LowerExternal(value SignMessageRequest) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[SignMessageRequest](c, value))
}

func (c FfiConverterSignMessageRequest) Write(writer io.Writer, value SignMessageRequest) {
	FfiConverterStringINSTANCE.Write(writer, value.Message)
	FfiConverterBoolINSTANCE.Write(writer, value.Compact)
}

type FfiDestroyerSignMessageRequest struct{}

func (_ FfiDestroyerSignMessageRequest) Destroy(value SignMessageRequest) {
	value.Destroy()
}

type SignMessageResponse struct {
	Pubkey string
	// The DER or compact hex encoded signature
	Signature string
}

func (r *SignMessageResponse) Destroy() {
	FfiDestroyerString{}.Destroy(r.Pubkey)
	FfiDestroyerString{}.Destroy(r.Signature)
}

type FfiConverterSignMessageResponse struct{}

var FfiConverterSignMessageResponseINSTANCE = FfiConverterSignMessageResponse{}

func (c FfiConverterSignMessageResponse) Lift(rb RustBufferI) SignMessageResponse {
	return LiftFromRustBuffer[SignMessageResponse](c, rb)
}

func (c FfiConverterSignMessageResponse) Read(reader io.Reader) SignMessageResponse {
	return SignMessageResponse{
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterStringINSTANCE.Read(reader),
	}
}

func (c FfiConverterSignMessageResponse) Lower(value SignMessageResponse) C.RustBuffer {
	return LowerIntoRustBuffer[SignMessageResponse](c, value)
}

func (c FfiConverterSignMessageResponse) LowerExternal(value SignMessageResponse) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[SignMessageResponse](c, value))
}

func (c FfiConverterSignMessageResponse) Write(writer io.Writer, value SignMessageResponse) {
	FfiConverterStringINSTANCE.Write(writer, value.Pubkey)
	FfiConverterStringINSTANCE.Write(writer, value.Signature)
}

type FfiDestroyerSignMessageResponse struct{}

func (_ FfiDestroyerSignMessageResponse) Destroy(value SignMessageResponse) {
	value.Destroy()
}

type SilentPaymentAddressDetails struct {
	Address string
	Network BitcoinNetwork
	Source  PaymentRequestSource
}

func (r *SilentPaymentAddressDetails) Destroy() {
	FfiDestroyerString{}.Destroy(r.Address)
	FfiDestroyerBitcoinNetwork{}.Destroy(r.Network)
	FfiDestroyerPaymentRequestSource{}.Destroy(r.Source)
}

type FfiConverterSilentPaymentAddressDetails struct{}

var FfiConverterSilentPaymentAddressDetailsINSTANCE = FfiConverterSilentPaymentAddressDetails{}

func (c FfiConverterSilentPaymentAddressDetails) Lift(rb RustBufferI) SilentPaymentAddressDetails {
	return LiftFromRustBuffer[SilentPaymentAddressDetails](c, rb)
}

func (c FfiConverterSilentPaymentAddressDetails) Read(reader io.Reader) SilentPaymentAddressDetails {
	return SilentPaymentAddressDetails{
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterBitcoinNetworkINSTANCE.Read(reader),
		FfiConverterPaymentRequestSourceINSTANCE.Read(reader),
	}
}

func (c FfiConverterSilentPaymentAddressDetails) Lower(value SilentPaymentAddressDetails) C.RustBuffer {
	return LowerIntoRustBuffer[SilentPaymentAddressDetails](c, value)
}

func (c FfiConverterSilentPaymentAddressDetails) LowerExternal(value SilentPaymentAddressDetails) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[SilentPaymentAddressDetails](c, value))
}

func (c FfiConverterSilentPaymentAddressDetails) Write(writer io.Writer, value SilentPaymentAddressDetails) {
	FfiConverterStringINSTANCE.Write(writer, value.Address)
	FfiConverterBitcoinNetworkINSTANCE.Write(writer, value.Network)
	FfiConverterPaymentRequestSourceINSTANCE.Write(writer, value.Source)
}

type FfiDestroyerSilentPaymentAddressDetails struct{}

func (_ FfiDestroyerSilentPaymentAddressDetails) Destroy(value SilentPaymentAddressDetails) {
	value.Destroy()
}

type SparkAddressDetails struct {
	// The raw address string
	Address string
	// The identity public key of the address owner
	IdentityPublicKey string
	Network           BitcoinNetwork
	Source            PaymentRequestSource
}

func (r *SparkAddressDetails) Destroy() {
	FfiDestroyerString{}.Destroy(r.Address)
	FfiDestroyerString{}.Destroy(r.IdentityPublicKey)
	FfiDestroyerBitcoinNetwork{}.Destroy(r.Network)
	FfiDestroyerPaymentRequestSource{}.Destroy(r.Source)
}

type FfiConverterSparkAddressDetails struct{}

var FfiConverterSparkAddressDetailsINSTANCE = FfiConverterSparkAddressDetails{}

func (c FfiConverterSparkAddressDetails) Lift(rb RustBufferI) SparkAddressDetails {
	return LiftFromRustBuffer[SparkAddressDetails](c, rb)
}

func (c FfiConverterSparkAddressDetails) Read(reader io.Reader) SparkAddressDetails {
	return SparkAddressDetails{
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterBitcoinNetworkINSTANCE.Read(reader),
		FfiConverterPaymentRequestSourceINSTANCE.Read(reader),
	}
}

func (c FfiConverterSparkAddressDetails) Lower(value SparkAddressDetails) C.RustBuffer {
	return LowerIntoRustBuffer[SparkAddressDetails](c, value)
}

func (c FfiConverterSparkAddressDetails) LowerExternal(value SparkAddressDetails) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[SparkAddressDetails](c, value))
}

func (c FfiConverterSparkAddressDetails) Write(writer io.Writer, value SparkAddressDetails) {
	FfiConverterStringINSTANCE.Write(writer, value.Address)
	FfiConverterStringINSTANCE.Write(writer, value.IdentityPublicKey)
	FfiConverterBitcoinNetworkINSTANCE.Write(writer, value.Network)
	FfiConverterPaymentRequestSourceINSTANCE.Write(writer, value.Source)
}

type FfiDestroyerSparkAddressDetails struct{}

func (_ FfiDestroyerSparkAddressDetails) Destroy(value SparkAddressDetails) {
	value.Destroy()
}

// Configuration for a custom Spark environment.
//
// When set on [`Config`], overrides the default Spark operator pool,
// service provider, threshold, and token settings. This allows connecting
// to alternative Spark deployments (e.g. dev/staging environments).
type SparkConfig struct {
	// Hex-encoded identifier of the coordinator operator.
	CoordinatorIdentifier string
	// The FROST signing threshold (e.g. 2 of 3).
	Threshold uint32
	// The set of signing operators.
	SigningOperators []SparkSigningOperator
	// Service provider (SSP) configuration.
	SspConfig SparkSspConfig
	// Expected bond amount in sats for token withdrawals.
	ExpectedWithdrawBondSats uint64
	// Expected relative block locktime for token withdrawals.
	ExpectedWithdrawRelativeBlockLocktime uint64
}

func (r *SparkConfig) Destroy() {
	FfiDestroyerString{}.Destroy(r.CoordinatorIdentifier)
	FfiDestroyerUint32{}.Destroy(r.Threshold)
	FfiDestroyerSequenceSparkSigningOperator{}.Destroy(r.SigningOperators)
	FfiDestroyerSparkSspConfig{}.Destroy(r.SspConfig)
	FfiDestroyerUint64{}.Destroy(r.ExpectedWithdrawBondSats)
	FfiDestroyerUint64{}.Destroy(r.ExpectedWithdrawRelativeBlockLocktime)
}

type FfiConverterSparkConfig struct{}

var FfiConverterSparkConfigINSTANCE = FfiConverterSparkConfig{}

func (c FfiConverterSparkConfig) Lift(rb RustBufferI) SparkConfig {
	return LiftFromRustBuffer[SparkConfig](c, rb)
}

func (c FfiConverterSparkConfig) Read(reader io.Reader) SparkConfig {
	return SparkConfig{
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterUint32INSTANCE.Read(reader),
		FfiConverterSequenceSparkSigningOperatorINSTANCE.Read(reader),
		FfiConverterSparkSspConfigINSTANCE.Read(reader),
		FfiConverterUint64INSTANCE.Read(reader),
		FfiConverterUint64INSTANCE.Read(reader),
	}
}

func (c FfiConverterSparkConfig) Lower(value SparkConfig) C.RustBuffer {
	return LowerIntoRustBuffer[SparkConfig](c, value)
}

func (c FfiConverterSparkConfig) LowerExternal(value SparkConfig) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[SparkConfig](c, value))
}

func (c FfiConverterSparkConfig) Write(writer io.Writer, value SparkConfig) {
	FfiConverterStringINSTANCE.Write(writer, value.CoordinatorIdentifier)
	FfiConverterUint32INSTANCE.Write(writer, value.Threshold)
	FfiConverterSequenceSparkSigningOperatorINSTANCE.Write(writer, value.SigningOperators)
	FfiConverterSparkSspConfigINSTANCE.Write(writer, value.SspConfig)
	FfiConverterUint64INSTANCE.Write(writer, value.ExpectedWithdrawBondSats)
	FfiConverterUint64INSTANCE.Write(writer, value.ExpectedWithdrawRelativeBlockLocktime)
}

type FfiDestroyerSparkConfig struct{}

func (_ FfiDestroyerSparkConfig) Destroy(value SparkConfig) {
	value.Destroy()
}

type SparkHtlcDetails struct {
	// The payment hash of the HTLC
	PaymentHash string
	// The preimage of the HTLC. Empty until receiver has released it.
	Preimage *string
	// The expiry time of the HTLC as a unix timestamp in seconds
	ExpiryTime uint64
	// The HTLC status
	Status SparkHtlcStatus
}

func (r *SparkHtlcDetails) Destroy() {
	FfiDestroyerString{}.Destroy(r.PaymentHash)
	FfiDestroyerOptionalString{}.Destroy(r.Preimage)
	FfiDestroyerUint64{}.Destroy(r.ExpiryTime)
	FfiDestroyerSparkHtlcStatus{}.Destroy(r.Status)
}

type FfiConverterSparkHtlcDetails struct{}

var FfiConverterSparkHtlcDetailsINSTANCE = FfiConverterSparkHtlcDetails{}

func (c FfiConverterSparkHtlcDetails) Lift(rb RustBufferI) SparkHtlcDetails {
	return LiftFromRustBuffer[SparkHtlcDetails](c, rb)
}

func (c FfiConverterSparkHtlcDetails) Read(reader io.Reader) SparkHtlcDetails {
	return SparkHtlcDetails{
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterOptionalStringINSTANCE.Read(reader),
		FfiConverterUint64INSTANCE.Read(reader),
		FfiConverterSparkHtlcStatusINSTANCE.Read(reader),
	}
}

func (c FfiConverterSparkHtlcDetails) Lower(value SparkHtlcDetails) C.RustBuffer {
	return LowerIntoRustBuffer[SparkHtlcDetails](c, value)
}

func (c FfiConverterSparkHtlcDetails) LowerExternal(value SparkHtlcDetails) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[SparkHtlcDetails](c, value))
}

func (c FfiConverterSparkHtlcDetails) Write(writer io.Writer, value SparkHtlcDetails) {
	FfiConverterStringINSTANCE.Write(writer, value.PaymentHash)
	FfiConverterOptionalStringINSTANCE.Write(writer, value.Preimage)
	FfiConverterUint64INSTANCE.Write(writer, value.ExpiryTime)
	FfiConverterSparkHtlcStatusINSTANCE.Write(writer, value.Status)
}

type FfiDestroyerSparkHtlcDetails struct{}

func (_ FfiDestroyerSparkHtlcDetails) Destroy(value SparkHtlcDetails) {
	value.Destroy()
}

type SparkHtlcOptions struct {
	// The payment hash of the HTLC. The receiver will need to provide the associated preimage to claim it.
	PaymentHash string
	// The duration of the HTLC in seconds.
	// After this time, the HTLC will be returned.
	ExpiryDurationSecs uint64
}

func (r *SparkHtlcOptions) Destroy() {
	FfiDestroyerString{}.Destroy(r.PaymentHash)
	FfiDestroyerUint64{}.Destroy(r.ExpiryDurationSecs)
}

type FfiConverterSparkHtlcOptions struct{}

var FfiConverterSparkHtlcOptionsINSTANCE = FfiConverterSparkHtlcOptions{}

func (c FfiConverterSparkHtlcOptions) Lift(rb RustBufferI) SparkHtlcOptions {
	return LiftFromRustBuffer[SparkHtlcOptions](c, rb)
}

func (c FfiConverterSparkHtlcOptions) Read(reader io.Reader) SparkHtlcOptions {
	return SparkHtlcOptions{
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterUint64INSTANCE.Read(reader),
	}
}

func (c FfiConverterSparkHtlcOptions) Lower(value SparkHtlcOptions) C.RustBuffer {
	return LowerIntoRustBuffer[SparkHtlcOptions](c, value)
}

func (c FfiConverterSparkHtlcOptions) LowerExternal(value SparkHtlcOptions) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[SparkHtlcOptions](c, value))
}

func (c FfiConverterSparkHtlcOptions) Write(writer io.Writer, value SparkHtlcOptions) {
	FfiConverterStringINSTANCE.Write(writer, value.PaymentHash)
	FfiConverterUint64INSTANCE.Write(writer, value.ExpiryDurationSecs)
}

type FfiDestroyerSparkHtlcOptions struct{}

func (_ FfiDestroyerSparkHtlcOptions) Destroy(value SparkHtlcOptions) {
	value.Destroy()
}

type SparkInvoiceDetails struct {
	// The raw invoice string
	Invoice string
	// The identity public key of the invoice issuer
	IdentityPublicKey string
	Network           BitcoinNetwork
	// Optional amount denominated in sats if `token_identifier` is absent, otherwise in the token base units
	Amount *u128
	// The token identifier of the token payment. Absence indicates a Bitcoin payment.
	TokenIdentifier *string
	// Optional expiry time as a unix timestamp in seconds. If not provided, the invoice will never expire.
	ExpiryTime *uint64
	// Optional description.
	Description *string
	// If set, the invoice may only be fulfilled by a payer with this public key.
	SenderPublicKey *string
}

func (r *SparkInvoiceDetails) Destroy() {
	FfiDestroyerString{}.Destroy(r.Invoice)
	FfiDestroyerString{}.Destroy(r.IdentityPublicKey)
	FfiDestroyerBitcoinNetwork{}.Destroy(r.Network)
	FfiDestroyerOptionalTypeu128{}.Destroy(r.Amount)
	FfiDestroyerOptionalString{}.Destroy(r.TokenIdentifier)
	FfiDestroyerOptionalUint64{}.Destroy(r.ExpiryTime)
	FfiDestroyerOptionalString{}.Destroy(r.Description)
	FfiDestroyerOptionalString{}.Destroy(r.SenderPublicKey)
}

type FfiConverterSparkInvoiceDetails struct{}

var FfiConverterSparkInvoiceDetailsINSTANCE = FfiConverterSparkInvoiceDetails{}

func (c FfiConverterSparkInvoiceDetails) Lift(rb RustBufferI) SparkInvoiceDetails {
	return LiftFromRustBuffer[SparkInvoiceDetails](c, rb)
}

func (c FfiConverterSparkInvoiceDetails) Read(reader io.Reader) SparkInvoiceDetails {
	return SparkInvoiceDetails{
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterBitcoinNetworkINSTANCE.Read(reader),
		FfiConverterOptionalTypeu128INSTANCE.Read(reader),
		FfiConverterOptionalStringINSTANCE.Read(reader),
		FfiConverterOptionalUint64INSTANCE.Read(reader),
		FfiConverterOptionalStringINSTANCE.Read(reader),
		FfiConverterOptionalStringINSTANCE.Read(reader),
	}
}

func (c FfiConverterSparkInvoiceDetails) Lower(value SparkInvoiceDetails) C.RustBuffer {
	return LowerIntoRustBuffer[SparkInvoiceDetails](c, value)
}

func (c FfiConverterSparkInvoiceDetails) LowerExternal(value SparkInvoiceDetails) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[SparkInvoiceDetails](c, value))
}

func (c FfiConverterSparkInvoiceDetails) Write(writer io.Writer, value SparkInvoiceDetails) {
	FfiConverterStringINSTANCE.Write(writer, value.Invoice)
	FfiConverterStringINSTANCE.Write(writer, value.IdentityPublicKey)
	FfiConverterBitcoinNetworkINSTANCE.Write(writer, value.Network)
	FfiConverterOptionalTypeu128INSTANCE.Write(writer, value.Amount)
	FfiConverterOptionalStringINSTANCE.Write(writer, value.TokenIdentifier)
	FfiConverterOptionalUint64INSTANCE.Write(writer, value.ExpiryTime)
	FfiConverterOptionalStringINSTANCE.Write(writer, value.Description)
	FfiConverterOptionalStringINSTANCE.Write(writer, value.SenderPublicKey)
}

type FfiDestroyerSparkInvoiceDetails struct{}

func (_ FfiDestroyerSparkInvoiceDetails) Destroy(value SparkInvoiceDetails) {
	value.Destroy()
}

type SparkInvoicePaymentDetails struct {
	// Represents the spark invoice description
	Description *string
	// The raw spark invoice string
	Invoice string
}

func (r *SparkInvoicePaymentDetails) Destroy() {
	FfiDestroyerOptionalString{}.Destroy(r.Description)
	FfiDestroyerString{}.Destroy(r.Invoice)
}

type FfiConverterSparkInvoicePaymentDetails struct{}

var FfiConverterSparkInvoicePaymentDetailsINSTANCE = FfiConverterSparkInvoicePaymentDetails{}

func (c FfiConverterSparkInvoicePaymentDetails) Lift(rb RustBufferI) SparkInvoicePaymentDetails {
	return LiftFromRustBuffer[SparkInvoicePaymentDetails](c, rb)
}

func (c FfiConverterSparkInvoicePaymentDetails) Read(reader io.Reader) SparkInvoicePaymentDetails {
	return SparkInvoicePaymentDetails{
		FfiConverterOptionalStringINSTANCE.Read(reader),
		FfiConverterStringINSTANCE.Read(reader),
	}
}

func (c FfiConverterSparkInvoicePaymentDetails) Lower(value SparkInvoicePaymentDetails) C.RustBuffer {
	return LowerIntoRustBuffer[SparkInvoicePaymentDetails](c, value)
}

func (c FfiConverterSparkInvoicePaymentDetails) LowerExternal(value SparkInvoicePaymentDetails) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[SparkInvoicePaymentDetails](c, value))
}

func (c FfiConverterSparkInvoicePaymentDetails) Write(writer io.Writer, value SparkInvoicePaymentDetails) {
	FfiConverterOptionalStringINSTANCE.Write(writer, value.Description)
	FfiConverterStringINSTANCE.Write(writer, value.Invoice)
}

type FfiDestroyerSparkInvoicePaymentDetails struct{}

func (_ FfiDestroyerSparkInvoicePaymentDetails) Destroy(value SparkInvoicePaymentDetails) {
	value.Destroy()
}

// A Spark signing operator.
type SparkSigningOperator struct {
	// Sequential operator ID (0-indexed).
	Id uint32
	// Hex-encoded 32-byte FROST identifier.
	Identifier string
	// gRPC address of the operator (e.g. `https://0.spark.lightspark.com`).
	Address string
	// Hex-encoded compressed public key of the operator.
	IdentityPublicKey string
}

func (r *SparkSigningOperator) Destroy() {
	FfiDestroyerUint32{}.Destroy(r.Id)
	FfiDestroyerString{}.Destroy(r.Identifier)
	FfiDestroyerString{}.Destroy(r.Address)
	FfiDestroyerString{}.Destroy(r.IdentityPublicKey)
}

type FfiConverterSparkSigningOperator struct{}

var FfiConverterSparkSigningOperatorINSTANCE = FfiConverterSparkSigningOperator{}

func (c FfiConverterSparkSigningOperator) Lift(rb RustBufferI) SparkSigningOperator {
	return LiftFromRustBuffer[SparkSigningOperator](c, rb)
}

func (c FfiConverterSparkSigningOperator) Read(reader io.Reader) SparkSigningOperator {
	return SparkSigningOperator{
		FfiConverterUint32INSTANCE.Read(reader),
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterStringINSTANCE.Read(reader),
	}
}

func (c FfiConverterSparkSigningOperator) Lower(value SparkSigningOperator) C.RustBuffer {
	return LowerIntoRustBuffer[SparkSigningOperator](c, value)
}

func (c FfiConverterSparkSigningOperator) LowerExternal(value SparkSigningOperator) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[SparkSigningOperator](c, value))
}

func (c FfiConverterSparkSigningOperator) Write(writer io.Writer, value SparkSigningOperator) {
	FfiConverterUint32INSTANCE.Write(writer, value.Id)
	FfiConverterStringINSTANCE.Write(writer, value.Identifier)
	FfiConverterStringINSTANCE.Write(writer, value.Address)
	FfiConverterStringINSTANCE.Write(writer, value.IdentityPublicKey)
}

type FfiDestroyerSparkSigningOperator struct{}

func (_ FfiDestroyerSparkSigningOperator) Destroy(value SparkSigningOperator) {
	value.Destroy()
}

// Configuration for the Spark Service Provider (SSP).
type SparkSspConfig struct {
	// Base URL of the SSP GraphQL API.
	BaseUrl string
	// Hex-encoded compressed public key of the SSP.
	IdentityPublicKey string
	// Optional GraphQL schema endpoint path (e.g. "graphql/spark/rc").
	// Defaults to the hardcoded schema endpoint if not set.
	SchemaEndpoint *string
}

func (r *SparkSspConfig) Destroy() {
	FfiDestroyerString{}.Destroy(r.BaseUrl)
	FfiDestroyerString{}.Destroy(r.IdentityPublicKey)
	FfiDestroyerOptionalString{}.Destroy(r.SchemaEndpoint)
}

type FfiConverterSparkSspConfig struct{}

var FfiConverterSparkSspConfigINSTANCE = FfiConverterSparkSspConfig{}

func (c FfiConverterSparkSspConfig) Lift(rb RustBufferI) SparkSspConfig {
	return LiftFromRustBuffer[SparkSspConfig](c, rb)
}

func (c FfiConverterSparkSspConfig) Read(reader io.Reader) SparkSspConfig {
	return SparkSspConfig{
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterOptionalStringINSTANCE.Read(reader),
	}
}

func (c FfiConverterSparkSspConfig) Lower(value SparkSspConfig) C.RustBuffer {
	return LowerIntoRustBuffer[SparkSspConfig](c, value)
}

func (c FfiConverterSparkSspConfig) LowerExternal(value SparkSspConfig) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[SparkSspConfig](c, value))
}

func (c FfiConverterSparkSspConfig) Write(writer io.Writer, value SparkSspConfig) {
	FfiConverterStringINSTANCE.Write(writer, value.BaseUrl)
	FfiConverterStringINSTANCE.Write(writer, value.IdentityPublicKey)
	FfiConverterOptionalStringINSTANCE.Write(writer, value.SchemaEndpoint)
}

type FfiDestroyerSparkSspConfig struct{}

func (_ FfiDestroyerSparkSspConfig) Destroy(value SparkSspConfig) {
	value.Destroy()
}

// The status of the Spark network services relevant to the SDK.
type SparkStatus struct {
	// The worst status across all relevant services.
	Status ServiceStatus
	// The last time the status was updated, as a unix timestamp in seconds.
	LastUpdated uint64
}

func (r *SparkStatus) Destroy() {
	FfiDestroyerServiceStatus{}.Destroy(r.Status)
	FfiDestroyerUint64{}.Destroy(r.LastUpdated)
}

type FfiConverterSparkStatus struct{}

var FfiConverterSparkStatusINSTANCE = FfiConverterSparkStatus{}

func (c FfiConverterSparkStatus) Lift(rb RustBufferI) SparkStatus {
	return LiftFromRustBuffer[SparkStatus](c, rb)
}

func (c FfiConverterSparkStatus) Read(reader io.Reader) SparkStatus {
	return SparkStatus{
		FfiConverterServiceStatusINSTANCE.Read(reader),
		FfiConverterUint64INSTANCE.Read(reader),
	}
}

func (c FfiConverterSparkStatus) Lower(value SparkStatus) C.RustBuffer {
	return LowerIntoRustBuffer[SparkStatus](c, value)
}

func (c FfiConverterSparkStatus) LowerExternal(value SparkStatus) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[SparkStatus](c, value))
}

func (c FfiConverterSparkStatus) Write(writer io.Writer, value SparkStatus) {
	FfiConverterServiceStatusINSTANCE.Write(writer, value.Status)
	FfiConverterUint64INSTANCE.Write(writer, value.LastUpdated)
}

type FfiDestroyerSparkStatus struct{}

func (_ FfiDestroyerSparkStatus) Destroy(value SparkStatus) {
	value.Destroy()
}

// Configuration for automatic conversion of Bitcoin to stable tokens.
//
// When configured, the SDK automatically monitors the Bitcoin balance after each
// wallet sync. When the balance exceeds the configured threshold plus the reserved
// amount, the SDK automatically converts the excess balance (above the reserve)
// to the active stable token.
//
// When the balance is held in a stable token, Bitcoin payments can still be sent.
// The SDK automatically detects when there's not enough Bitcoin balance to cover a
// payment and auto-populates the token-to-Bitcoin conversion options to facilitate
// the payment.
//
// The active token can be changed at runtime via [`UpdateUserSettingsRequest`].
type StableBalanceConfig struct {
	// Available tokens that can be used for stable balance.
	Tokens []StableBalanceToken
	// The label of the token to activate by default.
	//
	// If `None`, stable balance starts deactivated. The user can activate it
	// at runtime via [`UpdateUserSettingsRequest`]. If a user setting is cached
	// locally, it takes precedence over this default.
	DefaultActiveLabel *string
	// The minimum sats balance that triggers auto-conversion.
	//
	// If not provided, uses the minimum from conversion limits.
	// If provided but less than the conversion limit minimum, the limit minimum is used.
	ThresholdSats *uint64
	// Maximum slippage in basis points (1/100 of a percent).
	//
	// Defaults to 10 bps (0.1%) if not set.
	MaxSlippageBps *uint32
}

func (r *StableBalanceConfig) Destroy() {
	FfiDestroyerSequenceStableBalanceToken{}.Destroy(r.Tokens)
	FfiDestroyerOptionalString{}.Destroy(r.DefaultActiveLabel)
	FfiDestroyerOptionalUint64{}.Destroy(r.ThresholdSats)
	FfiDestroyerOptionalUint32{}.Destroy(r.MaxSlippageBps)
}

type FfiConverterStableBalanceConfig struct{}

var FfiConverterStableBalanceConfigINSTANCE = FfiConverterStableBalanceConfig{}

func (c FfiConverterStableBalanceConfig) Lift(rb RustBufferI) StableBalanceConfig {
	return LiftFromRustBuffer[StableBalanceConfig](c, rb)
}

func (c FfiConverterStableBalanceConfig) Read(reader io.Reader) StableBalanceConfig {
	return StableBalanceConfig{
		FfiConverterSequenceStableBalanceTokenINSTANCE.Read(reader),
		FfiConverterOptionalStringINSTANCE.Read(reader),
		FfiConverterOptionalUint64INSTANCE.Read(reader),
		FfiConverterOptionalUint32INSTANCE.Read(reader),
	}
}

func (c FfiConverterStableBalanceConfig) Lower(value StableBalanceConfig) C.RustBuffer {
	return LowerIntoRustBuffer[StableBalanceConfig](c, value)
}

func (c FfiConverterStableBalanceConfig) LowerExternal(value StableBalanceConfig) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[StableBalanceConfig](c, value))
}

func (c FfiConverterStableBalanceConfig) Write(writer io.Writer, value StableBalanceConfig) {
	FfiConverterSequenceStableBalanceTokenINSTANCE.Write(writer, value.Tokens)
	FfiConverterOptionalStringINSTANCE.Write(writer, value.DefaultActiveLabel)
	FfiConverterOptionalUint64INSTANCE.Write(writer, value.ThresholdSats)
	FfiConverterOptionalUint32INSTANCE.Write(writer, value.MaxSlippageBps)
}

type FfiDestroyerStableBalanceConfig struct{}

func (_ FfiDestroyerStableBalanceConfig) Destroy(value StableBalanceConfig) {
	value.Destroy()
}

// A stable token that can be used for automatic balance conversion.
type StableBalanceToken struct {
	// Integrator-defined display label for the token, e.g. "USD".
	//
	// This is a short, human-readable name set by the integrator for display purposes.
	// It is **not** a canonical Spark token ticker — it has no protocol-level meaning.
	// Labels must be unique within the [`StableBalanceConfig::tokens`] list.
	Label string
	// The full token identifier string used for conversions.
	TokenIdentifier string
}

func (r *StableBalanceToken) Destroy() {
	FfiDestroyerString{}.Destroy(r.Label)
	FfiDestroyerString{}.Destroy(r.TokenIdentifier)
}

type FfiConverterStableBalanceToken struct{}

var FfiConverterStableBalanceTokenINSTANCE = FfiConverterStableBalanceToken{}

func (c FfiConverterStableBalanceToken) Lift(rb RustBufferI) StableBalanceToken {
	return LiftFromRustBuffer[StableBalanceToken](c, rb)
}

func (c FfiConverterStableBalanceToken) Read(reader io.Reader) StableBalanceToken {
	return StableBalanceToken{
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterStringINSTANCE.Read(reader),
	}
}

func (c FfiConverterStableBalanceToken) Lower(value StableBalanceToken) C.RustBuffer {
	return LowerIntoRustBuffer[StableBalanceToken](c, value)
}

func (c FfiConverterStableBalanceToken) LowerExternal(value StableBalanceToken) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[StableBalanceToken](c, value))
}

func (c FfiConverterStableBalanceToken) Write(writer io.Writer, value StableBalanceToken) {
	FfiConverterStringINSTANCE.Write(writer, value.Label)
	FfiConverterStringINSTANCE.Write(writer, value.TokenIdentifier)
}

type FfiDestroyerStableBalanceToken struct{}

func (_ FfiDestroyerStableBalanceToken) Destroy(value StableBalanceToken) {
	value.Destroy()
}

// Storage-internal variant of [`ListPaymentsRequest`] that uses
// [`StoragePaymentDetailsFilter`] instead of the public [`PaymentDetailsFilter`].
type StorageListPaymentsRequest struct {
	TypeFilter           *[]PaymentType
	StatusFilter         *[]PaymentStatus
	AssetFilter          *AssetFilter
	PaymentDetailsFilter *[]StoragePaymentDetailsFilter
	FromTimestamp        *uint64
	ToTimestamp          *uint64
	Offset               *uint32
	Limit                *uint32
	SortAscending        *bool
}

func (r *StorageListPaymentsRequest) Destroy() {
	FfiDestroyerOptionalSequencePaymentType{}.Destroy(r.TypeFilter)
	FfiDestroyerOptionalSequencePaymentStatus{}.Destroy(r.StatusFilter)
	FfiDestroyerOptionalAssetFilter{}.Destroy(r.AssetFilter)
	FfiDestroyerOptionalSequenceStoragePaymentDetailsFilter{}.Destroy(r.PaymentDetailsFilter)
	FfiDestroyerOptionalUint64{}.Destroy(r.FromTimestamp)
	FfiDestroyerOptionalUint64{}.Destroy(r.ToTimestamp)
	FfiDestroyerOptionalUint32{}.Destroy(r.Offset)
	FfiDestroyerOptionalUint32{}.Destroy(r.Limit)
	FfiDestroyerOptionalBool{}.Destroy(r.SortAscending)
}

type FfiConverterStorageListPaymentsRequest struct{}

var FfiConverterStorageListPaymentsRequestINSTANCE = FfiConverterStorageListPaymentsRequest{}

func (c FfiConverterStorageListPaymentsRequest) Lift(rb RustBufferI) StorageListPaymentsRequest {
	return LiftFromRustBuffer[StorageListPaymentsRequest](c, rb)
}

func (c FfiConverterStorageListPaymentsRequest) Read(reader io.Reader) StorageListPaymentsRequest {
	return StorageListPaymentsRequest{
		FfiConverterOptionalSequencePaymentTypeINSTANCE.Read(reader),
		FfiConverterOptionalSequencePaymentStatusINSTANCE.Read(reader),
		FfiConverterOptionalAssetFilterINSTANCE.Read(reader),
		FfiConverterOptionalSequenceStoragePaymentDetailsFilterINSTANCE.Read(reader),
		FfiConverterOptionalUint64INSTANCE.Read(reader),
		FfiConverterOptionalUint64INSTANCE.Read(reader),
		FfiConverterOptionalUint32INSTANCE.Read(reader),
		FfiConverterOptionalUint32INSTANCE.Read(reader),
		FfiConverterOptionalBoolINSTANCE.Read(reader),
	}
}

func (c FfiConverterStorageListPaymentsRequest) Lower(value StorageListPaymentsRequest) C.RustBuffer {
	return LowerIntoRustBuffer[StorageListPaymentsRequest](c, value)
}

func (c FfiConverterStorageListPaymentsRequest) LowerExternal(value StorageListPaymentsRequest) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[StorageListPaymentsRequest](c, value))
}

func (c FfiConverterStorageListPaymentsRequest) Write(writer io.Writer, value StorageListPaymentsRequest) {
	FfiConverterOptionalSequencePaymentTypeINSTANCE.Write(writer, value.TypeFilter)
	FfiConverterOptionalSequencePaymentStatusINSTANCE.Write(writer, value.StatusFilter)
	FfiConverterOptionalAssetFilterINSTANCE.Write(writer, value.AssetFilter)
	FfiConverterOptionalSequenceStoragePaymentDetailsFilterINSTANCE.Write(writer, value.PaymentDetailsFilter)
	FfiConverterOptionalUint64INSTANCE.Write(writer, value.FromTimestamp)
	FfiConverterOptionalUint64INSTANCE.Write(writer, value.ToTimestamp)
	FfiConverterOptionalUint32INSTANCE.Write(writer, value.Offset)
	FfiConverterOptionalUint32INSTANCE.Write(writer, value.Limit)
	FfiConverterOptionalBoolINSTANCE.Write(writer, value.SortAscending)
}

type FfiDestroyerStorageListPaymentsRequest struct{}

func (_ FfiDestroyerStorageListPaymentsRequest) Destroy(value StorageListPaymentsRequest) {
	value.Destroy()
}

// Settings for the symbol representation of a currency
type Symbol struct {
	Grapheme *string
	Template *string
	Rtl      *bool
	Position *uint32
}

func (r *Symbol) Destroy() {
	FfiDestroyerOptionalString{}.Destroy(r.Grapheme)
	FfiDestroyerOptionalString{}.Destroy(r.Template)
	FfiDestroyerOptionalBool{}.Destroy(r.Rtl)
	FfiDestroyerOptionalUint32{}.Destroy(r.Position)
}

type FfiConverterSymbol struct{}

var FfiConverterSymbolINSTANCE = FfiConverterSymbol{}

func (c FfiConverterSymbol) Lift(rb RustBufferI) Symbol {
	return LiftFromRustBuffer[Symbol](c, rb)
}

func (c FfiConverterSymbol) Read(reader io.Reader) Symbol {
	return Symbol{
		FfiConverterOptionalStringINSTANCE.Read(reader),
		FfiConverterOptionalStringINSTANCE.Read(reader),
		FfiConverterOptionalBoolINSTANCE.Read(reader),
		FfiConverterOptionalUint32INSTANCE.Read(reader),
	}
}

func (c FfiConverterSymbol) Lower(value Symbol) C.RustBuffer {
	return LowerIntoRustBuffer[Symbol](c, value)
}

func (c FfiConverterSymbol) LowerExternal(value Symbol) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[Symbol](c, value))
}

func (c FfiConverterSymbol) Write(writer io.Writer, value Symbol) {
	FfiConverterOptionalStringINSTANCE.Write(writer, value.Grapheme)
	FfiConverterOptionalStringINSTANCE.Write(writer, value.Template)
	FfiConverterOptionalBoolINSTANCE.Write(writer, value.Rtl)
	FfiConverterOptionalUint32INSTANCE.Write(writer, value.Position)
}

type FfiDestroyerSymbol struct{}

func (_ FfiDestroyerSymbol) Destroy(value Symbol) {
	value.Destroy()
}

// Request to sync the wallet with the Spark network
type SyncWalletRequest struct {
}

func (r *SyncWalletRequest) Destroy() {
}

type FfiConverterSyncWalletRequest struct{}

var FfiConverterSyncWalletRequestINSTANCE = FfiConverterSyncWalletRequest{}

func (c FfiConverterSyncWalletRequest) Lift(rb RustBufferI) SyncWalletRequest {
	return LiftFromRustBuffer[SyncWalletRequest](c, rb)
}

func (c FfiConverterSyncWalletRequest) Read(reader io.Reader) SyncWalletRequest {
	return SyncWalletRequest{}
}

func (c FfiConverterSyncWalletRequest) Lower(value SyncWalletRequest) C.RustBuffer {
	return LowerIntoRustBuffer[SyncWalletRequest](c, value)
}

func (c FfiConverterSyncWalletRequest) LowerExternal(value SyncWalletRequest) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[SyncWalletRequest](c, value))
}

func (c FfiConverterSyncWalletRequest) Write(writer io.Writer, value SyncWalletRequest) {
}

type FfiDestroyerSyncWalletRequest struct{}

func (_ FfiDestroyerSyncWalletRequest) Destroy(value SyncWalletRequest) {
	value.Destroy()
}

// Response from synchronizing the wallet
type SyncWalletResponse struct {
}

func (r *SyncWalletResponse) Destroy() {
}

type FfiConverterSyncWalletResponse struct{}

var FfiConverterSyncWalletResponseINSTANCE = FfiConverterSyncWalletResponse{}

func (c FfiConverterSyncWalletResponse) Lift(rb RustBufferI) SyncWalletResponse {
	return LiftFromRustBuffer[SyncWalletResponse](c, rb)
}

func (c FfiConverterSyncWalletResponse) Read(reader io.Reader) SyncWalletResponse {
	return SyncWalletResponse{}
}

func (c FfiConverterSyncWalletResponse) Lower(value SyncWalletResponse) C.RustBuffer {
	return LowerIntoRustBuffer[SyncWalletResponse](c, value)
}

func (c FfiConverterSyncWalletResponse) LowerExternal(value SyncWalletResponse) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[SyncWalletResponse](c, value))
}

func (c FfiConverterSyncWalletResponse) Write(writer io.Writer, value SyncWalletResponse) {
}

type FfiDestroyerSyncWalletResponse struct{}

func (_ FfiDestroyerSyncWalletResponse) Destroy(value SyncWalletResponse) {
	value.Destroy()
}

type TokenBalance struct {
	Balance       u128
	TokenMetadata TokenMetadata
}

func (r *TokenBalance) Destroy() {
	FfiDestroyerTypeu128{}.Destroy(r.Balance)
	FfiDestroyerTokenMetadata{}.Destroy(r.TokenMetadata)
}

type FfiConverterTokenBalance struct{}

var FfiConverterTokenBalanceINSTANCE = FfiConverterTokenBalance{}

func (c FfiConverterTokenBalance) Lift(rb RustBufferI) TokenBalance {
	return LiftFromRustBuffer[TokenBalance](c, rb)
}

func (c FfiConverterTokenBalance) Read(reader io.Reader) TokenBalance {
	return TokenBalance{
		FfiConverterTypeu128INSTANCE.Read(reader),
		FfiConverterTokenMetadataINSTANCE.Read(reader),
	}
}

func (c FfiConverterTokenBalance) Lower(value TokenBalance) C.RustBuffer {
	return LowerIntoRustBuffer[TokenBalance](c, value)
}

func (c FfiConverterTokenBalance) LowerExternal(value TokenBalance) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[TokenBalance](c, value))
}

func (c FfiConverterTokenBalance) Write(writer io.Writer, value TokenBalance) {
	FfiConverterTypeu128INSTANCE.Write(writer, value.Balance)
	FfiConverterTokenMetadataINSTANCE.Write(writer, value.TokenMetadata)
}

type FfiDestroyerTokenBalance struct{}

func (_ FfiDestroyerTokenBalance) Destroy(value TokenBalance) {
	value.Destroy()
}

type TokenMetadata struct {
	Identifier string
	// Hex representation of the issuer public key
	IssuerPublicKey string
	Name            string
	Ticker          string
	// Number of decimals the token uses
	Decimals    uint32
	MaxSupply   u128
	IsFreezable bool
}

func (r *TokenMetadata) Destroy() {
	FfiDestroyerString{}.Destroy(r.Identifier)
	FfiDestroyerString{}.Destroy(r.IssuerPublicKey)
	FfiDestroyerString{}.Destroy(r.Name)
	FfiDestroyerString{}.Destroy(r.Ticker)
	FfiDestroyerUint32{}.Destroy(r.Decimals)
	FfiDestroyerTypeu128{}.Destroy(r.MaxSupply)
	FfiDestroyerBool{}.Destroy(r.IsFreezable)
}

type FfiConverterTokenMetadata struct{}

var FfiConverterTokenMetadataINSTANCE = FfiConverterTokenMetadata{}

func (c FfiConverterTokenMetadata) Lift(rb RustBufferI) TokenMetadata {
	return LiftFromRustBuffer[TokenMetadata](c, rb)
}

func (c FfiConverterTokenMetadata) Read(reader io.Reader) TokenMetadata {
	return TokenMetadata{
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterUint32INSTANCE.Read(reader),
		FfiConverterTypeu128INSTANCE.Read(reader),
		FfiConverterBoolINSTANCE.Read(reader),
	}
}

func (c FfiConverterTokenMetadata) Lower(value TokenMetadata) C.RustBuffer {
	return LowerIntoRustBuffer[TokenMetadata](c, value)
}

func (c FfiConverterTokenMetadata) LowerExternal(value TokenMetadata) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[TokenMetadata](c, value))
}

func (c FfiConverterTokenMetadata) Write(writer io.Writer, value TokenMetadata) {
	FfiConverterStringINSTANCE.Write(writer, value.Identifier)
	FfiConverterStringINSTANCE.Write(writer, value.IssuerPublicKey)
	FfiConverterStringINSTANCE.Write(writer, value.Name)
	FfiConverterStringINSTANCE.Write(writer, value.Ticker)
	FfiConverterUint32INSTANCE.Write(writer, value.Decimals)
	FfiConverterTypeu128INSTANCE.Write(writer, value.MaxSupply)
	FfiConverterBoolINSTANCE.Write(writer, value.IsFreezable)
}

type FfiDestroyerTokenMetadata struct{}

func (_ FfiDestroyerTokenMetadata) Destroy(value TokenMetadata) {
	value.Destroy()
}

type TxStatus struct {
	Confirmed   bool
	BlockHeight *uint32
	BlockTime   *uint64
}

func (r *TxStatus) Destroy() {
	FfiDestroyerBool{}.Destroy(r.Confirmed)
	FfiDestroyerOptionalUint32{}.Destroy(r.BlockHeight)
	FfiDestroyerOptionalUint64{}.Destroy(r.BlockTime)
}

type FfiConverterTxStatus struct{}

var FfiConverterTxStatusINSTANCE = FfiConverterTxStatus{}

func (c FfiConverterTxStatus) Lift(rb RustBufferI) TxStatus {
	return LiftFromRustBuffer[TxStatus](c, rb)
}

func (c FfiConverterTxStatus) Read(reader io.Reader) TxStatus {
	return TxStatus{
		FfiConverterBoolINSTANCE.Read(reader),
		FfiConverterOptionalUint32INSTANCE.Read(reader),
		FfiConverterOptionalUint64INSTANCE.Read(reader),
	}
}

func (c FfiConverterTxStatus) Lower(value TxStatus) C.RustBuffer {
	return LowerIntoRustBuffer[TxStatus](c, value)
}

func (c FfiConverterTxStatus) LowerExternal(value TxStatus) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[TxStatus](c, value))
}

func (c FfiConverterTxStatus) Write(writer io.Writer, value TxStatus) {
	FfiConverterBoolINSTANCE.Write(writer, value.Confirmed)
	FfiConverterOptionalUint32INSTANCE.Write(writer, value.BlockHeight)
	FfiConverterOptionalUint64INSTANCE.Write(writer, value.BlockTime)
}

type FfiDestroyerTxStatus struct{}

func (_ FfiDestroyerTxStatus) Destroy(value TxStatus) {
	value.Destroy()
}

type UnfreezeIssuerTokenRequest struct {
	Address string
}

func (r *UnfreezeIssuerTokenRequest) Destroy() {
	FfiDestroyerString{}.Destroy(r.Address)
}

type FfiConverterUnfreezeIssuerTokenRequest struct{}

var FfiConverterUnfreezeIssuerTokenRequestINSTANCE = FfiConverterUnfreezeIssuerTokenRequest{}

func (c FfiConverterUnfreezeIssuerTokenRequest) Lift(rb RustBufferI) UnfreezeIssuerTokenRequest {
	return LiftFromRustBuffer[UnfreezeIssuerTokenRequest](c, rb)
}

func (c FfiConverterUnfreezeIssuerTokenRequest) Read(reader io.Reader) UnfreezeIssuerTokenRequest {
	return UnfreezeIssuerTokenRequest{
		FfiConverterStringINSTANCE.Read(reader),
	}
}

func (c FfiConverterUnfreezeIssuerTokenRequest) Lower(value UnfreezeIssuerTokenRequest) C.RustBuffer {
	return LowerIntoRustBuffer[UnfreezeIssuerTokenRequest](c, value)
}

func (c FfiConverterUnfreezeIssuerTokenRequest) LowerExternal(value UnfreezeIssuerTokenRequest) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[UnfreezeIssuerTokenRequest](c, value))
}

func (c FfiConverterUnfreezeIssuerTokenRequest) Write(writer io.Writer, value UnfreezeIssuerTokenRequest) {
	FfiConverterStringINSTANCE.Write(writer, value.Address)
}

type FfiDestroyerUnfreezeIssuerTokenRequest struct{}

func (_ FfiDestroyerUnfreezeIssuerTokenRequest) Destroy(value UnfreezeIssuerTokenRequest) {
	value.Destroy()
}

type UnfreezeIssuerTokenResponse struct {
	ImpactedOutputIds   []string
	ImpactedTokenAmount u128
}

func (r *UnfreezeIssuerTokenResponse) Destroy() {
	FfiDestroyerSequenceString{}.Destroy(r.ImpactedOutputIds)
	FfiDestroyerTypeu128{}.Destroy(r.ImpactedTokenAmount)
}

type FfiConverterUnfreezeIssuerTokenResponse struct{}

var FfiConverterUnfreezeIssuerTokenResponseINSTANCE = FfiConverterUnfreezeIssuerTokenResponse{}

func (c FfiConverterUnfreezeIssuerTokenResponse) Lift(rb RustBufferI) UnfreezeIssuerTokenResponse {
	return LiftFromRustBuffer[UnfreezeIssuerTokenResponse](c, rb)
}

func (c FfiConverterUnfreezeIssuerTokenResponse) Read(reader io.Reader) UnfreezeIssuerTokenResponse {
	return UnfreezeIssuerTokenResponse{
		FfiConverterSequenceStringINSTANCE.Read(reader),
		FfiConverterTypeu128INSTANCE.Read(reader),
	}
}

func (c FfiConverterUnfreezeIssuerTokenResponse) Lower(value UnfreezeIssuerTokenResponse) C.RustBuffer {
	return LowerIntoRustBuffer[UnfreezeIssuerTokenResponse](c, value)
}

func (c FfiConverterUnfreezeIssuerTokenResponse) LowerExternal(value UnfreezeIssuerTokenResponse) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[UnfreezeIssuerTokenResponse](c, value))
}

func (c FfiConverterUnfreezeIssuerTokenResponse) Write(writer io.Writer, value UnfreezeIssuerTokenResponse) {
	FfiConverterSequenceStringINSTANCE.Write(writer, value.ImpactedOutputIds)
	FfiConverterTypeu128INSTANCE.Write(writer, value.ImpactedTokenAmount)
}

type FfiDestroyerUnfreezeIssuerTokenResponse struct{}

func (_ FfiDestroyerUnfreezeIssuerTokenResponse) Destroy(value UnfreezeIssuerTokenResponse) {
	value.Destroy()
}

// Request to unregister an existing webhook.
type UnregisterWebhookRequest struct {
	// The unique identifier of the webhook to unregister.
	WebhookId string
}

func (r *UnregisterWebhookRequest) Destroy() {
	FfiDestroyerString{}.Destroy(r.WebhookId)
}

type FfiConverterUnregisterWebhookRequest struct{}

var FfiConverterUnregisterWebhookRequestINSTANCE = FfiConverterUnregisterWebhookRequest{}

func (c FfiConverterUnregisterWebhookRequest) Lift(rb RustBufferI) UnregisterWebhookRequest {
	return LiftFromRustBuffer[UnregisterWebhookRequest](c, rb)
}

func (c FfiConverterUnregisterWebhookRequest) Read(reader io.Reader) UnregisterWebhookRequest {
	return UnregisterWebhookRequest{
		FfiConverterStringINSTANCE.Read(reader),
	}
}

func (c FfiConverterUnregisterWebhookRequest) Lower(value UnregisterWebhookRequest) C.RustBuffer {
	return LowerIntoRustBuffer[UnregisterWebhookRequest](c, value)
}

func (c FfiConverterUnregisterWebhookRequest) LowerExternal(value UnregisterWebhookRequest) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[UnregisterWebhookRequest](c, value))
}

func (c FfiConverterUnregisterWebhookRequest) Write(writer io.Writer, value UnregisterWebhookRequest) {
	FfiConverterStringINSTANCE.Write(writer, value.WebhookId)
}

type FfiDestroyerUnregisterWebhookRequest struct{}

func (_ FfiDestroyerUnregisterWebhookRequest) Destroy(value UnregisterWebhookRequest) {
	value.Destroy()
}

type UnversionedRecordChange struct {
	Id            RecordId
	SchemaVersion string
	UpdatedFields map[string]string
}

func (r *UnversionedRecordChange) Destroy() {
	FfiDestroyerRecordId{}.Destroy(r.Id)
	FfiDestroyerString{}.Destroy(r.SchemaVersion)
	FfiDestroyerMapStringString{}.Destroy(r.UpdatedFields)
}

type FfiConverterUnversionedRecordChange struct{}

var FfiConverterUnversionedRecordChangeINSTANCE = FfiConverterUnversionedRecordChange{}

func (c FfiConverterUnversionedRecordChange) Lift(rb RustBufferI) UnversionedRecordChange {
	return LiftFromRustBuffer[UnversionedRecordChange](c, rb)
}

func (c FfiConverterUnversionedRecordChange) Read(reader io.Reader) UnversionedRecordChange {
	return UnversionedRecordChange{
		FfiConverterRecordIdINSTANCE.Read(reader),
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterMapStringStringINSTANCE.Read(reader),
	}
}

func (c FfiConverterUnversionedRecordChange) Lower(value UnversionedRecordChange) C.RustBuffer {
	return LowerIntoRustBuffer[UnversionedRecordChange](c, value)
}

func (c FfiConverterUnversionedRecordChange) LowerExternal(value UnversionedRecordChange) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[UnversionedRecordChange](c, value))
}

func (c FfiConverterUnversionedRecordChange) Write(writer io.Writer, value UnversionedRecordChange) {
	FfiConverterRecordIdINSTANCE.Write(writer, value.Id)
	FfiConverterStringINSTANCE.Write(writer, value.SchemaVersion)
	FfiConverterMapStringStringINSTANCE.Write(writer, value.UpdatedFields)
}

type FfiDestroyerUnversionedRecordChange struct{}

func (_ FfiDestroyerUnversionedRecordChange) Destroy(value UnversionedRecordChange) {
	value.Destroy()
}

// Request to update an existing contact.
type UpdateContactRequest struct {
	Id   string
	Name string
	// A Lightning address (user@domain).
	PaymentIdentifier string
}

func (r *UpdateContactRequest) Destroy() {
	FfiDestroyerString{}.Destroy(r.Id)
	FfiDestroyerString{}.Destroy(r.Name)
	FfiDestroyerString{}.Destroy(r.PaymentIdentifier)
}

type FfiConverterUpdateContactRequest struct{}

var FfiConverterUpdateContactRequestINSTANCE = FfiConverterUpdateContactRequest{}

func (c FfiConverterUpdateContactRequest) Lift(rb RustBufferI) UpdateContactRequest {
	return LiftFromRustBuffer[UpdateContactRequest](c, rb)
}

func (c FfiConverterUpdateContactRequest) Read(reader io.Reader) UpdateContactRequest {
	return UpdateContactRequest{
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterStringINSTANCE.Read(reader),
	}
}

func (c FfiConverterUpdateContactRequest) Lower(value UpdateContactRequest) C.RustBuffer {
	return LowerIntoRustBuffer[UpdateContactRequest](c, value)
}

func (c FfiConverterUpdateContactRequest) LowerExternal(value UpdateContactRequest) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[UpdateContactRequest](c, value))
}

func (c FfiConverterUpdateContactRequest) Write(writer io.Writer, value UpdateContactRequest) {
	FfiConverterStringINSTANCE.Write(writer, value.Id)
	FfiConverterStringINSTANCE.Write(writer, value.Name)
	FfiConverterStringINSTANCE.Write(writer, value.PaymentIdentifier)
}

type FfiDestroyerUpdateContactRequest struct{}

func (_ FfiDestroyerUpdateContactRequest) Destroy(value UpdateContactRequest) {
	value.Destroy()
}

type UpdateUserSettingsRequest struct {
	SparkPrivateModeEnabled *bool
	// Update the active stable balance token. `None` means no change.
	StableBalanceActiveLabel *StableBalanceActiveLabel
}

func (r *UpdateUserSettingsRequest) Destroy() {
	FfiDestroyerOptionalBool{}.Destroy(r.SparkPrivateModeEnabled)
	FfiDestroyerOptionalStableBalanceActiveLabel{}.Destroy(r.StableBalanceActiveLabel)
}

type FfiConverterUpdateUserSettingsRequest struct{}

var FfiConverterUpdateUserSettingsRequestINSTANCE = FfiConverterUpdateUserSettingsRequest{}

func (c FfiConverterUpdateUserSettingsRequest) Lift(rb RustBufferI) UpdateUserSettingsRequest {
	return LiftFromRustBuffer[UpdateUserSettingsRequest](c, rb)
}

func (c FfiConverterUpdateUserSettingsRequest) Read(reader io.Reader) UpdateUserSettingsRequest {
	return UpdateUserSettingsRequest{
		FfiConverterOptionalBoolINSTANCE.Read(reader),
		FfiConverterOptionalStableBalanceActiveLabelINSTANCE.Read(reader),
	}
}

func (c FfiConverterUpdateUserSettingsRequest) Lower(value UpdateUserSettingsRequest) C.RustBuffer {
	return LowerIntoRustBuffer[UpdateUserSettingsRequest](c, value)
}

func (c FfiConverterUpdateUserSettingsRequest) LowerExternal(value UpdateUserSettingsRequest) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[UpdateUserSettingsRequest](c, value))
}

func (c FfiConverterUpdateUserSettingsRequest) Write(writer io.Writer, value UpdateUserSettingsRequest) {
	FfiConverterOptionalBoolINSTANCE.Write(writer, value.SparkPrivateModeEnabled)
	FfiConverterOptionalStableBalanceActiveLabelINSTANCE.Write(writer, value.StableBalanceActiveLabel)
}

type FfiDestroyerUpdateUserSettingsRequest struct{}

func (_ FfiDestroyerUpdateUserSettingsRequest) Destroy(value UpdateUserSettingsRequest) {
	value.Destroy()
}

type UrlSuccessActionData struct {
	// Contents description, up to 144 characters
	Description string
	// URL of the success action
	Url string
	// Indicates the success URL domain matches the LNURL callback domain.
	//
	// See <https://github.com/lnurl/luds/blob/luds/09.md>
	MatchesCallbackDomain bool
}

func (r *UrlSuccessActionData) Destroy() {
	FfiDestroyerString{}.Destroy(r.Description)
	FfiDestroyerString{}.Destroy(r.Url)
	FfiDestroyerBool{}.Destroy(r.MatchesCallbackDomain)
}

type FfiConverterUrlSuccessActionData struct{}

var FfiConverterUrlSuccessActionDataINSTANCE = FfiConverterUrlSuccessActionData{}

func (c FfiConverterUrlSuccessActionData) Lift(rb RustBufferI) UrlSuccessActionData {
	return LiftFromRustBuffer[UrlSuccessActionData](c, rb)
}

func (c FfiConverterUrlSuccessActionData) Read(reader io.Reader) UrlSuccessActionData {
	return UrlSuccessActionData{
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterBoolINSTANCE.Read(reader),
	}
}

func (c FfiConverterUrlSuccessActionData) Lower(value UrlSuccessActionData) C.RustBuffer {
	return LowerIntoRustBuffer[UrlSuccessActionData](c, value)
}

func (c FfiConverterUrlSuccessActionData) LowerExternal(value UrlSuccessActionData) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[UrlSuccessActionData](c, value))
}

func (c FfiConverterUrlSuccessActionData) Write(writer io.Writer, value UrlSuccessActionData) {
	FfiConverterStringINSTANCE.Write(writer, value.Description)
	FfiConverterStringINSTANCE.Write(writer, value.Url)
	FfiConverterBoolINSTANCE.Write(writer, value.MatchesCallbackDomain)
}

type FfiDestroyerUrlSuccessActionData struct{}

func (_ FfiDestroyerUrlSuccessActionData) Destroy(value UrlSuccessActionData) {
	value.Destroy()
}

type UserSettings struct {
	SparkPrivateModeEnabled bool
	// The label of the currently active stable balance token, or `None` if deactivated.
	StableBalanceActiveLabel *string
}

func (r *UserSettings) Destroy() {
	FfiDestroyerBool{}.Destroy(r.SparkPrivateModeEnabled)
	FfiDestroyerOptionalString{}.Destroy(r.StableBalanceActiveLabel)
}

type FfiConverterUserSettings struct{}

var FfiConverterUserSettingsINSTANCE = FfiConverterUserSettings{}

func (c FfiConverterUserSettings) Lift(rb RustBufferI) UserSettings {
	return LiftFromRustBuffer[UserSettings](c, rb)
}

func (c FfiConverterUserSettings) Read(reader io.Reader) UserSettings {
	return UserSettings{
		FfiConverterBoolINSTANCE.Read(reader),
		FfiConverterOptionalStringINSTANCE.Read(reader),
	}
}

func (c FfiConverterUserSettings) Lower(value UserSettings) C.RustBuffer {
	return LowerIntoRustBuffer[UserSettings](c, value)
}

func (c FfiConverterUserSettings) LowerExternal(value UserSettings) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[UserSettings](c, value))
}

func (c FfiConverterUserSettings) Write(writer io.Writer, value UserSettings) {
	FfiConverterBoolINSTANCE.Write(writer, value.SparkPrivateModeEnabled)
	FfiConverterOptionalStringINSTANCE.Write(writer, value.StableBalanceActiveLabel)
}

type FfiDestroyerUserSettings struct{}

func (_ FfiDestroyerUserSettings) Destroy(value UserSettings) {
	value.Destroy()
}

type Utxo struct {
	Txid   string
	Vout   uint32
	Value  uint64
	Status TxStatus
}

func (r *Utxo) Destroy() {
	FfiDestroyerString{}.Destroy(r.Txid)
	FfiDestroyerUint32{}.Destroy(r.Vout)
	FfiDestroyerUint64{}.Destroy(r.Value)
	FfiDestroyerTxStatus{}.Destroy(r.Status)
}

type FfiConverterUtxo struct{}

var FfiConverterUtxoINSTANCE = FfiConverterUtxo{}

func (c FfiConverterUtxo) Lift(rb RustBufferI) Utxo {
	return LiftFromRustBuffer[Utxo](c, rb)
}

func (c FfiConverterUtxo) Read(reader io.Reader) Utxo {
	return Utxo{
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterUint32INSTANCE.Read(reader),
		FfiConverterUint64INSTANCE.Read(reader),
		FfiConverterTxStatusINSTANCE.Read(reader),
	}
}

func (c FfiConverterUtxo) Lower(value Utxo) C.RustBuffer {
	return LowerIntoRustBuffer[Utxo](c, value)
}

func (c FfiConverterUtxo) LowerExternal(value Utxo) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[Utxo](c, value))
}

func (c FfiConverterUtxo) Write(writer io.Writer, value Utxo) {
	FfiConverterStringINSTANCE.Write(writer, value.Txid)
	FfiConverterUint32INSTANCE.Write(writer, value.Vout)
	FfiConverterUint64INSTANCE.Write(writer, value.Value)
	FfiConverterTxStatusINSTANCE.Write(writer, value.Status)
}

type FfiDestroyerUtxo struct{}

func (_ FfiDestroyerUtxo) Destroy(value Utxo) {
	value.Destroy()
}

// A wallet derived from a passkey.
//
// Contains the derived seed and the label used during derivation.
type Wallet struct {
	// The derived seed.
	Seed Seed
	// The label used for derivation (either user-provided or the default).
	Label string
}

func (r *Wallet) Destroy() {
	FfiDestroyerSeed{}.Destroy(r.Seed)
	FfiDestroyerString{}.Destroy(r.Label)
}

type FfiConverterWallet struct{}

var FfiConverterWalletINSTANCE = FfiConverterWallet{}

func (c FfiConverterWallet) Lift(rb RustBufferI) Wallet {
	return LiftFromRustBuffer[Wallet](c, rb)
}

func (c FfiConverterWallet) Read(reader io.Reader) Wallet {
	return Wallet{
		FfiConverterSeedINSTANCE.Read(reader),
		FfiConverterStringINSTANCE.Read(reader),
	}
}

func (c FfiConverterWallet) Lower(value Wallet) C.RustBuffer {
	return LowerIntoRustBuffer[Wallet](c, value)
}

func (c FfiConverterWallet) LowerExternal(value Wallet) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[Wallet](c, value))
}

func (c FfiConverterWallet) Write(writer io.Writer, value Wallet) {
	FfiConverterSeedINSTANCE.Write(writer, value.Seed)
	FfiConverterStringINSTANCE.Write(writer, value.Label)
}

type FfiDestroyerWallet struct{}

func (_ FfiDestroyerWallet) Destroy(value Wallet) {
	value.Destroy()
}

// A registered webhook entry.
type Webhook struct {
	// Unique identifier for this webhook.
	Id string
	// The URL that receives webhook notifications.
	Url string
	// The event types this webhook is subscribed to.
	EventTypes []WebhookEventType
}

func (r *Webhook) Destroy() {
	FfiDestroyerString{}.Destroy(r.Id)
	FfiDestroyerString{}.Destroy(r.Url)
	FfiDestroyerSequenceWebhookEventType{}.Destroy(r.EventTypes)
}

type FfiConverterWebhook struct{}

var FfiConverterWebhookINSTANCE = FfiConverterWebhook{}

func (c FfiConverterWebhook) Lift(rb RustBufferI) Webhook {
	return LiftFromRustBuffer[Webhook](c, rb)
}

func (c FfiConverterWebhook) Read(reader io.Reader) Webhook {
	return Webhook{
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterStringINSTANCE.Read(reader),
		FfiConverterSequenceWebhookEventTypeINSTANCE.Read(reader),
	}
}

func (c FfiConverterWebhook) Lower(value Webhook) C.RustBuffer {
	return LowerIntoRustBuffer[Webhook](c, value)
}

func (c FfiConverterWebhook) LowerExternal(value Webhook) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[Webhook](c, value))
}

func (c FfiConverterWebhook) Write(writer io.Writer, value Webhook) {
	FfiConverterStringINSTANCE.Write(writer, value.Id)
	FfiConverterStringINSTANCE.Write(writer, value.Url)
	FfiConverterSequenceWebhookEventTypeINSTANCE.Write(writer, value.EventTypes)
}

type FfiDestroyerWebhook struct{}

func (_ FfiDestroyerWebhook) Destroy(value Webhook) {
	value.Destroy()
}

// Result of decryption of [`AesSuccessActionData`] payload
type AesSuccessActionDataResult interface {
	Destroy()
}
type AesSuccessActionDataResultDecrypted struct {
	Data AesSuccessActionDataDecrypted
}

func (e AesSuccessActionDataResultDecrypted) Destroy() {
	FfiDestroyerAesSuccessActionDataDecrypted{}.Destroy(e.Data)
}

type AesSuccessActionDataResultErrorStatus struct {
	Reason string
}

func (e AesSuccessActionDataResultErrorStatus) Destroy() {
	FfiDestroyerString{}.Destroy(e.Reason)
}

type FfiConverterAesSuccessActionDataResult struct{}

var FfiConverterAesSuccessActionDataResultINSTANCE = FfiConverterAesSuccessActionDataResult{}

func (c FfiConverterAesSuccessActionDataResult) Lift(rb RustBufferI) AesSuccessActionDataResult {
	return LiftFromRustBuffer[AesSuccessActionDataResult](c, rb)
}

func (c FfiConverterAesSuccessActionDataResult) Lower(value AesSuccessActionDataResult) C.RustBuffer {
	return LowerIntoRustBuffer[AesSuccessActionDataResult](c, value)
}

func (c FfiConverterAesSuccessActionDataResult) LowerExternal(value AesSuccessActionDataResult) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[AesSuccessActionDataResult](c, value))
}
func (FfiConverterAesSuccessActionDataResult) Read(reader io.Reader) AesSuccessActionDataResult {
	id := readInt32(reader)
	switch id {
	case 1:
		return AesSuccessActionDataResultDecrypted{
			FfiConverterAesSuccessActionDataDecryptedINSTANCE.Read(reader),
		}
	case 2:
		return AesSuccessActionDataResultErrorStatus{
			FfiConverterStringINSTANCE.Read(reader),
		}
	default:
		panic(fmt.Sprintf("invalid enum value %v in FfiConverterAesSuccessActionDataResult.Read()", id))
	}
}

func (FfiConverterAesSuccessActionDataResult) Write(writer io.Writer, value AesSuccessActionDataResult) {
	switch variant_value := value.(type) {
	case AesSuccessActionDataResultDecrypted:
		writeInt32(writer, 1)
		FfiConverterAesSuccessActionDataDecryptedINSTANCE.Write(writer, variant_value.Data)
	case AesSuccessActionDataResultErrorStatus:
		writeInt32(writer, 2)
		FfiConverterStringINSTANCE.Write(writer, variant_value.Reason)
	default:
		_ = variant_value
		panic(fmt.Sprintf("invalid enum value `%v` in FfiConverterAesSuccessActionDataResult.Write", value))
	}
}

type FfiDestroyerAesSuccessActionDataResult struct{}

func (_ FfiDestroyerAesSuccessActionDataResult) Destroy(value AesSuccessActionDataResult) {
	value.Destroy()
}

type Amount interface {
	Destroy()
}
type AmountBitcoin struct {
	AmountMsat uint64
}

func (e AmountBitcoin) Destroy() {
	FfiDestroyerUint64{}.Destroy(e.AmountMsat)
}

// An amount of currency specified using ISO 4712.
type AmountCurrency struct {
	Iso4217Code      string
	FractionalAmount uint64
}

func (e AmountCurrency) Destroy() {
	FfiDestroyerString{}.Destroy(e.Iso4217Code)
	FfiDestroyerUint64{}.Destroy(e.FractionalAmount)
}

type FfiConverterAmount struct{}

var FfiConverterAmountINSTANCE = FfiConverterAmount{}

func (c FfiConverterAmount) Lift(rb RustBufferI) Amount {
	return LiftFromRustBuffer[Amount](c, rb)
}

func (c FfiConverterAmount) Lower(value Amount) C.RustBuffer {
	return LowerIntoRustBuffer[Amount](c, value)
}

func (c FfiConverterAmount) LowerExternal(value Amount) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[Amount](c, value))
}
func (FfiConverterAmount) Read(reader io.Reader) Amount {
	id := readInt32(reader)
	switch id {
	case 1:
		return AmountBitcoin{
			FfiConverterUint64INSTANCE.Read(reader),
		}
	case 2:
		return AmountCurrency{
			FfiConverterStringINSTANCE.Read(reader),
			FfiConverterUint64INSTANCE.Read(reader),
		}
	default:
		panic(fmt.Sprintf("invalid enum value %v in FfiConverterAmount.Read()", id))
	}
}

func (FfiConverterAmount) Write(writer io.Writer, value Amount) {
	switch variant_value := value.(type) {
	case AmountBitcoin:
		writeInt32(writer, 1)
		FfiConverterUint64INSTANCE.Write(writer, variant_value.AmountMsat)
	case AmountCurrency:
		writeInt32(writer, 2)
		FfiConverterStringINSTANCE.Write(writer, variant_value.Iso4217Code)
		FfiConverterUint64INSTANCE.Write(writer, variant_value.FractionalAmount)
	default:
		_ = variant_value
		panic(fmt.Sprintf("invalid enum value `%v` in FfiConverterAmount.Write", value))
	}
}

type FfiDestroyerAmount struct{}

func (_ FfiDestroyerAmount) Destroy(value Amount) {
	value.Destroy()
}

// The reason why a conversion amount was adjusted from the originally requested value.
type AmountAdjustmentReason uint

const (
	// The amount was increased to meet the minimum conversion limit.
	AmountAdjustmentReasonFlooredToMinLimit AmountAdjustmentReason = 1
	// The amount was increased to convert the full token balance,
	// avoiding a remaining balance below the minimum conversion limit (token dust).
	AmountAdjustmentReasonIncreasedToAvoidDust AmountAdjustmentReason = 2
)

type FfiConverterAmountAdjustmentReason struct{}

var FfiConverterAmountAdjustmentReasonINSTANCE = FfiConverterAmountAdjustmentReason{}

func (c FfiConverterAmountAdjustmentReason) Lift(rb RustBufferI) AmountAdjustmentReason {
	return LiftFromRustBuffer[AmountAdjustmentReason](c, rb)
}

func (c FfiConverterAmountAdjustmentReason) Lower(value AmountAdjustmentReason) C.RustBuffer {
	return LowerIntoRustBuffer[AmountAdjustmentReason](c, value)
}

func (c FfiConverterAmountAdjustmentReason) LowerExternal(value AmountAdjustmentReason) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[AmountAdjustmentReason](c, value))
}
func (FfiConverterAmountAdjustmentReason) Read(reader io.Reader) AmountAdjustmentReason {
	id := readInt32(reader)
	return AmountAdjustmentReason(id)
}

func (FfiConverterAmountAdjustmentReason) Write(writer io.Writer, value AmountAdjustmentReason) {
	writeInt32(writer, int32(value))
}

type FfiDestroyerAmountAdjustmentReason struct{}

func (_ FfiDestroyerAmountAdjustmentReason) Destroy(value AmountAdjustmentReason) {
}

// A field of [`ListPaymentsRequest`] when listing payments filtered by asset
type AssetFilter interface {
	Destroy()
}
type AssetFilterBitcoin struct {
}

func (e AssetFilterBitcoin) Destroy() {
}

type AssetFilterToken struct {
	TokenIdentifier *string
}

func (e AssetFilterToken) Destroy() {
	FfiDestroyerOptionalString{}.Destroy(e.TokenIdentifier)
}

type FfiConverterAssetFilter struct{}

var FfiConverterAssetFilterINSTANCE = FfiConverterAssetFilter{}

func (c FfiConverterAssetFilter) Lift(rb RustBufferI) AssetFilter {
	return LiftFromRustBuffer[AssetFilter](c, rb)
}

func (c FfiConverterAssetFilter) Lower(value AssetFilter) C.RustBuffer {
	return LowerIntoRustBuffer[AssetFilter](c, value)
}

func (c FfiConverterAssetFilter) LowerExternal(value AssetFilter) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[AssetFilter](c, value))
}
func (FfiConverterAssetFilter) Read(reader io.Reader) AssetFilter {
	id := readInt32(reader)
	switch id {
	case 1:
		return AssetFilterBitcoin{}
	case 2:
		return AssetFilterToken{
			FfiConverterOptionalStringINSTANCE.Read(reader),
		}
	default:
		panic(fmt.Sprintf("invalid enum value %v in FfiConverterAssetFilter.Read()", id))
	}
}

func (FfiConverterAssetFilter) Write(writer io.Writer, value AssetFilter) {
	switch variant_value := value.(type) {
	case AssetFilterBitcoin:
		writeInt32(writer, 1)
	case AssetFilterToken:
		writeInt32(writer, 2)
		FfiConverterOptionalStringINSTANCE.Write(writer, variant_value.TokenIdentifier)
	default:
		_ = variant_value
		panic(fmt.Sprintf("invalid enum value `%v` in FfiConverterAssetFilter.Write", value))
	}
}

type FfiDestroyerAssetFilter struct{}

func (_ FfiDestroyerAssetFilter) Destroy(value AssetFilter) {
	value.Destroy()
}

type BitcoinNetwork uint

const (
	// Mainnet
	BitcoinNetworkBitcoin  BitcoinNetwork = 1
	BitcoinNetworkTestnet3 BitcoinNetwork = 2
	BitcoinNetworkTestnet4 BitcoinNetwork = 3
	BitcoinNetworkSignet   BitcoinNetwork = 4
	BitcoinNetworkRegtest  BitcoinNetwork = 5
)

type FfiConverterBitcoinNetwork struct{}

var FfiConverterBitcoinNetworkINSTANCE = FfiConverterBitcoinNetwork{}

func (c FfiConverterBitcoinNetwork) Lift(rb RustBufferI) BitcoinNetwork {
	return LiftFromRustBuffer[BitcoinNetwork](c, rb)
}

func (c FfiConverterBitcoinNetwork) Lower(value BitcoinNetwork) C.RustBuffer {
	return LowerIntoRustBuffer[BitcoinNetwork](c, value)
}

func (c FfiConverterBitcoinNetwork) LowerExternal(value BitcoinNetwork) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[BitcoinNetwork](c, value))
}
func (FfiConverterBitcoinNetwork) Read(reader io.Reader) BitcoinNetwork {
	id := readInt32(reader)
	return BitcoinNetwork(id)
}

func (FfiConverterBitcoinNetwork) Write(writer io.Writer, value BitcoinNetwork) {
	writeInt32(writer, int32(value))
}

type FfiDestroyerBitcoinNetwork struct{}

func (_ FfiDestroyerBitcoinNetwork) Destroy(value BitcoinNetwork) {
}

// The available providers for buying Bitcoin
// Request to buy Bitcoin using an external provider.
//
// Each variant carries only the parameters relevant to that provider.
type BuyBitcoinRequest interface {
	Destroy()
}

// `MoonPay`: Fiat-to-Bitcoin via credit card, Apple Pay, etc.
// Uses an on-chain deposit address.
type BuyBitcoinRequestMoonpay struct {
	LockedAmountSat *uint64
	RedirectUrl     *string
}

func (e BuyBitcoinRequestMoonpay) Destroy() {
	FfiDestroyerOptionalUint64{}.Destroy(e.LockedAmountSat)
	FfiDestroyerOptionalString{}.Destroy(e.RedirectUrl)
}

// `CashApp`: Pay via the Lightning Network.
// Generates a bolt11 invoice and returns a `cash.app` deep link.
// Only available on mainnet.
type BuyBitcoinRequestCashApp struct {
	AmountSats *uint64
}

func (e BuyBitcoinRequestCashApp) Destroy() {
	FfiDestroyerOptionalUint64{}.Destroy(e.AmountSats)
}

type FfiConverterBuyBitcoinRequest struct{}

var FfiConverterBuyBitcoinRequestINSTANCE = FfiConverterBuyBitcoinRequest{}

func (c FfiConverterBuyBitcoinRequest) Lift(rb RustBufferI) BuyBitcoinRequest {
	return LiftFromRustBuffer[BuyBitcoinRequest](c, rb)
}

func (c FfiConverterBuyBitcoinRequest) Lower(value BuyBitcoinRequest) C.RustBuffer {
	return LowerIntoRustBuffer[BuyBitcoinRequest](c, value)
}

func (c FfiConverterBuyBitcoinRequest) LowerExternal(value BuyBitcoinRequest) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[BuyBitcoinRequest](c, value))
}
func (FfiConverterBuyBitcoinRequest) Read(reader io.Reader) BuyBitcoinRequest {
	id := readInt32(reader)
	switch id {
	case 1:
		return BuyBitcoinRequestMoonpay{
			FfiConverterOptionalUint64INSTANCE.Read(reader),
			FfiConverterOptionalStringINSTANCE.Read(reader),
		}
	case 2:
		return BuyBitcoinRequestCashApp{
			FfiConverterOptionalUint64INSTANCE.Read(reader),
		}
	default:
		panic(fmt.Sprintf("invalid enum value %v in FfiConverterBuyBitcoinRequest.Read()", id))
	}
}

func (FfiConverterBuyBitcoinRequest) Write(writer io.Writer, value BuyBitcoinRequest) {
	switch variant_value := value.(type) {
	case BuyBitcoinRequestMoonpay:
		writeInt32(writer, 1)
		FfiConverterOptionalUint64INSTANCE.Write(writer, variant_value.LockedAmountSat)
		FfiConverterOptionalStringINSTANCE.Write(writer, variant_value.RedirectUrl)
	case BuyBitcoinRequestCashApp:
		writeInt32(writer, 2)
		FfiConverterOptionalUint64INSTANCE.Write(writer, variant_value.AmountSats)
	default:
		_ = variant_value
		panic(fmt.Sprintf("invalid enum value `%v` in FfiConverterBuyBitcoinRequest.Write", value))
	}
}

type FfiDestroyerBuyBitcoinRequest struct{}

func (_ FfiDestroyerBuyBitcoinRequest) Destroy(value BuyBitcoinRequest) {
	value.Destroy()
}

type ChainApiType uint

const (
	ChainApiTypeEsplora      ChainApiType = 1
	ChainApiTypeMempoolSpace ChainApiType = 2
)

type FfiConverterChainApiType struct{}

var FfiConverterChainApiTypeINSTANCE = FfiConverterChainApiType{}

func (c FfiConverterChainApiType) Lift(rb RustBufferI) ChainApiType {
	return LiftFromRustBuffer[ChainApiType](c, rb)
}

func (c FfiConverterChainApiType) Lower(value ChainApiType) C.RustBuffer {
	return LowerIntoRustBuffer[ChainApiType](c, value)
}

func (c FfiConverterChainApiType) LowerExternal(value ChainApiType) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[ChainApiType](c, value))
}
func (FfiConverterChainApiType) Read(reader io.Reader) ChainApiType {
	id := readInt32(reader)
	return ChainApiType(id)
}

func (FfiConverterChainApiType) Write(writer io.Writer, value ChainApiType) {
	writeInt32(writer, int32(value))
}

type FfiDestroyerChainApiType struct{}

func (_ FfiDestroyerChainApiType) Destroy(value ChainApiType) {
}

type ChainServiceError struct {
	err error
}

// Convience method to turn *ChainServiceError into error
// Avoiding treating nil pointer as non nil error interface
func (err *ChainServiceError) AsError() error {
	if err == nil {
		return nil
	} else {
		return err
	}
}

func (err ChainServiceError) Error() string {
	return fmt.Sprintf("ChainServiceError: %s", err.err.Error())
}

func (err ChainServiceError) Unwrap() error {
	return err.err
}

// Err* are used for checking error type with `errors.Is`
var ErrChainServiceErrorInvalidAddress = fmt.Errorf("ChainServiceErrorInvalidAddress")
var ErrChainServiceErrorServiceConnectivity = fmt.Errorf("ChainServiceErrorServiceConnectivity")
var ErrChainServiceErrorGeneric = fmt.Errorf("ChainServiceErrorGeneric")

// Variant structs
type ChainServiceErrorInvalidAddress struct {
	Field0 string
}

func NewChainServiceErrorInvalidAddress(
	var0 string,
) *ChainServiceError {
	return &ChainServiceError{err: &ChainServiceErrorInvalidAddress{
		Field0: var0}}
}

func (e ChainServiceErrorInvalidAddress) destroy() {
	FfiDestroyerString{}.Destroy(e.Field0)
}

func (err ChainServiceErrorInvalidAddress) Error() string {
	return fmt.Sprint("InvalidAddress",
		": ",

		"Field0=",
		err.Field0,
	)
}

func (self ChainServiceErrorInvalidAddress) Is(target error) bool {
	return target == ErrChainServiceErrorInvalidAddress
}

type ChainServiceErrorServiceConnectivity struct {
	Field0 string
}

func NewChainServiceErrorServiceConnectivity(
	var0 string,
) *ChainServiceError {
	return &ChainServiceError{err: &ChainServiceErrorServiceConnectivity{
		Field0: var0}}
}

func (e ChainServiceErrorServiceConnectivity) destroy() {
	FfiDestroyerString{}.Destroy(e.Field0)
}

func (err ChainServiceErrorServiceConnectivity) Error() string {
	return fmt.Sprint("ServiceConnectivity",
		": ",

		"Field0=",
		err.Field0,
	)
}

func (self ChainServiceErrorServiceConnectivity) Is(target error) bool {
	return target == ErrChainServiceErrorServiceConnectivity
}

type ChainServiceErrorGeneric struct {
	Field0 string
}

func NewChainServiceErrorGeneric(
	var0 string,
) *ChainServiceError {
	return &ChainServiceError{err: &ChainServiceErrorGeneric{
		Field0: var0}}
}

func (e ChainServiceErrorGeneric) destroy() {
	FfiDestroyerString{}.Destroy(e.Field0)
}

func (err ChainServiceErrorGeneric) Error() string {
	return fmt.Sprint("Generic",
		": ",

		"Field0=",
		err.Field0,
	)
}

func (self ChainServiceErrorGeneric) Is(target error) bool {
	return target == ErrChainServiceErrorGeneric
}

type FfiConverterChainServiceError struct{}

var FfiConverterChainServiceErrorINSTANCE = FfiConverterChainServiceError{}

func (c FfiConverterChainServiceError) Lift(eb RustBufferI) *ChainServiceError {
	return LiftFromRustBuffer[*ChainServiceError](c, eb)
}

func (c FfiConverterChainServiceError) Lower(value *ChainServiceError) C.RustBuffer {
	return LowerIntoRustBuffer[*ChainServiceError](c, value)
}

func (c FfiConverterChainServiceError) LowerExternal(value *ChainServiceError) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[*ChainServiceError](c, value))
}

func (c FfiConverterChainServiceError) Read(reader io.Reader) *ChainServiceError {
	errorID := readUint32(reader)

	switch errorID {
	case 1:
		return &ChainServiceError{&ChainServiceErrorInvalidAddress{
			Field0: FfiConverterStringINSTANCE.Read(reader),
		}}
	case 2:
		return &ChainServiceError{&ChainServiceErrorServiceConnectivity{
			Field0: FfiConverterStringINSTANCE.Read(reader),
		}}
	case 3:
		return &ChainServiceError{&ChainServiceErrorGeneric{
			Field0: FfiConverterStringINSTANCE.Read(reader),
		}}
	default:
		panic(fmt.Sprintf("Unknown error code %d in FfiConverterChainServiceError.Read()", errorID))
	}
}

func (c FfiConverterChainServiceError) Write(writer io.Writer, value *ChainServiceError) {
	switch variantValue := value.err.(type) {
	case *ChainServiceErrorInvalidAddress:
		writeInt32(writer, 1)
		FfiConverterStringINSTANCE.Write(writer, variantValue.Field0)
	case *ChainServiceErrorServiceConnectivity:
		writeInt32(writer, 2)
		FfiConverterStringINSTANCE.Write(writer, variantValue.Field0)
	case *ChainServiceErrorGeneric:
		writeInt32(writer, 3)
		FfiConverterStringINSTANCE.Write(writer, variantValue.Field0)
	default:
		_ = variantValue
		panic(fmt.Sprintf("invalid error value `%v` in FfiConverterChainServiceError.Write", value))
	}
}

type FfiDestroyerChainServiceError struct{}

func (_ FfiDestroyerChainServiceError) Destroy(value *ChainServiceError) {
	switch variantValue := value.err.(type) {
	case ChainServiceErrorInvalidAddress:
		variantValue.destroy()
	case ChainServiceErrorServiceConnectivity:
		variantValue.destroy()
	case ChainServiceErrorGeneric:
		variantValue.destroy()
	default:
		_ = variantValue
		panic(fmt.Sprintf("invalid error value `%v` in FfiDestroyerChainServiceError.Destroy", value))
	}
}

// The purpose of the conversion, which is used to provide context for the conversion
// if its related to an ongoing payment or a self-transfer.
type ConversionPurpose interface {
	Destroy()
}

// Conversion is associated with an ongoing payment
type ConversionPurposeOngoingPayment struct {
	PaymentRequest string
}

func (e ConversionPurposeOngoingPayment) Destroy() {
	FfiDestroyerString{}.Destroy(e.PaymentRequest)
}

// Conversion is for self-transfer
type ConversionPurposeSelfTransfer struct {
}

func (e ConversionPurposeSelfTransfer) Destroy() {
}

// Conversion triggered automatically
type ConversionPurposeAutoConversion struct {
}

func (e ConversionPurposeAutoConversion) Destroy() {
}

type FfiConverterConversionPurpose struct{}

var FfiConverterConversionPurposeINSTANCE = FfiConverterConversionPurpose{}

func (c FfiConverterConversionPurpose) Lift(rb RustBufferI) ConversionPurpose {
	return LiftFromRustBuffer[ConversionPurpose](c, rb)
}

func (c FfiConverterConversionPurpose) Lower(value ConversionPurpose) C.RustBuffer {
	return LowerIntoRustBuffer[ConversionPurpose](c, value)
}

func (c FfiConverterConversionPurpose) LowerExternal(value ConversionPurpose) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[ConversionPurpose](c, value))
}
func (FfiConverterConversionPurpose) Read(reader io.Reader) ConversionPurpose {
	id := readInt32(reader)
	switch id {
	case 1:
		return ConversionPurposeOngoingPayment{
			FfiConverterStringINSTANCE.Read(reader),
		}
	case 2:
		return ConversionPurposeSelfTransfer{}
	case 3:
		return ConversionPurposeAutoConversion{}
	default:
		panic(fmt.Sprintf("invalid enum value %v in FfiConverterConversionPurpose.Read()", id))
	}
}

func (FfiConverterConversionPurpose) Write(writer io.Writer, value ConversionPurpose) {
	switch variant_value := value.(type) {
	case ConversionPurposeOngoingPayment:
		writeInt32(writer, 1)
		FfiConverterStringINSTANCE.Write(writer, variant_value.PaymentRequest)
	case ConversionPurposeSelfTransfer:
		writeInt32(writer, 2)
	case ConversionPurposeAutoConversion:
		writeInt32(writer, 3)
	default:
		_ = variant_value
		panic(fmt.Sprintf("invalid enum value `%v` in FfiConverterConversionPurpose.Write", value))
	}
}

type FfiDestroyerConversionPurpose struct{}

func (_ FfiDestroyerConversionPurpose) Destroy(value ConversionPurpose) {
	value.Destroy()
}

// The status of the conversion
type ConversionStatus uint

const (
	// Conversion is in-flight (queued or started, not yet completed)
	ConversionStatusPending ConversionStatus = 1
	// The conversion was successful
	ConversionStatusCompleted ConversionStatus = 2
	// The conversion failed (e.g., the initial send payment failed)
	ConversionStatusFailed ConversionStatus = 3
	// The conversion failed and no refund was made yet, which requires action by the SDK to
	// perform the refund. This can happen if there was a failure during the conversion process.
	ConversionStatusRefundNeeded ConversionStatus = 4
	// The conversion failed and a refund was made
	ConversionStatusRefunded ConversionStatus = 5
)

type FfiConverterConversionStatus struct{}

var FfiConverterConversionStatusINSTANCE = FfiConverterConversionStatus{}

func (c FfiConverterConversionStatus) Lift(rb RustBufferI) ConversionStatus {
	return LiftFromRustBuffer[ConversionStatus](c, rb)
}

func (c FfiConverterConversionStatus) Lower(value ConversionStatus) C.RustBuffer {
	return LowerIntoRustBuffer[ConversionStatus](c, value)
}

func (c FfiConverterConversionStatus) LowerExternal(value ConversionStatus) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[ConversionStatus](c, value))
}
func (FfiConverterConversionStatus) Read(reader io.Reader) ConversionStatus {
	id := readInt32(reader)
	return ConversionStatus(id)
}

func (FfiConverterConversionStatus) Write(writer io.Writer, value ConversionStatus) {
	writeInt32(writer, int32(value))
}

type FfiDestroyerConversionStatus struct{}

func (_ FfiDestroyerConversionStatus) Destroy(value ConversionStatus) {
}

type ConversionType interface {
	Destroy()
}

// Converting from Bitcoin to a token
type ConversionTypeFromBitcoin struct {
}

func (e ConversionTypeFromBitcoin) Destroy() {
}

// Converting from a token to Bitcoin
type ConversionTypeToBitcoin struct {
	FromTokenIdentifier string
}

func (e ConversionTypeToBitcoin) Destroy() {
	FfiDestroyerString{}.Destroy(e.FromTokenIdentifier)
}

type FfiConverterConversionType struct{}

var FfiConverterConversionTypeINSTANCE = FfiConverterConversionType{}

func (c FfiConverterConversionType) Lift(rb RustBufferI) ConversionType {
	return LiftFromRustBuffer[ConversionType](c, rb)
}

func (c FfiConverterConversionType) Lower(value ConversionType) C.RustBuffer {
	return LowerIntoRustBuffer[ConversionType](c, value)
}

func (c FfiConverterConversionType) LowerExternal(value ConversionType) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[ConversionType](c, value))
}
func (FfiConverterConversionType) Read(reader io.Reader) ConversionType {
	id := readInt32(reader)
	switch id {
	case 1:
		return ConversionTypeFromBitcoin{}
	case 2:
		return ConversionTypeToBitcoin{
			FfiConverterStringINSTANCE.Read(reader),
		}
	default:
		panic(fmt.Sprintf("invalid enum value %v in FfiConverterConversionType.Read()", id))
	}
}

func (FfiConverterConversionType) Write(writer io.Writer, value ConversionType) {
	switch variant_value := value.(type) {
	case ConversionTypeFromBitcoin:
		writeInt32(writer, 1)
	case ConversionTypeToBitcoin:
		writeInt32(writer, 2)
		FfiConverterStringINSTANCE.Write(writer, variant_value.FromTokenIdentifier)
	default:
		_ = variant_value
		panic(fmt.Sprintf("invalid enum value `%v` in FfiConverterConversionType.Write", value))
	}
}

type FfiDestroyerConversionType struct{}

func (_ FfiDestroyerConversionType) Destroy(value ConversionType) {
	value.Destroy()
}

type DepositClaimError interface {
	Destroy()
}
type DepositClaimErrorMaxDepositClaimFeeExceeded struct {
	Tx                         string
	Vout                       uint32
	MaxFee                     *Fee
	RequiredFeeSats            uint64
	RequiredFeeRateSatPerVbyte uint64
}

func (e DepositClaimErrorMaxDepositClaimFeeExceeded) Destroy() {
	FfiDestroyerString{}.Destroy(e.Tx)
	FfiDestroyerUint32{}.Destroy(e.Vout)
	FfiDestroyerOptionalFee{}.Destroy(e.MaxFee)
	FfiDestroyerUint64{}.Destroy(e.RequiredFeeSats)
	FfiDestroyerUint64{}.Destroy(e.RequiredFeeRateSatPerVbyte)
}

type DepositClaimErrorMissingUtxo struct {
	Tx   string
	Vout uint32
}

func (e DepositClaimErrorMissingUtxo) Destroy() {
	FfiDestroyerString{}.Destroy(e.Tx)
	FfiDestroyerUint32{}.Destroy(e.Vout)
}

type DepositClaimErrorGeneric struct {
	Message string
}

func (e DepositClaimErrorGeneric) Destroy() {
	FfiDestroyerString{}.Destroy(e.Message)
}

type FfiConverterDepositClaimError struct{}

var FfiConverterDepositClaimErrorINSTANCE = FfiConverterDepositClaimError{}

func (c FfiConverterDepositClaimError) Lift(rb RustBufferI) DepositClaimError {
	return LiftFromRustBuffer[DepositClaimError](c, rb)
}

func (c FfiConverterDepositClaimError) Lower(value DepositClaimError) C.RustBuffer {
	return LowerIntoRustBuffer[DepositClaimError](c, value)
}

func (c FfiConverterDepositClaimError) LowerExternal(value DepositClaimError) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[DepositClaimError](c, value))
}
func (FfiConverterDepositClaimError) Read(reader io.Reader) DepositClaimError {
	id := readInt32(reader)
	switch id {
	case 1:
		return DepositClaimErrorMaxDepositClaimFeeExceeded{
			FfiConverterStringINSTANCE.Read(reader),
			FfiConverterUint32INSTANCE.Read(reader),
			FfiConverterOptionalFeeINSTANCE.Read(reader),
			FfiConverterUint64INSTANCE.Read(reader),
			FfiConverterUint64INSTANCE.Read(reader),
		}
	case 2:
		return DepositClaimErrorMissingUtxo{
			FfiConverterStringINSTANCE.Read(reader),
			FfiConverterUint32INSTANCE.Read(reader),
		}
	case 3:
		return DepositClaimErrorGeneric{
			FfiConverterStringINSTANCE.Read(reader),
		}
	default:
		panic(fmt.Sprintf("invalid enum value %v in FfiConverterDepositClaimError.Read()", id))
	}
}

func (FfiConverterDepositClaimError) Write(writer io.Writer, value DepositClaimError) {
	switch variant_value := value.(type) {
	case DepositClaimErrorMaxDepositClaimFeeExceeded:
		writeInt32(writer, 1)
		FfiConverterStringINSTANCE.Write(writer, variant_value.Tx)
		FfiConverterUint32INSTANCE.Write(writer, variant_value.Vout)
		FfiConverterOptionalFeeINSTANCE.Write(writer, variant_value.MaxFee)
		FfiConverterUint64INSTANCE.Write(writer, variant_value.RequiredFeeSats)
		FfiConverterUint64INSTANCE.Write(writer, variant_value.RequiredFeeRateSatPerVbyte)
	case DepositClaimErrorMissingUtxo:
		writeInt32(writer, 2)
		FfiConverterStringINSTANCE.Write(writer, variant_value.Tx)
		FfiConverterUint32INSTANCE.Write(writer, variant_value.Vout)
	case DepositClaimErrorGeneric:
		writeInt32(writer, 3)
		FfiConverterStringINSTANCE.Write(writer, variant_value.Message)
	default:
		_ = variant_value
		panic(fmt.Sprintf("invalid enum value `%v` in FfiConverterDepositClaimError.Write", value))
	}
}

type FfiDestroyerDepositClaimError struct{}

func (_ FfiDestroyerDepositClaimError) Destroy(value DepositClaimError) {
	value.Destroy()
}

// FFI-safe representation of `spark_wallet::SecretSource`
type ExternalSecretSource interface {
	Destroy()
}

// Private key derived from a tree node
type ExternalSecretSourceDerived struct {
	NodeId ExternalTreeNodeId
}

func (e ExternalSecretSourceDerived) Destroy() {
	FfiDestroyerExternalTreeNodeId{}.Destroy(e.NodeId)
}

// Encrypted private key
type ExternalSecretSourceEncrypted struct {
	Key ExternalEncryptedSecret
}

func (e ExternalSecretSourceEncrypted) Destroy() {
	FfiDestroyerExternalEncryptedSecret{}.Destroy(e.Key)
}

type FfiConverterExternalSecretSource struct{}

var FfiConverterExternalSecretSourceINSTANCE = FfiConverterExternalSecretSource{}

func (c FfiConverterExternalSecretSource) Lift(rb RustBufferI) ExternalSecretSource {
	return LiftFromRustBuffer[ExternalSecretSource](c, rb)
}

func (c FfiConverterExternalSecretSource) Lower(value ExternalSecretSource) C.RustBuffer {
	return LowerIntoRustBuffer[ExternalSecretSource](c, value)
}

func (c FfiConverterExternalSecretSource) LowerExternal(value ExternalSecretSource) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[ExternalSecretSource](c, value))
}
func (FfiConverterExternalSecretSource) Read(reader io.Reader) ExternalSecretSource {
	id := readInt32(reader)
	switch id {
	case 1:
		return ExternalSecretSourceDerived{
			FfiConverterExternalTreeNodeIdINSTANCE.Read(reader),
		}
	case 2:
		return ExternalSecretSourceEncrypted{
			FfiConverterExternalEncryptedSecretINSTANCE.Read(reader),
		}
	default:
		panic(fmt.Sprintf("invalid enum value %v in FfiConverterExternalSecretSource.Read()", id))
	}
}

func (FfiConverterExternalSecretSource) Write(writer io.Writer, value ExternalSecretSource) {
	switch variant_value := value.(type) {
	case ExternalSecretSourceDerived:
		writeInt32(writer, 1)
		FfiConverterExternalTreeNodeIdINSTANCE.Write(writer, variant_value.NodeId)
	case ExternalSecretSourceEncrypted:
		writeInt32(writer, 2)
		FfiConverterExternalEncryptedSecretINSTANCE.Write(writer, variant_value.Key)
	default:
		_ = variant_value
		panic(fmt.Sprintf("invalid enum value `%v` in FfiConverterExternalSecretSource.Write", value))
	}
}

type FfiDestroyerExternalSecretSource struct{}

func (_ FfiDestroyerExternalSecretSource) Destroy(value ExternalSecretSource) {
	value.Destroy()
}

// FFI-safe representation of `spark_wallet::SecretToSplit`
type ExternalSecretToSplit interface {
	Destroy()
}

// A secret source to split
type ExternalSecretToSplitSecretSource struct {
	Source ExternalSecretSource
}

func (e ExternalSecretToSplitSecretSource) Destroy() {
	FfiDestroyerExternalSecretSource{}.Destroy(e.Source)
}

// A preimage to split (32 bytes)
type ExternalSecretToSplitPreimage struct {
	Data []byte
}

func (e ExternalSecretToSplitPreimage) Destroy() {
	FfiDestroyerBytes{}.Destroy(e.Data)
}

type FfiConverterExternalSecretToSplit struct{}

var FfiConverterExternalSecretToSplitINSTANCE = FfiConverterExternalSecretToSplit{}

func (c FfiConverterExternalSecretToSplit) Lift(rb RustBufferI) ExternalSecretToSplit {
	return LiftFromRustBuffer[ExternalSecretToSplit](c, rb)
}

func (c FfiConverterExternalSecretToSplit) Lower(value ExternalSecretToSplit) C.RustBuffer {
	return LowerIntoRustBuffer[ExternalSecretToSplit](c, value)
}

func (c FfiConverterExternalSecretToSplit) LowerExternal(value ExternalSecretToSplit) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[ExternalSecretToSplit](c, value))
}
func (FfiConverterExternalSecretToSplit) Read(reader io.Reader) ExternalSecretToSplit {
	id := readInt32(reader)
	switch id {
	case 1:
		return ExternalSecretToSplitSecretSource{
			FfiConverterExternalSecretSourceINSTANCE.Read(reader),
		}
	case 2:
		return ExternalSecretToSplitPreimage{
			FfiConverterBytesINSTANCE.Read(reader),
		}
	default:
		panic(fmt.Sprintf("invalid enum value %v in FfiConverterExternalSecretToSplit.Read()", id))
	}
}

func (FfiConverterExternalSecretToSplit) Write(writer io.Writer, value ExternalSecretToSplit) {
	switch variant_value := value.(type) {
	case ExternalSecretToSplitSecretSource:
		writeInt32(writer, 1)
		FfiConverterExternalSecretSourceINSTANCE.Write(writer, variant_value.Source)
	case ExternalSecretToSplitPreimage:
		writeInt32(writer, 2)
		FfiConverterBytesINSTANCE.Write(writer, variant_value.Data)
	default:
		_ = variant_value
		panic(fmt.Sprintf("invalid enum value `%v` in FfiConverterExternalSecretToSplit.Write", value))
	}
}

type FfiDestroyerExternalSecretToSplit struct{}

func (_ FfiDestroyerExternalSecretToSplit) Destroy(value ExternalSecretToSplit) {
	value.Destroy()
}

type Fee interface {
	Destroy()
}
type FeeFixed struct {
	Amount uint64
}

func (e FeeFixed) Destroy() {
	FfiDestroyerUint64{}.Destroy(e.Amount)
}

type FeeRate struct {
	SatPerVbyte uint64
}

func (e FeeRate) Destroy() {
	FfiDestroyerUint64{}.Destroy(e.SatPerVbyte)
}

type FfiConverterFee struct{}

var FfiConverterFeeINSTANCE = FfiConverterFee{}

func (c FfiConverterFee) Lift(rb RustBufferI) Fee {
	return LiftFromRustBuffer[Fee](c, rb)
}

func (c FfiConverterFee) Lower(value Fee) C.RustBuffer {
	return LowerIntoRustBuffer[Fee](c, value)
}

func (c FfiConverterFee) LowerExternal(value Fee) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[Fee](c, value))
}
func (FfiConverterFee) Read(reader io.Reader) Fee {
	id := readInt32(reader)
	switch id {
	case 1:
		return FeeFixed{
			FfiConverterUint64INSTANCE.Read(reader),
		}
	case 2:
		return FeeRate{
			FfiConverterUint64INSTANCE.Read(reader),
		}
	default:
		panic(fmt.Sprintf("invalid enum value %v in FfiConverterFee.Read()", id))
	}
}

func (FfiConverterFee) Write(writer io.Writer, value Fee) {
	switch variant_value := value.(type) {
	case FeeFixed:
		writeInt32(writer, 1)
		FfiConverterUint64INSTANCE.Write(writer, variant_value.Amount)
	case FeeRate:
		writeInt32(writer, 2)
		FfiConverterUint64INSTANCE.Write(writer, variant_value.SatPerVbyte)
	default:
		_ = variant_value
		panic(fmt.Sprintf("invalid enum value `%v` in FfiConverterFee.Write", value))
	}
}

type FfiDestroyerFee struct{}

func (_ FfiDestroyerFee) Destroy(value Fee) {
	value.Destroy()
}

// Specifies how fees are handled in a payment.
type FeePolicy uint

const (
	// Fees are added on top of the specified amount (default behavior).
	// The receiver gets the exact amount specified.
	FeePolicyFeesExcluded FeePolicy = 1
	// Fees are deducted from the specified amount.
	// The receiver gets the amount minus fees.
	FeePolicyFeesIncluded FeePolicy = 2
)

type FfiConverterFeePolicy struct{}

var FfiConverterFeePolicyINSTANCE = FfiConverterFeePolicy{}

func (c FfiConverterFeePolicy) Lift(rb RustBufferI) FeePolicy {
	return LiftFromRustBuffer[FeePolicy](c, rb)
}

func (c FfiConverterFeePolicy) Lower(value FeePolicy) C.RustBuffer {
	return LowerIntoRustBuffer[FeePolicy](c, value)
}

func (c FfiConverterFeePolicy) LowerExternal(value FeePolicy) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[FeePolicy](c, value))
}
func (FfiConverterFeePolicy) Read(reader io.Reader) FeePolicy {
	id := readInt32(reader)
	return FeePolicy(id)
}

func (FfiConverterFeePolicy) Write(writer io.Writer, value FeePolicy) {
	writeInt32(writer, int32(value))
}

type FfiDestroyerFeePolicy struct{}

func (_ FfiDestroyerFeePolicy) Destroy(value FeePolicy) {
}

type InputType interface {
	Destroy()
}
type InputTypeBitcoinAddress struct {
	Field0 BitcoinAddressDetails
}

func (e InputTypeBitcoinAddress) Destroy() {
	FfiDestroyerBitcoinAddressDetails{}.Destroy(e.Field0)
}

type InputTypeBolt11Invoice struct {
	Field0 Bolt11InvoiceDetails
}

func (e InputTypeBolt11Invoice) Destroy() {
	FfiDestroyerBolt11InvoiceDetails{}.Destroy(e.Field0)
}

type InputTypeBolt12Invoice struct {
	Field0 Bolt12InvoiceDetails
}

func (e InputTypeBolt12Invoice) Destroy() {
	FfiDestroyerBolt12InvoiceDetails{}.Destroy(e.Field0)
}

type InputTypeBolt12Offer struct {
	Field0 Bolt12OfferDetails
}

func (e InputTypeBolt12Offer) Destroy() {
	FfiDestroyerBolt12OfferDetails{}.Destroy(e.Field0)
}

type InputTypeLightningAddress struct {
	Field0 LightningAddressDetails
}

func (e InputTypeLightningAddress) Destroy() {
	FfiDestroyerLightningAddressDetails{}.Destroy(e.Field0)
}

type InputTypeLnurlPay struct {
	Field0 LnurlPayRequestDetails
}

func (e InputTypeLnurlPay) Destroy() {
	FfiDestroyerLnurlPayRequestDetails{}.Destroy(e.Field0)
}

type InputTypeSilentPaymentAddress struct {
	Field0 SilentPaymentAddressDetails
}

func (e InputTypeSilentPaymentAddress) Destroy() {
	FfiDestroyerSilentPaymentAddressDetails{}.Destroy(e.Field0)
}

type InputTypeLnurlAuth struct {
	Field0 LnurlAuthRequestDetails
}

func (e InputTypeLnurlAuth) Destroy() {
	FfiDestroyerLnurlAuthRequestDetails{}.Destroy(e.Field0)
}

type InputTypeUrl struct {
	Field0 string
}

func (e InputTypeUrl) Destroy() {
	FfiDestroyerString{}.Destroy(e.Field0)
}

type InputTypeBip21 struct {
	Field0 Bip21Details
}

func (e InputTypeBip21) Destroy() {
	FfiDestroyerBip21Details{}.Destroy(e.Field0)
}

type InputTypeBolt12InvoiceRequest struct {
	Field0 Bolt12InvoiceRequestDetails
}

func (e InputTypeBolt12InvoiceRequest) Destroy() {
	FfiDestroyerBolt12InvoiceRequestDetails{}.Destroy(e.Field0)
}

type InputTypeLnurlWithdraw struct {
	Field0 LnurlWithdrawRequestDetails
}

func (e InputTypeLnurlWithdraw) Destroy() {
	FfiDestroyerLnurlWithdrawRequestDetails{}.Destroy(e.Field0)
}

type InputTypeSparkAddress struct {
	Field0 SparkAddressDetails
}

func (e InputTypeSparkAddress) Destroy() {
	FfiDestroyerSparkAddressDetails{}.Destroy(e.Field0)
}

type InputTypeSparkInvoice struct {
	Field0 SparkInvoiceDetails
}

func (e InputTypeSparkInvoice) Destroy() {
	FfiDestroyerSparkInvoiceDetails{}.Destroy(e.Field0)
}

type FfiConverterInputType struct{}

var FfiConverterInputTypeINSTANCE = FfiConverterInputType{}

func (c FfiConverterInputType) Lift(rb RustBufferI) InputType {
	return LiftFromRustBuffer[InputType](c, rb)
}

func (c FfiConverterInputType) Lower(value InputType) C.RustBuffer {
	return LowerIntoRustBuffer[InputType](c, value)
}

func (c FfiConverterInputType) LowerExternal(value InputType) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[InputType](c, value))
}
func (FfiConverterInputType) Read(reader io.Reader) InputType {
	id := readInt32(reader)
	switch id {
	case 1:
		return InputTypeBitcoinAddress{
			FfiConverterBitcoinAddressDetailsINSTANCE.Read(reader),
		}
	case 2:
		return InputTypeBolt11Invoice{
			FfiConverterBolt11InvoiceDetailsINSTANCE.Read(reader),
		}
	case 3:
		return InputTypeBolt12Invoice{
			FfiConverterBolt12InvoiceDetailsINSTANCE.Read(reader),
		}
	case 4:
		return InputTypeBolt12Offer{
			FfiConverterBolt12OfferDetailsINSTANCE.Read(reader),
		}
	case 5:
		return InputTypeLightningAddress{
			FfiConverterLightningAddressDetailsINSTANCE.Read(reader),
		}
	case 6:
		return InputTypeLnurlPay{
			FfiConverterLnurlPayRequestDetailsINSTANCE.Read(reader),
		}
	case 7:
		return InputTypeSilentPaymentAddress{
			FfiConverterSilentPaymentAddressDetailsINSTANCE.Read(reader),
		}
	case 8:
		return InputTypeLnurlAuth{
			FfiConverterLnurlAuthRequestDetailsINSTANCE.Read(reader),
		}
	case 9:
		return InputTypeUrl{
			FfiConverterStringINSTANCE.Read(reader),
		}
	case 10:
		return InputTypeBip21{
			FfiConverterBip21DetailsINSTANCE.Read(reader),
		}
	case 11:
		return InputTypeBolt12InvoiceRequest{
			FfiConverterBolt12InvoiceRequestDetailsINSTANCE.Read(reader),
		}
	case 12:
		return InputTypeLnurlWithdraw{
			FfiConverterLnurlWithdrawRequestDetailsINSTANCE.Read(reader),
		}
	case 13:
		return InputTypeSparkAddress{
			FfiConverterSparkAddressDetailsINSTANCE.Read(reader),
		}
	case 14:
		return InputTypeSparkInvoice{
			FfiConverterSparkInvoiceDetailsINSTANCE.Read(reader),
		}
	default:
		panic(fmt.Sprintf("invalid enum value %v in FfiConverterInputType.Read()", id))
	}
}

func (FfiConverterInputType) Write(writer io.Writer, value InputType) {
	switch variant_value := value.(type) {
	case InputTypeBitcoinAddress:
		writeInt32(writer, 1)
		FfiConverterBitcoinAddressDetailsINSTANCE.Write(writer, variant_value.Field0)
	case InputTypeBolt11Invoice:
		writeInt32(writer, 2)
		FfiConverterBolt11InvoiceDetailsINSTANCE.Write(writer, variant_value.Field0)
	case InputTypeBolt12Invoice:
		writeInt32(writer, 3)
		FfiConverterBolt12InvoiceDetailsINSTANCE.Write(writer, variant_value.Field0)
	case InputTypeBolt12Offer:
		writeInt32(writer, 4)
		FfiConverterBolt12OfferDetailsINSTANCE.Write(writer, variant_value.Field0)
	case InputTypeLightningAddress:
		writeInt32(writer, 5)
		FfiConverterLightningAddressDetailsINSTANCE.Write(writer, variant_value.Field0)
	case InputTypeLnurlPay:
		writeInt32(writer, 6)
		FfiConverterLnurlPayRequestDetailsINSTANCE.Write(writer, variant_value.Field0)
	case InputTypeSilentPaymentAddress:
		writeInt32(writer, 7)
		FfiConverterSilentPaymentAddressDetailsINSTANCE.Write(writer, variant_value.Field0)
	case InputTypeLnurlAuth:
		writeInt32(writer, 8)
		FfiConverterLnurlAuthRequestDetailsINSTANCE.Write(writer, variant_value.Field0)
	case InputTypeUrl:
		writeInt32(writer, 9)
		FfiConverterStringINSTANCE.Write(writer, variant_value.Field0)
	case InputTypeBip21:
		writeInt32(writer, 10)
		FfiConverterBip21DetailsINSTANCE.Write(writer, variant_value.Field0)
	case InputTypeBolt12InvoiceRequest:
		writeInt32(writer, 11)
		FfiConverterBolt12InvoiceRequestDetailsINSTANCE.Write(writer, variant_value.Field0)
	case InputTypeLnurlWithdraw:
		writeInt32(writer, 12)
		FfiConverterLnurlWithdrawRequestDetailsINSTANCE.Write(writer, variant_value.Field0)
	case InputTypeSparkAddress:
		writeInt32(writer, 13)
		FfiConverterSparkAddressDetailsINSTANCE.Write(writer, variant_value.Field0)
	case InputTypeSparkInvoice:
		writeInt32(writer, 14)
		FfiConverterSparkInvoiceDetailsINSTANCE.Write(writer, variant_value.Field0)
	default:
		_ = variant_value
		panic(fmt.Sprintf("invalid enum value `%v` in FfiConverterInputType.Write", value))
	}
}

type FfiDestroyerInputType struct{}

func (_ FfiDestroyerInputType) Destroy(value InputType) {
	value.Destroy()
}

type KeySetType uint

const (
	KeySetTypeDefault       KeySetType = 1
	KeySetTypeTaproot       KeySetType = 2
	KeySetTypeNativeSegwit  KeySetType = 3
	KeySetTypeWrappedSegwit KeySetType = 4
	KeySetTypeLegacy        KeySetType = 5
)

type FfiConverterKeySetType struct{}

var FfiConverterKeySetTypeINSTANCE = FfiConverterKeySetType{}

func (c FfiConverterKeySetType) Lift(rb RustBufferI) KeySetType {
	return LiftFromRustBuffer[KeySetType](c, rb)
}

func (c FfiConverterKeySetType) Lower(value KeySetType) C.RustBuffer {
	return LowerIntoRustBuffer[KeySetType](c, value)
}

func (c FfiConverterKeySetType) LowerExternal(value KeySetType) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[KeySetType](c, value))
}
func (FfiConverterKeySetType) Read(reader io.Reader) KeySetType {
	id := readInt32(reader)
	return KeySetType(id)
}

func (FfiConverterKeySetType) Write(writer io.Writer, value KeySetType) {
	writeInt32(writer, int32(value))
}

type FfiDestroyerKeySetType struct{}

func (_ FfiDestroyerKeySetType) Destroy(value KeySetType) {
}

// The response from a LNURL-auth callback, indicating success or failure.
type LnurlCallbackStatus interface {
	Destroy()
}

// On-wire format is: `{"status": "OK"}`
type LnurlCallbackStatusOk struct {
}

func (e LnurlCallbackStatusOk) Destroy() {
}

// On-wire format is: `{"status": "ERROR", "reason": "error details..."}`
type LnurlCallbackStatusErrorStatus struct {
	ErrorDetails LnurlErrorDetails
}

func (e LnurlCallbackStatusErrorStatus) Destroy() {
	FfiDestroyerLnurlErrorDetails{}.Destroy(e.ErrorDetails)
}

type FfiConverterLnurlCallbackStatus struct{}

var FfiConverterLnurlCallbackStatusINSTANCE = FfiConverterLnurlCallbackStatus{}

func (c FfiConverterLnurlCallbackStatus) Lift(rb RustBufferI) LnurlCallbackStatus {
	return LiftFromRustBuffer[LnurlCallbackStatus](c, rb)
}

func (c FfiConverterLnurlCallbackStatus) Lower(value LnurlCallbackStatus) C.RustBuffer {
	return LowerIntoRustBuffer[LnurlCallbackStatus](c, value)
}

func (c FfiConverterLnurlCallbackStatus) LowerExternal(value LnurlCallbackStatus) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[LnurlCallbackStatus](c, value))
}
func (FfiConverterLnurlCallbackStatus) Read(reader io.Reader) LnurlCallbackStatus {
	id := readInt32(reader)
	switch id {
	case 1:
		return LnurlCallbackStatusOk{}
	case 2:
		return LnurlCallbackStatusErrorStatus{
			FfiConverterLnurlErrorDetailsINSTANCE.Read(reader),
		}
	default:
		panic(fmt.Sprintf("invalid enum value %v in FfiConverterLnurlCallbackStatus.Read()", id))
	}
}

func (FfiConverterLnurlCallbackStatus) Write(writer io.Writer, value LnurlCallbackStatus) {
	switch variant_value := value.(type) {
	case LnurlCallbackStatusOk:
		writeInt32(writer, 1)
	case LnurlCallbackStatusErrorStatus:
		writeInt32(writer, 2)
		FfiConverterLnurlErrorDetailsINSTANCE.Write(writer, variant_value.ErrorDetails)
	default:
		_ = variant_value
		panic(fmt.Sprintf("invalid enum value `%v` in FfiConverterLnurlCallbackStatus.Write", value))
	}
}

type FfiDestroyerLnurlCallbackStatus struct{}

func (_ FfiDestroyerLnurlCallbackStatus) Destroy(value LnurlCallbackStatus) {
	value.Destroy()
}

type MaxFee interface {
	Destroy()
}
type MaxFeeFixed struct {
	Amount uint64
}

func (e MaxFeeFixed) Destroy() {
	FfiDestroyerUint64{}.Destroy(e.Amount)
}

type MaxFeeRate struct {
	SatPerVbyte uint64
}

func (e MaxFeeRate) Destroy() {
	FfiDestroyerUint64{}.Destroy(e.SatPerVbyte)
}

type MaxFeeNetworkRecommended struct {
	LeewaySatPerVbyte uint64
}

func (e MaxFeeNetworkRecommended) Destroy() {
	FfiDestroyerUint64{}.Destroy(e.LeewaySatPerVbyte)
}

type FfiConverterMaxFee struct{}

var FfiConverterMaxFeeINSTANCE = FfiConverterMaxFee{}

func (c FfiConverterMaxFee) Lift(rb RustBufferI) MaxFee {
	return LiftFromRustBuffer[MaxFee](c, rb)
}

func (c FfiConverterMaxFee) Lower(value MaxFee) C.RustBuffer {
	return LowerIntoRustBuffer[MaxFee](c, value)
}

func (c FfiConverterMaxFee) LowerExternal(value MaxFee) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[MaxFee](c, value))
}
func (FfiConverterMaxFee) Read(reader io.Reader) MaxFee {
	id := readInt32(reader)
	switch id {
	case 1:
		return MaxFeeFixed{
			FfiConverterUint64INSTANCE.Read(reader),
		}
	case 2:
		return MaxFeeRate{
			FfiConverterUint64INSTANCE.Read(reader),
		}
	case 3:
		return MaxFeeNetworkRecommended{
			FfiConverterUint64INSTANCE.Read(reader),
		}
	default:
		panic(fmt.Sprintf("invalid enum value %v in FfiConverterMaxFee.Read()", id))
	}
}

func (FfiConverterMaxFee) Write(writer io.Writer, value MaxFee) {
	switch variant_value := value.(type) {
	case MaxFeeFixed:
		writeInt32(writer, 1)
		FfiConverterUint64INSTANCE.Write(writer, variant_value.Amount)
	case MaxFeeRate:
		writeInt32(writer, 2)
		FfiConverterUint64INSTANCE.Write(writer, variant_value.SatPerVbyte)
	case MaxFeeNetworkRecommended:
		writeInt32(writer, 3)
		FfiConverterUint64INSTANCE.Write(writer, variant_value.LeewaySatPerVbyte)
	default:
		_ = variant_value
		panic(fmt.Sprintf("invalid enum value `%v` in FfiConverterMaxFee.Write", value))
	}
}

type FfiDestroyerMaxFee struct{}

func (_ FfiDestroyerMaxFee) Destroy(value MaxFee) {
	value.Destroy()
}

type Network uint

const (
	NetworkMainnet Network = 1
	NetworkRegtest Network = 2
)

type FfiConverterNetwork struct{}

var FfiConverterNetworkINSTANCE = FfiConverterNetwork{}

func (c FfiConverterNetwork) Lift(rb RustBufferI) Network {
	return LiftFromRustBuffer[Network](c, rb)
}

func (c FfiConverterNetwork) Lower(value Network) C.RustBuffer {
	return LowerIntoRustBuffer[Network](c, value)
}

func (c FfiConverterNetwork) LowerExternal(value Network) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[Network](c, value))
}
func (FfiConverterNetwork) Read(reader io.Reader) Network {
	id := readInt32(reader)
	return Network(id)
}

func (FfiConverterNetwork) Write(writer io.Writer, value Network) {
	writeInt32(writer, int32(value))
}

type FfiDestroyerNetwork struct{}

func (_ FfiDestroyerNetwork) Destroy(value Network) {
}

type OnchainConfirmationSpeed uint

const (
	OnchainConfirmationSpeedFast   OnchainConfirmationSpeed = 1
	OnchainConfirmationSpeedMedium OnchainConfirmationSpeed = 2
	OnchainConfirmationSpeedSlow   OnchainConfirmationSpeed = 3
)

type FfiConverterOnchainConfirmationSpeed struct{}

var FfiConverterOnchainConfirmationSpeedINSTANCE = FfiConverterOnchainConfirmationSpeed{}

func (c FfiConverterOnchainConfirmationSpeed) Lift(rb RustBufferI) OnchainConfirmationSpeed {
	return LiftFromRustBuffer[OnchainConfirmationSpeed](c, rb)
}

func (c FfiConverterOnchainConfirmationSpeed) Lower(value OnchainConfirmationSpeed) C.RustBuffer {
	return LowerIntoRustBuffer[OnchainConfirmationSpeed](c, value)
}

func (c FfiConverterOnchainConfirmationSpeed) LowerExternal(value OnchainConfirmationSpeed) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[OnchainConfirmationSpeed](c, value))
}
func (FfiConverterOnchainConfirmationSpeed) Read(reader io.Reader) OnchainConfirmationSpeed {
	id := readInt32(reader)
	return OnchainConfirmationSpeed(id)
}

func (FfiConverterOnchainConfirmationSpeed) Write(writer io.Writer, value OnchainConfirmationSpeed) {
	writeInt32(writer, int32(value))
}

type FfiDestroyerOnchainConfirmationSpeed struct{}

func (_ FfiDestroyerOnchainConfirmationSpeed) Destroy(value OnchainConfirmationSpeed) {
}

type OptimizationEvent interface {
	Destroy()
}

// Optimization has started with the given number of rounds.
type OptimizationEventStarted struct {
	TotalRounds uint32
}

func (e OptimizationEventStarted) Destroy() {
	FfiDestroyerUint32{}.Destroy(e.TotalRounds)
}

// A round has completed.
type OptimizationEventRoundCompleted struct {
	CurrentRound uint32
	TotalRounds  uint32
}

func (e OptimizationEventRoundCompleted) Destroy() {
	FfiDestroyerUint32{}.Destroy(e.CurrentRound)
	FfiDestroyerUint32{}.Destroy(e.TotalRounds)
}

// Optimization completed successfully.
type OptimizationEventCompleted struct {
}

func (e OptimizationEventCompleted) Destroy() {
}

// Optimization was cancelled.
type OptimizationEventCancelled struct {
}

func (e OptimizationEventCancelled) Destroy() {
}

// Optimization failed with an error.
type OptimizationEventFailed struct {
	Error string
}

func (e OptimizationEventFailed) Destroy() {
	FfiDestroyerString{}.Destroy(e.Error)
}

// Optimization was skipped because leaves are already optimal.
type OptimizationEventSkipped struct {
}

func (e OptimizationEventSkipped) Destroy() {
}

type FfiConverterOptimizationEvent struct{}

var FfiConverterOptimizationEventINSTANCE = FfiConverterOptimizationEvent{}

func (c FfiConverterOptimizationEvent) Lift(rb RustBufferI) OptimizationEvent {
	return LiftFromRustBuffer[OptimizationEvent](c, rb)
}

func (c FfiConverterOptimizationEvent) Lower(value OptimizationEvent) C.RustBuffer {
	return LowerIntoRustBuffer[OptimizationEvent](c, value)
}

func (c FfiConverterOptimizationEvent) LowerExternal(value OptimizationEvent) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[OptimizationEvent](c, value))
}
func (FfiConverterOptimizationEvent) Read(reader io.Reader) OptimizationEvent {
	id := readInt32(reader)
	switch id {
	case 1:
		return OptimizationEventStarted{
			FfiConverterUint32INSTANCE.Read(reader),
		}
	case 2:
		return OptimizationEventRoundCompleted{
			FfiConverterUint32INSTANCE.Read(reader),
			FfiConverterUint32INSTANCE.Read(reader),
		}
	case 3:
		return OptimizationEventCompleted{}
	case 4:
		return OptimizationEventCancelled{}
	case 5:
		return OptimizationEventFailed{
			FfiConverterStringINSTANCE.Read(reader),
		}
	case 6:
		return OptimizationEventSkipped{}
	default:
		panic(fmt.Sprintf("invalid enum value %v in FfiConverterOptimizationEvent.Read()", id))
	}
}

func (FfiConverterOptimizationEvent) Write(writer io.Writer, value OptimizationEvent) {
	switch variant_value := value.(type) {
	case OptimizationEventStarted:
		writeInt32(writer, 1)
		FfiConverterUint32INSTANCE.Write(writer, variant_value.TotalRounds)
	case OptimizationEventRoundCompleted:
		writeInt32(writer, 2)
		FfiConverterUint32INSTANCE.Write(writer, variant_value.CurrentRound)
		FfiConverterUint32INSTANCE.Write(writer, variant_value.TotalRounds)
	case OptimizationEventCompleted:
		writeInt32(writer, 3)
	case OptimizationEventCancelled:
		writeInt32(writer, 4)
	case OptimizationEventFailed:
		writeInt32(writer, 5)
		FfiConverterStringINSTANCE.Write(writer, variant_value.Error)
	case OptimizationEventSkipped:
		writeInt32(writer, 6)
	default:
		_ = variant_value
		panic(fmt.Sprintf("invalid enum value `%v` in FfiConverterOptimizationEvent.Write", value))
	}
}

type FfiDestroyerOptimizationEvent struct{}

func (_ FfiDestroyerOptimizationEvent) Destroy(value OptimizationEvent) {
	value.Destroy()
}

// Error type for passkey operations.
type PasskeyError struct {
	err error
}

// Convience method to turn *PasskeyError into error
// Avoiding treating nil pointer as non nil error interface
func (err *PasskeyError) AsError() error {
	if err == nil {
		return nil
	} else {
		return err
	}
}

func (err PasskeyError) Error() string {
	return fmt.Sprintf("PasskeyError: %s", err.err.Error())
}

func (err PasskeyError) Unwrap() error {
	return err.err
}

// Err* are used for checking error type with `errors.Is`
var ErrPasskeyErrorPrfError = fmt.Errorf("PasskeyErrorPrfError")
var ErrPasskeyErrorRelayConnectionFailed = fmt.Errorf("PasskeyErrorRelayConnectionFailed")
var ErrPasskeyErrorNostrWriteFailed = fmt.Errorf("PasskeyErrorNostrWriteFailed")
var ErrPasskeyErrorNostrReadFailed = fmt.Errorf("PasskeyErrorNostrReadFailed")
var ErrPasskeyErrorKeyDerivationError = fmt.Errorf("PasskeyErrorKeyDerivationError")
var ErrPasskeyErrorInvalidPrfOutput = fmt.Errorf("PasskeyErrorInvalidPrfOutput")
var ErrPasskeyErrorMnemonicError = fmt.Errorf("PasskeyErrorMnemonicError")
var ErrPasskeyErrorInvalidSalt = fmt.Errorf("PasskeyErrorInvalidSalt")
var ErrPasskeyErrorGeneric = fmt.Errorf("PasskeyErrorGeneric")

// Variant structs
// Passkey PRF provider error
type PasskeyErrorPrfError struct {
	Field0 *PasskeyPrfError
}

// Passkey PRF provider error
func NewPasskeyErrorPrfError(
	var0 *PasskeyPrfError,
) *PasskeyError {
	return &PasskeyError{err: &PasskeyErrorPrfError{
		Field0: var0}}
}

func (e PasskeyErrorPrfError) destroy() {
	FfiDestroyerPasskeyPrfError{}.Destroy(e.Field0)
}

func (err PasskeyErrorPrfError) Error() string {
	return fmt.Sprint("PrfError",
		": ",

		"Field0=",
		err.Field0,
	)
}

func (self PasskeyErrorPrfError) Is(target error) bool {
	return target == ErrPasskeyErrorPrfError
}

// Nostr relay connection failed
type PasskeyErrorRelayConnectionFailed struct {
	Field0 string
}

// Nostr relay connection failed
func NewPasskeyErrorRelayConnectionFailed(
	var0 string,
) *PasskeyError {
	return &PasskeyError{err: &PasskeyErrorRelayConnectionFailed{
		Field0: var0}}
}

func (e PasskeyErrorRelayConnectionFailed) destroy() {
	FfiDestroyerString{}.Destroy(e.Field0)
}

func (err PasskeyErrorRelayConnectionFailed) Error() string {
	return fmt.Sprint("RelayConnectionFailed",
		": ",

		"Field0=",
		err.Field0,
	)
}

func (self PasskeyErrorRelayConnectionFailed) Is(target error) bool {
	return target == ErrPasskeyErrorRelayConnectionFailed
}

// Failed to publish to Nostr
type PasskeyErrorNostrWriteFailed struct {
	Field0 string
}

// Failed to publish to Nostr
func NewPasskeyErrorNostrWriteFailed(
	var0 string,
) *PasskeyError {
	return &PasskeyError{err: &PasskeyErrorNostrWriteFailed{
		Field0: var0}}
}

func (e PasskeyErrorNostrWriteFailed) destroy() {
	FfiDestroyerString{}.Destroy(e.Field0)
}

func (err PasskeyErrorNostrWriteFailed) Error() string {
	return fmt.Sprint("NostrWriteFailed",
		": ",

		"Field0=",
		err.Field0,
	)
}

func (self PasskeyErrorNostrWriteFailed) Is(target error) bool {
	return target == ErrPasskeyErrorNostrWriteFailed
}

// Failed to query from Nostr
type PasskeyErrorNostrReadFailed struct {
	Field0 string
}

// Failed to query from Nostr
func NewPasskeyErrorNostrReadFailed(
	var0 string,
) *PasskeyError {
	return &PasskeyError{err: &PasskeyErrorNostrReadFailed{
		Field0: var0}}
}

func (e PasskeyErrorNostrReadFailed) destroy() {
	FfiDestroyerString{}.Destroy(e.Field0)
}

func (err PasskeyErrorNostrReadFailed) Error() string {
	return fmt.Sprint("NostrReadFailed",
		": ",

		"Field0=",
		err.Field0,
	)
}

func (self PasskeyErrorNostrReadFailed) Is(target error) bool {
	return target == ErrPasskeyErrorNostrReadFailed
}

// Key derivation error
type PasskeyErrorKeyDerivationError struct {
	Field0 string
}

// Key derivation error
func NewPasskeyErrorKeyDerivationError(
	var0 string,
) *PasskeyError {
	return &PasskeyError{err: &PasskeyErrorKeyDerivationError{
		Field0: var0}}
}

func (e PasskeyErrorKeyDerivationError) destroy() {
	FfiDestroyerString{}.Destroy(e.Field0)
}

func (err PasskeyErrorKeyDerivationError) Error() string {
	return fmt.Sprint("KeyDerivationError",
		": ",

		"Field0=",
		err.Field0,
	)
}

func (self PasskeyErrorKeyDerivationError) Is(target error) bool {
	return target == ErrPasskeyErrorKeyDerivationError
}

// Invalid PRF output (wrong size, etc.)
type PasskeyErrorInvalidPrfOutput struct {
	Field0 string
}

// Invalid PRF output (wrong size, etc.)
func NewPasskeyErrorInvalidPrfOutput(
	var0 string,
) *PasskeyError {
	return &PasskeyError{err: &PasskeyErrorInvalidPrfOutput{
		Field0: var0}}
}

func (e PasskeyErrorInvalidPrfOutput) destroy() {
	FfiDestroyerString{}.Destroy(e.Field0)
}

func (err PasskeyErrorInvalidPrfOutput) Error() string {
	return fmt.Sprint("InvalidPrfOutput",
		": ",

		"Field0=",
		err.Field0,
	)
}

func (self PasskeyErrorInvalidPrfOutput) Is(target error) bool {
	return target == ErrPasskeyErrorInvalidPrfOutput
}

// BIP39 mnemonic generation error
type PasskeyErrorMnemonicError struct {
	Field0 string
}

// BIP39 mnemonic generation error
func NewPasskeyErrorMnemonicError(
	var0 string,
) *PasskeyError {
	return &PasskeyError{err: &PasskeyErrorMnemonicError{
		Field0: var0}}
}

func (e PasskeyErrorMnemonicError) destroy() {
	FfiDestroyerString{}.Destroy(e.Field0)
}

func (err PasskeyErrorMnemonicError) Error() string {
	return fmt.Sprint("MnemonicError",
		": ",

		"Field0=",
		err.Field0,
	)
}

func (self PasskeyErrorMnemonicError) Is(target error) bool {
	return target == ErrPasskeyErrorMnemonicError
}

// Invalid salt input
type PasskeyErrorInvalidSalt struct {
	Field0 string
}

// Invalid salt input
func NewPasskeyErrorInvalidSalt(
	var0 string,
) *PasskeyError {
	return &PasskeyError{err: &PasskeyErrorInvalidSalt{
		Field0: var0}}
}

func (e PasskeyErrorInvalidSalt) destroy() {
	FfiDestroyerString{}.Destroy(e.Field0)
}

func (err PasskeyErrorInvalidSalt) Error() string {
	return fmt.Sprint("InvalidSalt",
		": ",

		"Field0=",
		err.Field0,
	)
}

func (self PasskeyErrorInvalidSalt) Is(target error) bool {
	return target == ErrPasskeyErrorInvalidSalt
}

// Generic error
type PasskeyErrorGeneric struct {
	Field0 string
}

// Generic error
func NewPasskeyErrorGeneric(
	var0 string,
) *PasskeyError {
	return &PasskeyError{err: &PasskeyErrorGeneric{
		Field0: var0}}
}

func (e PasskeyErrorGeneric) destroy() {
	FfiDestroyerString{}.Destroy(e.Field0)
}

func (err PasskeyErrorGeneric) Error() string {
	return fmt.Sprint("Generic",
		": ",

		"Field0=",
		err.Field0,
	)
}

func (self PasskeyErrorGeneric) Is(target error) bool {
	return target == ErrPasskeyErrorGeneric
}

type FfiConverterPasskeyError struct{}

var FfiConverterPasskeyErrorINSTANCE = FfiConverterPasskeyError{}

func (c FfiConverterPasskeyError) Lift(eb RustBufferI) *PasskeyError {
	return LiftFromRustBuffer[*PasskeyError](c, eb)
}

func (c FfiConverterPasskeyError) Lower(value *PasskeyError) C.RustBuffer {
	return LowerIntoRustBuffer[*PasskeyError](c, value)
}

func (c FfiConverterPasskeyError) LowerExternal(value *PasskeyError) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[*PasskeyError](c, value))
}

func (c FfiConverterPasskeyError) Read(reader io.Reader) *PasskeyError {
	errorID := readUint32(reader)

	switch errorID {
	case 1:
		return &PasskeyError{&PasskeyErrorPrfError{
			Field0: FfiConverterPasskeyPrfErrorINSTANCE.Read(reader),
		}}
	case 2:
		return &PasskeyError{&PasskeyErrorRelayConnectionFailed{
			Field0: FfiConverterStringINSTANCE.Read(reader),
		}}
	case 3:
		return &PasskeyError{&PasskeyErrorNostrWriteFailed{
			Field0: FfiConverterStringINSTANCE.Read(reader),
		}}
	case 4:
		return &PasskeyError{&PasskeyErrorNostrReadFailed{
			Field0: FfiConverterStringINSTANCE.Read(reader),
		}}
	case 5:
		return &PasskeyError{&PasskeyErrorKeyDerivationError{
			Field0: FfiConverterStringINSTANCE.Read(reader),
		}}
	case 6:
		return &PasskeyError{&PasskeyErrorInvalidPrfOutput{
			Field0: FfiConverterStringINSTANCE.Read(reader),
		}}
	case 7:
		return &PasskeyError{&PasskeyErrorMnemonicError{
			Field0: FfiConverterStringINSTANCE.Read(reader),
		}}
	case 8:
		return &PasskeyError{&PasskeyErrorInvalidSalt{
			Field0: FfiConverterStringINSTANCE.Read(reader),
		}}
	case 9:
		return &PasskeyError{&PasskeyErrorGeneric{
			Field0: FfiConverterStringINSTANCE.Read(reader),
		}}
	default:
		panic(fmt.Sprintf("Unknown error code %d in FfiConverterPasskeyError.Read()", errorID))
	}
}

func (c FfiConverterPasskeyError) Write(writer io.Writer, value *PasskeyError) {
	switch variantValue := value.err.(type) {
	case *PasskeyErrorPrfError:
		writeInt32(writer, 1)
		FfiConverterPasskeyPrfErrorINSTANCE.Write(writer, variantValue.Field0)
	case *PasskeyErrorRelayConnectionFailed:
		writeInt32(writer, 2)
		FfiConverterStringINSTANCE.Write(writer, variantValue.Field0)
	case *PasskeyErrorNostrWriteFailed:
		writeInt32(writer, 3)
		FfiConverterStringINSTANCE.Write(writer, variantValue.Field0)
	case *PasskeyErrorNostrReadFailed:
		writeInt32(writer, 4)
		FfiConverterStringINSTANCE.Write(writer, variantValue.Field0)
	case *PasskeyErrorKeyDerivationError:
		writeInt32(writer, 5)
		FfiConverterStringINSTANCE.Write(writer, variantValue.Field0)
	case *PasskeyErrorInvalidPrfOutput:
		writeInt32(writer, 6)
		FfiConverterStringINSTANCE.Write(writer, variantValue.Field0)
	case *PasskeyErrorMnemonicError:
		writeInt32(writer, 7)
		FfiConverterStringINSTANCE.Write(writer, variantValue.Field0)
	case *PasskeyErrorInvalidSalt:
		writeInt32(writer, 8)
		FfiConverterStringINSTANCE.Write(writer, variantValue.Field0)
	case *PasskeyErrorGeneric:
		writeInt32(writer, 9)
		FfiConverterStringINSTANCE.Write(writer, variantValue.Field0)
	default:
		_ = variantValue
		panic(fmt.Sprintf("invalid error value `%v` in FfiConverterPasskeyError.Write", value))
	}
}

type FfiDestroyerPasskeyError struct{}

func (_ FfiDestroyerPasskeyError) Destroy(value *PasskeyError) {
	switch variantValue := value.err.(type) {
	case PasskeyErrorPrfError:
		variantValue.destroy()
	case PasskeyErrorRelayConnectionFailed:
		variantValue.destroy()
	case PasskeyErrorNostrWriteFailed:
		variantValue.destroy()
	case PasskeyErrorNostrReadFailed:
		variantValue.destroy()
	case PasskeyErrorKeyDerivationError:
		variantValue.destroy()
	case PasskeyErrorInvalidPrfOutput:
		variantValue.destroy()
	case PasskeyErrorMnemonicError:
		variantValue.destroy()
	case PasskeyErrorInvalidSalt:
		variantValue.destroy()
	case PasskeyErrorGeneric:
		variantValue.destroy()
	default:
		_ = variantValue
		panic(fmt.Sprintf("invalid error value `%v` in FfiDestroyerPasskeyError.Destroy", value))
	}
}

// Error type for passkey PRF operations.
// Platforms implement `PasskeyPrfProvider` and return this error type.
type PasskeyPrfError struct {
	err error
}

// Convience method to turn *PasskeyPrfError into error
// Avoiding treating nil pointer as non nil error interface
func (err *PasskeyPrfError) AsError() error {
	if err == nil {
		return nil
	} else {
		return err
	}
}

func (err PasskeyPrfError) Error() string {
	return fmt.Sprintf("PasskeyPrfError: %s", err.err.Error())
}

func (err PasskeyPrfError) Unwrap() error {
	return err.err
}

// Err* are used for checking error type with `errors.Is`
var ErrPasskeyPrfErrorPrfNotSupported = fmt.Errorf("PasskeyPrfErrorPrfNotSupported")
var ErrPasskeyPrfErrorUserCancelled = fmt.Errorf("PasskeyPrfErrorUserCancelled")
var ErrPasskeyPrfErrorCredentialNotFound = fmt.Errorf("PasskeyPrfErrorCredentialNotFound")
var ErrPasskeyPrfErrorAuthenticationFailed = fmt.Errorf("PasskeyPrfErrorAuthenticationFailed")
var ErrPasskeyPrfErrorPrfEvaluationFailed = fmt.Errorf("PasskeyPrfErrorPrfEvaluationFailed")
var ErrPasskeyPrfErrorGeneric = fmt.Errorf("PasskeyPrfErrorGeneric")

// Variant structs
// PRF extension is not supported by the authenticator
type PasskeyPrfErrorPrfNotSupported struct {
}

// PRF extension is not supported by the authenticator
func NewPasskeyPrfErrorPrfNotSupported() *PasskeyPrfError {
	return &PasskeyPrfError{err: &PasskeyPrfErrorPrfNotSupported{}}
}

func (e PasskeyPrfErrorPrfNotSupported) destroy() {
}

func (err PasskeyPrfErrorPrfNotSupported) Error() string {
	return fmt.Sprint("PrfNotSupported")
}

func (self PasskeyPrfErrorPrfNotSupported) Is(target error) bool {
	return target == ErrPasskeyPrfErrorPrfNotSupported
}

// User cancelled the authentication
type PasskeyPrfErrorUserCancelled struct {
}

// User cancelled the authentication
func NewPasskeyPrfErrorUserCancelled() *PasskeyPrfError {
	return &PasskeyPrfError{err: &PasskeyPrfErrorUserCancelled{}}
}

func (e PasskeyPrfErrorUserCancelled) destroy() {
}

func (err PasskeyPrfErrorUserCancelled) Error() string {
	return fmt.Sprint("UserCancelled")
}

func (self PasskeyPrfErrorUserCancelled) Is(target error) bool {
	return target == ErrPasskeyPrfErrorUserCancelled
}

// No credential found
type PasskeyPrfErrorCredentialNotFound struct {
}

// No credential found
func NewPasskeyPrfErrorCredentialNotFound() *PasskeyPrfError {
	return &PasskeyPrfError{err: &PasskeyPrfErrorCredentialNotFound{}}
}

func (e PasskeyPrfErrorCredentialNotFound) destroy() {
}

func (err PasskeyPrfErrorCredentialNotFound) Error() string {
	return fmt.Sprint("CredentialNotFound")
}

func (self PasskeyPrfErrorCredentialNotFound) Is(target error) bool {
	return target == ErrPasskeyPrfErrorCredentialNotFound
}

// Authentication failed
type PasskeyPrfErrorAuthenticationFailed struct {
	Field0 string
}

// Authentication failed
func NewPasskeyPrfErrorAuthenticationFailed(
	var0 string,
) *PasskeyPrfError {
	return &PasskeyPrfError{err: &PasskeyPrfErrorAuthenticationFailed{
		Field0: var0}}
}

func (e PasskeyPrfErrorAuthenticationFailed) destroy() {
	FfiDestroyerString{}.Destroy(e.Field0)
}

func (err PasskeyPrfErrorAuthenticationFailed) Error() string {
	return fmt.Sprint("AuthenticationFailed",
		": ",

		"Field0=",
		err.Field0,
	)
}

func (self PasskeyPrfErrorAuthenticationFailed) Is(target error) bool {
	return target == ErrPasskeyPrfErrorAuthenticationFailed
}

// PRF evaluation failed
type PasskeyPrfErrorPrfEvaluationFailed struct {
	Field0 string
}

// PRF evaluation failed
func NewPasskeyPrfErrorPrfEvaluationFailed(
	var0 string,
) *PasskeyPrfError {
	return &PasskeyPrfError{err: &PasskeyPrfErrorPrfEvaluationFailed{
		Field0: var0}}
}

func (e PasskeyPrfErrorPrfEvaluationFailed) destroy() {
	FfiDestroyerString{}.Destroy(e.Field0)
}

func (err PasskeyPrfErrorPrfEvaluationFailed) Error() string {
	return fmt.Sprint("PrfEvaluationFailed",
		": ",

		"Field0=",
		err.Field0,
	)
}

func (self PasskeyPrfErrorPrfEvaluationFailed) Is(target error) bool {
	return target == ErrPasskeyPrfErrorPrfEvaluationFailed
}

// Generic error
type PasskeyPrfErrorGeneric struct {
	Field0 string
}

// Generic error
func NewPasskeyPrfErrorGeneric(
	var0 string,
) *PasskeyPrfError {
	return &PasskeyPrfError{err: &PasskeyPrfErrorGeneric{
		Field0: var0}}
}

func (e PasskeyPrfErrorGeneric) destroy() {
	FfiDestroyerString{}.Destroy(e.Field0)
}

func (err PasskeyPrfErrorGeneric) Error() string {
	return fmt.Sprint("Generic",
		": ",

		"Field0=",
		err.Field0,
	)
}

func (self PasskeyPrfErrorGeneric) Is(target error) bool {
	return target == ErrPasskeyPrfErrorGeneric
}

type FfiConverterPasskeyPrfError struct{}

var FfiConverterPasskeyPrfErrorINSTANCE = FfiConverterPasskeyPrfError{}

func (c FfiConverterPasskeyPrfError) Lift(eb RustBufferI) *PasskeyPrfError {
	return LiftFromRustBuffer[*PasskeyPrfError](c, eb)
}

func (c FfiConverterPasskeyPrfError) Lower(value *PasskeyPrfError) C.RustBuffer {
	return LowerIntoRustBuffer[*PasskeyPrfError](c, value)
}

func (c FfiConverterPasskeyPrfError) LowerExternal(value *PasskeyPrfError) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[*PasskeyPrfError](c, value))
}

func (c FfiConverterPasskeyPrfError) Read(reader io.Reader) *PasskeyPrfError {
	errorID := readUint32(reader)

	switch errorID {
	case 1:
		return &PasskeyPrfError{&PasskeyPrfErrorPrfNotSupported{}}
	case 2:
		return &PasskeyPrfError{&PasskeyPrfErrorUserCancelled{}}
	case 3:
		return &PasskeyPrfError{&PasskeyPrfErrorCredentialNotFound{}}
	case 4:
		return &PasskeyPrfError{&PasskeyPrfErrorAuthenticationFailed{
			Field0: FfiConverterStringINSTANCE.Read(reader),
		}}
	case 5:
		return &PasskeyPrfError{&PasskeyPrfErrorPrfEvaluationFailed{
			Field0: FfiConverterStringINSTANCE.Read(reader),
		}}
	case 6:
		return &PasskeyPrfError{&PasskeyPrfErrorGeneric{
			Field0: FfiConverterStringINSTANCE.Read(reader),
		}}
	default:
		panic(fmt.Sprintf("Unknown error code %d in FfiConverterPasskeyPrfError.Read()", errorID))
	}
}

func (c FfiConverterPasskeyPrfError) Write(writer io.Writer, value *PasskeyPrfError) {
	switch variantValue := value.err.(type) {
	case *PasskeyPrfErrorPrfNotSupported:
		writeInt32(writer, 1)
	case *PasskeyPrfErrorUserCancelled:
		writeInt32(writer, 2)
	case *PasskeyPrfErrorCredentialNotFound:
		writeInt32(writer, 3)
	case *PasskeyPrfErrorAuthenticationFailed:
		writeInt32(writer, 4)
		FfiConverterStringINSTANCE.Write(writer, variantValue.Field0)
	case *PasskeyPrfErrorPrfEvaluationFailed:
		writeInt32(writer, 5)
		FfiConverterStringINSTANCE.Write(writer, variantValue.Field0)
	case *PasskeyPrfErrorGeneric:
		writeInt32(writer, 6)
		FfiConverterStringINSTANCE.Write(writer, variantValue.Field0)
	default:
		_ = variantValue
		panic(fmt.Sprintf("invalid error value `%v` in FfiConverterPasskeyPrfError.Write", value))
	}
}

type FfiDestroyerPasskeyPrfError struct{}

func (_ FfiDestroyerPasskeyPrfError) Destroy(value *PasskeyPrfError) {
	switch variantValue := value.err.(type) {
	case PasskeyPrfErrorPrfNotSupported:
		variantValue.destroy()
	case PasskeyPrfErrorUserCancelled:
		variantValue.destroy()
	case PasskeyPrfErrorCredentialNotFound:
		variantValue.destroy()
	case PasskeyPrfErrorAuthenticationFailed:
		variantValue.destroy()
	case PasskeyPrfErrorPrfEvaluationFailed:
		variantValue.destroy()
	case PasskeyPrfErrorGeneric:
		variantValue.destroy()
	default:
		_ = variantValue
		panic(fmt.Sprintf("invalid error value `%v` in FfiDestroyerPasskeyPrfError.Destroy", value))
	}
}

type PaymentDetails interface {
	Destroy()
}
type PaymentDetailsSpark struct {
	InvoiceDetails *SparkInvoicePaymentDetails
	HtlcDetails    *SparkHtlcDetails
	ConversionInfo *ConversionInfo
}

func (e PaymentDetailsSpark) Destroy() {
	FfiDestroyerOptionalSparkInvoicePaymentDetails{}.Destroy(e.InvoiceDetails)
	FfiDestroyerOptionalSparkHtlcDetails{}.Destroy(e.HtlcDetails)
	FfiDestroyerOptionalConversionInfo{}.Destroy(e.ConversionInfo)
}

type PaymentDetailsToken struct {
	Metadata       TokenMetadata
	TxHash         string
	TxType         TokenTransactionType
	InvoiceDetails *SparkInvoicePaymentDetails
	ConversionInfo *ConversionInfo
}

func (e PaymentDetailsToken) Destroy() {
	FfiDestroyerTokenMetadata{}.Destroy(e.Metadata)
	FfiDestroyerString{}.Destroy(e.TxHash)
	FfiDestroyerTokenTransactionType{}.Destroy(e.TxType)
	FfiDestroyerOptionalSparkInvoicePaymentDetails{}.Destroy(e.InvoiceDetails)
	FfiDestroyerOptionalConversionInfo{}.Destroy(e.ConversionInfo)
}

type PaymentDetailsLightning struct {
	Description          *string
	Invoice              string
	DestinationPubkey    string
	HtlcDetails          SparkHtlcDetails
	LnurlPayInfo         *LnurlPayInfo
	LnurlWithdrawInfo    *LnurlWithdrawInfo
	LnurlReceiveMetadata *LnurlReceiveMetadata
}

func (e PaymentDetailsLightning) Destroy() {
	FfiDestroyerOptionalString{}.Destroy(e.Description)
	FfiDestroyerString{}.Destroy(e.Invoice)
	FfiDestroyerString{}.Destroy(e.DestinationPubkey)
	FfiDestroyerSparkHtlcDetails{}.Destroy(e.HtlcDetails)
	FfiDestroyerOptionalLnurlPayInfo{}.Destroy(e.LnurlPayInfo)
	FfiDestroyerOptionalLnurlWithdrawInfo{}.Destroy(e.LnurlWithdrawInfo)
	FfiDestroyerOptionalLnurlReceiveMetadata{}.Destroy(e.LnurlReceiveMetadata)
}

type PaymentDetailsWithdraw struct {
	TxId string
}

func (e PaymentDetailsWithdraw) Destroy() {
	FfiDestroyerString{}.Destroy(e.TxId)
}

type PaymentDetailsDeposit struct {
	TxId string
}

func (e PaymentDetailsDeposit) Destroy() {
	FfiDestroyerString{}.Destroy(e.TxId)
}

type FfiConverterPaymentDetails struct{}

var FfiConverterPaymentDetailsINSTANCE = FfiConverterPaymentDetails{}

func (c FfiConverterPaymentDetails) Lift(rb RustBufferI) PaymentDetails {
	return LiftFromRustBuffer[PaymentDetails](c, rb)
}

func (c FfiConverterPaymentDetails) Lower(value PaymentDetails) C.RustBuffer {
	return LowerIntoRustBuffer[PaymentDetails](c, value)
}

func (c FfiConverterPaymentDetails) LowerExternal(value PaymentDetails) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[PaymentDetails](c, value))
}
func (FfiConverterPaymentDetails) Read(reader io.Reader) PaymentDetails {
	id := readInt32(reader)
	switch id {
	case 1:
		return PaymentDetailsSpark{
			FfiConverterOptionalSparkInvoicePaymentDetailsINSTANCE.Read(reader),
			FfiConverterOptionalSparkHtlcDetailsINSTANCE.Read(reader),
			FfiConverterOptionalConversionInfoINSTANCE.Read(reader),
		}
	case 2:
		return PaymentDetailsToken{
			FfiConverterTokenMetadataINSTANCE.Read(reader),
			FfiConverterStringINSTANCE.Read(reader),
			FfiConverterTokenTransactionTypeINSTANCE.Read(reader),
			FfiConverterOptionalSparkInvoicePaymentDetailsINSTANCE.Read(reader),
			FfiConverterOptionalConversionInfoINSTANCE.Read(reader),
		}
	case 3:
		return PaymentDetailsLightning{
			FfiConverterOptionalStringINSTANCE.Read(reader),
			FfiConverterStringINSTANCE.Read(reader),
			FfiConverterStringINSTANCE.Read(reader),
			FfiConverterSparkHtlcDetailsINSTANCE.Read(reader),
			FfiConverterOptionalLnurlPayInfoINSTANCE.Read(reader),
			FfiConverterOptionalLnurlWithdrawInfoINSTANCE.Read(reader),
			FfiConverterOptionalLnurlReceiveMetadataINSTANCE.Read(reader),
		}
	case 4:
		return PaymentDetailsWithdraw{
			FfiConverterStringINSTANCE.Read(reader),
		}
	case 5:
		return PaymentDetailsDeposit{
			FfiConverterStringINSTANCE.Read(reader),
		}
	default:
		panic(fmt.Sprintf("invalid enum value %v in FfiConverterPaymentDetails.Read()", id))
	}
}

func (FfiConverterPaymentDetails) Write(writer io.Writer, value PaymentDetails) {
	switch variant_value := value.(type) {
	case PaymentDetailsSpark:
		writeInt32(writer, 1)
		FfiConverterOptionalSparkInvoicePaymentDetailsINSTANCE.Write(writer, variant_value.InvoiceDetails)
		FfiConverterOptionalSparkHtlcDetailsINSTANCE.Write(writer, variant_value.HtlcDetails)
		FfiConverterOptionalConversionInfoINSTANCE.Write(writer, variant_value.ConversionInfo)
	case PaymentDetailsToken:
		writeInt32(writer, 2)
		FfiConverterTokenMetadataINSTANCE.Write(writer, variant_value.Metadata)
		FfiConverterStringINSTANCE.Write(writer, variant_value.TxHash)
		FfiConverterTokenTransactionTypeINSTANCE.Write(writer, variant_value.TxType)
		FfiConverterOptionalSparkInvoicePaymentDetailsINSTANCE.Write(writer, variant_value.InvoiceDetails)
		FfiConverterOptionalConversionInfoINSTANCE.Write(writer, variant_value.ConversionInfo)
	case PaymentDetailsLightning:
		writeInt32(writer, 3)
		FfiConverterOptionalStringINSTANCE.Write(writer, variant_value.Description)
		FfiConverterStringINSTANCE.Write(writer, variant_value.Invoice)
		FfiConverterStringINSTANCE.Write(writer, variant_value.DestinationPubkey)
		FfiConverterSparkHtlcDetailsINSTANCE.Write(writer, variant_value.HtlcDetails)
		FfiConverterOptionalLnurlPayInfoINSTANCE.Write(writer, variant_value.LnurlPayInfo)
		FfiConverterOptionalLnurlWithdrawInfoINSTANCE.Write(writer, variant_value.LnurlWithdrawInfo)
		FfiConverterOptionalLnurlReceiveMetadataINSTANCE.Write(writer, variant_value.LnurlReceiveMetadata)
	case PaymentDetailsWithdraw:
		writeInt32(writer, 4)
		FfiConverterStringINSTANCE.Write(writer, variant_value.TxId)
	case PaymentDetailsDeposit:
		writeInt32(writer, 5)
		FfiConverterStringINSTANCE.Write(writer, variant_value.TxId)
	default:
		_ = variant_value
		panic(fmt.Sprintf("invalid enum value `%v` in FfiConverterPaymentDetails.Write", value))
	}
}

type FfiDestroyerPaymentDetails struct{}

func (_ FfiDestroyerPaymentDetails) Destroy(value PaymentDetails) {
	value.Destroy()
}

type PaymentDetailsFilter interface {
	Destroy()
}
type PaymentDetailsFilterSpark struct {
	HtlcStatus             *[]SparkHtlcStatus
	ConversionRefundNeeded *bool
}

func (e PaymentDetailsFilterSpark) Destroy() {
	FfiDestroyerOptionalSequenceSparkHtlcStatus{}.Destroy(e.HtlcStatus)
	FfiDestroyerOptionalBool{}.Destroy(e.ConversionRefundNeeded)
}

type PaymentDetailsFilterToken struct {
	ConversionRefundNeeded *bool
	TxHash                 *string
	TxType                 *TokenTransactionType
}

func (e PaymentDetailsFilterToken) Destroy() {
	FfiDestroyerOptionalBool{}.Destroy(e.ConversionRefundNeeded)
	FfiDestroyerOptionalString{}.Destroy(e.TxHash)
	FfiDestroyerOptionalTokenTransactionType{}.Destroy(e.TxType)
}

type PaymentDetailsFilterLightning struct {
	HtlcStatus *[]SparkHtlcStatus
}

func (e PaymentDetailsFilterLightning) Destroy() {
	FfiDestroyerOptionalSequenceSparkHtlcStatus{}.Destroy(e.HtlcStatus)
}

type FfiConverterPaymentDetailsFilter struct{}

var FfiConverterPaymentDetailsFilterINSTANCE = FfiConverterPaymentDetailsFilter{}

func (c FfiConverterPaymentDetailsFilter) Lift(rb RustBufferI) PaymentDetailsFilter {
	return LiftFromRustBuffer[PaymentDetailsFilter](c, rb)
}

func (c FfiConverterPaymentDetailsFilter) Lower(value PaymentDetailsFilter) C.RustBuffer {
	return LowerIntoRustBuffer[PaymentDetailsFilter](c, value)
}

func (c FfiConverterPaymentDetailsFilter) LowerExternal(value PaymentDetailsFilter) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[PaymentDetailsFilter](c, value))
}
func (FfiConverterPaymentDetailsFilter) Read(reader io.Reader) PaymentDetailsFilter {
	id := readInt32(reader)
	switch id {
	case 1:
		return PaymentDetailsFilterSpark{
			FfiConverterOptionalSequenceSparkHtlcStatusINSTANCE.Read(reader),
			FfiConverterOptionalBoolINSTANCE.Read(reader),
		}
	case 2:
		return PaymentDetailsFilterToken{
			FfiConverterOptionalBoolINSTANCE.Read(reader),
			FfiConverterOptionalStringINSTANCE.Read(reader),
			FfiConverterOptionalTokenTransactionTypeINSTANCE.Read(reader),
		}
	case 3:
		return PaymentDetailsFilterLightning{
			FfiConverterOptionalSequenceSparkHtlcStatusINSTANCE.Read(reader),
		}
	default:
		panic(fmt.Sprintf("invalid enum value %v in FfiConverterPaymentDetailsFilter.Read()", id))
	}
}

func (FfiConverterPaymentDetailsFilter) Write(writer io.Writer, value PaymentDetailsFilter) {
	switch variant_value := value.(type) {
	case PaymentDetailsFilterSpark:
		writeInt32(writer, 1)
		FfiConverterOptionalSequenceSparkHtlcStatusINSTANCE.Write(writer, variant_value.HtlcStatus)
		FfiConverterOptionalBoolINSTANCE.Write(writer, variant_value.ConversionRefundNeeded)
	case PaymentDetailsFilterToken:
		writeInt32(writer, 2)
		FfiConverterOptionalBoolINSTANCE.Write(writer, variant_value.ConversionRefundNeeded)
		FfiConverterOptionalStringINSTANCE.Write(writer, variant_value.TxHash)
		FfiConverterOptionalTokenTransactionTypeINSTANCE.Write(writer, variant_value.TxType)
	case PaymentDetailsFilterLightning:
		writeInt32(writer, 3)
		FfiConverterOptionalSequenceSparkHtlcStatusINSTANCE.Write(writer, variant_value.HtlcStatus)
	default:
		_ = variant_value
		panic(fmt.Sprintf("invalid enum value `%v` in FfiConverterPaymentDetailsFilter.Write", value))
	}
}

type FfiDestroyerPaymentDetailsFilter struct{}

func (_ FfiDestroyerPaymentDetailsFilter) Destroy(value PaymentDetailsFilter) {
	value.Destroy()
}

type PaymentMethod uint

const (
	PaymentMethodLightning PaymentMethod = 1
	PaymentMethodSpark     PaymentMethod = 2
	PaymentMethodToken     PaymentMethod = 3
	PaymentMethodDeposit   PaymentMethod = 4
	PaymentMethodWithdraw  PaymentMethod = 5
	PaymentMethodUnknown   PaymentMethod = 6
)

type FfiConverterPaymentMethod struct{}

var FfiConverterPaymentMethodINSTANCE = FfiConverterPaymentMethod{}

func (c FfiConverterPaymentMethod) Lift(rb RustBufferI) PaymentMethod {
	return LiftFromRustBuffer[PaymentMethod](c, rb)
}

func (c FfiConverterPaymentMethod) Lower(value PaymentMethod) C.RustBuffer {
	return LowerIntoRustBuffer[PaymentMethod](c, value)
}

func (c FfiConverterPaymentMethod) LowerExternal(value PaymentMethod) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[PaymentMethod](c, value))
}
func (FfiConverterPaymentMethod) Read(reader io.Reader) PaymentMethod {
	id := readInt32(reader)
	return PaymentMethod(id)
}

func (FfiConverterPaymentMethod) Write(writer io.Writer, value PaymentMethod) {
	writeInt32(writer, int32(value))
}

type FfiDestroyerPaymentMethod struct{}

func (_ FfiDestroyerPaymentMethod) Destroy(value PaymentMethod) {
}

type PaymentObserverError struct {
	err error
}

// Convience method to turn *PaymentObserverError into error
// Avoiding treating nil pointer as non nil error interface
func (err *PaymentObserverError) AsError() error {
	if err == nil {
		return nil
	} else {
		return err
	}
}

func (err PaymentObserverError) Error() string {
	return fmt.Sprintf("PaymentObserverError: %s", err.err.Error())
}

func (err PaymentObserverError) Unwrap() error {
	return err.err
}

// Err* are used for checking error type with `errors.Is`
var ErrPaymentObserverErrorServiceConnectivity = fmt.Errorf("PaymentObserverErrorServiceConnectivity")
var ErrPaymentObserverErrorGeneric = fmt.Errorf("PaymentObserverErrorGeneric")

// Variant structs
type PaymentObserverErrorServiceConnectivity struct {
	Field0 string
}

func NewPaymentObserverErrorServiceConnectivity(
	var0 string,
) *PaymentObserverError {
	return &PaymentObserverError{err: &PaymentObserverErrorServiceConnectivity{
		Field0: var0}}
}

func (e PaymentObserverErrorServiceConnectivity) destroy() {
	FfiDestroyerString{}.Destroy(e.Field0)
}

func (err PaymentObserverErrorServiceConnectivity) Error() string {
	return fmt.Sprint("ServiceConnectivity",
		": ",

		"Field0=",
		err.Field0,
	)
}

func (self PaymentObserverErrorServiceConnectivity) Is(target error) bool {
	return target == ErrPaymentObserverErrorServiceConnectivity
}

type PaymentObserverErrorGeneric struct {
	Field0 string
}

func NewPaymentObserverErrorGeneric(
	var0 string,
) *PaymentObserverError {
	return &PaymentObserverError{err: &PaymentObserverErrorGeneric{
		Field0: var0}}
}

func (e PaymentObserverErrorGeneric) destroy() {
	FfiDestroyerString{}.Destroy(e.Field0)
}

func (err PaymentObserverErrorGeneric) Error() string {
	return fmt.Sprint("Generic",
		": ",

		"Field0=",
		err.Field0,
	)
}

func (self PaymentObserverErrorGeneric) Is(target error) bool {
	return target == ErrPaymentObserverErrorGeneric
}

type FfiConverterPaymentObserverError struct{}

var FfiConverterPaymentObserverErrorINSTANCE = FfiConverterPaymentObserverError{}

func (c FfiConverterPaymentObserverError) Lift(eb RustBufferI) *PaymentObserverError {
	return LiftFromRustBuffer[*PaymentObserverError](c, eb)
}

func (c FfiConverterPaymentObserverError) Lower(value *PaymentObserverError) C.RustBuffer {
	return LowerIntoRustBuffer[*PaymentObserverError](c, value)
}

func (c FfiConverterPaymentObserverError) LowerExternal(value *PaymentObserverError) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[*PaymentObserverError](c, value))
}

func (c FfiConverterPaymentObserverError) Read(reader io.Reader) *PaymentObserverError {
	errorID := readUint32(reader)

	switch errorID {
	case 1:
		return &PaymentObserverError{&PaymentObserverErrorServiceConnectivity{
			Field0: FfiConverterStringINSTANCE.Read(reader),
		}}
	case 2:
		return &PaymentObserverError{&PaymentObserverErrorGeneric{
			Field0: FfiConverterStringINSTANCE.Read(reader),
		}}
	default:
		panic(fmt.Sprintf("Unknown error code %d in FfiConverterPaymentObserverError.Read()", errorID))
	}
}

func (c FfiConverterPaymentObserverError) Write(writer io.Writer, value *PaymentObserverError) {
	switch variantValue := value.err.(type) {
	case *PaymentObserverErrorServiceConnectivity:
		writeInt32(writer, 1)
		FfiConverterStringINSTANCE.Write(writer, variantValue.Field0)
	case *PaymentObserverErrorGeneric:
		writeInt32(writer, 2)
		FfiConverterStringINSTANCE.Write(writer, variantValue.Field0)
	default:
		_ = variantValue
		panic(fmt.Sprintf("invalid error value `%v` in FfiConverterPaymentObserverError.Write", value))
	}
}

type FfiDestroyerPaymentObserverError struct{}

func (_ FfiDestroyerPaymentObserverError) Destroy(value *PaymentObserverError) {
	switch variantValue := value.err.(type) {
	case PaymentObserverErrorServiceConnectivity:
		variantValue.destroy()
	case PaymentObserverErrorGeneric:
		variantValue.destroy()
	default:
		_ = variantValue
		panic(fmt.Sprintf("invalid error value `%v` in FfiDestroyerPaymentObserverError.Destroy", value))
	}
}

// The status of a payment
type PaymentStatus uint

const (
	// Payment is completed successfully
	PaymentStatusCompleted PaymentStatus = 1
	// Payment is in progress
	PaymentStatusPending PaymentStatus = 2
	// Payment has failed
	PaymentStatusFailed PaymentStatus = 3
)

type FfiConverterPaymentStatus struct{}

var FfiConverterPaymentStatusINSTANCE = FfiConverterPaymentStatus{}

func (c FfiConverterPaymentStatus) Lift(rb RustBufferI) PaymentStatus {
	return LiftFromRustBuffer[PaymentStatus](c, rb)
}

func (c FfiConverterPaymentStatus) Lower(value PaymentStatus) C.RustBuffer {
	return LowerIntoRustBuffer[PaymentStatus](c, value)
}

func (c FfiConverterPaymentStatus) LowerExternal(value PaymentStatus) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[PaymentStatus](c, value))
}
func (FfiConverterPaymentStatus) Read(reader io.Reader) PaymentStatus {
	id := readInt32(reader)
	return PaymentStatus(id)
}

func (FfiConverterPaymentStatus) Write(writer io.Writer, value PaymentStatus) {
	writeInt32(writer, int32(value))
}

type FfiDestroyerPaymentStatus struct{}

func (_ FfiDestroyerPaymentStatus) Destroy(value PaymentStatus) {
}

// The type of payment
type PaymentType uint

const (
	// Payment sent from this wallet
	PaymentTypeSend PaymentType = 1
	// Payment received to this wallet
	PaymentTypeReceive PaymentType = 2
)

type FfiConverterPaymentType struct{}

var FfiConverterPaymentTypeINSTANCE = FfiConverterPaymentType{}

func (c FfiConverterPaymentType) Lift(rb RustBufferI) PaymentType {
	return LiftFromRustBuffer[PaymentType](c, rb)
}

func (c FfiConverterPaymentType) Lower(value PaymentType) C.RustBuffer {
	return LowerIntoRustBuffer[PaymentType](c, value)
}

func (c FfiConverterPaymentType) LowerExternal(value PaymentType) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[PaymentType](c, value))
}
func (FfiConverterPaymentType) Read(reader io.Reader) PaymentType {
	id := readInt32(reader)
	return PaymentType(id)
}

func (FfiConverterPaymentType) Write(writer io.Writer, value PaymentType) {
	writeInt32(writer, int32(value))
}

type FfiDestroyerPaymentType struct{}

func (_ FfiDestroyerPaymentType) Destroy(value PaymentType) {
}

// Queue mode for the connection pool.
//
// Determines the order in which connections are retrieved from the pool.
type PoolQueueMode uint

const (
	// First In, First Out (default).
	// Connections are used in the order they were returned to the pool.
	// Spreads load evenly across all connections.
	PoolQueueModeFifo PoolQueueMode = 1
	// Last In, First Out.
	// Most recently returned connections are used first.
	// Keeps fewer connections "hot" and allows idle connections to close sooner.
	PoolQueueModeLifo PoolQueueMode = 2
)

type FfiConverterPoolQueueMode struct{}

var FfiConverterPoolQueueModeINSTANCE = FfiConverterPoolQueueMode{}

func (c FfiConverterPoolQueueMode) Lift(rb RustBufferI) PoolQueueMode {
	return LiftFromRustBuffer[PoolQueueMode](c, rb)
}

func (c FfiConverterPoolQueueMode) Lower(value PoolQueueMode) C.RustBuffer {
	return LowerIntoRustBuffer[PoolQueueMode](c, value)
}

func (c FfiConverterPoolQueueMode) LowerExternal(value PoolQueueMode) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[PoolQueueMode](c, value))
}
func (FfiConverterPoolQueueMode) Read(reader io.Reader) PoolQueueMode {
	id := readInt32(reader)
	return PoolQueueMode(id)
}

func (FfiConverterPoolQueueMode) Write(writer io.Writer, value PoolQueueMode) {
	writeInt32(writer, int32(value))
}

type FfiDestroyerPoolQueueMode struct{}

func (_ FfiDestroyerPoolQueueMode) Destroy(value PoolQueueMode) {
}

type ProvisionalPaymentDetails interface {
	Destroy()
}
type ProvisionalPaymentDetailsBitcoin struct {
	WithdrawalAddress string
}

func (e ProvisionalPaymentDetailsBitcoin) Destroy() {
	FfiDestroyerString{}.Destroy(e.WithdrawalAddress)
}

type ProvisionalPaymentDetailsLightning struct {
	Invoice string
}

func (e ProvisionalPaymentDetailsLightning) Destroy() {
	FfiDestroyerString{}.Destroy(e.Invoice)
}

type ProvisionalPaymentDetailsSpark struct {
	PayRequest string
}

func (e ProvisionalPaymentDetailsSpark) Destroy() {
	FfiDestroyerString{}.Destroy(e.PayRequest)
}

type ProvisionalPaymentDetailsToken struct {
	TokenId    string
	PayRequest string
}

func (e ProvisionalPaymentDetailsToken) Destroy() {
	FfiDestroyerString{}.Destroy(e.TokenId)
	FfiDestroyerString{}.Destroy(e.PayRequest)
}

type FfiConverterProvisionalPaymentDetails struct{}

var FfiConverterProvisionalPaymentDetailsINSTANCE = FfiConverterProvisionalPaymentDetails{}

func (c FfiConverterProvisionalPaymentDetails) Lift(rb RustBufferI) ProvisionalPaymentDetails {
	return LiftFromRustBuffer[ProvisionalPaymentDetails](c, rb)
}

func (c FfiConverterProvisionalPaymentDetails) Lower(value ProvisionalPaymentDetails) C.RustBuffer {
	return LowerIntoRustBuffer[ProvisionalPaymentDetails](c, value)
}

func (c FfiConverterProvisionalPaymentDetails) LowerExternal(value ProvisionalPaymentDetails) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[ProvisionalPaymentDetails](c, value))
}
func (FfiConverterProvisionalPaymentDetails) Read(reader io.Reader) ProvisionalPaymentDetails {
	id := readInt32(reader)
	switch id {
	case 1:
		return ProvisionalPaymentDetailsBitcoin{
			FfiConverterStringINSTANCE.Read(reader),
		}
	case 2:
		return ProvisionalPaymentDetailsLightning{
			FfiConverterStringINSTANCE.Read(reader),
		}
	case 3:
		return ProvisionalPaymentDetailsSpark{
			FfiConverterStringINSTANCE.Read(reader),
		}
	case 4:
		return ProvisionalPaymentDetailsToken{
			FfiConverterStringINSTANCE.Read(reader),
			FfiConverterStringINSTANCE.Read(reader),
		}
	default:
		panic(fmt.Sprintf("invalid enum value %v in FfiConverterProvisionalPaymentDetails.Read()", id))
	}
}

func (FfiConverterProvisionalPaymentDetails) Write(writer io.Writer, value ProvisionalPaymentDetails) {
	switch variant_value := value.(type) {
	case ProvisionalPaymentDetailsBitcoin:
		writeInt32(writer, 1)
		FfiConverterStringINSTANCE.Write(writer, variant_value.WithdrawalAddress)
	case ProvisionalPaymentDetailsLightning:
		writeInt32(writer, 2)
		FfiConverterStringINSTANCE.Write(writer, variant_value.Invoice)
	case ProvisionalPaymentDetailsSpark:
		writeInt32(writer, 3)
		FfiConverterStringINSTANCE.Write(writer, variant_value.PayRequest)
	case ProvisionalPaymentDetailsToken:
		writeInt32(writer, 4)
		FfiConverterStringINSTANCE.Write(writer, variant_value.TokenId)
		FfiConverterStringINSTANCE.Write(writer, variant_value.PayRequest)
	default:
		_ = variant_value
		panic(fmt.Sprintf("invalid enum value `%v` in FfiConverterProvisionalPaymentDetails.Write", value))
	}
}

type FfiDestroyerProvisionalPaymentDetails struct{}

func (_ FfiDestroyerProvisionalPaymentDetails) Destroy(value ProvisionalPaymentDetails) {
	value.Destroy()
}

type ReceivePaymentMethod interface {
	Destroy()
}
type ReceivePaymentMethodSparkAddress struct {
}

func (e ReceivePaymentMethodSparkAddress) Destroy() {
}

type ReceivePaymentMethodSparkInvoice struct {
	Amount          *u128
	TokenIdentifier *string
	ExpiryTime      *uint64
	Description     *string
	SenderPublicKey *string
}

func (e ReceivePaymentMethodSparkInvoice) Destroy() {
	FfiDestroyerOptionalTypeu128{}.Destroy(e.Amount)
	FfiDestroyerOptionalString{}.Destroy(e.TokenIdentifier)
	FfiDestroyerOptionalUint64{}.Destroy(e.ExpiryTime)
	FfiDestroyerOptionalString{}.Destroy(e.Description)
	FfiDestroyerOptionalString{}.Destroy(e.SenderPublicKey)
}

type ReceivePaymentMethodBitcoinAddress struct {
	NewAddress *bool
}

func (e ReceivePaymentMethodBitcoinAddress) Destroy() {
	FfiDestroyerOptionalBool{}.Destroy(e.NewAddress)
}

type ReceivePaymentMethodBolt11Invoice struct {
	Description string
	AmountSats  *uint64
	ExpirySecs  *uint32
	PaymentHash *string
}

func (e ReceivePaymentMethodBolt11Invoice) Destroy() {
	FfiDestroyerString{}.Destroy(e.Description)
	FfiDestroyerOptionalUint64{}.Destroy(e.AmountSats)
	FfiDestroyerOptionalUint32{}.Destroy(e.ExpirySecs)
	FfiDestroyerOptionalString{}.Destroy(e.PaymentHash)
}

type FfiConverterReceivePaymentMethod struct{}

var FfiConverterReceivePaymentMethodINSTANCE = FfiConverterReceivePaymentMethod{}

func (c FfiConverterReceivePaymentMethod) Lift(rb RustBufferI) ReceivePaymentMethod {
	return LiftFromRustBuffer[ReceivePaymentMethod](c, rb)
}

func (c FfiConverterReceivePaymentMethod) Lower(value ReceivePaymentMethod) C.RustBuffer {
	return LowerIntoRustBuffer[ReceivePaymentMethod](c, value)
}

func (c FfiConverterReceivePaymentMethod) LowerExternal(value ReceivePaymentMethod) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[ReceivePaymentMethod](c, value))
}
func (FfiConverterReceivePaymentMethod) Read(reader io.Reader) ReceivePaymentMethod {
	id := readInt32(reader)
	switch id {
	case 1:
		return ReceivePaymentMethodSparkAddress{}
	case 2:
		return ReceivePaymentMethodSparkInvoice{
			FfiConverterOptionalTypeu128INSTANCE.Read(reader),
			FfiConverterOptionalStringINSTANCE.Read(reader),
			FfiConverterOptionalUint64INSTANCE.Read(reader),
			FfiConverterOptionalStringINSTANCE.Read(reader),
			FfiConverterOptionalStringINSTANCE.Read(reader),
		}
	case 3:
		return ReceivePaymentMethodBitcoinAddress{
			FfiConverterOptionalBoolINSTANCE.Read(reader),
		}
	case 4:
		return ReceivePaymentMethodBolt11Invoice{
			FfiConverterStringINSTANCE.Read(reader),
			FfiConverterOptionalUint64INSTANCE.Read(reader),
			FfiConverterOptionalUint32INSTANCE.Read(reader),
			FfiConverterOptionalStringINSTANCE.Read(reader),
		}
	default:
		panic(fmt.Sprintf("invalid enum value %v in FfiConverterReceivePaymentMethod.Read()", id))
	}
}

func (FfiConverterReceivePaymentMethod) Write(writer io.Writer, value ReceivePaymentMethod) {
	switch variant_value := value.(type) {
	case ReceivePaymentMethodSparkAddress:
		writeInt32(writer, 1)
	case ReceivePaymentMethodSparkInvoice:
		writeInt32(writer, 2)
		FfiConverterOptionalTypeu128INSTANCE.Write(writer, variant_value.Amount)
		FfiConverterOptionalStringINSTANCE.Write(writer, variant_value.TokenIdentifier)
		FfiConverterOptionalUint64INSTANCE.Write(writer, variant_value.ExpiryTime)
		FfiConverterOptionalStringINSTANCE.Write(writer, variant_value.Description)
		FfiConverterOptionalStringINSTANCE.Write(writer, variant_value.SenderPublicKey)
	case ReceivePaymentMethodBitcoinAddress:
		writeInt32(writer, 3)
		FfiConverterOptionalBoolINSTANCE.Write(writer, variant_value.NewAddress)
	case ReceivePaymentMethodBolt11Invoice:
		writeInt32(writer, 4)
		FfiConverterStringINSTANCE.Write(writer, variant_value.Description)
		FfiConverterOptionalUint64INSTANCE.Write(writer, variant_value.AmountSats)
		FfiConverterOptionalUint32INSTANCE.Write(writer, variant_value.ExpirySecs)
		FfiConverterOptionalStringINSTANCE.Write(writer, variant_value.PaymentHash)
	default:
		_ = variant_value
		panic(fmt.Sprintf("invalid enum value `%v` in FfiConverterReceivePaymentMethod.Write", value))
	}
}

type FfiDestroyerReceivePaymentMethod struct{}

func (_ FfiDestroyerReceivePaymentMethod) Destroy(value ReceivePaymentMethod) {
	value.Destroy()
}

// Error type for the `BreezSdk`
type SdkError struct {
	err error
}

// Convience method to turn *SdkError into error
// Avoiding treating nil pointer as non nil error interface
func (err *SdkError) AsError() error {
	if err == nil {
		return nil
	} else {
		return err
	}
}

func (err SdkError) Error() string {
	return fmt.Sprintf("SdkError: %s", err.err.Error())
}

func (err SdkError) Unwrap() error {
	return err.err
}

// Err* are used for checking error type with `errors.Is`
var ErrSdkErrorSparkError = fmt.Errorf("SdkErrorSparkError")
var ErrSdkErrorInsufficientFunds = fmt.Errorf("SdkErrorInsufficientFunds")
var ErrSdkErrorInvalidUuid = fmt.Errorf("SdkErrorInvalidUuid")
var ErrSdkErrorInvalidInput = fmt.Errorf("SdkErrorInvalidInput")
var ErrSdkErrorNetworkError = fmt.Errorf("SdkErrorNetworkError")
var ErrSdkErrorStorageError = fmt.Errorf("SdkErrorStorageError")
var ErrSdkErrorChainServiceError = fmt.Errorf("SdkErrorChainServiceError")
var ErrSdkErrorMaxDepositClaimFeeExceeded = fmt.Errorf("SdkErrorMaxDepositClaimFeeExceeded")
var ErrSdkErrorMissingUtxo = fmt.Errorf("SdkErrorMissingUtxo")
var ErrSdkErrorLnurlError = fmt.Errorf("SdkErrorLnurlError")
var ErrSdkErrorSigner = fmt.Errorf("SdkErrorSigner")
var ErrSdkErrorGeneric = fmt.Errorf("SdkErrorGeneric")

// Variant structs
type SdkErrorSparkError struct {
	Field0 string
}

func NewSdkErrorSparkError(
	var0 string,
) *SdkError {
	return &SdkError{err: &SdkErrorSparkError{
		Field0: var0}}
}

func (e SdkErrorSparkError) destroy() {
	FfiDestroyerString{}.Destroy(e.Field0)
}

func (err SdkErrorSparkError) Error() string {
	return fmt.Sprint("SparkError",
		": ",

		"Field0=",
		err.Field0,
	)
}

func (self SdkErrorSparkError) Is(target error) bool {
	return target == ErrSdkErrorSparkError
}

type SdkErrorInsufficientFunds struct {
}

func NewSdkErrorInsufficientFunds() *SdkError {
	return &SdkError{err: &SdkErrorInsufficientFunds{}}
}

func (e SdkErrorInsufficientFunds) destroy() {
}

func (err SdkErrorInsufficientFunds) Error() string {
	return fmt.Sprint("InsufficientFunds")
}

func (self SdkErrorInsufficientFunds) Is(target error) bool {
	return target == ErrSdkErrorInsufficientFunds
}

type SdkErrorInvalidUuid struct {
	Field0 string
}

func NewSdkErrorInvalidUuid(
	var0 string,
) *SdkError {
	return &SdkError{err: &SdkErrorInvalidUuid{
		Field0: var0}}
}

func (e SdkErrorInvalidUuid) destroy() {
	FfiDestroyerString{}.Destroy(e.Field0)
}

func (err SdkErrorInvalidUuid) Error() string {
	return fmt.Sprint("InvalidUuid",
		": ",

		"Field0=",
		err.Field0,
	)
}

func (self SdkErrorInvalidUuid) Is(target error) bool {
	return target == ErrSdkErrorInvalidUuid
}

// Invalid input error
type SdkErrorInvalidInput struct {
	Field0 string
}

// Invalid input error
func NewSdkErrorInvalidInput(
	var0 string,
) *SdkError {
	return &SdkError{err: &SdkErrorInvalidInput{
		Field0: var0}}
}

func (e SdkErrorInvalidInput) destroy() {
	FfiDestroyerString{}.Destroy(e.Field0)
}

func (err SdkErrorInvalidInput) Error() string {
	return fmt.Sprint("InvalidInput",
		": ",

		"Field0=",
		err.Field0,
	)
}

func (self SdkErrorInvalidInput) Is(target error) bool {
	return target == ErrSdkErrorInvalidInput
}

// Network error
type SdkErrorNetworkError struct {
	Field0 string
}

// Network error
func NewSdkErrorNetworkError(
	var0 string,
) *SdkError {
	return &SdkError{err: &SdkErrorNetworkError{
		Field0: var0}}
}

func (e SdkErrorNetworkError) destroy() {
	FfiDestroyerString{}.Destroy(e.Field0)
}

func (err SdkErrorNetworkError) Error() string {
	return fmt.Sprint("NetworkError",
		": ",

		"Field0=",
		err.Field0,
	)
}

func (self SdkErrorNetworkError) Is(target error) bool {
	return target == ErrSdkErrorNetworkError
}

// Storage error
type SdkErrorStorageError struct {
	Field0 string
}

// Storage error
func NewSdkErrorStorageError(
	var0 string,
) *SdkError {
	return &SdkError{err: &SdkErrorStorageError{
		Field0: var0}}
}

func (e SdkErrorStorageError) destroy() {
	FfiDestroyerString{}.Destroy(e.Field0)
}

func (err SdkErrorStorageError) Error() string {
	return fmt.Sprint("StorageError",
		": ",

		"Field0=",
		err.Field0,
	)
}

func (self SdkErrorStorageError) Is(target error) bool {
	return target == ErrSdkErrorStorageError
}

type SdkErrorChainServiceError struct {
	Field0 string
}

func NewSdkErrorChainServiceError(
	var0 string,
) *SdkError {
	return &SdkError{err: &SdkErrorChainServiceError{
		Field0: var0}}
}

func (e SdkErrorChainServiceError) destroy() {
	FfiDestroyerString{}.Destroy(e.Field0)
}

func (err SdkErrorChainServiceError) Error() string {
	return fmt.Sprint("ChainServiceError",
		": ",

		"Field0=",
		err.Field0,
	)
}

func (self SdkErrorChainServiceError) Is(target error) bool {
	return target == ErrSdkErrorChainServiceError
}

type SdkErrorMaxDepositClaimFeeExceeded struct {
	Tx                         string
	Vout                       uint32
	MaxFee                     *Fee
	RequiredFeeSats            uint64
	RequiredFeeRateSatPerVbyte uint64
}

func NewSdkErrorMaxDepositClaimFeeExceeded(
	tx string,
	vout uint32,
	maxFee *Fee,
	requiredFeeSats uint64,
	requiredFeeRateSatPerVbyte uint64,
) *SdkError {
	return &SdkError{err: &SdkErrorMaxDepositClaimFeeExceeded{
		Tx:                         tx,
		Vout:                       vout,
		MaxFee:                     maxFee,
		RequiredFeeSats:            requiredFeeSats,
		RequiredFeeRateSatPerVbyte: requiredFeeRateSatPerVbyte}}
}

func (e SdkErrorMaxDepositClaimFeeExceeded) destroy() {
	FfiDestroyerString{}.Destroy(e.Tx)
	FfiDestroyerUint32{}.Destroy(e.Vout)
	FfiDestroyerOptionalFee{}.Destroy(e.MaxFee)
	FfiDestroyerUint64{}.Destroy(e.RequiredFeeSats)
	FfiDestroyerUint64{}.Destroy(e.RequiredFeeRateSatPerVbyte)
}

func (err SdkErrorMaxDepositClaimFeeExceeded) Error() string {
	return fmt.Sprint("MaxDepositClaimFeeExceeded",
		": ",

		"Tx=",
		err.Tx,
		", ",
		"Vout=",
		err.Vout,
		", ",
		"MaxFee=",
		err.MaxFee,
		", ",
		"RequiredFeeSats=",
		err.RequiredFeeSats,
		", ",
		"RequiredFeeRateSatPerVbyte=",
		err.RequiredFeeRateSatPerVbyte,
	)
}

func (self SdkErrorMaxDepositClaimFeeExceeded) Is(target error) bool {
	return target == ErrSdkErrorMaxDepositClaimFeeExceeded
}

type SdkErrorMissingUtxo struct {
	Tx   string
	Vout uint32
}

func NewSdkErrorMissingUtxo(
	tx string,
	vout uint32,
) *SdkError {
	return &SdkError{err: &SdkErrorMissingUtxo{
		Tx:   tx,
		Vout: vout}}
}

func (e SdkErrorMissingUtxo) destroy() {
	FfiDestroyerString{}.Destroy(e.Tx)
	FfiDestroyerUint32{}.Destroy(e.Vout)
}

func (err SdkErrorMissingUtxo) Error() string {
	return fmt.Sprint("MissingUtxo",
		": ",

		"Tx=",
		err.Tx,
		", ",
		"Vout=",
		err.Vout,
	)
}

func (self SdkErrorMissingUtxo) Is(target error) bool {
	return target == ErrSdkErrorMissingUtxo
}

type SdkErrorLnurlError struct {
	Field0 string
}

func NewSdkErrorLnurlError(
	var0 string,
) *SdkError {
	return &SdkError{err: &SdkErrorLnurlError{
		Field0: var0}}
}

func (e SdkErrorLnurlError) destroy() {
	FfiDestroyerString{}.Destroy(e.Field0)
}

func (err SdkErrorLnurlError) Error() string {
	return fmt.Sprint("LnurlError",
		": ",

		"Field0=",
		err.Field0,
	)
}

func (self SdkErrorLnurlError) Is(target error) bool {
	return target == ErrSdkErrorLnurlError
}

type SdkErrorSigner struct {
	Field0 string
}

func NewSdkErrorSigner(
	var0 string,
) *SdkError {
	return &SdkError{err: &SdkErrorSigner{
		Field0: var0}}
}

func (e SdkErrorSigner) destroy() {
	FfiDestroyerString{}.Destroy(e.Field0)
}

func (err SdkErrorSigner) Error() string {
	return fmt.Sprint("Signer",
		": ",

		"Field0=",
		err.Field0,
	)
}

func (self SdkErrorSigner) Is(target error) bool {
	return target == ErrSdkErrorSigner
}

type SdkErrorGeneric struct {
	Field0 string
}

func NewSdkErrorGeneric(
	var0 string,
) *SdkError {
	return &SdkError{err: &SdkErrorGeneric{
		Field0: var0}}
}

func (e SdkErrorGeneric) destroy() {
	FfiDestroyerString{}.Destroy(e.Field0)
}

func (err SdkErrorGeneric) Error() string {
	return fmt.Sprint("Generic",
		": ",

		"Field0=",
		err.Field0,
	)
}

func (self SdkErrorGeneric) Is(target error) bool {
	return target == ErrSdkErrorGeneric
}

type FfiConverterSdkError struct{}

var FfiConverterSdkErrorINSTANCE = FfiConverterSdkError{}

func (c FfiConverterSdkError) Lift(eb RustBufferI) *SdkError {
	return LiftFromRustBuffer[*SdkError](c, eb)
}

func (c FfiConverterSdkError) Lower(value *SdkError) C.RustBuffer {
	return LowerIntoRustBuffer[*SdkError](c, value)
}

func (c FfiConverterSdkError) LowerExternal(value *SdkError) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[*SdkError](c, value))
}

func (c FfiConverterSdkError) Read(reader io.Reader) *SdkError {
	errorID := readUint32(reader)

	switch errorID {
	case 1:
		return &SdkError{&SdkErrorSparkError{
			Field0: FfiConverterStringINSTANCE.Read(reader),
		}}
	case 2:
		return &SdkError{&SdkErrorInsufficientFunds{}}
	case 3:
		return &SdkError{&SdkErrorInvalidUuid{
			Field0: FfiConverterStringINSTANCE.Read(reader),
		}}
	case 4:
		return &SdkError{&SdkErrorInvalidInput{
			Field0: FfiConverterStringINSTANCE.Read(reader),
		}}
	case 5:
		return &SdkError{&SdkErrorNetworkError{
			Field0: FfiConverterStringINSTANCE.Read(reader),
		}}
	case 6:
		return &SdkError{&SdkErrorStorageError{
			Field0: FfiConverterStringINSTANCE.Read(reader),
		}}
	case 7:
		return &SdkError{&SdkErrorChainServiceError{
			Field0: FfiConverterStringINSTANCE.Read(reader),
		}}
	case 8:
		return &SdkError{&SdkErrorMaxDepositClaimFeeExceeded{
			Tx:                         FfiConverterStringINSTANCE.Read(reader),
			Vout:                       FfiConverterUint32INSTANCE.Read(reader),
			MaxFee:                     FfiConverterOptionalFeeINSTANCE.Read(reader),
			RequiredFeeSats:            FfiConverterUint64INSTANCE.Read(reader),
			RequiredFeeRateSatPerVbyte: FfiConverterUint64INSTANCE.Read(reader),
		}}
	case 9:
		return &SdkError{&SdkErrorMissingUtxo{
			Tx:   FfiConverterStringINSTANCE.Read(reader),
			Vout: FfiConverterUint32INSTANCE.Read(reader),
		}}
	case 10:
		return &SdkError{&SdkErrorLnurlError{
			Field0: FfiConverterStringINSTANCE.Read(reader),
		}}
	case 11:
		return &SdkError{&SdkErrorSigner{
			Field0: FfiConverterStringINSTANCE.Read(reader),
		}}
	case 12:
		return &SdkError{&SdkErrorGeneric{
			Field0: FfiConverterStringINSTANCE.Read(reader),
		}}
	default:
		panic(fmt.Sprintf("Unknown error code %d in FfiConverterSdkError.Read()", errorID))
	}
}

func (c FfiConverterSdkError) Write(writer io.Writer, value *SdkError) {
	switch variantValue := value.err.(type) {
	case *SdkErrorSparkError:
		writeInt32(writer, 1)
		FfiConverterStringINSTANCE.Write(writer, variantValue.Field0)
	case *SdkErrorInsufficientFunds:
		writeInt32(writer, 2)
	case *SdkErrorInvalidUuid:
		writeInt32(writer, 3)
		FfiConverterStringINSTANCE.Write(writer, variantValue.Field0)
	case *SdkErrorInvalidInput:
		writeInt32(writer, 4)
		FfiConverterStringINSTANCE.Write(writer, variantValue.Field0)
	case *SdkErrorNetworkError:
		writeInt32(writer, 5)
		FfiConverterStringINSTANCE.Write(writer, variantValue.Field0)
	case *SdkErrorStorageError:
		writeInt32(writer, 6)
		FfiConverterStringINSTANCE.Write(writer, variantValue.Field0)
	case *SdkErrorChainServiceError:
		writeInt32(writer, 7)
		FfiConverterStringINSTANCE.Write(writer, variantValue.Field0)
	case *SdkErrorMaxDepositClaimFeeExceeded:
		writeInt32(writer, 8)
		FfiConverterStringINSTANCE.Write(writer, variantValue.Tx)
		FfiConverterUint32INSTANCE.Write(writer, variantValue.Vout)
		FfiConverterOptionalFeeINSTANCE.Write(writer, variantValue.MaxFee)
		FfiConverterUint64INSTANCE.Write(writer, variantValue.RequiredFeeSats)
		FfiConverterUint64INSTANCE.Write(writer, variantValue.RequiredFeeRateSatPerVbyte)
	case *SdkErrorMissingUtxo:
		writeInt32(writer, 9)
		FfiConverterStringINSTANCE.Write(writer, variantValue.Tx)
		FfiConverterUint32INSTANCE.Write(writer, variantValue.Vout)
	case *SdkErrorLnurlError:
		writeInt32(writer, 10)
		FfiConverterStringINSTANCE.Write(writer, variantValue.Field0)
	case *SdkErrorSigner:
		writeInt32(writer, 11)
		FfiConverterStringINSTANCE.Write(writer, variantValue.Field0)
	case *SdkErrorGeneric:
		writeInt32(writer, 12)
		FfiConverterStringINSTANCE.Write(writer, variantValue.Field0)
	default:
		_ = variantValue
		panic(fmt.Sprintf("invalid error value `%v` in FfiConverterSdkError.Write", value))
	}
}

type FfiDestroyerSdkError struct{}

func (_ FfiDestroyerSdkError) Destroy(value *SdkError) {
	switch variantValue := value.err.(type) {
	case SdkErrorSparkError:
		variantValue.destroy()
	case SdkErrorInsufficientFunds:
		variantValue.destroy()
	case SdkErrorInvalidUuid:
		variantValue.destroy()
	case SdkErrorInvalidInput:
		variantValue.destroy()
	case SdkErrorNetworkError:
		variantValue.destroy()
	case SdkErrorStorageError:
		variantValue.destroy()
	case SdkErrorChainServiceError:
		variantValue.destroy()
	case SdkErrorMaxDepositClaimFeeExceeded:
		variantValue.destroy()
	case SdkErrorMissingUtxo:
		variantValue.destroy()
	case SdkErrorLnurlError:
		variantValue.destroy()
	case SdkErrorSigner:
		variantValue.destroy()
	case SdkErrorGeneric:
		variantValue.destroy()
	default:
		_ = variantValue
		panic(fmt.Sprintf("invalid error value `%v` in FfiDestroyerSdkError.Destroy", value))
	}
}

// Events emitted by the SDK
type SdkEvent interface {
	Destroy()
}

// Emitted when the wallet has been synchronized with the network
type SdkEventSynced struct {
}

func (e SdkEventSynced) Destroy() {
}

// Emitted when the SDK was unable to claim deposits
type SdkEventUnclaimedDeposits struct {
	UnclaimedDeposits []DepositInfo
}

func (e SdkEventUnclaimedDeposits) Destroy() {
	FfiDestroyerSequenceDepositInfo{}.Destroy(e.UnclaimedDeposits)
}

type SdkEventClaimedDeposits struct {
	ClaimedDeposits []DepositInfo
}

func (e SdkEventClaimedDeposits) Destroy() {
	FfiDestroyerSequenceDepositInfo{}.Destroy(e.ClaimedDeposits)
}

type SdkEventPaymentSucceeded struct {
	Payment Payment
}

func (e SdkEventPaymentSucceeded) Destroy() {
	FfiDestroyerPayment{}.Destroy(e.Payment)
}

type SdkEventPaymentPending struct {
	Payment Payment
}

func (e SdkEventPaymentPending) Destroy() {
	FfiDestroyerPayment{}.Destroy(e.Payment)
}

type SdkEventPaymentFailed struct {
	Payment Payment
}

func (e SdkEventPaymentFailed) Destroy() {
	FfiDestroyerPayment{}.Destroy(e.Payment)
}

type SdkEventOptimization struct {
	OptimizationEvent OptimizationEvent
}

func (e SdkEventOptimization) Destroy() {
	FfiDestroyerOptimizationEvent{}.Destroy(e.OptimizationEvent)
}

type SdkEventLightningAddressChanged struct {
	LightningAddress *LightningAddressInfo
}

func (e SdkEventLightningAddressChanged) Destroy() {
	FfiDestroyerOptionalLightningAddressInfo{}.Destroy(e.LightningAddress)
}

type SdkEventNewDeposits struct {
	NewDeposits []DepositInfo
}

func (e SdkEventNewDeposits) Destroy() {
	FfiDestroyerSequenceDepositInfo{}.Destroy(e.NewDeposits)
}

type FfiConverterSdkEvent struct{}

var FfiConverterSdkEventINSTANCE = FfiConverterSdkEvent{}

func (c FfiConverterSdkEvent) Lift(rb RustBufferI) SdkEvent {
	return LiftFromRustBuffer[SdkEvent](c, rb)
}

func (c FfiConverterSdkEvent) Lower(value SdkEvent) C.RustBuffer {
	return LowerIntoRustBuffer[SdkEvent](c, value)
}

func (c FfiConverterSdkEvent) LowerExternal(value SdkEvent) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[SdkEvent](c, value))
}
func (FfiConverterSdkEvent) Read(reader io.Reader) SdkEvent {
	id := readInt32(reader)
	switch id {
	case 1:
		return SdkEventSynced{}
	case 2:
		return SdkEventUnclaimedDeposits{
			FfiConverterSequenceDepositInfoINSTANCE.Read(reader),
		}
	case 3:
		return SdkEventClaimedDeposits{
			FfiConverterSequenceDepositInfoINSTANCE.Read(reader),
		}
	case 4:
		return SdkEventPaymentSucceeded{
			FfiConverterPaymentINSTANCE.Read(reader),
		}
	case 5:
		return SdkEventPaymentPending{
			FfiConverterPaymentINSTANCE.Read(reader),
		}
	case 6:
		return SdkEventPaymentFailed{
			FfiConverterPaymentINSTANCE.Read(reader),
		}
	case 7:
		return SdkEventOptimization{
			FfiConverterOptimizationEventINSTANCE.Read(reader),
		}
	case 8:
		return SdkEventLightningAddressChanged{
			FfiConverterOptionalLightningAddressInfoINSTANCE.Read(reader),
		}
	case 9:
		return SdkEventNewDeposits{
			FfiConverterSequenceDepositInfoINSTANCE.Read(reader),
		}
	default:
		panic(fmt.Sprintf("invalid enum value %v in FfiConverterSdkEvent.Read()", id))
	}
}

func (FfiConverterSdkEvent) Write(writer io.Writer, value SdkEvent) {
	switch variant_value := value.(type) {
	case SdkEventSynced:
		writeInt32(writer, 1)
	case SdkEventUnclaimedDeposits:
		writeInt32(writer, 2)
		FfiConverterSequenceDepositInfoINSTANCE.Write(writer, variant_value.UnclaimedDeposits)
	case SdkEventClaimedDeposits:
		writeInt32(writer, 3)
		FfiConverterSequenceDepositInfoINSTANCE.Write(writer, variant_value.ClaimedDeposits)
	case SdkEventPaymentSucceeded:
		writeInt32(writer, 4)
		FfiConverterPaymentINSTANCE.Write(writer, variant_value.Payment)
	case SdkEventPaymentPending:
		writeInt32(writer, 5)
		FfiConverterPaymentINSTANCE.Write(writer, variant_value.Payment)
	case SdkEventPaymentFailed:
		writeInt32(writer, 6)
		FfiConverterPaymentINSTANCE.Write(writer, variant_value.Payment)
	case SdkEventOptimization:
		writeInt32(writer, 7)
		FfiConverterOptimizationEventINSTANCE.Write(writer, variant_value.OptimizationEvent)
	case SdkEventLightningAddressChanged:
		writeInt32(writer, 8)
		FfiConverterOptionalLightningAddressInfoINSTANCE.Write(writer, variant_value.LightningAddress)
	case SdkEventNewDeposits:
		writeInt32(writer, 9)
		FfiConverterSequenceDepositInfoINSTANCE.Write(writer, variant_value.NewDeposits)
	default:
		_ = variant_value
		panic(fmt.Sprintf("invalid enum value `%v` in FfiConverterSdkEvent.Write", value))
	}
}

type FfiDestroyerSdkEvent struct{}

func (_ FfiDestroyerSdkEvent) Destroy(value SdkEvent) {
	value.Destroy()
}

// Represents the seed for wallet generation, either as a mnemonic phrase with an optional
// passphrase or as raw entropy bytes.
type Seed interface {
	Destroy()
}

// A BIP-39 mnemonic phrase with an optional passphrase.
type SeedMnemonic struct {
	Mnemonic   string
	Passphrase *string
}

func (e SeedMnemonic) Destroy() {
	FfiDestroyerString{}.Destroy(e.Mnemonic)
	FfiDestroyerOptionalString{}.Destroy(e.Passphrase)
}

// Raw entropy bytes.
type SeedEntropy struct {
	Field0 []byte
}

func (e SeedEntropy) Destroy() {
	FfiDestroyerBytes{}.Destroy(e.Field0)
}

type FfiConverterSeed struct{}

var FfiConverterSeedINSTANCE = FfiConverterSeed{}

func (c FfiConverterSeed) Lift(rb RustBufferI) Seed {
	return LiftFromRustBuffer[Seed](c, rb)
}

func (c FfiConverterSeed) Lower(value Seed) C.RustBuffer {
	return LowerIntoRustBuffer[Seed](c, value)
}

func (c FfiConverterSeed) LowerExternal(value Seed) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[Seed](c, value))
}
func (FfiConverterSeed) Read(reader io.Reader) Seed {
	id := readInt32(reader)
	switch id {
	case 1:
		return SeedMnemonic{
			FfiConverterStringINSTANCE.Read(reader),
			FfiConverterOptionalStringINSTANCE.Read(reader),
		}
	case 2:
		return SeedEntropy{
			FfiConverterBytesINSTANCE.Read(reader),
		}
	default:
		panic(fmt.Sprintf("invalid enum value %v in FfiConverterSeed.Read()", id))
	}
}

func (FfiConverterSeed) Write(writer io.Writer, value Seed) {
	switch variant_value := value.(type) {
	case SeedMnemonic:
		writeInt32(writer, 1)
		FfiConverterStringINSTANCE.Write(writer, variant_value.Mnemonic)
		FfiConverterOptionalStringINSTANCE.Write(writer, variant_value.Passphrase)
	case SeedEntropy:
		writeInt32(writer, 2)
		FfiConverterBytesINSTANCE.Write(writer, variant_value.Field0)
	default:
		_ = variant_value
		panic(fmt.Sprintf("invalid enum value `%v` in FfiConverterSeed.Write", value))
	}
}

type FfiDestroyerSeed struct{}

func (_ FfiDestroyerSeed) Destroy(value Seed) {
	value.Destroy()
}

type SendPaymentMethod interface {
	Destroy()
}
type SendPaymentMethodBitcoinAddress struct {
	Address  BitcoinAddressDetails
	FeeQuote SendOnchainFeeQuote
}

func (e SendPaymentMethodBitcoinAddress) Destroy() {
	FfiDestroyerBitcoinAddressDetails{}.Destroy(e.Address)
	FfiDestroyerSendOnchainFeeQuote{}.Destroy(e.FeeQuote)
}

type SendPaymentMethodBolt11Invoice struct {
	InvoiceDetails       Bolt11InvoiceDetails
	SparkTransferFeeSats *uint64
	LightningFeeSats     uint64
}

func (e SendPaymentMethodBolt11Invoice) Destroy() {
	FfiDestroyerBolt11InvoiceDetails{}.Destroy(e.InvoiceDetails)
	FfiDestroyerOptionalUint64{}.Destroy(e.SparkTransferFeeSats)
	FfiDestroyerUint64{}.Destroy(e.LightningFeeSats)
}

type SendPaymentMethodSparkAddress struct {
	Address         string
	Fee             u128
	TokenIdentifier *string
}

func (e SendPaymentMethodSparkAddress) Destroy() {
	FfiDestroyerString{}.Destroy(e.Address)
	FfiDestroyerTypeu128{}.Destroy(e.Fee)
	FfiDestroyerOptionalString{}.Destroy(e.TokenIdentifier)
}

type SendPaymentMethodSparkInvoice struct {
	SparkInvoiceDetails SparkInvoiceDetails
	Fee                 u128
	TokenIdentifier     *string
}

func (e SendPaymentMethodSparkInvoice) Destroy() {
	FfiDestroyerSparkInvoiceDetails{}.Destroy(e.SparkInvoiceDetails)
	FfiDestroyerTypeu128{}.Destroy(e.Fee)
	FfiDestroyerOptionalString{}.Destroy(e.TokenIdentifier)
}

type FfiConverterSendPaymentMethod struct{}

var FfiConverterSendPaymentMethodINSTANCE = FfiConverterSendPaymentMethod{}

func (c FfiConverterSendPaymentMethod) Lift(rb RustBufferI) SendPaymentMethod {
	return LiftFromRustBuffer[SendPaymentMethod](c, rb)
}

func (c FfiConverterSendPaymentMethod) Lower(value SendPaymentMethod) C.RustBuffer {
	return LowerIntoRustBuffer[SendPaymentMethod](c, value)
}

func (c FfiConverterSendPaymentMethod) LowerExternal(value SendPaymentMethod) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[SendPaymentMethod](c, value))
}
func (FfiConverterSendPaymentMethod) Read(reader io.Reader) SendPaymentMethod {
	id := readInt32(reader)
	switch id {
	case 1:
		return SendPaymentMethodBitcoinAddress{
			FfiConverterBitcoinAddressDetailsINSTANCE.Read(reader),
			FfiConverterSendOnchainFeeQuoteINSTANCE.Read(reader),
		}
	case 2:
		return SendPaymentMethodBolt11Invoice{
			FfiConverterBolt11InvoiceDetailsINSTANCE.Read(reader),
			FfiConverterOptionalUint64INSTANCE.Read(reader),
			FfiConverterUint64INSTANCE.Read(reader),
		}
	case 3:
		return SendPaymentMethodSparkAddress{
			FfiConverterStringINSTANCE.Read(reader),
			FfiConverterTypeu128INSTANCE.Read(reader),
			FfiConverterOptionalStringINSTANCE.Read(reader),
		}
	case 4:
		return SendPaymentMethodSparkInvoice{
			FfiConverterSparkInvoiceDetailsINSTANCE.Read(reader),
			FfiConverterTypeu128INSTANCE.Read(reader),
			FfiConverterOptionalStringINSTANCE.Read(reader),
		}
	default:
		panic(fmt.Sprintf("invalid enum value %v in FfiConverterSendPaymentMethod.Read()", id))
	}
}

func (FfiConverterSendPaymentMethod) Write(writer io.Writer, value SendPaymentMethod) {
	switch variant_value := value.(type) {
	case SendPaymentMethodBitcoinAddress:
		writeInt32(writer, 1)
		FfiConverterBitcoinAddressDetailsINSTANCE.Write(writer, variant_value.Address)
		FfiConverterSendOnchainFeeQuoteINSTANCE.Write(writer, variant_value.FeeQuote)
	case SendPaymentMethodBolt11Invoice:
		writeInt32(writer, 2)
		FfiConverterBolt11InvoiceDetailsINSTANCE.Write(writer, variant_value.InvoiceDetails)
		FfiConverterOptionalUint64INSTANCE.Write(writer, variant_value.SparkTransferFeeSats)
		FfiConverterUint64INSTANCE.Write(writer, variant_value.LightningFeeSats)
	case SendPaymentMethodSparkAddress:
		writeInt32(writer, 3)
		FfiConverterStringINSTANCE.Write(writer, variant_value.Address)
		FfiConverterTypeu128INSTANCE.Write(writer, variant_value.Fee)
		FfiConverterOptionalStringINSTANCE.Write(writer, variant_value.TokenIdentifier)
	case SendPaymentMethodSparkInvoice:
		writeInt32(writer, 4)
		FfiConverterSparkInvoiceDetailsINSTANCE.Write(writer, variant_value.SparkInvoiceDetails)
		FfiConverterTypeu128INSTANCE.Write(writer, variant_value.Fee)
		FfiConverterOptionalStringINSTANCE.Write(writer, variant_value.TokenIdentifier)
	default:
		_ = variant_value
		panic(fmt.Sprintf("invalid enum value `%v` in FfiConverterSendPaymentMethod.Write", value))
	}
}

type FfiDestroyerSendPaymentMethod struct{}

func (_ FfiDestroyerSendPaymentMethod) Destroy(value SendPaymentMethod) {
	value.Destroy()
}

type SendPaymentOptions interface {
	Destroy()
}
type SendPaymentOptionsBitcoinAddress struct {
	ConfirmationSpeed OnchainConfirmationSpeed
}

func (e SendPaymentOptionsBitcoinAddress) Destroy() {
	FfiDestroyerOnchainConfirmationSpeed{}.Destroy(e.ConfirmationSpeed)
}

type SendPaymentOptionsBolt11Invoice struct {
	PreferSpark           bool
	CompletionTimeoutSecs *uint32
}

func (e SendPaymentOptionsBolt11Invoice) Destroy() {
	FfiDestroyerBool{}.Destroy(e.PreferSpark)
	FfiDestroyerOptionalUint32{}.Destroy(e.CompletionTimeoutSecs)
}

type SendPaymentOptionsSparkAddress struct {
	HtlcOptions *SparkHtlcOptions
}

func (e SendPaymentOptionsSparkAddress) Destroy() {
	FfiDestroyerOptionalSparkHtlcOptions{}.Destroy(e.HtlcOptions)
}

type FfiConverterSendPaymentOptions struct{}

var FfiConverterSendPaymentOptionsINSTANCE = FfiConverterSendPaymentOptions{}

func (c FfiConverterSendPaymentOptions) Lift(rb RustBufferI) SendPaymentOptions {
	return LiftFromRustBuffer[SendPaymentOptions](c, rb)
}

func (c FfiConverterSendPaymentOptions) Lower(value SendPaymentOptions) C.RustBuffer {
	return LowerIntoRustBuffer[SendPaymentOptions](c, value)
}

func (c FfiConverterSendPaymentOptions) LowerExternal(value SendPaymentOptions) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[SendPaymentOptions](c, value))
}
func (FfiConverterSendPaymentOptions) Read(reader io.Reader) SendPaymentOptions {
	id := readInt32(reader)
	switch id {
	case 1:
		return SendPaymentOptionsBitcoinAddress{
			FfiConverterOnchainConfirmationSpeedINSTANCE.Read(reader),
		}
	case 2:
		return SendPaymentOptionsBolt11Invoice{
			FfiConverterBoolINSTANCE.Read(reader),
			FfiConverterOptionalUint32INSTANCE.Read(reader),
		}
	case 3:
		return SendPaymentOptionsSparkAddress{
			FfiConverterOptionalSparkHtlcOptionsINSTANCE.Read(reader),
		}
	default:
		panic(fmt.Sprintf("invalid enum value %v in FfiConverterSendPaymentOptions.Read()", id))
	}
}

func (FfiConverterSendPaymentOptions) Write(writer io.Writer, value SendPaymentOptions) {
	switch variant_value := value.(type) {
	case SendPaymentOptionsBitcoinAddress:
		writeInt32(writer, 1)
		FfiConverterOnchainConfirmationSpeedINSTANCE.Write(writer, variant_value.ConfirmationSpeed)
	case SendPaymentOptionsBolt11Invoice:
		writeInt32(writer, 2)
		FfiConverterBoolINSTANCE.Write(writer, variant_value.PreferSpark)
		FfiConverterOptionalUint32INSTANCE.Write(writer, variant_value.CompletionTimeoutSecs)
	case SendPaymentOptionsSparkAddress:
		writeInt32(writer, 3)
		FfiConverterOptionalSparkHtlcOptionsINSTANCE.Write(writer, variant_value.HtlcOptions)
	default:
		_ = variant_value
		panic(fmt.Sprintf("invalid enum value `%v` in FfiConverterSendPaymentOptions.Write", value))
	}
}

type FfiDestroyerSendPaymentOptions struct{}

func (_ FfiDestroyerSendPaymentOptions) Destroy(value SendPaymentOptions) {
	value.Destroy()
}

type ServiceConnectivityError struct {
	err error
}

// Convience method to turn *ServiceConnectivityError into error
// Avoiding treating nil pointer as non nil error interface
func (err *ServiceConnectivityError) AsError() error {
	if err == nil {
		return nil
	} else {
		return err
	}
}

func (err ServiceConnectivityError) Error() string {
	return fmt.Sprintf("ServiceConnectivityError: %s", err.err.Error())
}

func (err ServiceConnectivityError) Unwrap() error {
	return err.err
}

// Err* are used for checking error type with `errors.Is`
var ErrServiceConnectivityErrorBuilder = fmt.Errorf("ServiceConnectivityErrorBuilder")
var ErrServiceConnectivityErrorRedirect = fmt.Errorf("ServiceConnectivityErrorRedirect")
var ErrServiceConnectivityErrorStatus = fmt.Errorf("ServiceConnectivityErrorStatus")
var ErrServiceConnectivityErrorTimeout = fmt.Errorf("ServiceConnectivityErrorTimeout")
var ErrServiceConnectivityErrorRequest = fmt.Errorf("ServiceConnectivityErrorRequest")
var ErrServiceConnectivityErrorConnect = fmt.Errorf("ServiceConnectivityErrorConnect")
var ErrServiceConnectivityErrorBody = fmt.Errorf("ServiceConnectivityErrorBody")
var ErrServiceConnectivityErrorDecode = fmt.Errorf("ServiceConnectivityErrorDecode")
var ErrServiceConnectivityErrorJson = fmt.Errorf("ServiceConnectivityErrorJson")
var ErrServiceConnectivityErrorOther = fmt.Errorf("ServiceConnectivityErrorOther")

// Variant structs
type ServiceConnectivityErrorBuilder struct {
	Field0 string
}

func NewServiceConnectivityErrorBuilder(
	var0 string,
) *ServiceConnectivityError {
	return &ServiceConnectivityError{err: &ServiceConnectivityErrorBuilder{
		Field0: var0}}
}

func (e ServiceConnectivityErrorBuilder) destroy() {
	FfiDestroyerString{}.Destroy(e.Field0)
}

func (err ServiceConnectivityErrorBuilder) Error() string {
	return fmt.Sprint("Builder",
		": ",

		"Field0=",
		err.Field0,
	)
}

func (self ServiceConnectivityErrorBuilder) Is(target error) bool {
	return target == ErrServiceConnectivityErrorBuilder
}

type ServiceConnectivityErrorRedirect struct {
	Field0 string
}

func NewServiceConnectivityErrorRedirect(
	var0 string,
) *ServiceConnectivityError {
	return &ServiceConnectivityError{err: &ServiceConnectivityErrorRedirect{
		Field0: var0}}
}

func (e ServiceConnectivityErrorRedirect) destroy() {
	FfiDestroyerString{}.Destroy(e.Field0)
}

func (err ServiceConnectivityErrorRedirect) Error() string {
	return fmt.Sprint("Redirect",
		": ",

		"Field0=",
		err.Field0,
	)
}

func (self ServiceConnectivityErrorRedirect) Is(target error) bool {
	return target == ErrServiceConnectivityErrorRedirect
}

type ServiceConnectivityErrorStatus struct {
	Status uint16
	Body   string
}

func NewServiceConnectivityErrorStatus(
	status uint16,
	body string,
) *ServiceConnectivityError {
	return &ServiceConnectivityError{err: &ServiceConnectivityErrorStatus{
		Status: status,
		Body:   body}}
}

func (e ServiceConnectivityErrorStatus) destroy() {
	FfiDestroyerUint16{}.Destroy(e.Status)
	FfiDestroyerString{}.Destroy(e.Body)
}

func (err ServiceConnectivityErrorStatus) Error() string {
	return fmt.Sprint("Status",
		": ",

		"Status=",
		err.Status,
		", ",
		"Body=",
		err.Body,
	)
}

func (self ServiceConnectivityErrorStatus) Is(target error) bool {
	return target == ErrServiceConnectivityErrorStatus
}

type ServiceConnectivityErrorTimeout struct {
	Field0 string
}

func NewServiceConnectivityErrorTimeout(
	var0 string,
) *ServiceConnectivityError {
	return &ServiceConnectivityError{err: &ServiceConnectivityErrorTimeout{
		Field0: var0}}
}

func (e ServiceConnectivityErrorTimeout) destroy() {
	FfiDestroyerString{}.Destroy(e.Field0)
}

func (err ServiceConnectivityErrorTimeout) Error() string {
	return fmt.Sprint("Timeout",
		": ",

		"Field0=",
		err.Field0,
	)
}

func (self ServiceConnectivityErrorTimeout) Is(target error) bool {
	return target == ErrServiceConnectivityErrorTimeout
}

type ServiceConnectivityErrorRequest struct {
	Field0 string
}

func NewServiceConnectivityErrorRequest(
	var0 string,
) *ServiceConnectivityError {
	return &ServiceConnectivityError{err: &ServiceConnectivityErrorRequest{
		Field0: var0}}
}

func (e ServiceConnectivityErrorRequest) destroy() {
	FfiDestroyerString{}.Destroy(e.Field0)
}

func (err ServiceConnectivityErrorRequest) Error() string {
	return fmt.Sprint("Request",
		": ",

		"Field0=",
		err.Field0,
	)
}

func (self ServiceConnectivityErrorRequest) Is(target error) bool {
	return target == ErrServiceConnectivityErrorRequest
}

type ServiceConnectivityErrorConnect struct {
	Field0 string
}

func NewServiceConnectivityErrorConnect(
	var0 string,
) *ServiceConnectivityError {
	return &ServiceConnectivityError{err: &ServiceConnectivityErrorConnect{
		Field0: var0}}
}

func (e ServiceConnectivityErrorConnect) destroy() {
	FfiDestroyerString{}.Destroy(e.Field0)
}

func (err ServiceConnectivityErrorConnect) Error() string {
	return fmt.Sprint("Connect",
		": ",

		"Field0=",
		err.Field0,
	)
}

func (self ServiceConnectivityErrorConnect) Is(target error) bool {
	return target == ErrServiceConnectivityErrorConnect
}

type ServiceConnectivityErrorBody struct {
	Field0 string
}

func NewServiceConnectivityErrorBody(
	var0 string,
) *ServiceConnectivityError {
	return &ServiceConnectivityError{err: &ServiceConnectivityErrorBody{
		Field0: var0}}
}

func (e ServiceConnectivityErrorBody) destroy() {
	FfiDestroyerString{}.Destroy(e.Field0)
}

func (err ServiceConnectivityErrorBody) Error() string {
	return fmt.Sprint("Body",
		": ",

		"Field0=",
		err.Field0,
	)
}

func (self ServiceConnectivityErrorBody) Is(target error) bool {
	return target == ErrServiceConnectivityErrorBody
}

type ServiceConnectivityErrorDecode struct {
	Field0 string
}

func NewServiceConnectivityErrorDecode(
	var0 string,
) *ServiceConnectivityError {
	return &ServiceConnectivityError{err: &ServiceConnectivityErrorDecode{
		Field0: var0}}
}

func (e ServiceConnectivityErrorDecode) destroy() {
	FfiDestroyerString{}.Destroy(e.Field0)
}

func (err ServiceConnectivityErrorDecode) Error() string {
	return fmt.Sprint("Decode",
		": ",

		"Field0=",
		err.Field0,
	)
}

func (self ServiceConnectivityErrorDecode) Is(target error) bool {
	return target == ErrServiceConnectivityErrorDecode
}

type ServiceConnectivityErrorJson struct {
	Field0 string
}

func NewServiceConnectivityErrorJson(
	var0 string,
) *ServiceConnectivityError {
	return &ServiceConnectivityError{err: &ServiceConnectivityErrorJson{
		Field0: var0}}
}

func (e ServiceConnectivityErrorJson) destroy() {
	FfiDestroyerString{}.Destroy(e.Field0)
}

func (err ServiceConnectivityErrorJson) Error() string {
	return fmt.Sprint("Json",
		": ",

		"Field0=",
		err.Field0,
	)
}

func (self ServiceConnectivityErrorJson) Is(target error) bool {
	return target == ErrServiceConnectivityErrorJson
}

type ServiceConnectivityErrorOther struct {
	Field0 string
}

func NewServiceConnectivityErrorOther(
	var0 string,
) *ServiceConnectivityError {
	return &ServiceConnectivityError{err: &ServiceConnectivityErrorOther{
		Field0: var0}}
}

func (e ServiceConnectivityErrorOther) destroy() {
	FfiDestroyerString{}.Destroy(e.Field0)
}

func (err ServiceConnectivityErrorOther) Error() string {
	return fmt.Sprint("Other",
		": ",

		"Field0=",
		err.Field0,
	)
}

func (self ServiceConnectivityErrorOther) Is(target error) bool {
	return target == ErrServiceConnectivityErrorOther
}

type FfiConverterServiceConnectivityError struct{}

var FfiConverterServiceConnectivityErrorINSTANCE = FfiConverterServiceConnectivityError{}

func (c FfiConverterServiceConnectivityError) Lift(eb RustBufferI) *ServiceConnectivityError {
	return LiftFromRustBuffer[*ServiceConnectivityError](c, eb)
}

func (c FfiConverterServiceConnectivityError) Lower(value *ServiceConnectivityError) C.RustBuffer {
	return LowerIntoRustBuffer[*ServiceConnectivityError](c, value)
}

func (c FfiConverterServiceConnectivityError) LowerExternal(value *ServiceConnectivityError) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[*ServiceConnectivityError](c, value))
}

func (c FfiConverterServiceConnectivityError) Read(reader io.Reader) *ServiceConnectivityError {
	errorID := readUint32(reader)

	switch errorID {
	case 1:
		return &ServiceConnectivityError{&ServiceConnectivityErrorBuilder{
			Field0: FfiConverterStringINSTANCE.Read(reader),
		}}
	case 2:
		return &ServiceConnectivityError{&ServiceConnectivityErrorRedirect{
			Field0: FfiConverterStringINSTANCE.Read(reader),
		}}
	case 3:
		return &ServiceConnectivityError{&ServiceConnectivityErrorStatus{
			Status: FfiConverterUint16INSTANCE.Read(reader),
			Body:   FfiConverterStringINSTANCE.Read(reader),
		}}
	case 4:
		return &ServiceConnectivityError{&ServiceConnectivityErrorTimeout{
			Field0: FfiConverterStringINSTANCE.Read(reader),
		}}
	case 5:
		return &ServiceConnectivityError{&ServiceConnectivityErrorRequest{
			Field0: FfiConverterStringINSTANCE.Read(reader),
		}}
	case 6:
		return &ServiceConnectivityError{&ServiceConnectivityErrorConnect{
			Field0: FfiConverterStringINSTANCE.Read(reader),
		}}
	case 7:
		return &ServiceConnectivityError{&ServiceConnectivityErrorBody{
			Field0: FfiConverterStringINSTANCE.Read(reader),
		}}
	case 8:
		return &ServiceConnectivityError{&ServiceConnectivityErrorDecode{
			Field0: FfiConverterStringINSTANCE.Read(reader),
		}}
	case 9:
		return &ServiceConnectivityError{&ServiceConnectivityErrorJson{
			Field0: FfiConverterStringINSTANCE.Read(reader),
		}}
	case 10:
		return &ServiceConnectivityError{&ServiceConnectivityErrorOther{
			Field0: FfiConverterStringINSTANCE.Read(reader),
		}}
	default:
		panic(fmt.Sprintf("Unknown error code %d in FfiConverterServiceConnectivityError.Read()", errorID))
	}
}

func (c FfiConverterServiceConnectivityError) Write(writer io.Writer, value *ServiceConnectivityError) {
	switch variantValue := value.err.(type) {
	case *ServiceConnectivityErrorBuilder:
		writeInt32(writer, 1)
		FfiConverterStringINSTANCE.Write(writer, variantValue.Field0)
	case *ServiceConnectivityErrorRedirect:
		writeInt32(writer, 2)
		FfiConverterStringINSTANCE.Write(writer, variantValue.Field0)
	case *ServiceConnectivityErrorStatus:
		writeInt32(writer, 3)
		FfiConverterUint16INSTANCE.Write(writer, variantValue.Status)
		FfiConverterStringINSTANCE.Write(writer, variantValue.Body)
	case *ServiceConnectivityErrorTimeout:
		writeInt32(writer, 4)
		FfiConverterStringINSTANCE.Write(writer, variantValue.Field0)
	case *ServiceConnectivityErrorRequest:
		writeInt32(writer, 5)
		FfiConverterStringINSTANCE.Write(writer, variantValue.Field0)
	case *ServiceConnectivityErrorConnect:
		writeInt32(writer, 6)
		FfiConverterStringINSTANCE.Write(writer, variantValue.Field0)
	case *ServiceConnectivityErrorBody:
		writeInt32(writer, 7)
		FfiConverterStringINSTANCE.Write(writer, variantValue.Field0)
	case *ServiceConnectivityErrorDecode:
		writeInt32(writer, 8)
		FfiConverterStringINSTANCE.Write(writer, variantValue.Field0)
	case *ServiceConnectivityErrorJson:
		writeInt32(writer, 9)
		FfiConverterStringINSTANCE.Write(writer, variantValue.Field0)
	case *ServiceConnectivityErrorOther:
		writeInt32(writer, 10)
		FfiConverterStringINSTANCE.Write(writer, variantValue.Field0)
	default:
		_ = variantValue
		panic(fmt.Sprintf("invalid error value `%v` in FfiConverterServiceConnectivityError.Write", value))
	}
}

type FfiDestroyerServiceConnectivityError struct{}

func (_ FfiDestroyerServiceConnectivityError) Destroy(value *ServiceConnectivityError) {
	switch variantValue := value.err.(type) {
	case ServiceConnectivityErrorBuilder:
		variantValue.destroy()
	case ServiceConnectivityErrorRedirect:
		variantValue.destroy()
	case ServiceConnectivityErrorStatus:
		variantValue.destroy()
	case ServiceConnectivityErrorTimeout:
		variantValue.destroy()
	case ServiceConnectivityErrorRequest:
		variantValue.destroy()
	case ServiceConnectivityErrorConnect:
		variantValue.destroy()
	case ServiceConnectivityErrorBody:
		variantValue.destroy()
	case ServiceConnectivityErrorDecode:
		variantValue.destroy()
	case ServiceConnectivityErrorJson:
		variantValue.destroy()
	case ServiceConnectivityErrorOther:
		variantValue.destroy()
	default:
		_ = variantValue
		panic(fmt.Sprintf("invalid error value `%v` in FfiDestroyerServiceConnectivityError.Destroy", value))
	}
}

// The operational status of a Spark service.
type ServiceStatus uint

const (
	// Service is fully operational.
	ServiceStatusOperational ServiceStatus = 1
	// Service is experiencing degraded performance.
	ServiceStatusDegraded ServiceStatus = 2
	// Service is partially unavailable.
	ServiceStatusPartial ServiceStatus = 3
	// Service status is unknown.
	ServiceStatusUnknown ServiceStatus = 4
	// Service is experiencing a major outage.
	ServiceStatusMajor ServiceStatus = 5
)

type FfiConverterServiceStatus struct{}

var FfiConverterServiceStatusINSTANCE = FfiConverterServiceStatus{}

func (c FfiConverterServiceStatus) Lift(rb RustBufferI) ServiceStatus {
	return LiftFromRustBuffer[ServiceStatus](c, rb)
}

func (c FfiConverterServiceStatus) Lower(value ServiceStatus) C.RustBuffer {
	return LowerIntoRustBuffer[ServiceStatus](c, value)
}

func (c FfiConverterServiceStatus) LowerExternal(value ServiceStatus) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[ServiceStatus](c, value))
}
func (FfiConverterServiceStatus) Read(reader io.Reader) ServiceStatus {
	id := readInt32(reader)
	return ServiceStatus(id)
}

func (FfiConverterServiceStatus) Write(writer io.Writer, value ServiceStatus) {
	writeInt32(writer, int32(value))
}

type FfiDestroyerServiceStatus struct{}

func (_ FfiDestroyerServiceStatus) Destroy(value ServiceStatus) {
}

// Error type for signer operations
type SignerError struct {
	err error
}

// Convience method to turn *SignerError into error
// Avoiding treating nil pointer as non nil error interface
func (err *SignerError) AsError() error {
	if err == nil {
		return nil
	} else {
		return err
	}
}

func (err SignerError) Error() string {
	return fmt.Sprintf("SignerError: %s", err.err.Error())
}

func (err SignerError) Unwrap() error {
	return err.err
}

// Err* are used for checking error type with `errors.Is`
var ErrSignerErrorKeyDerivation = fmt.Errorf("SignerErrorKeyDerivation")
var ErrSignerErrorSigning = fmt.Errorf("SignerErrorSigning")
var ErrSignerErrorEncryption = fmt.Errorf("SignerErrorEncryption")
var ErrSignerErrorDecryption = fmt.Errorf("SignerErrorDecryption")
var ErrSignerErrorFrost = fmt.Errorf("SignerErrorFrost")
var ErrSignerErrorInvalidInput = fmt.Errorf("SignerErrorInvalidInput")
var ErrSignerErrorGeneric = fmt.Errorf("SignerErrorGeneric")

// Variant structs
type SignerErrorKeyDerivation struct {
	Field0 string
}

func NewSignerErrorKeyDerivation(
	var0 string,
) *SignerError {
	return &SignerError{err: &SignerErrorKeyDerivation{
		Field0: var0}}
}

func (e SignerErrorKeyDerivation) destroy() {
	FfiDestroyerString{}.Destroy(e.Field0)
}

func (err SignerErrorKeyDerivation) Error() string {
	return fmt.Sprint("KeyDerivation",
		": ",

		"Field0=",
		err.Field0,
	)
}

func (self SignerErrorKeyDerivation) Is(target error) bool {
	return target == ErrSignerErrorKeyDerivation
}

type SignerErrorSigning struct {
	Field0 string
}

func NewSignerErrorSigning(
	var0 string,
) *SignerError {
	return &SignerError{err: &SignerErrorSigning{
		Field0: var0}}
}

func (e SignerErrorSigning) destroy() {
	FfiDestroyerString{}.Destroy(e.Field0)
}

func (err SignerErrorSigning) Error() string {
	return fmt.Sprint("Signing",
		": ",

		"Field0=",
		err.Field0,
	)
}

func (self SignerErrorSigning) Is(target error) bool {
	return target == ErrSignerErrorSigning
}

type SignerErrorEncryption struct {
	Field0 string
}

func NewSignerErrorEncryption(
	var0 string,
) *SignerError {
	return &SignerError{err: &SignerErrorEncryption{
		Field0: var0}}
}

func (e SignerErrorEncryption) destroy() {
	FfiDestroyerString{}.Destroy(e.Field0)
}

func (err SignerErrorEncryption) Error() string {
	return fmt.Sprint("Encryption",
		": ",

		"Field0=",
		err.Field0,
	)
}

func (self SignerErrorEncryption) Is(target error) bool {
	return target == ErrSignerErrorEncryption
}

type SignerErrorDecryption struct {
	Field0 string
}

func NewSignerErrorDecryption(
	var0 string,
) *SignerError {
	return &SignerError{err: &SignerErrorDecryption{
		Field0: var0}}
}

func (e SignerErrorDecryption) destroy() {
	FfiDestroyerString{}.Destroy(e.Field0)
}

func (err SignerErrorDecryption) Error() string {
	return fmt.Sprint("Decryption",
		": ",

		"Field0=",
		err.Field0,
	)
}

func (self SignerErrorDecryption) Is(target error) bool {
	return target == ErrSignerErrorDecryption
}

type SignerErrorFrost struct {
	Field0 string
}

func NewSignerErrorFrost(
	var0 string,
) *SignerError {
	return &SignerError{err: &SignerErrorFrost{
		Field0: var0}}
}

func (e SignerErrorFrost) destroy() {
	FfiDestroyerString{}.Destroy(e.Field0)
}

func (err SignerErrorFrost) Error() string {
	return fmt.Sprint("Frost",
		": ",

		"Field0=",
		err.Field0,
	)
}

func (self SignerErrorFrost) Is(target error) bool {
	return target == ErrSignerErrorFrost
}

type SignerErrorInvalidInput struct {
	Field0 string
}

func NewSignerErrorInvalidInput(
	var0 string,
) *SignerError {
	return &SignerError{err: &SignerErrorInvalidInput{
		Field0: var0}}
}

func (e SignerErrorInvalidInput) destroy() {
	FfiDestroyerString{}.Destroy(e.Field0)
}

func (err SignerErrorInvalidInput) Error() string {
	return fmt.Sprint("InvalidInput",
		": ",

		"Field0=",
		err.Field0,
	)
}

func (self SignerErrorInvalidInput) Is(target error) bool {
	return target == ErrSignerErrorInvalidInput
}

type SignerErrorGeneric struct {
	Field0 string
}

func NewSignerErrorGeneric(
	var0 string,
) *SignerError {
	return &SignerError{err: &SignerErrorGeneric{
		Field0: var0}}
}

func (e SignerErrorGeneric) destroy() {
	FfiDestroyerString{}.Destroy(e.Field0)
}

func (err SignerErrorGeneric) Error() string {
	return fmt.Sprint("Generic",
		": ",

		"Field0=",
		err.Field0,
	)
}

func (self SignerErrorGeneric) Is(target error) bool {
	return target == ErrSignerErrorGeneric
}

type FfiConverterSignerError struct{}

var FfiConverterSignerErrorINSTANCE = FfiConverterSignerError{}

func (c FfiConverterSignerError) Lift(eb RustBufferI) *SignerError {
	return LiftFromRustBuffer[*SignerError](c, eb)
}

func (c FfiConverterSignerError) Lower(value *SignerError) C.RustBuffer {
	return LowerIntoRustBuffer[*SignerError](c, value)
}

func (c FfiConverterSignerError) LowerExternal(value *SignerError) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[*SignerError](c, value))
}

func (c FfiConverterSignerError) Read(reader io.Reader) *SignerError {
	errorID := readUint32(reader)

	switch errorID {
	case 1:
		return &SignerError{&SignerErrorKeyDerivation{
			Field0: FfiConverterStringINSTANCE.Read(reader),
		}}
	case 2:
		return &SignerError{&SignerErrorSigning{
			Field0: FfiConverterStringINSTANCE.Read(reader),
		}}
	case 3:
		return &SignerError{&SignerErrorEncryption{
			Field0: FfiConverterStringINSTANCE.Read(reader),
		}}
	case 4:
		return &SignerError{&SignerErrorDecryption{
			Field0: FfiConverterStringINSTANCE.Read(reader),
		}}
	case 5:
		return &SignerError{&SignerErrorFrost{
			Field0: FfiConverterStringINSTANCE.Read(reader),
		}}
	case 6:
		return &SignerError{&SignerErrorInvalidInput{
			Field0: FfiConverterStringINSTANCE.Read(reader),
		}}
	case 7:
		return &SignerError{&SignerErrorGeneric{
			Field0: FfiConverterStringINSTANCE.Read(reader),
		}}
	default:
		panic(fmt.Sprintf("Unknown error code %d in FfiConverterSignerError.Read()", errorID))
	}
}

func (c FfiConverterSignerError) Write(writer io.Writer, value *SignerError) {
	switch variantValue := value.err.(type) {
	case *SignerErrorKeyDerivation:
		writeInt32(writer, 1)
		FfiConverterStringINSTANCE.Write(writer, variantValue.Field0)
	case *SignerErrorSigning:
		writeInt32(writer, 2)
		FfiConverterStringINSTANCE.Write(writer, variantValue.Field0)
	case *SignerErrorEncryption:
		writeInt32(writer, 3)
		FfiConverterStringINSTANCE.Write(writer, variantValue.Field0)
	case *SignerErrorDecryption:
		writeInt32(writer, 4)
		FfiConverterStringINSTANCE.Write(writer, variantValue.Field0)
	case *SignerErrorFrost:
		writeInt32(writer, 5)
		FfiConverterStringINSTANCE.Write(writer, variantValue.Field0)
	case *SignerErrorInvalidInput:
		writeInt32(writer, 6)
		FfiConverterStringINSTANCE.Write(writer, variantValue.Field0)
	case *SignerErrorGeneric:
		writeInt32(writer, 7)
		FfiConverterStringINSTANCE.Write(writer, variantValue.Field0)
	default:
		_ = variantValue
		panic(fmt.Sprintf("invalid error value `%v` in FfiConverterSignerError.Write", value))
	}
}

type FfiDestroyerSignerError struct{}

func (_ FfiDestroyerSignerError) Destroy(value *SignerError) {
	switch variantValue := value.err.(type) {
	case SignerErrorKeyDerivation:
		variantValue.destroy()
	case SignerErrorSigning:
		variantValue.destroy()
	case SignerErrorEncryption:
		variantValue.destroy()
	case SignerErrorDecryption:
		variantValue.destroy()
	case SignerErrorFrost:
		variantValue.destroy()
	case SignerErrorInvalidInput:
		variantValue.destroy()
	case SignerErrorGeneric:
		variantValue.destroy()
	default:
		_ = variantValue
		panic(fmt.Sprintf("invalid error value `%v` in FfiDestroyerSignerError.Destroy", value))
	}
}

type SparkHtlcStatus uint

const (
	// The HTLC is waiting for the preimage to be shared by the receiver
	SparkHtlcStatusWaitingForPreimage SparkHtlcStatus = 1
	// The HTLC preimage has been shared and the transfer can be or has been claimed by the receiver
	SparkHtlcStatusPreimageShared SparkHtlcStatus = 2
	// The HTLC has been returned to the sender due to expiry
	SparkHtlcStatusReturned SparkHtlcStatus = 3
)

type FfiConverterSparkHtlcStatus struct{}

var FfiConverterSparkHtlcStatusINSTANCE = FfiConverterSparkHtlcStatus{}

func (c FfiConverterSparkHtlcStatus) Lift(rb RustBufferI) SparkHtlcStatus {
	return LiftFromRustBuffer[SparkHtlcStatus](c, rb)
}

func (c FfiConverterSparkHtlcStatus) Lower(value SparkHtlcStatus) C.RustBuffer {
	return LowerIntoRustBuffer[SparkHtlcStatus](c, value)
}

func (c FfiConverterSparkHtlcStatus) LowerExternal(value SparkHtlcStatus) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[SparkHtlcStatus](c, value))
}
func (FfiConverterSparkHtlcStatus) Read(reader io.Reader) SparkHtlcStatus {
	id := readInt32(reader)
	return SparkHtlcStatus(id)
}

func (FfiConverterSparkHtlcStatus) Write(writer io.Writer, value SparkHtlcStatus) {
	writeInt32(writer, int32(value))
}

type FfiDestroyerSparkHtlcStatus struct{}

func (_ FfiDestroyerSparkHtlcStatus) Destroy(value SparkHtlcStatus) {
}

// Specifies how to update the active stable balance token.
type StableBalanceActiveLabel interface {
	Destroy()
}

// Activate stable balance with the given label.
type StableBalanceActiveLabelSet struct {
	Label string
}

func (e StableBalanceActiveLabelSet) Destroy() {
	FfiDestroyerString{}.Destroy(e.Label)
}

// Deactivate stable balance.
type StableBalanceActiveLabelUnset struct {
}

func (e StableBalanceActiveLabelUnset) Destroy() {
}

type FfiConverterStableBalanceActiveLabel struct{}

var FfiConverterStableBalanceActiveLabelINSTANCE = FfiConverterStableBalanceActiveLabel{}

func (c FfiConverterStableBalanceActiveLabel) Lift(rb RustBufferI) StableBalanceActiveLabel {
	return LiftFromRustBuffer[StableBalanceActiveLabel](c, rb)
}

func (c FfiConverterStableBalanceActiveLabel) Lower(value StableBalanceActiveLabel) C.RustBuffer {
	return LowerIntoRustBuffer[StableBalanceActiveLabel](c, value)
}

func (c FfiConverterStableBalanceActiveLabel) LowerExternal(value StableBalanceActiveLabel) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[StableBalanceActiveLabel](c, value))
}
func (FfiConverterStableBalanceActiveLabel) Read(reader io.Reader) StableBalanceActiveLabel {
	id := readInt32(reader)
	switch id {
	case 1:
		return StableBalanceActiveLabelSet{
			FfiConverterStringINSTANCE.Read(reader),
		}
	case 2:
		return StableBalanceActiveLabelUnset{}
	default:
		panic(fmt.Sprintf("invalid enum value %v in FfiConverterStableBalanceActiveLabel.Read()", id))
	}
}

func (FfiConverterStableBalanceActiveLabel) Write(writer io.Writer, value StableBalanceActiveLabel) {
	switch variant_value := value.(type) {
	case StableBalanceActiveLabelSet:
		writeInt32(writer, 1)
		FfiConverterStringINSTANCE.Write(writer, variant_value.Label)
	case StableBalanceActiveLabelUnset:
		writeInt32(writer, 2)
	default:
		_ = variant_value
		panic(fmt.Sprintf("invalid enum value `%v` in FfiConverterStableBalanceActiveLabel.Write", value))
	}
}

type FfiDestroyerStableBalanceActiveLabel struct{}

func (_ FfiDestroyerStableBalanceActiveLabel) Destroy(value StableBalanceActiveLabel) {
	value.Destroy()
}

// Errors that can occur during storage operations
type StorageError struct {
	err error
}

// Convience method to turn *StorageError into error
// Avoiding treating nil pointer as non nil error interface
func (err *StorageError) AsError() error {
	if err == nil {
		return nil
	} else {
		return err
	}
}

func (err StorageError) Error() string {
	return fmt.Sprintf("StorageError: %s", err.err.Error())
}

func (err StorageError) Unwrap() error {
	return err.err
}

// Err* are used for checking error type with `errors.Is`
var ErrStorageErrorConnection = fmt.Errorf("StorageErrorConnection")
var ErrStorageErrorImplementation = fmt.Errorf("StorageErrorImplementation")
var ErrStorageErrorInitializationError = fmt.Errorf("StorageErrorInitializationError")
var ErrStorageErrorSerialization = fmt.Errorf("StorageErrorSerialization")
var ErrStorageErrorNotFound = fmt.Errorf("StorageErrorNotFound")

// Variant structs
// Connection-related errors (pool exhaustion, timeouts, connection refused).
// These are often transient and may be retried.
type StorageErrorConnection struct {
	Field0 string
}

// Connection-related errors (pool exhaustion, timeouts, connection refused).
// These are often transient and may be retried.
func NewStorageErrorConnection(
	var0 string,
) *StorageError {
	return &StorageError{err: &StorageErrorConnection{
		Field0: var0}}
}

func (e StorageErrorConnection) destroy() {
	FfiDestroyerString{}.Destroy(e.Field0)
}

func (err StorageErrorConnection) Error() string {
	return fmt.Sprint("Connection",
		": ",

		"Field0=",
		err.Field0,
	)
}

func (self StorageErrorConnection) Is(target error) bool {
	return target == ErrStorageErrorConnection
}

type StorageErrorImplementation struct {
	Field0 string
}

func NewStorageErrorImplementation(
	var0 string,
) *StorageError {
	return &StorageError{err: &StorageErrorImplementation{
		Field0: var0}}
}

func (e StorageErrorImplementation) destroy() {
	FfiDestroyerString{}.Destroy(e.Field0)
}

func (err StorageErrorImplementation) Error() string {
	return fmt.Sprint("Implementation",
		": ",

		"Field0=",
		err.Field0,
	)
}

func (self StorageErrorImplementation) Is(target error) bool {
	return target == ErrStorageErrorImplementation
}

// Database initialization error
type StorageErrorInitializationError struct {
	Field0 string
}

// Database initialization error
func NewStorageErrorInitializationError(
	var0 string,
) *StorageError {
	return &StorageError{err: &StorageErrorInitializationError{
		Field0: var0}}
}

func (e StorageErrorInitializationError) destroy() {
	FfiDestroyerString{}.Destroy(e.Field0)
}

func (err StorageErrorInitializationError) Error() string {
	return fmt.Sprint("InitializationError",
		": ",

		"Field0=",
		err.Field0,
	)
}

func (self StorageErrorInitializationError) Is(target error) bool {
	return target == ErrStorageErrorInitializationError
}

type StorageErrorSerialization struct {
	Field0 string
}

func NewStorageErrorSerialization(
	var0 string,
) *StorageError {
	return &StorageError{err: &StorageErrorSerialization{
		Field0: var0}}
}

func (e StorageErrorSerialization) destroy() {
	FfiDestroyerString{}.Destroy(e.Field0)
}

func (err StorageErrorSerialization) Error() string {
	return fmt.Sprint("Serialization",
		": ",

		"Field0=",
		err.Field0,
	)
}

func (self StorageErrorSerialization) Is(target error) bool {
	return target == ErrStorageErrorSerialization
}

type StorageErrorNotFound struct {
}

func NewStorageErrorNotFound() *StorageError {
	return &StorageError{err: &StorageErrorNotFound{}}
}

func (e StorageErrorNotFound) destroy() {
}

func (err StorageErrorNotFound) Error() string {
	return fmt.Sprint("NotFound")
}

func (self StorageErrorNotFound) Is(target error) bool {
	return target == ErrStorageErrorNotFound
}

type FfiConverterStorageError struct{}

var FfiConverterStorageErrorINSTANCE = FfiConverterStorageError{}

func (c FfiConverterStorageError) Lift(eb RustBufferI) *StorageError {
	return LiftFromRustBuffer[*StorageError](c, eb)
}

func (c FfiConverterStorageError) Lower(value *StorageError) C.RustBuffer {
	return LowerIntoRustBuffer[*StorageError](c, value)
}

func (c FfiConverterStorageError) LowerExternal(value *StorageError) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[*StorageError](c, value))
}

func (c FfiConverterStorageError) Read(reader io.Reader) *StorageError {
	errorID := readUint32(reader)

	switch errorID {
	case 1:
		return &StorageError{&StorageErrorConnection{
			Field0: FfiConverterStringINSTANCE.Read(reader),
		}}
	case 2:
		return &StorageError{&StorageErrorImplementation{
			Field0: FfiConverterStringINSTANCE.Read(reader),
		}}
	case 3:
		return &StorageError{&StorageErrorInitializationError{
			Field0: FfiConverterStringINSTANCE.Read(reader),
		}}
	case 4:
		return &StorageError{&StorageErrorSerialization{
			Field0: FfiConverterStringINSTANCE.Read(reader),
		}}
	case 5:
		return &StorageError{&StorageErrorNotFound{}}
	default:
		panic(fmt.Sprintf("Unknown error code %d in FfiConverterStorageError.Read()", errorID))
	}
}

func (c FfiConverterStorageError) Write(writer io.Writer, value *StorageError) {
	switch variantValue := value.err.(type) {
	case *StorageErrorConnection:
		writeInt32(writer, 1)
		FfiConverterStringINSTANCE.Write(writer, variantValue.Field0)
	case *StorageErrorImplementation:
		writeInt32(writer, 2)
		FfiConverterStringINSTANCE.Write(writer, variantValue.Field0)
	case *StorageErrorInitializationError:
		writeInt32(writer, 3)
		FfiConverterStringINSTANCE.Write(writer, variantValue.Field0)
	case *StorageErrorSerialization:
		writeInt32(writer, 4)
		FfiConverterStringINSTANCE.Write(writer, variantValue.Field0)
	case *StorageErrorNotFound:
		writeInt32(writer, 5)
	default:
		_ = variantValue
		panic(fmt.Sprintf("invalid error value `%v` in FfiConverterStorageError.Write", value))
	}
}

type FfiDestroyerStorageError struct{}

func (_ FfiDestroyerStorageError) Destroy(value *StorageError) {
	switch variantValue := value.err.(type) {
	case StorageErrorConnection:
		variantValue.destroy()
	case StorageErrorImplementation:
		variantValue.destroy()
	case StorageErrorInitializationError:
		variantValue.destroy()
	case StorageErrorSerialization:
		variantValue.destroy()
	case StorageErrorNotFound:
		variantValue.destroy()
	default:
		_ = variantValue
		panic(fmt.Sprintf("invalid error value `%v` in FfiDestroyerStorageError.Destroy", value))
	}
}

// Storage-internal variant of [`PaymentDetailsFilter`].
type StoragePaymentDetailsFilter interface {
	Destroy()
}
type StoragePaymentDetailsFilterSpark struct {
	HtlcStatus             *[]SparkHtlcStatus
	ConversionRefundNeeded *bool
}

func (e StoragePaymentDetailsFilterSpark) Destroy() {
	FfiDestroyerOptionalSequenceSparkHtlcStatus{}.Destroy(e.HtlcStatus)
	FfiDestroyerOptionalBool{}.Destroy(e.ConversionRefundNeeded)
}

type StoragePaymentDetailsFilterToken struct {
	ConversionRefundNeeded *bool
	TxHash                 *string
	TxType                 *TokenTransactionType
}

func (e StoragePaymentDetailsFilterToken) Destroy() {
	FfiDestroyerOptionalBool{}.Destroy(e.ConversionRefundNeeded)
	FfiDestroyerOptionalString{}.Destroy(e.TxHash)
	FfiDestroyerOptionalTokenTransactionType{}.Destroy(e.TxType)
}

type StoragePaymentDetailsFilterLightning struct {
	HtlcStatus *[]SparkHtlcStatus
}

func (e StoragePaymentDetailsFilterLightning) Destroy() {
	FfiDestroyerOptionalSequenceSparkHtlcStatus{}.Destroy(e.HtlcStatus)
}

type FfiConverterStoragePaymentDetailsFilter struct{}

var FfiConverterStoragePaymentDetailsFilterINSTANCE = FfiConverterStoragePaymentDetailsFilter{}

func (c FfiConverterStoragePaymentDetailsFilter) Lift(rb RustBufferI) StoragePaymentDetailsFilter {
	return LiftFromRustBuffer[StoragePaymentDetailsFilter](c, rb)
}

func (c FfiConverterStoragePaymentDetailsFilter) Lower(value StoragePaymentDetailsFilter) C.RustBuffer {
	return LowerIntoRustBuffer[StoragePaymentDetailsFilter](c, value)
}

func (c FfiConverterStoragePaymentDetailsFilter) LowerExternal(value StoragePaymentDetailsFilter) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[StoragePaymentDetailsFilter](c, value))
}
func (FfiConverterStoragePaymentDetailsFilter) Read(reader io.Reader) StoragePaymentDetailsFilter {
	id := readInt32(reader)
	switch id {
	case 1:
		return StoragePaymentDetailsFilterSpark{
			FfiConverterOptionalSequenceSparkHtlcStatusINSTANCE.Read(reader),
			FfiConverterOptionalBoolINSTANCE.Read(reader),
		}
	case 2:
		return StoragePaymentDetailsFilterToken{
			FfiConverterOptionalBoolINSTANCE.Read(reader),
			FfiConverterOptionalStringINSTANCE.Read(reader),
			FfiConverterOptionalTokenTransactionTypeINSTANCE.Read(reader),
		}
	case 3:
		return StoragePaymentDetailsFilterLightning{
			FfiConverterOptionalSequenceSparkHtlcStatusINSTANCE.Read(reader),
		}
	default:
		panic(fmt.Sprintf("invalid enum value %v in FfiConverterStoragePaymentDetailsFilter.Read()", id))
	}
}

func (FfiConverterStoragePaymentDetailsFilter) Write(writer io.Writer, value StoragePaymentDetailsFilter) {
	switch variant_value := value.(type) {
	case StoragePaymentDetailsFilterSpark:
		writeInt32(writer, 1)
		FfiConverterOptionalSequenceSparkHtlcStatusINSTANCE.Write(writer, variant_value.HtlcStatus)
		FfiConverterOptionalBoolINSTANCE.Write(writer, variant_value.ConversionRefundNeeded)
	case StoragePaymentDetailsFilterToken:
		writeInt32(writer, 2)
		FfiConverterOptionalBoolINSTANCE.Write(writer, variant_value.ConversionRefundNeeded)
		FfiConverterOptionalStringINSTANCE.Write(writer, variant_value.TxHash)
		FfiConverterOptionalTokenTransactionTypeINSTANCE.Write(writer, variant_value.TxType)
	case StoragePaymentDetailsFilterLightning:
		writeInt32(writer, 3)
		FfiConverterOptionalSequenceSparkHtlcStatusINSTANCE.Write(writer, variant_value.HtlcStatus)
	default:
		_ = variant_value
		panic(fmt.Sprintf("invalid enum value `%v` in FfiConverterStoragePaymentDetailsFilter.Write", value))
	}
}

type FfiDestroyerStoragePaymentDetailsFilter struct{}

func (_ FfiDestroyerStoragePaymentDetailsFilter) Destroy(value StoragePaymentDetailsFilter) {
	value.Destroy()
}

// Supported success action types
//
// Receiving any other (unsupported) success action type will result in a failed parsing,
// which will abort the LNURL-pay workflow, as per LUD-09.
type SuccessAction interface {
	Destroy()
}

// AES type, described in LUD-10
type SuccessActionAes struct {
	Data AesSuccessActionData
}

func (e SuccessActionAes) Destroy() {
	FfiDestroyerAesSuccessActionData{}.Destroy(e.Data)
}

// Message type, described in LUD-09
type SuccessActionMessage struct {
	Data MessageSuccessActionData
}

func (e SuccessActionMessage) Destroy() {
	FfiDestroyerMessageSuccessActionData{}.Destroy(e.Data)
}

// URL type, described in LUD-09
type SuccessActionUrl struct {
	Data UrlSuccessActionData
}

func (e SuccessActionUrl) Destroy() {
	FfiDestroyerUrlSuccessActionData{}.Destroy(e.Data)
}

type FfiConverterSuccessAction struct{}

var FfiConverterSuccessActionINSTANCE = FfiConverterSuccessAction{}

func (c FfiConverterSuccessAction) Lift(rb RustBufferI) SuccessAction {
	return LiftFromRustBuffer[SuccessAction](c, rb)
}

func (c FfiConverterSuccessAction) Lower(value SuccessAction) C.RustBuffer {
	return LowerIntoRustBuffer[SuccessAction](c, value)
}

func (c FfiConverterSuccessAction) LowerExternal(value SuccessAction) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[SuccessAction](c, value))
}
func (FfiConverterSuccessAction) Read(reader io.Reader) SuccessAction {
	id := readInt32(reader)
	switch id {
	case 1:
		return SuccessActionAes{
			FfiConverterAesSuccessActionDataINSTANCE.Read(reader),
		}
	case 2:
		return SuccessActionMessage{
			FfiConverterMessageSuccessActionDataINSTANCE.Read(reader),
		}
	case 3:
		return SuccessActionUrl{
			FfiConverterUrlSuccessActionDataINSTANCE.Read(reader),
		}
	default:
		panic(fmt.Sprintf("invalid enum value %v in FfiConverterSuccessAction.Read()", id))
	}
}

func (FfiConverterSuccessAction) Write(writer io.Writer, value SuccessAction) {
	switch variant_value := value.(type) {
	case SuccessActionAes:
		writeInt32(writer, 1)
		FfiConverterAesSuccessActionDataINSTANCE.Write(writer, variant_value.Data)
	case SuccessActionMessage:
		writeInt32(writer, 2)
		FfiConverterMessageSuccessActionDataINSTANCE.Write(writer, variant_value.Data)
	case SuccessActionUrl:
		writeInt32(writer, 3)
		FfiConverterUrlSuccessActionDataINSTANCE.Write(writer, variant_value.Data)
	default:
		_ = variant_value
		panic(fmt.Sprintf("invalid enum value `%v` in FfiConverterSuccessAction.Write", value))
	}
}

type FfiDestroyerSuccessAction struct{}

func (_ FfiDestroyerSuccessAction) Destroy(value SuccessAction) {
	value.Destroy()
}

// [`SuccessAction`] where contents are ready to be consumed by the caller
//
// Contents are identical to [`SuccessAction`], except for AES where the ciphertext is decrypted.
type SuccessActionProcessed interface {
	Destroy()
}

// See [`SuccessAction::Aes`] for received payload
//
// See [`AesSuccessActionDataDecrypted`] for decrypted payload
type SuccessActionProcessedAes struct {
	Result AesSuccessActionDataResult
}

func (e SuccessActionProcessedAes) Destroy() {
	FfiDestroyerAesSuccessActionDataResult{}.Destroy(e.Result)
}

// See [`SuccessAction::Message`]
type SuccessActionProcessedMessage struct {
	Data MessageSuccessActionData
}

func (e SuccessActionProcessedMessage) Destroy() {
	FfiDestroyerMessageSuccessActionData{}.Destroy(e.Data)
}

// See [`SuccessAction::Url`]
type SuccessActionProcessedUrl struct {
	Data UrlSuccessActionData
}

func (e SuccessActionProcessedUrl) Destroy() {
	FfiDestroyerUrlSuccessActionData{}.Destroy(e.Data)
}

type FfiConverterSuccessActionProcessed struct{}

var FfiConverterSuccessActionProcessedINSTANCE = FfiConverterSuccessActionProcessed{}

func (c FfiConverterSuccessActionProcessed) Lift(rb RustBufferI) SuccessActionProcessed {
	return LiftFromRustBuffer[SuccessActionProcessed](c, rb)
}

func (c FfiConverterSuccessActionProcessed) Lower(value SuccessActionProcessed) C.RustBuffer {
	return LowerIntoRustBuffer[SuccessActionProcessed](c, value)
}

func (c FfiConverterSuccessActionProcessed) LowerExternal(value SuccessActionProcessed) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[SuccessActionProcessed](c, value))
}
func (FfiConverterSuccessActionProcessed) Read(reader io.Reader) SuccessActionProcessed {
	id := readInt32(reader)
	switch id {
	case 1:
		return SuccessActionProcessedAes{
			FfiConverterAesSuccessActionDataResultINSTANCE.Read(reader),
		}
	case 2:
		return SuccessActionProcessedMessage{
			FfiConverterMessageSuccessActionDataINSTANCE.Read(reader),
		}
	case 3:
		return SuccessActionProcessedUrl{
			FfiConverterUrlSuccessActionDataINSTANCE.Read(reader),
		}
	default:
		panic(fmt.Sprintf("invalid enum value %v in FfiConverterSuccessActionProcessed.Read()", id))
	}
}

func (FfiConverterSuccessActionProcessed) Write(writer io.Writer, value SuccessActionProcessed) {
	switch variant_value := value.(type) {
	case SuccessActionProcessedAes:
		writeInt32(writer, 1)
		FfiConverterAesSuccessActionDataResultINSTANCE.Write(writer, variant_value.Result)
	case SuccessActionProcessedMessage:
		writeInt32(writer, 2)
		FfiConverterMessageSuccessActionDataINSTANCE.Write(writer, variant_value.Data)
	case SuccessActionProcessedUrl:
		writeInt32(writer, 3)
		FfiConverterUrlSuccessActionDataINSTANCE.Write(writer, variant_value.Data)
	default:
		_ = variant_value
		panic(fmt.Sprintf("invalid enum value `%v` in FfiConverterSuccessActionProcessed.Write", value))
	}
}

type FfiDestroyerSuccessActionProcessed struct{}

func (_ FfiDestroyerSuccessActionProcessed) Destroy(value SuccessActionProcessed) {
	value.Destroy()
}

type TokenTransactionType uint

const (
	TokenTransactionTypeTransfer TokenTransactionType = 1
	TokenTransactionTypeMint     TokenTransactionType = 2
	TokenTransactionTypeBurn     TokenTransactionType = 3
)

type FfiConverterTokenTransactionType struct{}

var FfiConverterTokenTransactionTypeINSTANCE = FfiConverterTokenTransactionType{}

func (c FfiConverterTokenTransactionType) Lift(rb RustBufferI) TokenTransactionType {
	return LiftFromRustBuffer[TokenTransactionType](c, rb)
}

func (c FfiConverterTokenTransactionType) Lower(value TokenTransactionType) C.RustBuffer {
	return LowerIntoRustBuffer[TokenTransactionType](c, value)
}

func (c FfiConverterTokenTransactionType) LowerExternal(value TokenTransactionType) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[TokenTransactionType](c, value))
}
func (FfiConverterTokenTransactionType) Read(reader io.Reader) TokenTransactionType {
	id := readInt32(reader)
	return TokenTransactionType(id)
}

func (FfiConverterTokenTransactionType) Write(writer io.Writer, value TokenTransactionType) {
	writeInt32(writer, int32(value))
}

type FfiDestroyerTokenTransactionType struct{}

func (_ FfiDestroyerTokenTransactionType) Destroy(value TokenTransactionType) {
}

type UpdateDepositPayload interface {
	Destroy()
}
type UpdateDepositPayloadClaimError struct {
	Error DepositClaimError
}

func (e UpdateDepositPayloadClaimError) Destroy() {
	FfiDestroyerDepositClaimError{}.Destroy(e.Error)
}

type UpdateDepositPayloadRefund struct {
	RefundTxid string
	RefundTx   string
}

func (e UpdateDepositPayloadRefund) Destroy() {
	FfiDestroyerString{}.Destroy(e.RefundTxid)
	FfiDestroyerString{}.Destroy(e.RefundTx)
}

type FfiConverterUpdateDepositPayload struct{}

var FfiConverterUpdateDepositPayloadINSTANCE = FfiConverterUpdateDepositPayload{}

func (c FfiConverterUpdateDepositPayload) Lift(rb RustBufferI) UpdateDepositPayload {
	return LiftFromRustBuffer[UpdateDepositPayload](c, rb)
}

func (c FfiConverterUpdateDepositPayload) Lower(value UpdateDepositPayload) C.RustBuffer {
	return LowerIntoRustBuffer[UpdateDepositPayload](c, value)
}

func (c FfiConverterUpdateDepositPayload) LowerExternal(value UpdateDepositPayload) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[UpdateDepositPayload](c, value))
}
func (FfiConverterUpdateDepositPayload) Read(reader io.Reader) UpdateDepositPayload {
	id := readInt32(reader)
	switch id {
	case 1:
		return UpdateDepositPayloadClaimError{
			FfiConverterDepositClaimErrorINSTANCE.Read(reader),
		}
	case 2:
		return UpdateDepositPayloadRefund{
			FfiConverterStringINSTANCE.Read(reader),
			FfiConverterStringINSTANCE.Read(reader),
		}
	default:
		panic(fmt.Sprintf("invalid enum value %v in FfiConverterUpdateDepositPayload.Read()", id))
	}
}

func (FfiConverterUpdateDepositPayload) Write(writer io.Writer, value UpdateDepositPayload) {
	switch variant_value := value.(type) {
	case UpdateDepositPayloadClaimError:
		writeInt32(writer, 1)
		FfiConverterDepositClaimErrorINSTANCE.Write(writer, variant_value.Error)
	case UpdateDepositPayloadRefund:
		writeInt32(writer, 2)
		FfiConverterStringINSTANCE.Write(writer, variant_value.RefundTxid)
		FfiConverterStringINSTANCE.Write(writer, variant_value.RefundTx)
	default:
		_ = variant_value
		panic(fmt.Sprintf("invalid enum value `%v` in FfiConverterUpdateDepositPayload.Write", value))
	}
}

type FfiDestroyerUpdateDepositPayload struct{}

func (_ FfiDestroyerUpdateDepositPayload) Destroy(value UpdateDepositPayload) {
	value.Destroy()
}

// The type of event that triggers a webhook notification.
type WebhookEventType interface {
	Destroy()
}

// Triggered when a Lightning receive operation completes.
type WebhookEventTypeLightningReceiveFinished struct {
}

func (e WebhookEventTypeLightningReceiveFinished) Destroy() {
}

// Triggered when a Lightning send operation completes.
type WebhookEventTypeLightningSendFinished struct {
}

func (e WebhookEventTypeLightningSendFinished) Destroy() {
}

// Triggered when a cooperative exit completes.
type WebhookEventTypeCoopExitFinished struct {
}

func (e WebhookEventTypeCoopExitFinished) Destroy() {
}

// Triggered when a static deposit completes.
type WebhookEventTypeStaticDepositFinished struct {
}

func (e WebhookEventTypeStaticDepositFinished) Destroy() {
}

// An event type not yet recognized by this version of the SDK.
type WebhookEventTypeUnknown struct {
	Field0 string
}

func (e WebhookEventTypeUnknown) Destroy() {
	FfiDestroyerString{}.Destroy(e.Field0)
}

type FfiConverterWebhookEventType struct{}

var FfiConverterWebhookEventTypeINSTANCE = FfiConverterWebhookEventType{}

func (c FfiConverterWebhookEventType) Lift(rb RustBufferI) WebhookEventType {
	return LiftFromRustBuffer[WebhookEventType](c, rb)
}

func (c FfiConverterWebhookEventType) Lower(value WebhookEventType) C.RustBuffer {
	return LowerIntoRustBuffer[WebhookEventType](c, value)
}

func (c FfiConverterWebhookEventType) LowerExternal(value WebhookEventType) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[WebhookEventType](c, value))
}
func (FfiConverterWebhookEventType) Read(reader io.Reader) WebhookEventType {
	id := readInt32(reader)
	switch id {
	case 1:
		return WebhookEventTypeLightningReceiveFinished{}
	case 2:
		return WebhookEventTypeLightningSendFinished{}
	case 3:
		return WebhookEventTypeCoopExitFinished{}
	case 4:
		return WebhookEventTypeStaticDepositFinished{}
	case 5:
		return WebhookEventTypeUnknown{
			FfiConverterStringINSTANCE.Read(reader),
		}
	default:
		panic(fmt.Sprintf("invalid enum value %v in FfiConverterWebhookEventType.Read()", id))
	}
}

func (FfiConverterWebhookEventType) Write(writer io.Writer, value WebhookEventType) {
	switch variant_value := value.(type) {
	case WebhookEventTypeLightningReceiveFinished:
		writeInt32(writer, 1)
	case WebhookEventTypeLightningSendFinished:
		writeInt32(writer, 2)
	case WebhookEventTypeCoopExitFinished:
		writeInt32(writer, 3)
	case WebhookEventTypeStaticDepositFinished:
		writeInt32(writer, 4)
	case WebhookEventTypeUnknown:
		writeInt32(writer, 5)
		FfiConverterStringINSTANCE.Write(writer, variant_value.Field0)
	default:
		_ = variant_value
		panic(fmt.Sprintf("invalid enum value `%v` in FfiConverterWebhookEventType.Write", value))
	}
}

type FfiDestroyerWebhookEventType struct{}

func (_ FfiDestroyerWebhookEventType) Destroy(value WebhookEventType) {
	value.Destroy()
}

// Trait for event listeners
type EventListener interface {

	// Called when an event occurs
	OnEvent(event SdkEvent)
}

type FfiConverterCallbackInterfaceEventListener struct {
	handleMap *concurrentHandleMap[EventListener]
}

var FfiConverterCallbackInterfaceEventListenerINSTANCE = FfiConverterCallbackInterfaceEventListener{
	handleMap: newConcurrentHandleMap[EventListener](),
}

func (c FfiConverterCallbackInterfaceEventListener) Lift(handle uint64) EventListener {
	val, ok := c.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}
	return val
}

func (c FfiConverterCallbackInterfaceEventListener) Read(reader io.Reader) EventListener {
	return c.Lift(readUint64(reader))
}

func (c FfiConverterCallbackInterfaceEventListener) Lower(value EventListener) C.uint64_t {
	return C.uint64_t(c.handleMap.insert(value))
}

func (c FfiConverterCallbackInterfaceEventListener) Write(writer io.Writer, value EventListener) {
	writeUint64(writer, uint64(c.Lower(value)))
}

type FfiDestroyerCallbackInterfaceEventListener struct{}

func (FfiDestroyerCallbackInterfaceEventListener) Destroy(value EventListener) {}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceEventListenerMethod0
func breez_sdk_spark_cgo_dispatchCallbackInterfaceEventListenerMethod0(uniffiHandle C.uint64_t, event C.RustBuffer, uniffiFutureCallback C.UniffiForeignFutureCompleteVoid, uniffiCallbackData C.uint64_t, uniffiOutReturn *C.UniffiForeignFuture) {
	handle := uint64(uniffiHandle)
	uniffiObj, ok := FfiConverterCallbackInterfaceEventListenerINSTANCE.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}

	result := make(chan C.UniffiForeignFutureStructVoid, 1)
	cancel := make(chan struct{}, 1)
	guardHandle := cgo.NewHandle(cancel)
	*uniffiOutReturn = C.UniffiForeignFuture{
		handle: C.uint64_t(guardHandle),
		free:   C.UniffiForeignFutureFree(C.breez_sdk_spark_uniffiFreeGorutine),
	}

	// Wait for compleation or cancel
	go func() {
		select {
		case <-cancel:
		case res := <-result:
			C.call_UniffiForeignFutureCompleteVoid(uniffiFutureCallback, uniffiCallbackData, res)
		}
	}()

	// Eval callback asynchroniously
	go func() {
		asyncResult := &C.UniffiForeignFutureStructVoid{}
		defer func() {
			result <- *asyncResult
		}()

		uniffiObj.OnEvent(
			FfiConverterSdkEventINSTANCE.Lift(GoRustBuffer{
				inner: event,
			}),
		)

	}()
}

var UniffiVTableCallbackInterfaceEventListenerINSTANCE = C.UniffiVTableCallbackInterfaceEventListener{
	onEvent: (C.UniffiCallbackInterfaceEventListenerMethod0)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceEventListenerMethod0),

	uniffiFree: (C.UniffiCallbackInterfaceFree)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceEventListenerFree),
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceEventListenerFree
func breez_sdk_spark_cgo_dispatchCallbackInterfaceEventListenerFree(handle C.uint64_t) {
	FfiConverterCallbackInterfaceEventListenerINSTANCE.handleMap.remove(uint64(handle))
}

func (c FfiConverterCallbackInterfaceEventListener) register() {
	C.uniffi_breez_sdk_spark_fn_init_callback_vtable_eventlistener(&UniffiVTableCallbackInterfaceEventListenerINSTANCE)
}

type Logger interface {
	Log(l LogEntry)
}

type FfiConverterCallbackInterfaceLogger struct {
	handleMap *concurrentHandleMap[Logger]
}

var FfiConverterCallbackInterfaceLoggerINSTANCE = FfiConverterCallbackInterfaceLogger{
	handleMap: newConcurrentHandleMap[Logger](),
}

func (c FfiConverterCallbackInterfaceLogger) Lift(handle uint64) Logger {
	val, ok := c.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}
	return val
}

func (c FfiConverterCallbackInterfaceLogger) Read(reader io.Reader) Logger {
	return c.Lift(readUint64(reader))
}

func (c FfiConverterCallbackInterfaceLogger) Lower(value Logger) C.uint64_t {
	return C.uint64_t(c.handleMap.insert(value))
}

func (c FfiConverterCallbackInterfaceLogger) Write(writer io.Writer, value Logger) {
	writeUint64(writer, uint64(c.Lower(value)))
}

type FfiDestroyerCallbackInterfaceLogger struct{}

func (FfiDestroyerCallbackInterfaceLogger) Destroy(value Logger) {}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceLoggerMethod0
func breez_sdk_spark_cgo_dispatchCallbackInterfaceLoggerMethod0(uniffiHandle C.uint64_t, l C.RustBuffer, uniffiOutReturn *C.void, callStatus *C.RustCallStatus) {
	handle := uint64(uniffiHandle)
	uniffiObj, ok := FfiConverterCallbackInterfaceLoggerINSTANCE.handleMap.tryGet(handle)
	if !ok {
		panic(fmt.Errorf("no callback in handle map: %d", handle))
	}

	uniffiObj.Log(
		FfiConverterLogEntryINSTANCE.Lift(GoRustBuffer{
			inner: l,
		}),
	)

}

var UniffiVTableCallbackInterfaceLoggerINSTANCE = C.UniffiVTableCallbackInterfaceLogger{
	log: (C.UniffiCallbackInterfaceLoggerMethod0)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceLoggerMethod0),

	uniffiFree: (C.UniffiCallbackInterfaceFree)(C.breez_sdk_spark_cgo_dispatchCallbackInterfaceLoggerFree),
}

//export breez_sdk_spark_cgo_dispatchCallbackInterfaceLoggerFree
func breez_sdk_spark_cgo_dispatchCallbackInterfaceLoggerFree(handle C.uint64_t) {
	FfiConverterCallbackInterfaceLoggerINSTANCE.handleMap.remove(uint64(handle))
}

func (c FfiConverterCallbackInterfaceLogger) register() {
	C.uniffi_breez_sdk_spark_fn_init_callback_vtable_logger(&UniffiVTableCallbackInterfaceLoggerINSTANCE)
}

type FfiConverterOptionalUint32 struct{}

var FfiConverterOptionalUint32INSTANCE = FfiConverterOptionalUint32{}

func (c FfiConverterOptionalUint32) Lift(rb RustBufferI) *uint32 {
	return LiftFromRustBuffer[*uint32](c, rb)
}

func (_ FfiConverterOptionalUint32) Read(reader io.Reader) *uint32 {
	if readInt8(reader) == 0 {
		return nil
	}
	temp := FfiConverterUint32INSTANCE.Read(reader)
	return &temp
}

func (c FfiConverterOptionalUint32) Lower(value *uint32) C.RustBuffer {
	return LowerIntoRustBuffer[*uint32](c, value)
}

func (c FfiConverterOptionalUint32) LowerExternal(value *uint32) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[*uint32](c, value))
}

func (_ FfiConverterOptionalUint32) Write(writer io.Writer, value *uint32) {
	if value == nil {
		writeInt8(writer, 0)
	} else {
		writeInt8(writer, 1)
		FfiConverterUint32INSTANCE.Write(writer, *value)
	}
}

type FfiDestroyerOptionalUint32 struct{}

func (_ FfiDestroyerOptionalUint32) Destroy(value *uint32) {
	if value != nil {
		FfiDestroyerUint32{}.Destroy(*value)
	}
}

type FfiConverterOptionalUint64 struct{}

var FfiConverterOptionalUint64INSTANCE = FfiConverterOptionalUint64{}

func (c FfiConverterOptionalUint64) Lift(rb RustBufferI) *uint64 {
	return LiftFromRustBuffer[*uint64](c, rb)
}

func (_ FfiConverterOptionalUint64) Read(reader io.Reader) *uint64 {
	if readInt8(reader) == 0 {
		return nil
	}
	temp := FfiConverterUint64INSTANCE.Read(reader)
	return &temp
}

func (c FfiConverterOptionalUint64) Lower(value *uint64) C.RustBuffer {
	return LowerIntoRustBuffer[*uint64](c, value)
}

func (c FfiConverterOptionalUint64) LowerExternal(value *uint64) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[*uint64](c, value))
}

func (_ FfiConverterOptionalUint64) Write(writer io.Writer, value *uint64) {
	if value == nil {
		writeInt8(writer, 0)
	} else {
		writeInt8(writer, 1)
		FfiConverterUint64INSTANCE.Write(writer, *value)
	}
}

type FfiDestroyerOptionalUint64 struct{}

func (_ FfiDestroyerOptionalUint64) Destroy(value *uint64) {
	if value != nil {
		FfiDestroyerUint64{}.Destroy(*value)
	}
}

type FfiConverterOptionalBool struct{}

var FfiConverterOptionalBoolINSTANCE = FfiConverterOptionalBool{}

func (c FfiConverterOptionalBool) Lift(rb RustBufferI) *bool {
	return LiftFromRustBuffer[*bool](c, rb)
}

func (_ FfiConverterOptionalBool) Read(reader io.Reader) *bool {
	if readInt8(reader) == 0 {
		return nil
	}
	temp := FfiConverterBoolINSTANCE.Read(reader)
	return &temp
}

func (c FfiConverterOptionalBool) Lower(value *bool) C.RustBuffer {
	return LowerIntoRustBuffer[*bool](c, value)
}

func (c FfiConverterOptionalBool) LowerExternal(value *bool) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[*bool](c, value))
}

func (_ FfiConverterOptionalBool) Write(writer io.Writer, value *bool) {
	if value == nil {
		writeInt8(writer, 0)
	} else {
		writeInt8(writer, 1)
		FfiConverterBoolINSTANCE.Write(writer, *value)
	}
}

type FfiDestroyerOptionalBool struct{}

func (_ FfiDestroyerOptionalBool) Destroy(value *bool) {
	if value != nil {
		FfiDestroyerBool{}.Destroy(*value)
	}
}

type FfiConverterOptionalString struct{}

var FfiConverterOptionalStringINSTANCE = FfiConverterOptionalString{}

func (c FfiConverterOptionalString) Lift(rb RustBufferI) *string {
	return LiftFromRustBuffer[*string](c, rb)
}

func (_ FfiConverterOptionalString) Read(reader io.Reader) *string {
	if readInt8(reader) == 0 {
		return nil
	}
	temp := FfiConverterStringINSTANCE.Read(reader)
	return &temp
}

func (c FfiConverterOptionalString) Lower(value *string) C.RustBuffer {
	return LowerIntoRustBuffer[*string](c, value)
}

func (c FfiConverterOptionalString) LowerExternal(value *string) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[*string](c, value))
}

func (_ FfiConverterOptionalString) Write(writer io.Writer, value *string) {
	if value == nil {
		writeInt8(writer, 0)
	} else {
		writeInt8(writer, 1)
		FfiConverterStringINSTANCE.Write(writer, *value)
	}
}

type FfiDestroyerOptionalString struct{}

func (_ FfiDestroyerOptionalString) Destroy(value *string) {
	if value != nil {
		FfiDestroyerString{}.Destroy(*value)
	}
}

type FfiConverterOptionalBytes struct{}

var FfiConverterOptionalBytesINSTANCE = FfiConverterOptionalBytes{}

func (c FfiConverterOptionalBytes) Lift(rb RustBufferI) *[]byte {
	return LiftFromRustBuffer[*[]byte](c, rb)
}

func (_ FfiConverterOptionalBytes) Read(reader io.Reader) *[]byte {
	if readInt8(reader) == 0 {
		return nil
	}
	temp := FfiConverterBytesINSTANCE.Read(reader)
	return &temp
}

func (c FfiConverterOptionalBytes) Lower(value *[]byte) C.RustBuffer {
	return LowerIntoRustBuffer[*[]byte](c, value)
}

func (c FfiConverterOptionalBytes) LowerExternal(value *[]byte) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[*[]byte](c, value))
}

func (_ FfiConverterOptionalBytes) Write(writer io.Writer, value *[]byte) {
	if value == nil {
		writeInt8(writer, 0)
	} else {
		writeInt8(writer, 1)
		FfiConverterBytesINSTANCE.Write(writer, *value)
	}
}

type FfiDestroyerOptionalBytes struct{}

func (_ FfiDestroyerOptionalBytes) Destroy(value *[]byte) {
	if value != nil {
		FfiDestroyerBytes{}.Destroy(*value)
	}
}

type FfiConverterOptionalConversionDetails struct{}

var FfiConverterOptionalConversionDetailsINSTANCE = FfiConverterOptionalConversionDetails{}

func (c FfiConverterOptionalConversionDetails) Lift(rb RustBufferI) *ConversionDetails {
	return LiftFromRustBuffer[*ConversionDetails](c, rb)
}

func (_ FfiConverterOptionalConversionDetails) Read(reader io.Reader) *ConversionDetails {
	if readInt8(reader) == 0 {
		return nil
	}
	temp := FfiConverterConversionDetailsINSTANCE.Read(reader)
	return &temp
}

func (c FfiConverterOptionalConversionDetails) Lower(value *ConversionDetails) C.RustBuffer {
	return LowerIntoRustBuffer[*ConversionDetails](c, value)
}

func (c FfiConverterOptionalConversionDetails) LowerExternal(value *ConversionDetails) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[*ConversionDetails](c, value))
}

func (_ FfiConverterOptionalConversionDetails) Write(writer io.Writer, value *ConversionDetails) {
	if value == nil {
		writeInt8(writer, 0)
	} else {
		writeInt8(writer, 1)
		FfiConverterConversionDetailsINSTANCE.Write(writer, *value)
	}
}

type FfiDestroyerOptionalConversionDetails struct{}

func (_ FfiDestroyerOptionalConversionDetails) Destroy(value *ConversionDetails) {
	if value != nil {
		FfiDestroyerConversionDetails{}.Destroy(*value)
	}
}

type FfiConverterOptionalConversionEstimate struct{}

var FfiConverterOptionalConversionEstimateINSTANCE = FfiConverterOptionalConversionEstimate{}

func (c FfiConverterOptionalConversionEstimate) Lift(rb RustBufferI) *ConversionEstimate {
	return LiftFromRustBuffer[*ConversionEstimate](c, rb)
}

func (_ FfiConverterOptionalConversionEstimate) Read(reader io.Reader) *ConversionEstimate {
	if readInt8(reader) == 0 {
		return nil
	}
	temp := FfiConverterConversionEstimateINSTANCE.Read(reader)
	return &temp
}

func (c FfiConverterOptionalConversionEstimate) Lower(value *ConversionEstimate) C.RustBuffer {
	return LowerIntoRustBuffer[*ConversionEstimate](c, value)
}

func (c FfiConverterOptionalConversionEstimate) LowerExternal(value *ConversionEstimate) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[*ConversionEstimate](c, value))
}

func (_ FfiConverterOptionalConversionEstimate) Write(writer io.Writer, value *ConversionEstimate) {
	if value == nil {
		writeInt8(writer, 0)
	} else {
		writeInt8(writer, 1)
		FfiConverterConversionEstimateINSTANCE.Write(writer, *value)
	}
}

type FfiDestroyerOptionalConversionEstimate struct{}

func (_ FfiDestroyerOptionalConversionEstimate) Destroy(value *ConversionEstimate) {
	if value != nil {
		FfiDestroyerConversionEstimate{}.Destroy(*value)
	}
}

type FfiConverterOptionalConversionInfo struct{}

var FfiConverterOptionalConversionInfoINSTANCE = FfiConverterOptionalConversionInfo{}

func (c FfiConverterOptionalConversionInfo) Lift(rb RustBufferI) *ConversionInfo {
	return LiftFromRustBuffer[*ConversionInfo](c, rb)
}

func (_ FfiConverterOptionalConversionInfo) Read(reader io.Reader) *ConversionInfo {
	if readInt8(reader) == 0 {
		return nil
	}
	temp := FfiConverterConversionInfoINSTANCE.Read(reader)
	return &temp
}

func (c FfiConverterOptionalConversionInfo) Lower(value *ConversionInfo) C.RustBuffer {
	return LowerIntoRustBuffer[*ConversionInfo](c, value)
}

func (c FfiConverterOptionalConversionInfo) LowerExternal(value *ConversionInfo) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[*ConversionInfo](c, value))
}

func (_ FfiConverterOptionalConversionInfo) Write(writer io.Writer, value *ConversionInfo) {
	if value == nil {
		writeInt8(writer, 0)
	} else {
		writeInt8(writer, 1)
		FfiConverterConversionInfoINSTANCE.Write(writer, *value)
	}
}

type FfiDestroyerOptionalConversionInfo struct{}

func (_ FfiDestroyerOptionalConversionInfo) Destroy(value *ConversionInfo) {
	if value != nil {
		FfiDestroyerConversionInfo{}.Destroy(*value)
	}
}

type FfiConverterOptionalConversionOptions struct{}

var FfiConverterOptionalConversionOptionsINSTANCE = FfiConverterOptionalConversionOptions{}

func (c FfiConverterOptionalConversionOptions) Lift(rb RustBufferI) *ConversionOptions {
	return LiftFromRustBuffer[*ConversionOptions](c, rb)
}

func (_ FfiConverterOptionalConversionOptions) Read(reader io.Reader) *ConversionOptions {
	if readInt8(reader) == 0 {
		return nil
	}
	temp := FfiConverterConversionOptionsINSTANCE.Read(reader)
	return &temp
}

func (c FfiConverterOptionalConversionOptions) Lower(value *ConversionOptions) C.RustBuffer {
	return LowerIntoRustBuffer[*ConversionOptions](c, value)
}

func (c FfiConverterOptionalConversionOptions) LowerExternal(value *ConversionOptions) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[*ConversionOptions](c, value))
}

func (_ FfiConverterOptionalConversionOptions) Write(writer io.Writer, value *ConversionOptions) {
	if value == nil {
		writeInt8(writer, 0)
	} else {
		writeInt8(writer, 1)
		FfiConverterConversionOptionsINSTANCE.Write(writer, *value)
	}
}

type FfiDestroyerOptionalConversionOptions struct{}

func (_ FfiDestroyerOptionalConversionOptions) Destroy(value *ConversionOptions) {
	if value != nil {
		FfiDestroyerConversionOptions{}.Destroy(*value)
	}
}

type FfiConverterOptionalConversionStep struct{}

var FfiConverterOptionalConversionStepINSTANCE = FfiConverterOptionalConversionStep{}

func (c FfiConverterOptionalConversionStep) Lift(rb RustBufferI) *ConversionStep {
	return LiftFromRustBuffer[*ConversionStep](c, rb)
}

func (_ FfiConverterOptionalConversionStep) Read(reader io.Reader) *ConversionStep {
	if readInt8(reader) == 0 {
		return nil
	}
	temp := FfiConverterConversionStepINSTANCE.Read(reader)
	return &temp
}

func (c FfiConverterOptionalConversionStep) Lower(value *ConversionStep) C.RustBuffer {
	return LowerIntoRustBuffer[*ConversionStep](c, value)
}

func (c FfiConverterOptionalConversionStep) LowerExternal(value *ConversionStep) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[*ConversionStep](c, value))
}

func (_ FfiConverterOptionalConversionStep) Write(writer io.Writer, value *ConversionStep) {
	if value == nil {
		writeInt8(writer, 0)
	} else {
		writeInt8(writer, 1)
		FfiConverterConversionStepINSTANCE.Write(writer, *value)
	}
}

type FfiDestroyerOptionalConversionStep struct{}

func (_ FfiDestroyerOptionalConversionStep) Destroy(value *ConversionStep) {
	if value != nil {
		FfiDestroyerConversionStep{}.Destroy(*value)
	}
}

type FfiConverterOptionalCredentials struct{}

var FfiConverterOptionalCredentialsINSTANCE = FfiConverterOptionalCredentials{}

func (c FfiConverterOptionalCredentials) Lift(rb RustBufferI) *Credentials {
	return LiftFromRustBuffer[*Credentials](c, rb)
}

func (_ FfiConverterOptionalCredentials) Read(reader io.Reader) *Credentials {
	if readInt8(reader) == 0 {
		return nil
	}
	temp := FfiConverterCredentialsINSTANCE.Read(reader)
	return &temp
}

func (c FfiConverterOptionalCredentials) Lower(value *Credentials) C.RustBuffer {
	return LowerIntoRustBuffer[*Credentials](c, value)
}

func (c FfiConverterOptionalCredentials) LowerExternal(value *Credentials) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[*Credentials](c, value))
}

func (_ FfiConverterOptionalCredentials) Write(writer io.Writer, value *Credentials) {
	if value == nil {
		writeInt8(writer, 0)
	} else {
		writeInt8(writer, 1)
		FfiConverterCredentialsINSTANCE.Write(writer, *value)
	}
}

type FfiDestroyerOptionalCredentials struct{}

func (_ FfiDestroyerOptionalCredentials) Destroy(value *Credentials) {
	if value != nil {
		FfiDestroyerCredentials{}.Destroy(*value)
	}
}

type FfiConverterOptionalKeySetConfig struct{}

var FfiConverterOptionalKeySetConfigINSTANCE = FfiConverterOptionalKeySetConfig{}

func (c FfiConverterOptionalKeySetConfig) Lift(rb RustBufferI) *KeySetConfig {
	return LiftFromRustBuffer[*KeySetConfig](c, rb)
}

func (_ FfiConverterOptionalKeySetConfig) Read(reader io.Reader) *KeySetConfig {
	if readInt8(reader) == 0 {
		return nil
	}
	temp := FfiConverterKeySetConfigINSTANCE.Read(reader)
	return &temp
}

func (c FfiConverterOptionalKeySetConfig) Lower(value *KeySetConfig) C.RustBuffer {
	return LowerIntoRustBuffer[*KeySetConfig](c, value)
}

func (c FfiConverterOptionalKeySetConfig) LowerExternal(value *KeySetConfig) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[*KeySetConfig](c, value))
}

func (_ FfiConverterOptionalKeySetConfig) Write(writer io.Writer, value *KeySetConfig) {
	if value == nil {
		writeInt8(writer, 0)
	} else {
		writeInt8(writer, 1)
		FfiConverterKeySetConfigINSTANCE.Write(writer, *value)
	}
}

type FfiDestroyerOptionalKeySetConfig struct{}

func (_ FfiDestroyerOptionalKeySetConfig) Destroy(value *KeySetConfig) {
	if value != nil {
		FfiDestroyerKeySetConfig{}.Destroy(*value)
	}
}

type FfiConverterOptionalLightningAddressInfo struct{}

var FfiConverterOptionalLightningAddressInfoINSTANCE = FfiConverterOptionalLightningAddressInfo{}

func (c FfiConverterOptionalLightningAddressInfo) Lift(rb RustBufferI) *LightningAddressInfo {
	return LiftFromRustBuffer[*LightningAddressInfo](c, rb)
}

func (_ FfiConverterOptionalLightningAddressInfo) Read(reader io.Reader) *LightningAddressInfo {
	if readInt8(reader) == 0 {
		return nil
	}
	temp := FfiConverterLightningAddressInfoINSTANCE.Read(reader)
	return &temp
}

func (c FfiConverterOptionalLightningAddressInfo) Lower(value *LightningAddressInfo) C.RustBuffer {
	return LowerIntoRustBuffer[*LightningAddressInfo](c, value)
}

func (c FfiConverterOptionalLightningAddressInfo) LowerExternal(value *LightningAddressInfo) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[*LightningAddressInfo](c, value))
}

func (_ FfiConverterOptionalLightningAddressInfo) Write(writer io.Writer, value *LightningAddressInfo) {
	if value == nil {
		writeInt8(writer, 0)
	} else {
		writeInt8(writer, 1)
		FfiConverterLightningAddressInfoINSTANCE.Write(writer, *value)
	}
}

type FfiDestroyerOptionalLightningAddressInfo struct{}

func (_ FfiDestroyerOptionalLightningAddressInfo) Destroy(value *LightningAddressInfo) {
	if value != nil {
		FfiDestroyerLightningAddressInfo{}.Destroy(*value)
	}
}

type FfiConverterOptionalLnurlPayInfo struct{}

var FfiConverterOptionalLnurlPayInfoINSTANCE = FfiConverterOptionalLnurlPayInfo{}

func (c FfiConverterOptionalLnurlPayInfo) Lift(rb RustBufferI) *LnurlPayInfo {
	return LiftFromRustBuffer[*LnurlPayInfo](c, rb)
}

func (_ FfiConverterOptionalLnurlPayInfo) Read(reader io.Reader) *LnurlPayInfo {
	if readInt8(reader) == 0 {
		return nil
	}
	temp := FfiConverterLnurlPayInfoINSTANCE.Read(reader)
	return &temp
}

func (c FfiConverterOptionalLnurlPayInfo) Lower(value *LnurlPayInfo) C.RustBuffer {
	return LowerIntoRustBuffer[*LnurlPayInfo](c, value)
}

func (c FfiConverterOptionalLnurlPayInfo) LowerExternal(value *LnurlPayInfo) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[*LnurlPayInfo](c, value))
}

func (_ FfiConverterOptionalLnurlPayInfo) Write(writer io.Writer, value *LnurlPayInfo) {
	if value == nil {
		writeInt8(writer, 0)
	} else {
		writeInt8(writer, 1)
		FfiConverterLnurlPayInfoINSTANCE.Write(writer, *value)
	}
}

type FfiDestroyerOptionalLnurlPayInfo struct{}

func (_ FfiDestroyerOptionalLnurlPayInfo) Destroy(value *LnurlPayInfo) {
	if value != nil {
		FfiDestroyerLnurlPayInfo{}.Destroy(*value)
	}
}

type FfiConverterOptionalLnurlReceiveMetadata struct{}

var FfiConverterOptionalLnurlReceiveMetadataINSTANCE = FfiConverterOptionalLnurlReceiveMetadata{}

func (c FfiConverterOptionalLnurlReceiveMetadata) Lift(rb RustBufferI) *LnurlReceiveMetadata {
	return LiftFromRustBuffer[*LnurlReceiveMetadata](c, rb)
}

func (_ FfiConverterOptionalLnurlReceiveMetadata) Read(reader io.Reader) *LnurlReceiveMetadata {
	if readInt8(reader) == 0 {
		return nil
	}
	temp := FfiConverterLnurlReceiveMetadataINSTANCE.Read(reader)
	return &temp
}

func (c FfiConverterOptionalLnurlReceiveMetadata) Lower(value *LnurlReceiveMetadata) C.RustBuffer {
	return LowerIntoRustBuffer[*LnurlReceiveMetadata](c, value)
}

func (c FfiConverterOptionalLnurlReceiveMetadata) LowerExternal(value *LnurlReceiveMetadata) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[*LnurlReceiveMetadata](c, value))
}

func (_ FfiConverterOptionalLnurlReceiveMetadata) Write(writer io.Writer, value *LnurlReceiveMetadata) {
	if value == nil {
		writeInt8(writer, 0)
	} else {
		writeInt8(writer, 1)
		FfiConverterLnurlReceiveMetadataINSTANCE.Write(writer, *value)
	}
}

type FfiDestroyerOptionalLnurlReceiveMetadata struct{}

func (_ FfiDestroyerOptionalLnurlReceiveMetadata) Destroy(value *LnurlReceiveMetadata) {
	if value != nil {
		FfiDestroyerLnurlReceiveMetadata{}.Destroy(*value)
	}
}

type FfiConverterOptionalLnurlWithdrawInfo struct{}

var FfiConverterOptionalLnurlWithdrawInfoINSTANCE = FfiConverterOptionalLnurlWithdrawInfo{}

func (c FfiConverterOptionalLnurlWithdrawInfo) Lift(rb RustBufferI) *LnurlWithdrawInfo {
	return LiftFromRustBuffer[*LnurlWithdrawInfo](c, rb)
}

func (_ FfiConverterOptionalLnurlWithdrawInfo) Read(reader io.Reader) *LnurlWithdrawInfo {
	if readInt8(reader) == 0 {
		return nil
	}
	temp := FfiConverterLnurlWithdrawInfoINSTANCE.Read(reader)
	return &temp
}

func (c FfiConverterOptionalLnurlWithdrawInfo) Lower(value *LnurlWithdrawInfo) C.RustBuffer {
	return LowerIntoRustBuffer[*LnurlWithdrawInfo](c, value)
}

func (c FfiConverterOptionalLnurlWithdrawInfo) LowerExternal(value *LnurlWithdrawInfo) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[*LnurlWithdrawInfo](c, value))
}

func (_ FfiConverterOptionalLnurlWithdrawInfo) Write(writer io.Writer, value *LnurlWithdrawInfo) {
	if value == nil {
		writeInt8(writer, 0)
	} else {
		writeInt8(writer, 1)
		FfiConverterLnurlWithdrawInfoINSTANCE.Write(writer, *value)
	}
}

type FfiDestroyerOptionalLnurlWithdrawInfo struct{}

func (_ FfiDestroyerOptionalLnurlWithdrawInfo) Destroy(value *LnurlWithdrawInfo) {
	if value != nil {
		FfiDestroyerLnurlWithdrawInfo{}.Destroy(*value)
	}
}

type FfiConverterOptionalNostrRelayConfig struct{}

var FfiConverterOptionalNostrRelayConfigINSTANCE = FfiConverterOptionalNostrRelayConfig{}

func (c FfiConverterOptionalNostrRelayConfig) Lift(rb RustBufferI) *NostrRelayConfig {
	return LiftFromRustBuffer[*NostrRelayConfig](c, rb)
}

func (_ FfiConverterOptionalNostrRelayConfig) Read(reader io.Reader) *NostrRelayConfig {
	if readInt8(reader) == 0 {
		return nil
	}
	temp := FfiConverterNostrRelayConfigINSTANCE.Read(reader)
	return &temp
}

func (c FfiConverterOptionalNostrRelayConfig) Lower(value *NostrRelayConfig) C.RustBuffer {
	return LowerIntoRustBuffer[*NostrRelayConfig](c, value)
}

func (c FfiConverterOptionalNostrRelayConfig) LowerExternal(value *NostrRelayConfig) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[*NostrRelayConfig](c, value))
}

func (_ FfiConverterOptionalNostrRelayConfig) Write(writer io.Writer, value *NostrRelayConfig) {
	if value == nil {
		writeInt8(writer, 0)
	} else {
		writeInt8(writer, 1)
		FfiConverterNostrRelayConfigINSTANCE.Write(writer, *value)
	}
}

type FfiDestroyerOptionalNostrRelayConfig struct{}

func (_ FfiDestroyerOptionalNostrRelayConfig) Destroy(value *NostrRelayConfig) {
	if value != nil {
		FfiDestroyerNostrRelayConfig{}.Destroy(*value)
	}
}

type FfiConverterOptionalOutgoingChange struct{}

var FfiConverterOptionalOutgoingChangeINSTANCE = FfiConverterOptionalOutgoingChange{}

func (c FfiConverterOptionalOutgoingChange) Lift(rb RustBufferI) *OutgoingChange {
	return LiftFromRustBuffer[*OutgoingChange](c, rb)
}

func (_ FfiConverterOptionalOutgoingChange) Read(reader io.Reader) *OutgoingChange {
	if readInt8(reader) == 0 {
		return nil
	}
	temp := FfiConverterOutgoingChangeINSTANCE.Read(reader)
	return &temp
}

func (c FfiConverterOptionalOutgoingChange) Lower(value *OutgoingChange) C.RustBuffer {
	return LowerIntoRustBuffer[*OutgoingChange](c, value)
}

func (c FfiConverterOptionalOutgoingChange) LowerExternal(value *OutgoingChange) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[*OutgoingChange](c, value))
}

func (_ FfiConverterOptionalOutgoingChange) Write(writer io.Writer, value *OutgoingChange) {
	if value == nil {
		writeInt8(writer, 0)
	} else {
		writeInt8(writer, 1)
		FfiConverterOutgoingChangeINSTANCE.Write(writer, *value)
	}
}

type FfiDestroyerOptionalOutgoingChange struct{}

func (_ FfiDestroyerOptionalOutgoingChange) Destroy(value *OutgoingChange) {
	if value != nil {
		FfiDestroyerOutgoingChange{}.Destroy(*value)
	}
}

type FfiConverterOptionalPayment struct{}

var FfiConverterOptionalPaymentINSTANCE = FfiConverterOptionalPayment{}

func (c FfiConverterOptionalPayment) Lift(rb RustBufferI) *Payment {
	return LiftFromRustBuffer[*Payment](c, rb)
}

func (_ FfiConverterOptionalPayment) Read(reader io.Reader) *Payment {
	if readInt8(reader) == 0 {
		return nil
	}
	temp := FfiConverterPaymentINSTANCE.Read(reader)
	return &temp
}

func (c FfiConverterOptionalPayment) Lower(value *Payment) C.RustBuffer {
	return LowerIntoRustBuffer[*Payment](c, value)
}

func (c FfiConverterOptionalPayment) LowerExternal(value *Payment) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[*Payment](c, value))
}

func (_ FfiConverterOptionalPayment) Write(writer io.Writer, value *Payment) {
	if value == nil {
		writeInt8(writer, 0)
	} else {
		writeInt8(writer, 1)
		FfiConverterPaymentINSTANCE.Write(writer, *value)
	}
}

type FfiDestroyerOptionalPayment struct{}

func (_ FfiDestroyerOptionalPayment) Destroy(value *Payment) {
	if value != nil {
		FfiDestroyerPayment{}.Destroy(*value)
	}
}

type FfiConverterOptionalRecord struct{}

var FfiConverterOptionalRecordINSTANCE = FfiConverterOptionalRecord{}

func (c FfiConverterOptionalRecord) Lift(rb RustBufferI) *Record {
	return LiftFromRustBuffer[*Record](c, rb)
}

func (_ FfiConverterOptionalRecord) Read(reader io.Reader) *Record {
	if readInt8(reader) == 0 {
		return nil
	}
	temp := FfiConverterRecordINSTANCE.Read(reader)
	return &temp
}

func (c FfiConverterOptionalRecord) Lower(value *Record) C.RustBuffer {
	return LowerIntoRustBuffer[*Record](c, value)
}

func (c FfiConverterOptionalRecord) LowerExternal(value *Record) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[*Record](c, value))
}

func (_ FfiConverterOptionalRecord) Write(writer io.Writer, value *Record) {
	if value == nil {
		writeInt8(writer, 0)
	} else {
		writeInt8(writer, 1)
		FfiConverterRecordINSTANCE.Write(writer, *value)
	}
}

type FfiDestroyerOptionalRecord struct{}

func (_ FfiDestroyerOptionalRecord) Destroy(value *Record) {
	if value != nil {
		FfiDestroyerRecord{}.Destroy(*value)
	}
}

type FfiConverterOptionalSparkConfig struct{}

var FfiConverterOptionalSparkConfigINSTANCE = FfiConverterOptionalSparkConfig{}

func (c FfiConverterOptionalSparkConfig) Lift(rb RustBufferI) *SparkConfig {
	return LiftFromRustBuffer[*SparkConfig](c, rb)
}

func (_ FfiConverterOptionalSparkConfig) Read(reader io.Reader) *SparkConfig {
	if readInt8(reader) == 0 {
		return nil
	}
	temp := FfiConverterSparkConfigINSTANCE.Read(reader)
	return &temp
}

func (c FfiConverterOptionalSparkConfig) Lower(value *SparkConfig) C.RustBuffer {
	return LowerIntoRustBuffer[*SparkConfig](c, value)
}

func (c FfiConverterOptionalSparkConfig) LowerExternal(value *SparkConfig) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[*SparkConfig](c, value))
}

func (_ FfiConverterOptionalSparkConfig) Write(writer io.Writer, value *SparkConfig) {
	if value == nil {
		writeInt8(writer, 0)
	} else {
		writeInt8(writer, 1)
		FfiConverterSparkConfigINSTANCE.Write(writer, *value)
	}
}

type FfiDestroyerOptionalSparkConfig struct{}

func (_ FfiDestroyerOptionalSparkConfig) Destroy(value *SparkConfig) {
	if value != nil {
		FfiDestroyerSparkConfig{}.Destroy(*value)
	}
}

type FfiConverterOptionalSparkHtlcDetails struct{}

var FfiConverterOptionalSparkHtlcDetailsINSTANCE = FfiConverterOptionalSparkHtlcDetails{}

func (c FfiConverterOptionalSparkHtlcDetails) Lift(rb RustBufferI) *SparkHtlcDetails {
	return LiftFromRustBuffer[*SparkHtlcDetails](c, rb)
}

func (_ FfiConverterOptionalSparkHtlcDetails) Read(reader io.Reader) *SparkHtlcDetails {
	if readInt8(reader) == 0 {
		return nil
	}
	temp := FfiConverterSparkHtlcDetailsINSTANCE.Read(reader)
	return &temp
}

func (c FfiConverterOptionalSparkHtlcDetails) Lower(value *SparkHtlcDetails) C.RustBuffer {
	return LowerIntoRustBuffer[*SparkHtlcDetails](c, value)
}

func (c FfiConverterOptionalSparkHtlcDetails) LowerExternal(value *SparkHtlcDetails) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[*SparkHtlcDetails](c, value))
}

func (_ FfiConverterOptionalSparkHtlcDetails) Write(writer io.Writer, value *SparkHtlcDetails) {
	if value == nil {
		writeInt8(writer, 0)
	} else {
		writeInt8(writer, 1)
		FfiConverterSparkHtlcDetailsINSTANCE.Write(writer, *value)
	}
}

type FfiDestroyerOptionalSparkHtlcDetails struct{}

func (_ FfiDestroyerOptionalSparkHtlcDetails) Destroy(value *SparkHtlcDetails) {
	if value != nil {
		FfiDestroyerSparkHtlcDetails{}.Destroy(*value)
	}
}

type FfiConverterOptionalSparkHtlcOptions struct{}

var FfiConverterOptionalSparkHtlcOptionsINSTANCE = FfiConverterOptionalSparkHtlcOptions{}

func (c FfiConverterOptionalSparkHtlcOptions) Lift(rb RustBufferI) *SparkHtlcOptions {
	return LiftFromRustBuffer[*SparkHtlcOptions](c, rb)
}

func (_ FfiConverterOptionalSparkHtlcOptions) Read(reader io.Reader) *SparkHtlcOptions {
	if readInt8(reader) == 0 {
		return nil
	}
	temp := FfiConverterSparkHtlcOptionsINSTANCE.Read(reader)
	return &temp
}

func (c FfiConverterOptionalSparkHtlcOptions) Lower(value *SparkHtlcOptions) C.RustBuffer {
	return LowerIntoRustBuffer[*SparkHtlcOptions](c, value)
}

func (c FfiConverterOptionalSparkHtlcOptions) LowerExternal(value *SparkHtlcOptions) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[*SparkHtlcOptions](c, value))
}

func (_ FfiConverterOptionalSparkHtlcOptions) Write(writer io.Writer, value *SparkHtlcOptions) {
	if value == nil {
		writeInt8(writer, 0)
	} else {
		writeInt8(writer, 1)
		FfiConverterSparkHtlcOptionsINSTANCE.Write(writer, *value)
	}
}

type FfiDestroyerOptionalSparkHtlcOptions struct{}

func (_ FfiDestroyerOptionalSparkHtlcOptions) Destroy(value *SparkHtlcOptions) {
	if value != nil {
		FfiDestroyerSparkHtlcOptions{}.Destroy(*value)
	}
}

type FfiConverterOptionalSparkInvoicePaymentDetails struct{}

var FfiConverterOptionalSparkInvoicePaymentDetailsINSTANCE = FfiConverterOptionalSparkInvoicePaymentDetails{}

func (c FfiConverterOptionalSparkInvoicePaymentDetails) Lift(rb RustBufferI) *SparkInvoicePaymentDetails {
	return LiftFromRustBuffer[*SparkInvoicePaymentDetails](c, rb)
}

func (_ FfiConverterOptionalSparkInvoicePaymentDetails) Read(reader io.Reader) *SparkInvoicePaymentDetails {
	if readInt8(reader) == 0 {
		return nil
	}
	temp := FfiConverterSparkInvoicePaymentDetailsINSTANCE.Read(reader)
	return &temp
}

func (c FfiConverterOptionalSparkInvoicePaymentDetails) Lower(value *SparkInvoicePaymentDetails) C.RustBuffer {
	return LowerIntoRustBuffer[*SparkInvoicePaymentDetails](c, value)
}

func (c FfiConverterOptionalSparkInvoicePaymentDetails) LowerExternal(value *SparkInvoicePaymentDetails) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[*SparkInvoicePaymentDetails](c, value))
}

func (_ FfiConverterOptionalSparkInvoicePaymentDetails) Write(writer io.Writer, value *SparkInvoicePaymentDetails) {
	if value == nil {
		writeInt8(writer, 0)
	} else {
		writeInt8(writer, 1)
		FfiConverterSparkInvoicePaymentDetailsINSTANCE.Write(writer, *value)
	}
}

type FfiDestroyerOptionalSparkInvoicePaymentDetails struct{}

func (_ FfiDestroyerOptionalSparkInvoicePaymentDetails) Destroy(value *SparkInvoicePaymentDetails) {
	if value != nil {
		FfiDestroyerSparkInvoicePaymentDetails{}.Destroy(*value)
	}
}

type FfiConverterOptionalStableBalanceConfig struct{}

var FfiConverterOptionalStableBalanceConfigINSTANCE = FfiConverterOptionalStableBalanceConfig{}

func (c FfiConverterOptionalStableBalanceConfig) Lift(rb RustBufferI) *StableBalanceConfig {
	return LiftFromRustBuffer[*StableBalanceConfig](c, rb)
}

func (_ FfiConverterOptionalStableBalanceConfig) Read(reader io.Reader) *StableBalanceConfig {
	if readInt8(reader) == 0 {
		return nil
	}
	temp := FfiConverterStableBalanceConfigINSTANCE.Read(reader)
	return &temp
}

func (c FfiConverterOptionalStableBalanceConfig) Lower(value *StableBalanceConfig) C.RustBuffer {
	return LowerIntoRustBuffer[*StableBalanceConfig](c, value)
}

func (c FfiConverterOptionalStableBalanceConfig) LowerExternal(value *StableBalanceConfig) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[*StableBalanceConfig](c, value))
}

func (_ FfiConverterOptionalStableBalanceConfig) Write(writer io.Writer, value *StableBalanceConfig) {
	if value == nil {
		writeInt8(writer, 0)
	} else {
		writeInt8(writer, 1)
		FfiConverterStableBalanceConfigINSTANCE.Write(writer, *value)
	}
}

type FfiDestroyerOptionalStableBalanceConfig struct{}

func (_ FfiDestroyerOptionalStableBalanceConfig) Destroy(value *StableBalanceConfig) {
	if value != nil {
		FfiDestroyerStableBalanceConfig{}.Destroy(*value)
	}
}

type FfiConverterOptionalSymbol struct{}

var FfiConverterOptionalSymbolINSTANCE = FfiConverterOptionalSymbol{}

func (c FfiConverterOptionalSymbol) Lift(rb RustBufferI) *Symbol {
	return LiftFromRustBuffer[*Symbol](c, rb)
}

func (_ FfiConverterOptionalSymbol) Read(reader io.Reader) *Symbol {
	if readInt8(reader) == 0 {
		return nil
	}
	temp := FfiConverterSymbolINSTANCE.Read(reader)
	return &temp
}

func (c FfiConverterOptionalSymbol) Lower(value *Symbol) C.RustBuffer {
	return LowerIntoRustBuffer[*Symbol](c, value)
}

func (c FfiConverterOptionalSymbol) LowerExternal(value *Symbol) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[*Symbol](c, value))
}

func (_ FfiConverterOptionalSymbol) Write(writer io.Writer, value *Symbol) {
	if value == nil {
		writeInt8(writer, 0)
	} else {
		writeInt8(writer, 1)
		FfiConverterSymbolINSTANCE.Write(writer, *value)
	}
}

type FfiDestroyerOptionalSymbol struct{}

func (_ FfiDestroyerOptionalSymbol) Destroy(value *Symbol) {
	if value != nil {
		FfiDestroyerSymbol{}.Destroy(*value)
	}
}

type FfiConverterOptionalTokenMetadata struct{}

var FfiConverterOptionalTokenMetadataINSTANCE = FfiConverterOptionalTokenMetadata{}

func (c FfiConverterOptionalTokenMetadata) Lift(rb RustBufferI) *TokenMetadata {
	return LiftFromRustBuffer[*TokenMetadata](c, rb)
}

func (_ FfiConverterOptionalTokenMetadata) Read(reader io.Reader) *TokenMetadata {
	if readInt8(reader) == 0 {
		return nil
	}
	temp := FfiConverterTokenMetadataINSTANCE.Read(reader)
	return &temp
}

func (c FfiConverterOptionalTokenMetadata) Lower(value *TokenMetadata) C.RustBuffer {
	return LowerIntoRustBuffer[*TokenMetadata](c, value)
}

func (c FfiConverterOptionalTokenMetadata) LowerExternal(value *TokenMetadata) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[*TokenMetadata](c, value))
}

func (_ FfiConverterOptionalTokenMetadata) Write(writer io.Writer, value *TokenMetadata) {
	if value == nil {
		writeInt8(writer, 0)
	} else {
		writeInt8(writer, 1)
		FfiConverterTokenMetadataINSTANCE.Write(writer, *value)
	}
}

type FfiDestroyerOptionalTokenMetadata struct{}

func (_ FfiDestroyerOptionalTokenMetadata) Destroy(value *TokenMetadata) {
	if value != nil {
		FfiDestroyerTokenMetadata{}.Destroy(*value)
	}
}

type FfiConverterOptionalAmount struct{}

var FfiConverterOptionalAmountINSTANCE = FfiConverterOptionalAmount{}

func (c FfiConverterOptionalAmount) Lift(rb RustBufferI) *Amount {
	return LiftFromRustBuffer[*Amount](c, rb)
}

func (_ FfiConverterOptionalAmount) Read(reader io.Reader) *Amount {
	if readInt8(reader) == 0 {
		return nil
	}
	temp := FfiConverterAmountINSTANCE.Read(reader)
	return &temp
}

func (c FfiConverterOptionalAmount) Lower(value *Amount) C.RustBuffer {
	return LowerIntoRustBuffer[*Amount](c, value)
}

func (c FfiConverterOptionalAmount) LowerExternal(value *Amount) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[*Amount](c, value))
}

func (_ FfiConverterOptionalAmount) Write(writer io.Writer, value *Amount) {
	if value == nil {
		writeInt8(writer, 0)
	} else {
		writeInt8(writer, 1)
		FfiConverterAmountINSTANCE.Write(writer, *value)
	}
}

type FfiDestroyerOptionalAmount struct{}

func (_ FfiDestroyerOptionalAmount) Destroy(value *Amount) {
	if value != nil {
		FfiDestroyerAmount{}.Destroy(*value)
	}
}

type FfiConverterOptionalAmountAdjustmentReason struct{}

var FfiConverterOptionalAmountAdjustmentReasonINSTANCE = FfiConverterOptionalAmountAdjustmentReason{}

func (c FfiConverterOptionalAmountAdjustmentReason) Lift(rb RustBufferI) *AmountAdjustmentReason {
	return LiftFromRustBuffer[*AmountAdjustmentReason](c, rb)
}

func (_ FfiConverterOptionalAmountAdjustmentReason) Read(reader io.Reader) *AmountAdjustmentReason {
	if readInt8(reader) == 0 {
		return nil
	}
	temp := FfiConverterAmountAdjustmentReasonINSTANCE.Read(reader)
	return &temp
}

func (c FfiConverterOptionalAmountAdjustmentReason) Lower(value *AmountAdjustmentReason) C.RustBuffer {
	return LowerIntoRustBuffer[*AmountAdjustmentReason](c, value)
}

func (c FfiConverterOptionalAmountAdjustmentReason) LowerExternal(value *AmountAdjustmentReason) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[*AmountAdjustmentReason](c, value))
}

func (_ FfiConverterOptionalAmountAdjustmentReason) Write(writer io.Writer, value *AmountAdjustmentReason) {
	if value == nil {
		writeInt8(writer, 0)
	} else {
		writeInt8(writer, 1)
		FfiConverterAmountAdjustmentReasonINSTANCE.Write(writer, *value)
	}
}

type FfiDestroyerOptionalAmountAdjustmentReason struct{}

func (_ FfiDestroyerOptionalAmountAdjustmentReason) Destroy(value *AmountAdjustmentReason) {
	if value != nil {
		FfiDestroyerAmountAdjustmentReason{}.Destroy(*value)
	}
}

type FfiConverterOptionalAssetFilter struct{}

var FfiConverterOptionalAssetFilterINSTANCE = FfiConverterOptionalAssetFilter{}

func (c FfiConverterOptionalAssetFilter) Lift(rb RustBufferI) *AssetFilter {
	return LiftFromRustBuffer[*AssetFilter](c, rb)
}

func (_ FfiConverterOptionalAssetFilter) Read(reader io.Reader) *AssetFilter {
	if readInt8(reader) == 0 {
		return nil
	}
	temp := FfiConverterAssetFilterINSTANCE.Read(reader)
	return &temp
}

func (c FfiConverterOptionalAssetFilter) Lower(value *AssetFilter) C.RustBuffer {
	return LowerIntoRustBuffer[*AssetFilter](c, value)
}

func (c FfiConverterOptionalAssetFilter) LowerExternal(value *AssetFilter) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[*AssetFilter](c, value))
}

func (_ FfiConverterOptionalAssetFilter) Write(writer io.Writer, value *AssetFilter) {
	if value == nil {
		writeInt8(writer, 0)
	} else {
		writeInt8(writer, 1)
		FfiConverterAssetFilterINSTANCE.Write(writer, *value)
	}
}

type FfiDestroyerOptionalAssetFilter struct{}

func (_ FfiDestroyerOptionalAssetFilter) Destroy(value *AssetFilter) {
	if value != nil {
		FfiDestroyerAssetFilter{}.Destroy(*value)
	}
}

type FfiConverterOptionalConversionPurpose struct{}

var FfiConverterOptionalConversionPurposeINSTANCE = FfiConverterOptionalConversionPurpose{}

func (c FfiConverterOptionalConversionPurpose) Lift(rb RustBufferI) *ConversionPurpose {
	return LiftFromRustBuffer[*ConversionPurpose](c, rb)
}

func (_ FfiConverterOptionalConversionPurpose) Read(reader io.Reader) *ConversionPurpose {
	if readInt8(reader) == 0 {
		return nil
	}
	temp := FfiConverterConversionPurposeINSTANCE.Read(reader)
	return &temp
}

func (c FfiConverterOptionalConversionPurpose) Lower(value *ConversionPurpose) C.RustBuffer {
	return LowerIntoRustBuffer[*ConversionPurpose](c, value)
}

func (c FfiConverterOptionalConversionPurpose) LowerExternal(value *ConversionPurpose) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[*ConversionPurpose](c, value))
}

func (_ FfiConverterOptionalConversionPurpose) Write(writer io.Writer, value *ConversionPurpose) {
	if value == nil {
		writeInt8(writer, 0)
	} else {
		writeInt8(writer, 1)
		FfiConverterConversionPurposeINSTANCE.Write(writer, *value)
	}
}

type FfiDestroyerOptionalConversionPurpose struct{}

func (_ FfiDestroyerOptionalConversionPurpose) Destroy(value *ConversionPurpose) {
	if value != nil {
		FfiDestroyerConversionPurpose{}.Destroy(*value)
	}
}

type FfiConverterOptionalConversionStatus struct{}

var FfiConverterOptionalConversionStatusINSTANCE = FfiConverterOptionalConversionStatus{}

func (c FfiConverterOptionalConversionStatus) Lift(rb RustBufferI) *ConversionStatus {
	return LiftFromRustBuffer[*ConversionStatus](c, rb)
}

func (_ FfiConverterOptionalConversionStatus) Read(reader io.Reader) *ConversionStatus {
	if readInt8(reader) == 0 {
		return nil
	}
	temp := FfiConverterConversionStatusINSTANCE.Read(reader)
	return &temp
}

func (c FfiConverterOptionalConversionStatus) Lower(value *ConversionStatus) C.RustBuffer {
	return LowerIntoRustBuffer[*ConversionStatus](c, value)
}

func (c FfiConverterOptionalConversionStatus) LowerExternal(value *ConversionStatus) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[*ConversionStatus](c, value))
}

func (_ FfiConverterOptionalConversionStatus) Write(writer io.Writer, value *ConversionStatus) {
	if value == nil {
		writeInt8(writer, 0)
	} else {
		writeInt8(writer, 1)
		FfiConverterConversionStatusINSTANCE.Write(writer, *value)
	}
}

type FfiDestroyerOptionalConversionStatus struct{}

func (_ FfiDestroyerOptionalConversionStatus) Destroy(value *ConversionStatus) {
	if value != nil {
		FfiDestroyerConversionStatus{}.Destroy(*value)
	}
}

type FfiConverterOptionalDepositClaimError struct{}

var FfiConverterOptionalDepositClaimErrorINSTANCE = FfiConverterOptionalDepositClaimError{}

func (c FfiConverterOptionalDepositClaimError) Lift(rb RustBufferI) *DepositClaimError {
	return LiftFromRustBuffer[*DepositClaimError](c, rb)
}

func (_ FfiConverterOptionalDepositClaimError) Read(reader io.Reader) *DepositClaimError {
	if readInt8(reader) == 0 {
		return nil
	}
	temp := FfiConverterDepositClaimErrorINSTANCE.Read(reader)
	return &temp
}

func (c FfiConverterOptionalDepositClaimError) Lower(value *DepositClaimError) C.RustBuffer {
	return LowerIntoRustBuffer[*DepositClaimError](c, value)
}

func (c FfiConverterOptionalDepositClaimError) LowerExternal(value *DepositClaimError) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[*DepositClaimError](c, value))
}

func (_ FfiConverterOptionalDepositClaimError) Write(writer io.Writer, value *DepositClaimError) {
	if value == nil {
		writeInt8(writer, 0)
	} else {
		writeInt8(writer, 1)
		FfiConverterDepositClaimErrorINSTANCE.Write(writer, *value)
	}
}

type FfiDestroyerOptionalDepositClaimError struct{}

func (_ FfiDestroyerOptionalDepositClaimError) Destroy(value *DepositClaimError) {
	if value != nil {
		FfiDestroyerDepositClaimError{}.Destroy(*value)
	}
}

type FfiConverterOptionalFee struct{}

var FfiConverterOptionalFeeINSTANCE = FfiConverterOptionalFee{}

func (c FfiConverterOptionalFee) Lift(rb RustBufferI) *Fee {
	return LiftFromRustBuffer[*Fee](c, rb)
}

func (_ FfiConverterOptionalFee) Read(reader io.Reader) *Fee {
	if readInt8(reader) == 0 {
		return nil
	}
	temp := FfiConverterFeeINSTANCE.Read(reader)
	return &temp
}

func (c FfiConverterOptionalFee) Lower(value *Fee) C.RustBuffer {
	return LowerIntoRustBuffer[*Fee](c, value)
}

func (c FfiConverterOptionalFee) LowerExternal(value *Fee) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[*Fee](c, value))
}

func (_ FfiConverterOptionalFee) Write(writer io.Writer, value *Fee) {
	if value == nil {
		writeInt8(writer, 0)
	} else {
		writeInt8(writer, 1)
		FfiConverterFeeINSTANCE.Write(writer, *value)
	}
}

type FfiDestroyerOptionalFee struct{}

func (_ FfiDestroyerOptionalFee) Destroy(value *Fee) {
	if value != nil {
		FfiDestroyerFee{}.Destroy(*value)
	}
}

type FfiConverterOptionalFeePolicy struct{}

var FfiConverterOptionalFeePolicyINSTANCE = FfiConverterOptionalFeePolicy{}

func (c FfiConverterOptionalFeePolicy) Lift(rb RustBufferI) *FeePolicy {
	return LiftFromRustBuffer[*FeePolicy](c, rb)
}

func (_ FfiConverterOptionalFeePolicy) Read(reader io.Reader) *FeePolicy {
	if readInt8(reader) == 0 {
		return nil
	}
	temp := FfiConverterFeePolicyINSTANCE.Read(reader)
	return &temp
}

func (c FfiConverterOptionalFeePolicy) Lower(value *FeePolicy) C.RustBuffer {
	return LowerIntoRustBuffer[*FeePolicy](c, value)
}

func (c FfiConverterOptionalFeePolicy) LowerExternal(value *FeePolicy) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[*FeePolicy](c, value))
}

func (_ FfiConverterOptionalFeePolicy) Write(writer io.Writer, value *FeePolicy) {
	if value == nil {
		writeInt8(writer, 0)
	} else {
		writeInt8(writer, 1)
		FfiConverterFeePolicyINSTANCE.Write(writer, *value)
	}
}

type FfiDestroyerOptionalFeePolicy struct{}

func (_ FfiDestroyerOptionalFeePolicy) Destroy(value *FeePolicy) {
	if value != nil {
		FfiDestroyerFeePolicy{}.Destroy(*value)
	}
}

type FfiConverterOptionalMaxFee struct{}

var FfiConverterOptionalMaxFeeINSTANCE = FfiConverterOptionalMaxFee{}

func (c FfiConverterOptionalMaxFee) Lift(rb RustBufferI) *MaxFee {
	return LiftFromRustBuffer[*MaxFee](c, rb)
}

func (_ FfiConverterOptionalMaxFee) Read(reader io.Reader) *MaxFee {
	if readInt8(reader) == 0 {
		return nil
	}
	temp := FfiConverterMaxFeeINSTANCE.Read(reader)
	return &temp
}

func (c FfiConverterOptionalMaxFee) Lower(value *MaxFee) C.RustBuffer {
	return LowerIntoRustBuffer[*MaxFee](c, value)
}

func (c FfiConverterOptionalMaxFee) LowerExternal(value *MaxFee) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[*MaxFee](c, value))
}

func (_ FfiConverterOptionalMaxFee) Write(writer io.Writer, value *MaxFee) {
	if value == nil {
		writeInt8(writer, 0)
	} else {
		writeInt8(writer, 1)
		FfiConverterMaxFeeINSTANCE.Write(writer, *value)
	}
}

type FfiDestroyerOptionalMaxFee struct{}

func (_ FfiDestroyerOptionalMaxFee) Destroy(value *MaxFee) {
	if value != nil {
		FfiDestroyerMaxFee{}.Destroy(*value)
	}
}

type FfiConverterOptionalPaymentDetails struct{}

var FfiConverterOptionalPaymentDetailsINSTANCE = FfiConverterOptionalPaymentDetails{}

func (c FfiConverterOptionalPaymentDetails) Lift(rb RustBufferI) *PaymentDetails {
	return LiftFromRustBuffer[*PaymentDetails](c, rb)
}

func (_ FfiConverterOptionalPaymentDetails) Read(reader io.Reader) *PaymentDetails {
	if readInt8(reader) == 0 {
		return nil
	}
	temp := FfiConverterPaymentDetailsINSTANCE.Read(reader)
	return &temp
}

func (c FfiConverterOptionalPaymentDetails) Lower(value *PaymentDetails) C.RustBuffer {
	return LowerIntoRustBuffer[*PaymentDetails](c, value)
}

func (c FfiConverterOptionalPaymentDetails) LowerExternal(value *PaymentDetails) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[*PaymentDetails](c, value))
}

func (_ FfiConverterOptionalPaymentDetails) Write(writer io.Writer, value *PaymentDetails) {
	if value == nil {
		writeInt8(writer, 0)
	} else {
		writeInt8(writer, 1)
		FfiConverterPaymentDetailsINSTANCE.Write(writer, *value)
	}
}

type FfiDestroyerOptionalPaymentDetails struct{}

func (_ FfiDestroyerOptionalPaymentDetails) Destroy(value *PaymentDetails) {
	if value != nil {
		FfiDestroyerPaymentDetails{}.Destroy(*value)
	}
}

type FfiConverterOptionalSendPaymentOptions struct{}

var FfiConverterOptionalSendPaymentOptionsINSTANCE = FfiConverterOptionalSendPaymentOptions{}

func (c FfiConverterOptionalSendPaymentOptions) Lift(rb RustBufferI) *SendPaymentOptions {
	return LiftFromRustBuffer[*SendPaymentOptions](c, rb)
}

func (_ FfiConverterOptionalSendPaymentOptions) Read(reader io.Reader) *SendPaymentOptions {
	if readInt8(reader) == 0 {
		return nil
	}
	temp := FfiConverterSendPaymentOptionsINSTANCE.Read(reader)
	return &temp
}

func (c FfiConverterOptionalSendPaymentOptions) Lower(value *SendPaymentOptions) C.RustBuffer {
	return LowerIntoRustBuffer[*SendPaymentOptions](c, value)
}

func (c FfiConverterOptionalSendPaymentOptions) LowerExternal(value *SendPaymentOptions) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[*SendPaymentOptions](c, value))
}

func (_ FfiConverterOptionalSendPaymentOptions) Write(writer io.Writer, value *SendPaymentOptions) {
	if value == nil {
		writeInt8(writer, 0)
	} else {
		writeInt8(writer, 1)
		FfiConverterSendPaymentOptionsINSTANCE.Write(writer, *value)
	}
}

type FfiDestroyerOptionalSendPaymentOptions struct{}

func (_ FfiDestroyerOptionalSendPaymentOptions) Destroy(value *SendPaymentOptions) {
	if value != nil {
		FfiDestroyerSendPaymentOptions{}.Destroy(*value)
	}
}

type FfiConverterOptionalStableBalanceActiveLabel struct{}

var FfiConverterOptionalStableBalanceActiveLabelINSTANCE = FfiConverterOptionalStableBalanceActiveLabel{}

func (c FfiConverterOptionalStableBalanceActiveLabel) Lift(rb RustBufferI) *StableBalanceActiveLabel {
	return LiftFromRustBuffer[*StableBalanceActiveLabel](c, rb)
}

func (_ FfiConverterOptionalStableBalanceActiveLabel) Read(reader io.Reader) *StableBalanceActiveLabel {
	if readInt8(reader) == 0 {
		return nil
	}
	temp := FfiConverterStableBalanceActiveLabelINSTANCE.Read(reader)
	return &temp
}

func (c FfiConverterOptionalStableBalanceActiveLabel) Lower(value *StableBalanceActiveLabel) C.RustBuffer {
	return LowerIntoRustBuffer[*StableBalanceActiveLabel](c, value)
}

func (c FfiConverterOptionalStableBalanceActiveLabel) LowerExternal(value *StableBalanceActiveLabel) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[*StableBalanceActiveLabel](c, value))
}

func (_ FfiConverterOptionalStableBalanceActiveLabel) Write(writer io.Writer, value *StableBalanceActiveLabel) {
	if value == nil {
		writeInt8(writer, 0)
	} else {
		writeInt8(writer, 1)
		FfiConverterStableBalanceActiveLabelINSTANCE.Write(writer, *value)
	}
}

type FfiDestroyerOptionalStableBalanceActiveLabel struct{}

func (_ FfiDestroyerOptionalStableBalanceActiveLabel) Destroy(value *StableBalanceActiveLabel) {
	if value != nil {
		FfiDestroyerStableBalanceActiveLabel{}.Destroy(*value)
	}
}

type FfiConverterOptionalSuccessAction struct{}

var FfiConverterOptionalSuccessActionINSTANCE = FfiConverterOptionalSuccessAction{}

func (c FfiConverterOptionalSuccessAction) Lift(rb RustBufferI) *SuccessAction {
	return LiftFromRustBuffer[*SuccessAction](c, rb)
}

func (_ FfiConverterOptionalSuccessAction) Read(reader io.Reader) *SuccessAction {
	if readInt8(reader) == 0 {
		return nil
	}
	temp := FfiConverterSuccessActionINSTANCE.Read(reader)
	return &temp
}

func (c FfiConverterOptionalSuccessAction) Lower(value *SuccessAction) C.RustBuffer {
	return LowerIntoRustBuffer[*SuccessAction](c, value)
}

func (c FfiConverterOptionalSuccessAction) LowerExternal(value *SuccessAction) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[*SuccessAction](c, value))
}

func (_ FfiConverterOptionalSuccessAction) Write(writer io.Writer, value *SuccessAction) {
	if value == nil {
		writeInt8(writer, 0)
	} else {
		writeInt8(writer, 1)
		FfiConverterSuccessActionINSTANCE.Write(writer, *value)
	}
}

type FfiDestroyerOptionalSuccessAction struct{}

func (_ FfiDestroyerOptionalSuccessAction) Destroy(value *SuccessAction) {
	if value != nil {
		FfiDestroyerSuccessAction{}.Destroy(*value)
	}
}

type FfiConverterOptionalSuccessActionProcessed struct{}

var FfiConverterOptionalSuccessActionProcessedINSTANCE = FfiConverterOptionalSuccessActionProcessed{}

func (c FfiConverterOptionalSuccessActionProcessed) Lift(rb RustBufferI) *SuccessActionProcessed {
	return LiftFromRustBuffer[*SuccessActionProcessed](c, rb)
}

func (_ FfiConverterOptionalSuccessActionProcessed) Read(reader io.Reader) *SuccessActionProcessed {
	if readInt8(reader) == 0 {
		return nil
	}
	temp := FfiConverterSuccessActionProcessedINSTANCE.Read(reader)
	return &temp
}

func (c FfiConverterOptionalSuccessActionProcessed) Lower(value *SuccessActionProcessed) C.RustBuffer {
	return LowerIntoRustBuffer[*SuccessActionProcessed](c, value)
}

func (c FfiConverterOptionalSuccessActionProcessed) LowerExternal(value *SuccessActionProcessed) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[*SuccessActionProcessed](c, value))
}

func (_ FfiConverterOptionalSuccessActionProcessed) Write(writer io.Writer, value *SuccessActionProcessed) {
	if value == nil {
		writeInt8(writer, 0)
	} else {
		writeInt8(writer, 1)
		FfiConverterSuccessActionProcessedINSTANCE.Write(writer, *value)
	}
}

type FfiDestroyerOptionalSuccessActionProcessed struct{}

func (_ FfiDestroyerOptionalSuccessActionProcessed) Destroy(value *SuccessActionProcessed) {
	if value != nil {
		FfiDestroyerSuccessActionProcessed{}.Destroy(*value)
	}
}

type FfiConverterOptionalTokenTransactionType struct{}

var FfiConverterOptionalTokenTransactionTypeINSTANCE = FfiConverterOptionalTokenTransactionType{}

func (c FfiConverterOptionalTokenTransactionType) Lift(rb RustBufferI) *TokenTransactionType {
	return LiftFromRustBuffer[*TokenTransactionType](c, rb)
}

func (_ FfiConverterOptionalTokenTransactionType) Read(reader io.Reader) *TokenTransactionType {
	if readInt8(reader) == 0 {
		return nil
	}
	temp := FfiConverterTokenTransactionTypeINSTANCE.Read(reader)
	return &temp
}

func (c FfiConverterOptionalTokenTransactionType) Lower(value *TokenTransactionType) C.RustBuffer {
	return LowerIntoRustBuffer[*TokenTransactionType](c, value)
}

func (c FfiConverterOptionalTokenTransactionType) LowerExternal(value *TokenTransactionType) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[*TokenTransactionType](c, value))
}

func (_ FfiConverterOptionalTokenTransactionType) Write(writer io.Writer, value *TokenTransactionType) {
	if value == nil {
		writeInt8(writer, 0)
	} else {
		writeInt8(writer, 1)
		FfiConverterTokenTransactionTypeINSTANCE.Write(writer, *value)
	}
}

type FfiDestroyerOptionalTokenTransactionType struct{}

func (_ FfiDestroyerOptionalTokenTransactionType) Destroy(value *TokenTransactionType) {
	if value != nil {
		FfiDestroyerTokenTransactionType{}.Destroy(*value)
	}
}

type FfiConverterOptionalCallbackInterfaceLogger struct{}

var FfiConverterOptionalCallbackInterfaceLoggerINSTANCE = FfiConverterOptionalCallbackInterfaceLogger{}

func (c FfiConverterOptionalCallbackInterfaceLogger) Lift(rb RustBufferI) *Logger {
	return LiftFromRustBuffer[*Logger](c, rb)
}

func (_ FfiConverterOptionalCallbackInterfaceLogger) Read(reader io.Reader) *Logger {
	if readInt8(reader) == 0 {
		return nil
	}
	temp := FfiConverterCallbackInterfaceLoggerINSTANCE.Read(reader)
	return &temp
}

func (c FfiConverterOptionalCallbackInterfaceLogger) Lower(value *Logger) C.RustBuffer {
	return LowerIntoRustBuffer[*Logger](c, value)
}

func (c FfiConverterOptionalCallbackInterfaceLogger) LowerExternal(value *Logger) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[*Logger](c, value))
}

func (_ FfiConverterOptionalCallbackInterfaceLogger) Write(writer io.Writer, value *Logger) {
	if value == nil {
		writeInt8(writer, 0)
	} else {
		writeInt8(writer, 1)
		FfiConverterCallbackInterfaceLoggerINSTANCE.Write(writer, *value)
	}
}

type FfiDestroyerOptionalCallbackInterfaceLogger struct{}

func (_ FfiDestroyerOptionalCallbackInterfaceLogger) Destroy(value *Logger) {
	if value != nil {
		FfiDestroyerCallbackInterfaceLogger{}.Destroy(*value)
	}
}

type FfiConverterOptionalSequenceExternalInputParser struct{}

var FfiConverterOptionalSequenceExternalInputParserINSTANCE = FfiConverterOptionalSequenceExternalInputParser{}

func (c FfiConverterOptionalSequenceExternalInputParser) Lift(rb RustBufferI) *[]ExternalInputParser {
	return LiftFromRustBuffer[*[]ExternalInputParser](c, rb)
}

func (_ FfiConverterOptionalSequenceExternalInputParser) Read(reader io.Reader) *[]ExternalInputParser {
	if readInt8(reader) == 0 {
		return nil
	}
	temp := FfiConverterSequenceExternalInputParserINSTANCE.Read(reader)
	return &temp
}

func (c FfiConverterOptionalSequenceExternalInputParser) Lower(value *[]ExternalInputParser) C.RustBuffer {
	return LowerIntoRustBuffer[*[]ExternalInputParser](c, value)
}

func (c FfiConverterOptionalSequenceExternalInputParser) LowerExternal(value *[]ExternalInputParser) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[*[]ExternalInputParser](c, value))
}

func (_ FfiConverterOptionalSequenceExternalInputParser) Write(writer io.Writer, value *[]ExternalInputParser) {
	if value == nil {
		writeInt8(writer, 0)
	} else {
		writeInt8(writer, 1)
		FfiConverterSequenceExternalInputParserINSTANCE.Write(writer, *value)
	}
}

type FfiDestroyerOptionalSequenceExternalInputParser struct{}

func (_ FfiDestroyerOptionalSequenceExternalInputParser) Destroy(value *[]ExternalInputParser) {
	if value != nil {
		FfiDestroyerSequenceExternalInputParser{}.Destroy(*value)
	}
}

type FfiConverterOptionalSequencePaymentDetailsFilter struct{}

var FfiConverterOptionalSequencePaymentDetailsFilterINSTANCE = FfiConverterOptionalSequencePaymentDetailsFilter{}

func (c FfiConverterOptionalSequencePaymentDetailsFilter) Lift(rb RustBufferI) *[]PaymentDetailsFilter {
	return LiftFromRustBuffer[*[]PaymentDetailsFilter](c, rb)
}

func (_ FfiConverterOptionalSequencePaymentDetailsFilter) Read(reader io.Reader) *[]PaymentDetailsFilter {
	if readInt8(reader) == 0 {
		return nil
	}
	temp := FfiConverterSequencePaymentDetailsFilterINSTANCE.Read(reader)
	return &temp
}

func (c FfiConverterOptionalSequencePaymentDetailsFilter) Lower(value *[]PaymentDetailsFilter) C.RustBuffer {
	return LowerIntoRustBuffer[*[]PaymentDetailsFilter](c, value)
}

func (c FfiConverterOptionalSequencePaymentDetailsFilter) LowerExternal(value *[]PaymentDetailsFilter) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[*[]PaymentDetailsFilter](c, value))
}

func (_ FfiConverterOptionalSequencePaymentDetailsFilter) Write(writer io.Writer, value *[]PaymentDetailsFilter) {
	if value == nil {
		writeInt8(writer, 0)
	} else {
		writeInt8(writer, 1)
		FfiConverterSequencePaymentDetailsFilterINSTANCE.Write(writer, *value)
	}
}

type FfiDestroyerOptionalSequencePaymentDetailsFilter struct{}

func (_ FfiDestroyerOptionalSequencePaymentDetailsFilter) Destroy(value *[]PaymentDetailsFilter) {
	if value != nil {
		FfiDestroyerSequencePaymentDetailsFilter{}.Destroy(*value)
	}
}

type FfiConverterOptionalSequencePaymentStatus struct{}

var FfiConverterOptionalSequencePaymentStatusINSTANCE = FfiConverterOptionalSequencePaymentStatus{}

func (c FfiConverterOptionalSequencePaymentStatus) Lift(rb RustBufferI) *[]PaymentStatus {
	return LiftFromRustBuffer[*[]PaymentStatus](c, rb)
}

func (_ FfiConverterOptionalSequencePaymentStatus) Read(reader io.Reader) *[]PaymentStatus {
	if readInt8(reader) == 0 {
		return nil
	}
	temp := FfiConverterSequencePaymentStatusINSTANCE.Read(reader)
	return &temp
}

func (c FfiConverterOptionalSequencePaymentStatus) Lower(value *[]PaymentStatus) C.RustBuffer {
	return LowerIntoRustBuffer[*[]PaymentStatus](c, value)
}

func (c FfiConverterOptionalSequencePaymentStatus) LowerExternal(value *[]PaymentStatus) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[*[]PaymentStatus](c, value))
}

func (_ FfiConverterOptionalSequencePaymentStatus) Write(writer io.Writer, value *[]PaymentStatus) {
	if value == nil {
		writeInt8(writer, 0)
	} else {
		writeInt8(writer, 1)
		FfiConverterSequencePaymentStatusINSTANCE.Write(writer, *value)
	}
}

type FfiDestroyerOptionalSequencePaymentStatus struct{}

func (_ FfiDestroyerOptionalSequencePaymentStatus) Destroy(value *[]PaymentStatus) {
	if value != nil {
		FfiDestroyerSequencePaymentStatus{}.Destroy(*value)
	}
}

type FfiConverterOptionalSequencePaymentType struct{}

var FfiConverterOptionalSequencePaymentTypeINSTANCE = FfiConverterOptionalSequencePaymentType{}

func (c FfiConverterOptionalSequencePaymentType) Lift(rb RustBufferI) *[]PaymentType {
	return LiftFromRustBuffer[*[]PaymentType](c, rb)
}

func (_ FfiConverterOptionalSequencePaymentType) Read(reader io.Reader) *[]PaymentType {
	if readInt8(reader) == 0 {
		return nil
	}
	temp := FfiConverterSequencePaymentTypeINSTANCE.Read(reader)
	return &temp
}

func (c FfiConverterOptionalSequencePaymentType) Lower(value *[]PaymentType) C.RustBuffer {
	return LowerIntoRustBuffer[*[]PaymentType](c, value)
}

func (c FfiConverterOptionalSequencePaymentType) LowerExternal(value *[]PaymentType) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[*[]PaymentType](c, value))
}

func (_ FfiConverterOptionalSequencePaymentType) Write(writer io.Writer, value *[]PaymentType) {
	if value == nil {
		writeInt8(writer, 0)
	} else {
		writeInt8(writer, 1)
		FfiConverterSequencePaymentTypeINSTANCE.Write(writer, *value)
	}
}

type FfiDestroyerOptionalSequencePaymentType struct{}

func (_ FfiDestroyerOptionalSequencePaymentType) Destroy(value *[]PaymentType) {
	if value != nil {
		FfiDestroyerSequencePaymentType{}.Destroy(*value)
	}
}

type FfiConverterOptionalSequenceSparkHtlcStatus struct{}

var FfiConverterOptionalSequenceSparkHtlcStatusINSTANCE = FfiConverterOptionalSequenceSparkHtlcStatus{}

func (c FfiConverterOptionalSequenceSparkHtlcStatus) Lift(rb RustBufferI) *[]SparkHtlcStatus {
	return LiftFromRustBuffer[*[]SparkHtlcStatus](c, rb)
}

func (_ FfiConverterOptionalSequenceSparkHtlcStatus) Read(reader io.Reader) *[]SparkHtlcStatus {
	if readInt8(reader) == 0 {
		return nil
	}
	temp := FfiConverterSequenceSparkHtlcStatusINSTANCE.Read(reader)
	return &temp
}

func (c FfiConverterOptionalSequenceSparkHtlcStatus) Lower(value *[]SparkHtlcStatus) C.RustBuffer {
	return LowerIntoRustBuffer[*[]SparkHtlcStatus](c, value)
}

func (c FfiConverterOptionalSequenceSparkHtlcStatus) LowerExternal(value *[]SparkHtlcStatus) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[*[]SparkHtlcStatus](c, value))
}

func (_ FfiConverterOptionalSequenceSparkHtlcStatus) Write(writer io.Writer, value *[]SparkHtlcStatus) {
	if value == nil {
		writeInt8(writer, 0)
	} else {
		writeInt8(writer, 1)
		FfiConverterSequenceSparkHtlcStatusINSTANCE.Write(writer, *value)
	}
}

type FfiDestroyerOptionalSequenceSparkHtlcStatus struct{}

func (_ FfiDestroyerOptionalSequenceSparkHtlcStatus) Destroy(value *[]SparkHtlcStatus) {
	if value != nil {
		FfiDestroyerSequenceSparkHtlcStatus{}.Destroy(*value)
	}
}

type FfiConverterOptionalSequenceStoragePaymentDetailsFilter struct{}

var FfiConverterOptionalSequenceStoragePaymentDetailsFilterINSTANCE = FfiConverterOptionalSequenceStoragePaymentDetailsFilter{}

func (c FfiConverterOptionalSequenceStoragePaymentDetailsFilter) Lift(rb RustBufferI) *[]StoragePaymentDetailsFilter {
	return LiftFromRustBuffer[*[]StoragePaymentDetailsFilter](c, rb)
}

func (_ FfiConverterOptionalSequenceStoragePaymentDetailsFilter) Read(reader io.Reader) *[]StoragePaymentDetailsFilter {
	if readInt8(reader) == 0 {
		return nil
	}
	temp := FfiConverterSequenceStoragePaymentDetailsFilterINSTANCE.Read(reader)
	return &temp
}

func (c FfiConverterOptionalSequenceStoragePaymentDetailsFilter) Lower(value *[]StoragePaymentDetailsFilter) C.RustBuffer {
	return LowerIntoRustBuffer[*[]StoragePaymentDetailsFilter](c, value)
}

func (c FfiConverterOptionalSequenceStoragePaymentDetailsFilter) LowerExternal(value *[]StoragePaymentDetailsFilter) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[*[]StoragePaymentDetailsFilter](c, value))
}

func (_ FfiConverterOptionalSequenceStoragePaymentDetailsFilter) Write(writer io.Writer, value *[]StoragePaymentDetailsFilter) {
	if value == nil {
		writeInt8(writer, 0)
	} else {
		writeInt8(writer, 1)
		FfiConverterSequenceStoragePaymentDetailsFilterINSTANCE.Write(writer, *value)
	}
}

type FfiDestroyerOptionalSequenceStoragePaymentDetailsFilter struct{}

func (_ FfiDestroyerOptionalSequenceStoragePaymentDetailsFilter) Destroy(value *[]StoragePaymentDetailsFilter) {
	if value != nil {
		FfiDestroyerSequenceStoragePaymentDetailsFilter{}.Destroy(*value)
	}
}

type FfiConverterOptionalMapStringString struct{}

var FfiConverterOptionalMapStringStringINSTANCE = FfiConverterOptionalMapStringString{}

func (c FfiConverterOptionalMapStringString) Lift(rb RustBufferI) *map[string]string {
	return LiftFromRustBuffer[*map[string]string](c, rb)
}

func (_ FfiConverterOptionalMapStringString) Read(reader io.Reader) *map[string]string {
	if readInt8(reader) == 0 {
		return nil
	}
	temp := FfiConverterMapStringStringINSTANCE.Read(reader)
	return &temp
}

func (c FfiConverterOptionalMapStringString) Lower(value *map[string]string) C.RustBuffer {
	return LowerIntoRustBuffer[*map[string]string](c, value)
}

func (c FfiConverterOptionalMapStringString) LowerExternal(value *map[string]string) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[*map[string]string](c, value))
}

func (_ FfiConverterOptionalMapStringString) Write(writer io.Writer, value *map[string]string) {
	if value == nil {
		writeInt8(writer, 0)
	} else {
		writeInt8(writer, 1)
		FfiConverterMapStringStringINSTANCE.Write(writer, *value)
	}
}

type FfiDestroyerOptionalMapStringString struct{}

func (_ FfiDestroyerOptionalMapStringString) Destroy(value *map[string]string) {
	if value != nil {
		FfiDestroyerMapStringString{}.Destroy(*value)
	}
}

type FfiConverterOptionalTypeu128 struct{}

var FfiConverterOptionalTypeu128INSTANCE = FfiConverterOptionalTypeu128{}

func (c FfiConverterOptionalTypeu128) Lift(rb RustBufferI) *u128 {
	return LiftFromRustBuffer[*u128](c, rb)
}

func (_ FfiConverterOptionalTypeu128) Read(reader io.Reader) *u128 {
	if readInt8(reader) == 0 {
		return nil
	}
	temp := FfiConverterTypeu128INSTANCE.Read(reader)
	return &temp
}

func (c FfiConverterOptionalTypeu128) Lower(value *u128) C.RustBuffer {
	return LowerIntoRustBuffer[*u128](c, value)
}

func (c FfiConverterOptionalTypeu128) LowerExternal(value *u128) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[*u128](c, value))
}

func (_ FfiConverterOptionalTypeu128) Write(writer io.Writer, value *u128) {
	if value == nil {
		writeInt8(writer, 0)
	} else {
		writeInt8(writer, 1)
		FfiConverterTypeu128INSTANCE.Write(writer, *value)
	}
}

type FfiDestroyerOptionalTypeu128 struct{}

func (_ FfiDestroyerOptionalTypeu128) Destroy(value *u128) {
	if value != nil {
		FfiDestroyerTypeu128{}.Destroy(*value)
	}
}

type FfiConverterSequenceString struct{}

var FfiConverterSequenceStringINSTANCE = FfiConverterSequenceString{}

func (c FfiConverterSequenceString) Lift(rb RustBufferI) []string {
	return LiftFromRustBuffer[[]string](c, rb)
}

func (c FfiConverterSequenceString) Read(reader io.Reader) []string {
	length := readInt32(reader)
	if length == 0 {
		return nil
	}
	result := make([]string, 0, length)
	for i := int32(0); i < length; i++ {
		result = append(result, FfiConverterStringINSTANCE.Read(reader))
	}
	return result
}

func (c FfiConverterSequenceString) Lower(value []string) C.RustBuffer {
	return LowerIntoRustBuffer[[]string](c, value)
}

func (c FfiConverterSequenceString) LowerExternal(value []string) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[[]string](c, value))
}

func (c FfiConverterSequenceString) Write(writer io.Writer, value []string) {
	if len(value) > math.MaxInt32 {
		panic("[]string is too large to fit into Int32")
	}

	writeInt32(writer, int32(len(value)))
	for _, item := range value {
		FfiConverterStringINSTANCE.Write(writer, item)
	}
}

type FfiDestroyerSequenceString struct{}

func (FfiDestroyerSequenceString) Destroy(sequence []string) {
	for _, value := range sequence {
		FfiDestroyerString{}.Destroy(value)
	}
}

type FfiConverterSequenceBytes struct{}

var FfiConverterSequenceBytesINSTANCE = FfiConverterSequenceBytes{}

func (c FfiConverterSequenceBytes) Lift(rb RustBufferI) [][]byte {
	return LiftFromRustBuffer[[][]byte](c, rb)
}

func (c FfiConverterSequenceBytes) Read(reader io.Reader) [][]byte {
	length := readInt32(reader)
	if length == 0 {
		return nil
	}
	result := make([][]byte, 0, length)
	for i := int32(0); i < length; i++ {
		result = append(result, FfiConverterBytesINSTANCE.Read(reader))
	}
	return result
}

func (c FfiConverterSequenceBytes) Lower(value [][]byte) C.RustBuffer {
	return LowerIntoRustBuffer[[][]byte](c, value)
}

func (c FfiConverterSequenceBytes) LowerExternal(value [][]byte) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[[][]byte](c, value))
}

func (c FfiConverterSequenceBytes) Write(writer io.Writer, value [][]byte) {
	if len(value) > math.MaxInt32 {
		panic("[][]byte is too large to fit into Int32")
	}

	writeInt32(writer, int32(len(value)))
	for _, item := range value {
		FfiConverterBytesINSTANCE.Write(writer, item)
	}
}

type FfiDestroyerSequenceBytes struct{}

func (FfiDestroyerSequenceBytes) Destroy(sequence [][]byte) {
	for _, value := range sequence {
		FfiDestroyerBytes{}.Destroy(value)
	}
}

type FfiConverterSequenceBip21Extra struct{}

var FfiConverterSequenceBip21ExtraINSTANCE = FfiConverterSequenceBip21Extra{}

func (c FfiConverterSequenceBip21Extra) Lift(rb RustBufferI) []Bip21Extra {
	return LiftFromRustBuffer[[]Bip21Extra](c, rb)
}

func (c FfiConverterSequenceBip21Extra) Read(reader io.Reader) []Bip21Extra {
	length := readInt32(reader)
	if length == 0 {
		return nil
	}
	result := make([]Bip21Extra, 0, length)
	for i := int32(0); i < length; i++ {
		result = append(result, FfiConverterBip21ExtraINSTANCE.Read(reader))
	}
	return result
}

func (c FfiConverterSequenceBip21Extra) Lower(value []Bip21Extra) C.RustBuffer {
	return LowerIntoRustBuffer[[]Bip21Extra](c, value)
}

func (c FfiConverterSequenceBip21Extra) LowerExternal(value []Bip21Extra) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[[]Bip21Extra](c, value))
}

func (c FfiConverterSequenceBip21Extra) Write(writer io.Writer, value []Bip21Extra) {
	if len(value) > math.MaxInt32 {
		panic("[]Bip21Extra is too large to fit into Int32")
	}

	writeInt32(writer, int32(len(value)))
	for _, item := range value {
		FfiConverterBip21ExtraINSTANCE.Write(writer, item)
	}
}

type FfiDestroyerSequenceBip21Extra struct{}

func (FfiDestroyerSequenceBip21Extra) Destroy(sequence []Bip21Extra) {
	for _, value := range sequence {
		FfiDestroyerBip21Extra{}.Destroy(value)
	}
}

type FfiConverterSequenceBolt11RouteHint struct{}

var FfiConverterSequenceBolt11RouteHintINSTANCE = FfiConverterSequenceBolt11RouteHint{}

func (c FfiConverterSequenceBolt11RouteHint) Lift(rb RustBufferI) []Bolt11RouteHint {
	return LiftFromRustBuffer[[]Bolt11RouteHint](c, rb)
}

func (c FfiConverterSequenceBolt11RouteHint) Read(reader io.Reader) []Bolt11RouteHint {
	length := readInt32(reader)
	if length == 0 {
		return nil
	}
	result := make([]Bolt11RouteHint, 0, length)
	for i := int32(0); i < length; i++ {
		result = append(result, FfiConverterBolt11RouteHintINSTANCE.Read(reader))
	}
	return result
}

func (c FfiConverterSequenceBolt11RouteHint) Lower(value []Bolt11RouteHint) C.RustBuffer {
	return LowerIntoRustBuffer[[]Bolt11RouteHint](c, value)
}

func (c FfiConverterSequenceBolt11RouteHint) LowerExternal(value []Bolt11RouteHint) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[[]Bolt11RouteHint](c, value))
}

func (c FfiConverterSequenceBolt11RouteHint) Write(writer io.Writer, value []Bolt11RouteHint) {
	if len(value) > math.MaxInt32 {
		panic("[]Bolt11RouteHint is too large to fit into Int32")
	}

	writeInt32(writer, int32(len(value)))
	for _, item := range value {
		FfiConverterBolt11RouteHintINSTANCE.Write(writer, item)
	}
}

type FfiDestroyerSequenceBolt11RouteHint struct{}

func (FfiDestroyerSequenceBolt11RouteHint) Destroy(sequence []Bolt11RouteHint) {
	for _, value := range sequence {
		FfiDestroyerBolt11RouteHint{}.Destroy(value)
	}
}

type FfiConverterSequenceBolt11RouteHintHop struct{}

var FfiConverterSequenceBolt11RouteHintHopINSTANCE = FfiConverterSequenceBolt11RouteHintHop{}

func (c FfiConverterSequenceBolt11RouteHintHop) Lift(rb RustBufferI) []Bolt11RouteHintHop {
	return LiftFromRustBuffer[[]Bolt11RouteHintHop](c, rb)
}

func (c FfiConverterSequenceBolt11RouteHintHop) Read(reader io.Reader) []Bolt11RouteHintHop {
	length := readInt32(reader)
	if length == 0 {
		return nil
	}
	result := make([]Bolt11RouteHintHop, 0, length)
	for i := int32(0); i < length; i++ {
		result = append(result, FfiConverterBolt11RouteHintHopINSTANCE.Read(reader))
	}
	return result
}

func (c FfiConverterSequenceBolt11RouteHintHop) Lower(value []Bolt11RouteHintHop) C.RustBuffer {
	return LowerIntoRustBuffer[[]Bolt11RouteHintHop](c, value)
}

func (c FfiConverterSequenceBolt11RouteHintHop) LowerExternal(value []Bolt11RouteHintHop) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[[]Bolt11RouteHintHop](c, value))
}

func (c FfiConverterSequenceBolt11RouteHintHop) Write(writer io.Writer, value []Bolt11RouteHintHop) {
	if len(value) > math.MaxInt32 {
		panic("[]Bolt11RouteHintHop is too large to fit into Int32")
	}

	writeInt32(writer, int32(len(value)))
	for _, item := range value {
		FfiConverterBolt11RouteHintHopINSTANCE.Write(writer, item)
	}
}

type FfiDestroyerSequenceBolt11RouteHintHop struct{}

func (FfiDestroyerSequenceBolt11RouteHintHop) Destroy(sequence []Bolt11RouteHintHop) {
	for _, value := range sequence {
		FfiDestroyerBolt11RouteHintHop{}.Destroy(value)
	}
}

type FfiConverterSequenceBolt12OfferBlindedPath struct{}

var FfiConverterSequenceBolt12OfferBlindedPathINSTANCE = FfiConverterSequenceBolt12OfferBlindedPath{}

func (c FfiConverterSequenceBolt12OfferBlindedPath) Lift(rb RustBufferI) []Bolt12OfferBlindedPath {
	return LiftFromRustBuffer[[]Bolt12OfferBlindedPath](c, rb)
}

func (c FfiConverterSequenceBolt12OfferBlindedPath) Read(reader io.Reader) []Bolt12OfferBlindedPath {
	length := readInt32(reader)
	if length == 0 {
		return nil
	}
	result := make([]Bolt12OfferBlindedPath, 0, length)
	for i := int32(0); i < length; i++ {
		result = append(result, FfiConverterBolt12OfferBlindedPathINSTANCE.Read(reader))
	}
	return result
}

func (c FfiConverterSequenceBolt12OfferBlindedPath) Lower(value []Bolt12OfferBlindedPath) C.RustBuffer {
	return LowerIntoRustBuffer[[]Bolt12OfferBlindedPath](c, value)
}

func (c FfiConverterSequenceBolt12OfferBlindedPath) LowerExternal(value []Bolt12OfferBlindedPath) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[[]Bolt12OfferBlindedPath](c, value))
}

func (c FfiConverterSequenceBolt12OfferBlindedPath) Write(writer io.Writer, value []Bolt12OfferBlindedPath) {
	if len(value) > math.MaxInt32 {
		panic("[]Bolt12OfferBlindedPath is too large to fit into Int32")
	}

	writeInt32(writer, int32(len(value)))
	for _, item := range value {
		FfiConverterBolt12OfferBlindedPathINSTANCE.Write(writer, item)
	}
}

type FfiDestroyerSequenceBolt12OfferBlindedPath struct{}

func (FfiDestroyerSequenceBolt12OfferBlindedPath) Destroy(sequence []Bolt12OfferBlindedPath) {
	for _, value := range sequence {
		FfiDestroyerBolt12OfferBlindedPath{}.Destroy(value)
	}
}

type FfiConverterSequenceContact struct{}

var FfiConverterSequenceContactINSTANCE = FfiConverterSequenceContact{}

func (c FfiConverterSequenceContact) Lift(rb RustBufferI) []Contact {
	return LiftFromRustBuffer[[]Contact](c, rb)
}

func (c FfiConverterSequenceContact) Read(reader io.Reader) []Contact {
	length := readInt32(reader)
	if length == 0 {
		return nil
	}
	result := make([]Contact, 0, length)
	for i := int32(0); i < length; i++ {
		result = append(result, FfiConverterContactINSTANCE.Read(reader))
	}
	return result
}

func (c FfiConverterSequenceContact) Lower(value []Contact) C.RustBuffer {
	return LowerIntoRustBuffer[[]Contact](c, value)
}

func (c FfiConverterSequenceContact) LowerExternal(value []Contact) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[[]Contact](c, value))
}

func (c FfiConverterSequenceContact) Write(writer io.Writer, value []Contact) {
	if len(value) > math.MaxInt32 {
		panic("[]Contact is too large to fit into Int32")
	}

	writeInt32(writer, int32(len(value)))
	for _, item := range value {
		FfiConverterContactINSTANCE.Write(writer, item)
	}
}

type FfiDestroyerSequenceContact struct{}

func (FfiDestroyerSequenceContact) Destroy(sequence []Contact) {
	for _, value := range sequence {
		FfiDestroyerContact{}.Destroy(value)
	}
}

type FfiConverterSequenceDepositInfo struct{}

var FfiConverterSequenceDepositInfoINSTANCE = FfiConverterSequenceDepositInfo{}

func (c FfiConverterSequenceDepositInfo) Lift(rb RustBufferI) []DepositInfo {
	return LiftFromRustBuffer[[]DepositInfo](c, rb)
}

func (c FfiConverterSequenceDepositInfo) Read(reader io.Reader) []DepositInfo {
	length := readInt32(reader)
	if length == 0 {
		return nil
	}
	result := make([]DepositInfo, 0, length)
	for i := int32(0); i < length; i++ {
		result = append(result, FfiConverterDepositInfoINSTANCE.Read(reader))
	}
	return result
}

func (c FfiConverterSequenceDepositInfo) Lower(value []DepositInfo) C.RustBuffer {
	return LowerIntoRustBuffer[[]DepositInfo](c, value)
}

func (c FfiConverterSequenceDepositInfo) LowerExternal(value []DepositInfo) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[[]DepositInfo](c, value))
}

func (c FfiConverterSequenceDepositInfo) Write(writer io.Writer, value []DepositInfo) {
	if len(value) > math.MaxInt32 {
		panic("[]DepositInfo is too large to fit into Int32")
	}

	writeInt32(writer, int32(len(value)))
	for _, item := range value {
		FfiConverterDepositInfoINSTANCE.Write(writer, item)
	}
}

type FfiDestroyerSequenceDepositInfo struct{}

func (FfiDestroyerSequenceDepositInfo) Destroy(sequence []DepositInfo) {
	for _, value := range sequence {
		FfiDestroyerDepositInfo{}.Destroy(value)
	}
}

type FfiConverterSequenceExternalInputParser struct{}

var FfiConverterSequenceExternalInputParserINSTANCE = FfiConverterSequenceExternalInputParser{}

func (c FfiConverterSequenceExternalInputParser) Lift(rb RustBufferI) []ExternalInputParser {
	return LiftFromRustBuffer[[]ExternalInputParser](c, rb)
}

func (c FfiConverterSequenceExternalInputParser) Read(reader io.Reader) []ExternalInputParser {
	length := readInt32(reader)
	if length == 0 {
		return nil
	}
	result := make([]ExternalInputParser, 0, length)
	for i := int32(0); i < length; i++ {
		result = append(result, FfiConverterExternalInputParserINSTANCE.Read(reader))
	}
	return result
}

func (c FfiConverterSequenceExternalInputParser) Lower(value []ExternalInputParser) C.RustBuffer {
	return LowerIntoRustBuffer[[]ExternalInputParser](c, value)
}

func (c FfiConverterSequenceExternalInputParser) LowerExternal(value []ExternalInputParser) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[[]ExternalInputParser](c, value))
}

func (c FfiConverterSequenceExternalInputParser) Write(writer io.Writer, value []ExternalInputParser) {
	if len(value) > math.MaxInt32 {
		panic("[]ExternalInputParser is too large to fit into Int32")
	}

	writeInt32(writer, int32(len(value)))
	for _, item := range value {
		FfiConverterExternalInputParserINSTANCE.Write(writer, item)
	}
}

type FfiDestroyerSequenceExternalInputParser struct{}

func (FfiDestroyerSequenceExternalInputParser) Destroy(sequence []ExternalInputParser) {
	for _, value := range sequence {
		FfiDestroyerExternalInputParser{}.Destroy(value)
	}
}

type FfiConverterSequenceExternalVerifiableSecretShare struct{}

var FfiConverterSequenceExternalVerifiableSecretShareINSTANCE = FfiConverterSequenceExternalVerifiableSecretShare{}

func (c FfiConverterSequenceExternalVerifiableSecretShare) Lift(rb RustBufferI) []ExternalVerifiableSecretShare {
	return LiftFromRustBuffer[[]ExternalVerifiableSecretShare](c, rb)
}

func (c FfiConverterSequenceExternalVerifiableSecretShare) Read(reader io.Reader) []ExternalVerifiableSecretShare {
	length := readInt32(reader)
	if length == 0 {
		return nil
	}
	result := make([]ExternalVerifiableSecretShare, 0, length)
	for i := int32(0); i < length; i++ {
		result = append(result, FfiConverterExternalVerifiableSecretShareINSTANCE.Read(reader))
	}
	return result
}

func (c FfiConverterSequenceExternalVerifiableSecretShare) Lower(value []ExternalVerifiableSecretShare) C.RustBuffer {
	return LowerIntoRustBuffer[[]ExternalVerifiableSecretShare](c, value)
}

func (c FfiConverterSequenceExternalVerifiableSecretShare) LowerExternal(value []ExternalVerifiableSecretShare) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[[]ExternalVerifiableSecretShare](c, value))
}

func (c FfiConverterSequenceExternalVerifiableSecretShare) Write(writer io.Writer, value []ExternalVerifiableSecretShare) {
	if len(value) > math.MaxInt32 {
		panic("[]ExternalVerifiableSecretShare is too large to fit into Int32")
	}

	writeInt32(writer, int32(len(value)))
	for _, item := range value {
		FfiConverterExternalVerifiableSecretShareINSTANCE.Write(writer, item)
	}
}

type FfiDestroyerSequenceExternalVerifiableSecretShare struct{}

func (FfiDestroyerSequenceExternalVerifiableSecretShare) Destroy(sequence []ExternalVerifiableSecretShare) {
	for _, value := range sequence {
		FfiDestroyerExternalVerifiableSecretShare{}.Destroy(value)
	}
}

type FfiConverterSequenceFiatCurrency struct{}

var FfiConverterSequenceFiatCurrencyINSTANCE = FfiConverterSequenceFiatCurrency{}

func (c FfiConverterSequenceFiatCurrency) Lift(rb RustBufferI) []FiatCurrency {
	return LiftFromRustBuffer[[]FiatCurrency](c, rb)
}

func (c FfiConverterSequenceFiatCurrency) Read(reader io.Reader) []FiatCurrency {
	length := readInt32(reader)
	if length == 0 {
		return nil
	}
	result := make([]FiatCurrency, 0, length)
	for i := int32(0); i < length; i++ {
		result = append(result, FfiConverterFiatCurrencyINSTANCE.Read(reader))
	}
	return result
}

func (c FfiConverterSequenceFiatCurrency) Lower(value []FiatCurrency) C.RustBuffer {
	return LowerIntoRustBuffer[[]FiatCurrency](c, value)
}

func (c FfiConverterSequenceFiatCurrency) LowerExternal(value []FiatCurrency) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[[]FiatCurrency](c, value))
}

func (c FfiConverterSequenceFiatCurrency) Write(writer io.Writer, value []FiatCurrency) {
	if len(value) > math.MaxInt32 {
		panic("[]FiatCurrency is too large to fit into Int32")
	}

	writeInt32(writer, int32(len(value)))
	for _, item := range value {
		FfiConverterFiatCurrencyINSTANCE.Write(writer, item)
	}
}

type FfiDestroyerSequenceFiatCurrency struct{}

func (FfiDestroyerSequenceFiatCurrency) Destroy(sequence []FiatCurrency) {
	for _, value := range sequence {
		FfiDestroyerFiatCurrency{}.Destroy(value)
	}
}

type FfiConverterSequenceIdentifierCommitmentPair struct{}

var FfiConverterSequenceIdentifierCommitmentPairINSTANCE = FfiConverterSequenceIdentifierCommitmentPair{}

func (c FfiConverterSequenceIdentifierCommitmentPair) Lift(rb RustBufferI) []IdentifierCommitmentPair {
	return LiftFromRustBuffer[[]IdentifierCommitmentPair](c, rb)
}

func (c FfiConverterSequenceIdentifierCommitmentPair) Read(reader io.Reader) []IdentifierCommitmentPair {
	length := readInt32(reader)
	if length == 0 {
		return nil
	}
	result := make([]IdentifierCommitmentPair, 0, length)
	for i := int32(0); i < length; i++ {
		result = append(result, FfiConverterIdentifierCommitmentPairINSTANCE.Read(reader))
	}
	return result
}

func (c FfiConverterSequenceIdentifierCommitmentPair) Lower(value []IdentifierCommitmentPair) C.RustBuffer {
	return LowerIntoRustBuffer[[]IdentifierCommitmentPair](c, value)
}

func (c FfiConverterSequenceIdentifierCommitmentPair) LowerExternal(value []IdentifierCommitmentPair) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[[]IdentifierCommitmentPair](c, value))
}

func (c FfiConverterSequenceIdentifierCommitmentPair) Write(writer io.Writer, value []IdentifierCommitmentPair) {
	if len(value) > math.MaxInt32 {
		panic("[]IdentifierCommitmentPair is too large to fit into Int32")
	}

	writeInt32(writer, int32(len(value)))
	for _, item := range value {
		FfiConverterIdentifierCommitmentPairINSTANCE.Write(writer, item)
	}
}

type FfiDestroyerSequenceIdentifierCommitmentPair struct{}

func (FfiDestroyerSequenceIdentifierCommitmentPair) Destroy(sequence []IdentifierCommitmentPair) {
	for _, value := range sequence {
		FfiDestroyerIdentifierCommitmentPair{}.Destroy(value)
	}
}

type FfiConverterSequenceIdentifierPublicKeyPair struct{}

var FfiConverterSequenceIdentifierPublicKeyPairINSTANCE = FfiConverterSequenceIdentifierPublicKeyPair{}

func (c FfiConverterSequenceIdentifierPublicKeyPair) Lift(rb RustBufferI) []IdentifierPublicKeyPair {
	return LiftFromRustBuffer[[]IdentifierPublicKeyPair](c, rb)
}

func (c FfiConverterSequenceIdentifierPublicKeyPair) Read(reader io.Reader) []IdentifierPublicKeyPair {
	length := readInt32(reader)
	if length == 0 {
		return nil
	}
	result := make([]IdentifierPublicKeyPair, 0, length)
	for i := int32(0); i < length; i++ {
		result = append(result, FfiConverterIdentifierPublicKeyPairINSTANCE.Read(reader))
	}
	return result
}

func (c FfiConverterSequenceIdentifierPublicKeyPair) Lower(value []IdentifierPublicKeyPair) C.RustBuffer {
	return LowerIntoRustBuffer[[]IdentifierPublicKeyPair](c, value)
}

func (c FfiConverterSequenceIdentifierPublicKeyPair) LowerExternal(value []IdentifierPublicKeyPair) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[[]IdentifierPublicKeyPair](c, value))
}

func (c FfiConverterSequenceIdentifierPublicKeyPair) Write(writer io.Writer, value []IdentifierPublicKeyPair) {
	if len(value) > math.MaxInt32 {
		panic("[]IdentifierPublicKeyPair is too large to fit into Int32")
	}

	writeInt32(writer, int32(len(value)))
	for _, item := range value {
		FfiConverterIdentifierPublicKeyPairINSTANCE.Write(writer, item)
	}
}

type FfiDestroyerSequenceIdentifierPublicKeyPair struct{}

func (FfiDestroyerSequenceIdentifierPublicKeyPair) Destroy(sequence []IdentifierPublicKeyPair) {
	for _, value := range sequence {
		FfiDestroyerIdentifierPublicKeyPair{}.Destroy(value)
	}
}

type FfiConverterSequenceIdentifierSignaturePair struct{}

var FfiConverterSequenceIdentifierSignaturePairINSTANCE = FfiConverterSequenceIdentifierSignaturePair{}

func (c FfiConverterSequenceIdentifierSignaturePair) Lift(rb RustBufferI) []IdentifierSignaturePair {
	return LiftFromRustBuffer[[]IdentifierSignaturePair](c, rb)
}

func (c FfiConverterSequenceIdentifierSignaturePair) Read(reader io.Reader) []IdentifierSignaturePair {
	length := readInt32(reader)
	if length == 0 {
		return nil
	}
	result := make([]IdentifierSignaturePair, 0, length)
	for i := int32(0); i < length; i++ {
		result = append(result, FfiConverterIdentifierSignaturePairINSTANCE.Read(reader))
	}
	return result
}

func (c FfiConverterSequenceIdentifierSignaturePair) Lower(value []IdentifierSignaturePair) C.RustBuffer {
	return LowerIntoRustBuffer[[]IdentifierSignaturePair](c, value)
}

func (c FfiConverterSequenceIdentifierSignaturePair) LowerExternal(value []IdentifierSignaturePair) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[[]IdentifierSignaturePair](c, value))
}

func (c FfiConverterSequenceIdentifierSignaturePair) Write(writer io.Writer, value []IdentifierSignaturePair) {
	if len(value) > math.MaxInt32 {
		panic("[]IdentifierSignaturePair is too large to fit into Int32")
	}

	writeInt32(writer, int32(len(value)))
	for _, item := range value {
		FfiConverterIdentifierSignaturePairINSTANCE.Write(writer, item)
	}
}

type FfiDestroyerSequenceIdentifierSignaturePair struct{}

func (FfiDestroyerSequenceIdentifierSignaturePair) Destroy(sequence []IdentifierSignaturePair) {
	for _, value := range sequence {
		FfiDestroyerIdentifierSignaturePair{}.Destroy(value)
	}
}

type FfiConverterSequenceIncomingChange struct{}

var FfiConverterSequenceIncomingChangeINSTANCE = FfiConverterSequenceIncomingChange{}

func (c FfiConverterSequenceIncomingChange) Lift(rb RustBufferI) []IncomingChange {
	return LiftFromRustBuffer[[]IncomingChange](c, rb)
}

func (c FfiConverterSequenceIncomingChange) Read(reader io.Reader) []IncomingChange {
	length := readInt32(reader)
	if length == 0 {
		return nil
	}
	result := make([]IncomingChange, 0, length)
	for i := int32(0); i < length; i++ {
		result = append(result, FfiConverterIncomingChangeINSTANCE.Read(reader))
	}
	return result
}

func (c FfiConverterSequenceIncomingChange) Lower(value []IncomingChange) C.RustBuffer {
	return LowerIntoRustBuffer[[]IncomingChange](c, value)
}

func (c FfiConverterSequenceIncomingChange) LowerExternal(value []IncomingChange) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[[]IncomingChange](c, value))
}

func (c FfiConverterSequenceIncomingChange) Write(writer io.Writer, value []IncomingChange) {
	if len(value) > math.MaxInt32 {
		panic("[]IncomingChange is too large to fit into Int32")
	}

	writeInt32(writer, int32(len(value)))
	for _, item := range value {
		FfiConverterIncomingChangeINSTANCE.Write(writer, item)
	}
}

type FfiDestroyerSequenceIncomingChange struct{}

func (FfiDestroyerSequenceIncomingChange) Destroy(sequence []IncomingChange) {
	for _, value := range sequence {
		FfiDestroyerIncomingChange{}.Destroy(value)
	}
}

type FfiConverterSequenceLocaleOverrides struct{}

var FfiConverterSequenceLocaleOverridesINSTANCE = FfiConverterSequenceLocaleOverrides{}

func (c FfiConverterSequenceLocaleOverrides) Lift(rb RustBufferI) []LocaleOverrides {
	return LiftFromRustBuffer[[]LocaleOverrides](c, rb)
}

func (c FfiConverterSequenceLocaleOverrides) Read(reader io.Reader) []LocaleOverrides {
	length := readInt32(reader)
	if length == 0 {
		return nil
	}
	result := make([]LocaleOverrides, 0, length)
	for i := int32(0); i < length; i++ {
		result = append(result, FfiConverterLocaleOverridesINSTANCE.Read(reader))
	}
	return result
}

func (c FfiConverterSequenceLocaleOverrides) Lower(value []LocaleOverrides) C.RustBuffer {
	return LowerIntoRustBuffer[[]LocaleOverrides](c, value)
}

func (c FfiConverterSequenceLocaleOverrides) LowerExternal(value []LocaleOverrides) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[[]LocaleOverrides](c, value))
}

func (c FfiConverterSequenceLocaleOverrides) Write(writer io.Writer, value []LocaleOverrides) {
	if len(value) > math.MaxInt32 {
		panic("[]LocaleOverrides is too large to fit into Int32")
	}

	writeInt32(writer, int32(len(value)))
	for _, item := range value {
		FfiConverterLocaleOverridesINSTANCE.Write(writer, item)
	}
}

type FfiDestroyerSequenceLocaleOverrides struct{}

func (FfiDestroyerSequenceLocaleOverrides) Destroy(sequence []LocaleOverrides) {
	for _, value := range sequence {
		FfiDestroyerLocaleOverrides{}.Destroy(value)
	}
}

type FfiConverterSequenceLocalizedName struct{}

var FfiConverterSequenceLocalizedNameINSTANCE = FfiConverterSequenceLocalizedName{}

func (c FfiConverterSequenceLocalizedName) Lift(rb RustBufferI) []LocalizedName {
	return LiftFromRustBuffer[[]LocalizedName](c, rb)
}

func (c FfiConverterSequenceLocalizedName) Read(reader io.Reader) []LocalizedName {
	length := readInt32(reader)
	if length == 0 {
		return nil
	}
	result := make([]LocalizedName, 0, length)
	for i := int32(0); i < length; i++ {
		result = append(result, FfiConverterLocalizedNameINSTANCE.Read(reader))
	}
	return result
}

func (c FfiConverterSequenceLocalizedName) Lower(value []LocalizedName) C.RustBuffer {
	return LowerIntoRustBuffer[[]LocalizedName](c, value)
}

func (c FfiConverterSequenceLocalizedName) LowerExternal(value []LocalizedName) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[[]LocalizedName](c, value))
}

func (c FfiConverterSequenceLocalizedName) Write(writer io.Writer, value []LocalizedName) {
	if len(value) > math.MaxInt32 {
		panic("[]LocalizedName is too large to fit into Int32")
	}

	writeInt32(writer, int32(len(value)))
	for _, item := range value {
		FfiConverterLocalizedNameINSTANCE.Write(writer, item)
	}
}

type FfiDestroyerSequenceLocalizedName struct{}

func (FfiDestroyerSequenceLocalizedName) Destroy(sequence []LocalizedName) {
	for _, value := range sequence {
		FfiDestroyerLocalizedName{}.Destroy(value)
	}
}

type FfiConverterSequenceOutgoingChange struct{}

var FfiConverterSequenceOutgoingChangeINSTANCE = FfiConverterSequenceOutgoingChange{}

func (c FfiConverterSequenceOutgoingChange) Lift(rb RustBufferI) []OutgoingChange {
	return LiftFromRustBuffer[[]OutgoingChange](c, rb)
}

func (c FfiConverterSequenceOutgoingChange) Read(reader io.Reader) []OutgoingChange {
	length := readInt32(reader)
	if length == 0 {
		return nil
	}
	result := make([]OutgoingChange, 0, length)
	for i := int32(0); i < length; i++ {
		result = append(result, FfiConverterOutgoingChangeINSTANCE.Read(reader))
	}
	return result
}

func (c FfiConverterSequenceOutgoingChange) Lower(value []OutgoingChange) C.RustBuffer {
	return LowerIntoRustBuffer[[]OutgoingChange](c, value)
}

func (c FfiConverterSequenceOutgoingChange) LowerExternal(value []OutgoingChange) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[[]OutgoingChange](c, value))
}

func (c FfiConverterSequenceOutgoingChange) Write(writer io.Writer, value []OutgoingChange) {
	if len(value) > math.MaxInt32 {
		panic("[]OutgoingChange is too large to fit into Int32")
	}

	writeInt32(writer, int32(len(value)))
	for _, item := range value {
		FfiConverterOutgoingChangeINSTANCE.Write(writer, item)
	}
}

type FfiDestroyerSequenceOutgoingChange struct{}

func (FfiDestroyerSequenceOutgoingChange) Destroy(sequence []OutgoingChange) {
	for _, value := range sequence {
		FfiDestroyerOutgoingChange{}.Destroy(value)
	}
}

type FfiConverterSequencePayment struct{}

var FfiConverterSequencePaymentINSTANCE = FfiConverterSequencePayment{}

func (c FfiConverterSequencePayment) Lift(rb RustBufferI) []Payment {
	return LiftFromRustBuffer[[]Payment](c, rb)
}

func (c FfiConverterSequencePayment) Read(reader io.Reader) []Payment {
	length := readInt32(reader)
	if length == 0 {
		return nil
	}
	result := make([]Payment, 0, length)
	for i := int32(0); i < length; i++ {
		result = append(result, FfiConverterPaymentINSTANCE.Read(reader))
	}
	return result
}

func (c FfiConverterSequencePayment) Lower(value []Payment) C.RustBuffer {
	return LowerIntoRustBuffer[[]Payment](c, value)
}

func (c FfiConverterSequencePayment) LowerExternal(value []Payment) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[[]Payment](c, value))
}

func (c FfiConverterSequencePayment) Write(writer io.Writer, value []Payment) {
	if len(value) > math.MaxInt32 {
		panic("[]Payment is too large to fit into Int32")
	}

	writeInt32(writer, int32(len(value)))
	for _, item := range value {
		FfiConverterPaymentINSTANCE.Write(writer, item)
	}
}

type FfiDestroyerSequencePayment struct{}

func (FfiDestroyerSequencePayment) Destroy(sequence []Payment) {
	for _, value := range sequence {
		FfiDestroyerPayment{}.Destroy(value)
	}
}

type FfiConverterSequenceProvisionalPayment struct{}

var FfiConverterSequenceProvisionalPaymentINSTANCE = FfiConverterSequenceProvisionalPayment{}

func (c FfiConverterSequenceProvisionalPayment) Lift(rb RustBufferI) []ProvisionalPayment {
	return LiftFromRustBuffer[[]ProvisionalPayment](c, rb)
}

func (c FfiConverterSequenceProvisionalPayment) Read(reader io.Reader) []ProvisionalPayment {
	length := readInt32(reader)
	if length == 0 {
		return nil
	}
	result := make([]ProvisionalPayment, 0, length)
	for i := int32(0); i < length; i++ {
		result = append(result, FfiConverterProvisionalPaymentINSTANCE.Read(reader))
	}
	return result
}

func (c FfiConverterSequenceProvisionalPayment) Lower(value []ProvisionalPayment) C.RustBuffer {
	return LowerIntoRustBuffer[[]ProvisionalPayment](c, value)
}

func (c FfiConverterSequenceProvisionalPayment) LowerExternal(value []ProvisionalPayment) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[[]ProvisionalPayment](c, value))
}

func (c FfiConverterSequenceProvisionalPayment) Write(writer io.Writer, value []ProvisionalPayment) {
	if len(value) > math.MaxInt32 {
		panic("[]ProvisionalPayment is too large to fit into Int32")
	}

	writeInt32(writer, int32(len(value)))
	for _, item := range value {
		FfiConverterProvisionalPaymentINSTANCE.Write(writer, item)
	}
}

type FfiDestroyerSequenceProvisionalPayment struct{}

func (FfiDestroyerSequenceProvisionalPayment) Destroy(sequence []ProvisionalPayment) {
	for _, value := range sequence {
		FfiDestroyerProvisionalPayment{}.Destroy(value)
	}
}

type FfiConverterSequenceRate struct{}

var FfiConverterSequenceRateINSTANCE = FfiConverterSequenceRate{}

func (c FfiConverterSequenceRate) Lift(rb RustBufferI) []Rate {
	return LiftFromRustBuffer[[]Rate](c, rb)
}

func (c FfiConverterSequenceRate) Read(reader io.Reader) []Rate {
	length := readInt32(reader)
	if length == 0 {
		return nil
	}
	result := make([]Rate, 0, length)
	for i := int32(0); i < length; i++ {
		result = append(result, FfiConverterRateINSTANCE.Read(reader))
	}
	return result
}

func (c FfiConverterSequenceRate) Lower(value []Rate) C.RustBuffer {
	return LowerIntoRustBuffer[[]Rate](c, value)
}

func (c FfiConverterSequenceRate) LowerExternal(value []Rate) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[[]Rate](c, value))
}

func (c FfiConverterSequenceRate) Write(writer io.Writer, value []Rate) {
	if len(value) > math.MaxInt32 {
		panic("[]Rate is too large to fit into Int32")
	}

	writeInt32(writer, int32(len(value)))
	for _, item := range value {
		FfiConverterRateINSTANCE.Write(writer, item)
	}
}

type FfiDestroyerSequenceRate struct{}

func (FfiDestroyerSequenceRate) Destroy(sequence []Rate) {
	for _, value := range sequence {
		FfiDestroyerRate{}.Destroy(value)
	}
}

type FfiConverterSequenceRecord struct{}

var FfiConverterSequenceRecordINSTANCE = FfiConverterSequenceRecord{}

func (c FfiConverterSequenceRecord) Lift(rb RustBufferI) []Record {
	return LiftFromRustBuffer[[]Record](c, rb)
}

func (c FfiConverterSequenceRecord) Read(reader io.Reader) []Record {
	length := readInt32(reader)
	if length == 0 {
		return nil
	}
	result := make([]Record, 0, length)
	for i := int32(0); i < length; i++ {
		result = append(result, FfiConverterRecordINSTANCE.Read(reader))
	}
	return result
}

func (c FfiConverterSequenceRecord) Lower(value []Record) C.RustBuffer {
	return LowerIntoRustBuffer[[]Record](c, value)
}

func (c FfiConverterSequenceRecord) LowerExternal(value []Record) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[[]Record](c, value))
}

func (c FfiConverterSequenceRecord) Write(writer io.Writer, value []Record) {
	if len(value) > math.MaxInt32 {
		panic("[]Record is too large to fit into Int32")
	}

	writeInt32(writer, int32(len(value)))
	for _, item := range value {
		FfiConverterRecordINSTANCE.Write(writer, item)
	}
}

type FfiDestroyerSequenceRecord struct{}

func (FfiDestroyerSequenceRecord) Destroy(sequence []Record) {
	for _, value := range sequence {
		FfiDestroyerRecord{}.Destroy(value)
	}
}

type FfiConverterSequenceSetLnurlMetadataItem struct{}

var FfiConverterSequenceSetLnurlMetadataItemINSTANCE = FfiConverterSequenceSetLnurlMetadataItem{}

func (c FfiConverterSequenceSetLnurlMetadataItem) Lift(rb RustBufferI) []SetLnurlMetadataItem {
	return LiftFromRustBuffer[[]SetLnurlMetadataItem](c, rb)
}

func (c FfiConverterSequenceSetLnurlMetadataItem) Read(reader io.Reader) []SetLnurlMetadataItem {
	length := readInt32(reader)
	if length == 0 {
		return nil
	}
	result := make([]SetLnurlMetadataItem, 0, length)
	for i := int32(0); i < length; i++ {
		result = append(result, FfiConverterSetLnurlMetadataItemINSTANCE.Read(reader))
	}
	return result
}

func (c FfiConverterSequenceSetLnurlMetadataItem) Lower(value []SetLnurlMetadataItem) C.RustBuffer {
	return LowerIntoRustBuffer[[]SetLnurlMetadataItem](c, value)
}

func (c FfiConverterSequenceSetLnurlMetadataItem) LowerExternal(value []SetLnurlMetadataItem) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[[]SetLnurlMetadataItem](c, value))
}

func (c FfiConverterSequenceSetLnurlMetadataItem) Write(writer io.Writer, value []SetLnurlMetadataItem) {
	if len(value) > math.MaxInt32 {
		panic("[]SetLnurlMetadataItem is too large to fit into Int32")
	}

	writeInt32(writer, int32(len(value)))
	for _, item := range value {
		FfiConverterSetLnurlMetadataItemINSTANCE.Write(writer, item)
	}
}

type FfiDestroyerSequenceSetLnurlMetadataItem struct{}

func (FfiDestroyerSequenceSetLnurlMetadataItem) Destroy(sequence []SetLnurlMetadataItem) {
	for _, value := range sequence {
		FfiDestroyerSetLnurlMetadataItem{}.Destroy(value)
	}
}

type FfiConverterSequenceSparkSigningOperator struct{}

var FfiConverterSequenceSparkSigningOperatorINSTANCE = FfiConverterSequenceSparkSigningOperator{}

func (c FfiConverterSequenceSparkSigningOperator) Lift(rb RustBufferI) []SparkSigningOperator {
	return LiftFromRustBuffer[[]SparkSigningOperator](c, rb)
}

func (c FfiConverterSequenceSparkSigningOperator) Read(reader io.Reader) []SparkSigningOperator {
	length := readInt32(reader)
	if length == 0 {
		return nil
	}
	result := make([]SparkSigningOperator, 0, length)
	for i := int32(0); i < length; i++ {
		result = append(result, FfiConverterSparkSigningOperatorINSTANCE.Read(reader))
	}
	return result
}

func (c FfiConverterSequenceSparkSigningOperator) Lower(value []SparkSigningOperator) C.RustBuffer {
	return LowerIntoRustBuffer[[]SparkSigningOperator](c, value)
}

func (c FfiConverterSequenceSparkSigningOperator) LowerExternal(value []SparkSigningOperator) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[[]SparkSigningOperator](c, value))
}

func (c FfiConverterSequenceSparkSigningOperator) Write(writer io.Writer, value []SparkSigningOperator) {
	if len(value) > math.MaxInt32 {
		panic("[]SparkSigningOperator is too large to fit into Int32")
	}

	writeInt32(writer, int32(len(value)))
	for _, item := range value {
		FfiConverterSparkSigningOperatorINSTANCE.Write(writer, item)
	}
}

type FfiDestroyerSequenceSparkSigningOperator struct{}

func (FfiDestroyerSequenceSparkSigningOperator) Destroy(sequence []SparkSigningOperator) {
	for _, value := range sequence {
		FfiDestroyerSparkSigningOperator{}.Destroy(value)
	}
}

type FfiConverterSequenceStableBalanceToken struct{}

var FfiConverterSequenceStableBalanceTokenINSTANCE = FfiConverterSequenceStableBalanceToken{}

func (c FfiConverterSequenceStableBalanceToken) Lift(rb RustBufferI) []StableBalanceToken {
	return LiftFromRustBuffer[[]StableBalanceToken](c, rb)
}

func (c FfiConverterSequenceStableBalanceToken) Read(reader io.Reader) []StableBalanceToken {
	length := readInt32(reader)
	if length == 0 {
		return nil
	}
	result := make([]StableBalanceToken, 0, length)
	for i := int32(0); i < length; i++ {
		result = append(result, FfiConverterStableBalanceTokenINSTANCE.Read(reader))
	}
	return result
}

func (c FfiConverterSequenceStableBalanceToken) Lower(value []StableBalanceToken) C.RustBuffer {
	return LowerIntoRustBuffer[[]StableBalanceToken](c, value)
}

func (c FfiConverterSequenceStableBalanceToken) LowerExternal(value []StableBalanceToken) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[[]StableBalanceToken](c, value))
}

func (c FfiConverterSequenceStableBalanceToken) Write(writer io.Writer, value []StableBalanceToken) {
	if len(value) > math.MaxInt32 {
		panic("[]StableBalanceToken is too large to fit into Int32")
	}

	writeInt32(writer, int32(len(value)))
	for _, item := range value {
		FfiConverterStableBalanceTokenINSTANCE.Write(writer, item)
	}
}

type FfiDestroyerSequenceStableBalanceToken struct{}

func (FfiDestroyerSequenceStableBalanceToken) Destroy(sequence []StableBalanceToken) {
	for _, value := range sequence {
		FfiDestroyerStableBalanceToken{}.Destroy(value)
	}
}

type FfiConverterSequenceTokenMetadata struct{}

var FfiConverterSequenceTokenMetadataINSTANCE = FfiConverterSequenceTokenMetadata{}

func (c FfiConverterSequenceTokenMetadata) Lift(rb RustBufferI) []TokenMetadata {
	return LiftFromRustBuffer[[]TokenMetadata](c, rb)
}

func (c FfiConverterSequenceTokenMetadata) Read(reader io.Reader) []TokenMetadata {
	length := readInt32(reader)
	if length == 0 {
		return nil
	}
	result := make([]TokenMetadata, 0, length)
	for i := int32(0); i < length; i++ {
		result = append(result, FfiConverterTokenMetadataINSTANCE.Read(reader))
	}
	return result
}

func (c FfiConverterSequenceTokenMetadata) Lower(value []TokenMetadata) C.RustBuffer {
	return LowerIntoRustBuffer[[]TokenMetadata](c, value)
}

func (c FfiConverterSequenceTokenMetadata) LowerExternal(value []TokenMetadata) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[[]TokenMetadata](c, value))
}

func (c FfiConverterSequenceTokenMetadata) Write(writer io.Writer, value []TokenMetadata) {
	if len(value) > math.MaxInt32 {
		panic("[]TokenMetadata is too large to fit into Int32")
	}

	writeInt32(writer, int32(len(value)))
	for _, item := range value {
		FfiConverterTokenMetadataINSTANCE.Write(writer, item)
	}
}

type FfiDestroyerSequenceTokenMetadata struct{}

func (FfiDestroyerSequenceTokenMetadata) Destroy(sequence []TokenMetadata) {
	for _, value := range sequence {
		FfiDestroyerTokenMetadata{}.Destroy(value)
	}
}

type FfiConverterSequenceUtxo struct{}

var FfiConverterSequenceUtxoINSTANCE = FfiConverterSequenceUtxo{}

func (c FfiConverterSequenceUtxo) Lift(rb RustBufferI) []Utxo {
	return LiftFromRustBuffer[[]Utxo](c, rb)
}

func (c FfiConverterSequenceUtxo) Read(reader io.Reader) []Utxo {
	length := readInt32(reader)
	if length == 0 {
		return nil
	}
	result := make([]Utxo, 0, length)
	for i := int32(0); i < length; i++ {
		result = append(result, FfiConverterUtxoINSTANCE.Read(reader))
	}
	return result
}

func (c FfiConverterSequenceUtxo) Lower(value []Utxo) C.RustBuffer {
	return LowerIntoRustBuffer[[]Utxo](c, value)
}

func (c FfiConverterSequenceUtxo) LowerExternal(value []Utxo) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[[]Utxo](c, value))
}

func (c FfiConverterSequenceUtxo) Write(writer io.Writer, value []Utxo) {
	if len(value) > math.MaxInt32 {
		panic("[]Utxo is too large to fit into Int32")
	}

	writeInt32(writer, int32(len(value)))
	for _, item := range value {
		FfiConverterUtxoINSTANCE.Write(writer, item)
	}
}

type FfiDestroyerSequenceUtxo struct{}

func (FfiDestroyerSequenceUtxo) Destroy(sequence []Utxo) {
	for _, value := range sequence {
		FfiDestroyerUtxo{}.Destroy(value)
	}
}

type FfiConverterSequenceWebhook struct{}

var FfiConverterSequenceWebhookINSTANCE = FfiConverterSequenceWebhook{}

func (c FfiConverterSequenceWebhook) Lift(rb RustBufferI) []Webhook {
	return LiftFromRustBuffer[[]Webhook](c, rb)
}

func (c FfiConverterSequenceWebhook) Read(reader io.Reader) []Webhook {
	length := readInt32(reader)
	if length == 0 {
		return nil
	}
	result := make([]Webhook, 0, length)
	for i := int32(0); i < length; i++ {
		result = append(result, FfiConverterWebhookINSTANCE.Read(reader))
	}
	return result
}

func (c FfiConverterSequenceWebhook) Lower(value []Webhook) C.RustBuffer {
	return LowerIntoRustBuffer[[]Webhook](c, value)
}

func (c FfiConverterSequenceWebhook) LowerExternal(value []Webhook) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[[]Webhook](c, value))
}

func (c FfiConverterSequenceWebhook) Write(writer io.Writer, value []Webhook) {
	if len(value) > math.MaxInt32 {
		panic("[]Webhook is too large to fit into Int32")
	}

	writeInt32(writer, int32(len(value)))
	for _, item := range value {
		FfiConverterWebhookINSTANCE.Write(writer, item)
	}
}

type FfiDestroyerSequenceWebhook struct{}

func (FfiDestroyerSequenceWebhook) Destroy(sequence []Webhook) {
	for _, value := range sequence {
		FfiDestroyerWebhook{}.Destroy(value)
	}
}

type FfiConverterSequenceInputType struct{}

var FfiConverterSequenceInputTypeINSTANCE = FfiConverterSequenceInputType{}

func (c FfiConverterSequenceInputType) Lift(rb RustBufferI) []InputType {
	return LiftFromRustBuffer[[]InputType](c, rb)
}

func (c FfiConverterSequenceInputType) Read(reader io.Reader) []InputType {
	length := readInt32(reader)
	if length == 0 {
		return nil
	}
	result := make([]InputType, 0, length)
	for i := int32(0); i < length; i++ {
		result = append(result, FfiConverterInputTypeINSTANCE.Read(reader))
	}
	return result
}

func (c FfiConverterSequenceInputType) Lower(value []InputType) C.RustBuffer {
	return LowerIntoRustBuffer[[]InputType](c, value)
}

func (c FfiConverterSequenceInputType) LowerExternal(value []InputType) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[[]InputType](c, value))
}

func (c FfiConverterSequenceInputType) Write(writer io.Writer, value []InputType) {
	if len(value) > math.MaxInt32 {
		panic("[]InputType is too large to fit into Int32")
	}

	writeInt32(writer, int32(len(value)))
	for _, item := range value {
		FfiConverterInputTypeINSTANCE.Write(writer, item)
	}
}

type FfiDestroyerSequenceInputType struct{}

func (FfiDestroyerSequenceInputType) Destroy(sequence []InputType) {
	for _, value := range sequence {
		FfiDestroyerInputType{}.Destroy(value)
	}
}

type FfiConverterSequencePaymentDetailsFilter struct{}

var FfiConverterSequencePaymentDetailsFilterINSTANCE = FfiConverterSequencePaymentDetailsFilter{}

func (c FfiConverterSequencePaymentDetailsFilter) Lift(rb RustBufferI) []PaymentDetailsFilter {
	return LiftFromRustBuffer[[]PaymentDetailsFilter](c, rb)
}

func (c FfiConverterSequencePaymentDetailsFilter) Read(reader io.Reader) []PaymentDetailsFilter {
	length := readInt32(reader)
	if length == 0 {
		return nil
	}
	result := make([]PaymentDetailsFilter, 0, length)
	for i := int32(0); i < length; i++ {
		result = append(result, FfiConverterPaymentDetailsFilterINSTANCE.Read(reader))
	}
	return result
}

func (c FfiConverterSequencePaymentDetailsFilter) Lower(value []PaymentDetailsFilter) C.RustBuffer {
	return LowerIntoRustBuffer[[]PaymentDetailsFilter](c, value)
}

func (c FfiConverterSequencePaymentDetailsFilter) LowerExternal(value []PaymentDetailsFilter) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[[]PaymentDetailsFilter](c, value))
}

func (c FfiConverterSequencePaymentDetailsFilter) Write(writer io.Writer, value []PaymentDetailsFilter) {
	if len(value) > math.MaxInt32 {
		panic("[]PaymentDetailsFilter is too large to fit into Int32")
	}

	writeInt32(writer, int32(len(value)))
	for _, item := range value {
		FfiConverterPaymentDetailsFilterINSTANCE.Write(writer, item)
	}
}

type FfiDestroyerSequencePaymentDetailsFilter struct{}

func (FfiDestroyerSequencePaymentDetailsFilter) Destroy(sequence []PaymentDetailsFilter) {
	for _, value := range sequence {
		FfiDestroyerPaymentDetailsFilter{}.Destroy(value)
	}
}

type FfiConverterSequencePaymentStatus struct{}

var FfiConverterSequencePaymentStatusINSTANCE = FfiConverterSequencePaymentStatus{}

func (c FfiConverterSequencePaymentStatus) Lift(rb RustBufferI) []PaymentStatus {
	return LiftFromRustBuffer[[]PaymentStatus](c, rb)
}

func (c FfiConverterSequencePaymentStatus) Read(reader io.Reader) []PaymentStatus {
	length := readInt32(reader)
	if length == 0 {
		return nil
	}
	result := make([]PaymentStatus, 0, length)
	for i := int32(0); i < length; i++ {
		result = append(result, FfiConverterPaymentStatusINSTANCE.Read(reader))
	}
	return result
}

func (c FfiConverterSequencePaymentStatus) Lower(value []PaymentStatus) C.RustBuffer {
	return LowerIntoRustBuffer[[]PaymentStatus](c, value)
}

func (c FfiConverterSequencePaymentStatus) LowerExternal(value []PaymentStatus) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[[]PaymentStatus](c, value))
}

func (c FfiConverterSequencePaymentStatus) Write(writer io.Writer, value []PaymentStatus) {
	if len(value) > math.MaxInt32 {
		panic("[]PaymentStatus is too large to fit into Int32")
	}

	writeInt32(writer, int32(len(value)))
	for _, item := range value {
		FfiConverterPaymentStatusINSTANCE.Write(writer, item)
	}
}

type FfiDestroyerSequencePaymentStatus struct{}

func (FfiDestroyerSequencePaymentStatus) Destroy(sequence []PaymentStatus) {
	for _, value := range sequence {
		FfiDestroyerPaymentStatus{}.Destroy(value)
	}
}

type FfiConverterSequencePaymentType struct{}

var FfiConverterSequencePaymentTypeINSTANCE = FfiConverterSequencePaymentType{}

func (c FfiConverterSequencePaymentType) Lift(rb RustBufferI) []PaymentType {
	return LiftFromRustBuffer[[]PaymentType](c, rb)
}

func (c FfiConverterSequencePaymentType) Read(reader io.Reader) []PaymentType {
	length := readInt32(reader)
	if length == 0 {
		return nil
	}
	result := make([]PaymentType, 0, length)
	for i := int32(0); i < length; i++ {
		result = append(result, FfiConverterPaymentTypeINSTANCE.Read(reader))
	}
	return result
}

func (c FfiConverterSequencePaymentType) Lower(value []PaymentType) C.RustBuffer {
	return LowerIntoRustBuffer[[]PaymentType](c, value)
}

func (c FfiConverterSequencePaymentType) LowerExternal(value []PaymentType) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[[]PaymentType](c, value))
}

func (c FfiConverterSequencePaymentType) Write(writer io.Writer, value []PaymentType) {
	if len(value) > math.MaxInt32 {
		panic("[]PaymentType is too large to fit into Int32")
	}

	writeInt32(writer, int32(len(value)))
	for _, item := range value {
		FfiConverterPaymentTypeINSTANCE.Write(writer, item)
	}
}

type FfiDestroyerSequencePaymentType struct{}

func (FfiDestroyerSequencePaymentType) Destroy(sequence []PaymentType) {
	for _, value := range sequence {
		FfiDestroyerPaymentType{}.Destroy(value)
	}
}

type FfiConverterSequenceSparkHtlcStatus struct{}

var FfiConverterSequenceSparkHtlcStatusINSTANCE = FfiConverterSequenceSparkHtlcStatus{}

func (c FfiConverterSequenceSparkHtlcStatus) Lift(rb RustBufferI) []SparkHtlcStatus {
	return LiftFromRustBuffer[[]SparkHtlcStatus](c, rb)
}

func (c FfiConverterSequenceSparkHtlcStatus) Read(reader io.Reader) []SparkHtlcStatus {
	length := readInt32(reader)
	if length == 0 {
		return nil
	}
	result := make([]SparkHtlcStatus, 0, length)
	for i := int32(0); i < length; i++ {
		result = append(result, FfiConverterSparkHtlcStatusINSTANCE.Read(reader))
	}
	return result
}

func (c FfiConverterSequenceSparkHtlcStatus) Lower(value []SparkHtlcStatus) C.RustBuffer {
	return LowerIntoRustBuffer[[]SparkHtlcStatus](c, value)
}

func (c FfiConverterSequenceSparkHtlcStatus) LowerExternal(value []SparkHtlcStatus) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[[]SparkHtlcStatus](c, value))
}

func (c FfiConverterSequenceSparkHtlcStatus) Write(writer io.Writer, value []SparkHtlcStatus) {
	if len(value) > math.MaxInt32 {
		panic("[]SparkHtlcStatus is too large to fit into Int32")
	}

	writeInt32(writer, int32(len(value)))
	for _, item := range value {
		FfiConverterSparkHtlcStatusINSTANCE.Write(writer, item)
	}
}

type FfiDestroyerSequenceSparkHtlcStatus struct{}

func (FfiDestroyerSequenceSparkHtlcStatus) Destroy(sequence []SparkHtlcStatus) {
	for _, value := range sequence {
		FfiDestroyerSparkHtlcStatus{}.Destroy(value)
	}
}

type FfiConverterSequenceStoragePaymentDetailsFilter struct{}

var FfiConverterSequenceStoragePaymentDetailsFilterINSTANCE = FfiConverterSequenceStoragePaymentDetailsFilter{}

func (c FfiConverterSequenceStoragePaymentDetailsFilter) Lift(rb RustBufferI) []StoragePaymentDetailsFilter {
	return LiftFromRustBuffer[[]StoragePaymentDetailsFilter](c, rb)
}

func (c FfiConverterSequenceStoragePaymentDetailsFilter) Read(reader io.Reader) []StoragePaymentDetailsFilter {
	length := readInt32(reader)
	if length == 0 {
		return nil
	}
	result := make([]StoragePaymentDetailsFilter, 0, length)
	for i := int32(0); i < length; i++ {
		result = append(result, FfiConverterStoragePaymentDetailsFilterINSTANCE.Read(reader))
	}
	return result
}

func (c FfiConverterSequenceStoragePaymentDetailsFilter) Lower(value []StoragePaymentDetailsFilter) C.RustBuffer {
	return LowerIntoRustBuffer[[]StoragePaymentDetailsFilter](c, value)
}

func (c FfiConverterSequenceStoragePaymentDetailsFilter) LowerExternal(value []StoragePaymentDetailsFilter) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[[]StoragePaymentDetailsFilter](c, value))
}

func (c FfiConverterSequenceStoragePaymentDetailsFilter) Write(writer io.Writer, value []StoragePaymentDetailsFilter) {
	if len(value) > math.MaxInt32 {
		panic("[]StoragePaymentDetailsFilter is too large to fit into Int32")
	}

	writeInt32(writer, int32(len(value)))
	for _, item := range value {
		FfiConverterStoragePaymentDetailsFilterINSTANCE.Write(writer, item)
	}
}

type FfiDestroyerSequenceStoragePaymentDetailsFilter struct{}

func (FfiDestroyerSequenceStoragePaymentDetailsFilter) Destroy(sequence []StoragePaymentDetailsFilter) {
	for _, value := range sequence {
		FfiDestroyerStoragePaymentDetailsFilter{}.Destroy(value)
	}
}

type FfiConverterSequenceWebhookEventType struct{}

var FfiConverterSequenceWebhookEventTypeINSTANCE = FfiConverterSequenceWebhookEventType{}

func (c FfiConverterSequenceWebhookEventType) Lift(rb RustBufferI) []WebhookEventType {
	return LiftFromRustBuffer[[]WebhookEventType](c, rb)
}

func (c FfiConverterSequenceWebhookEventType) Read(reader io.Reader) []WebhookEventType {
	length := readInt32(reader)
	if length == 0 {
		return nil
	}
	result := make([]WebhookEventType, 0, length)
	for i := int32(0); i < length; i++ {
		result = append(result, FfiConverterWebhookEventTypeINSTANCE.Read(reader))
	}
	return result
}

func (c FfiConverterSequenceWebhookEventType) Lower(value []WebhookEventType) C.RustBuffer {
	return LowerIntoRustBuffer[[]WebhookEventType](c, value)
}

func (c FfiConverterSequenceWebhookEventType) LowerExternal(value []WebhookEventType) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[[]WebhookEventType](c, value))
}

func (c FfiConverterSequenceWebhookEventType) Write(writer io.Writer, value []WebhookEventType) {
	if len(value) > math.MaxInt32 {
		panic("[]WebhookEventType is too large to fit into Int32")
	}

	writeInt32(writer, int32(len(value)))
	for _, item := range value {
		FfiConverterWebhookEventTypeINSTANCE.Write(writer, item)
	}
}

type FfiDestroyerSequenceWebhookEventType struct{}

func (FfiDestroyerSequenceWebhookEventType) Destroy(sequence []WebhookEventType) {
	for _, value := range sequence {
		FfiDestroyerWebhookEventType{}.Destroy(value)
	}
}

type FfiConverterMapStringString struct{}

var FfiConverterMapStringStringINSTANCE = FfiConverterMapStringString{}

func (c FfiConverterMapStringString) Lift(rb RustBufferI) map[string]string {
	return LiftFromRustBuffer[map[string]string](c, rb)
}

func (_ FfiConverterMapStringString) Read(reader io.Reader) map[string]string {
	result := make(map[string]string)
	length := readInt32(reader)
	for i := int32(0); i < length; i++ {
		key := FfiConverterStringINSTANCE.Read(reader)
		value := FfiConverterStringINSTANCE.Read(reader)
		result[key] = value
	}
	return result
}

func (c FfiConverterMapStringString) Lower(value map[string]string) C.RustBuffer {
	return LowerIntoRustBuffer[map[string]string](c, value)
}

func (c FfiConverterMapStringString) LowerExternal(value map[string]string) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[map[string]string](c, value))
}

func (_ FfiConverterMapStringString) Write(writer io.Writer, mapValue map[string]string) {
	if len(mapValue) > math.MaxInt32 {
		panic("map[string]string is too large to fit into Int32")
	}

	writeInt32(writer, int32(len(mapValue)))
	for key, value := range mapValue {
		FfiConverterStringINSTANCE.Write(writer, key)
		FfiConverterStringINSTANCE.Write(writer, value)
	}
}

type FfiDestroyerMapStringString struct{}

func (_ FfiDestroyerMapStringString) Destroy(mapValue map[string]string) {
	for key, value := range mapValue {
		FfiDestroyerString{}.Destroy(key)
		FfiDestroyerString{}.Destroy(value)
	}
}

type FfiConverterMapStringTokenBalance struct{}

var FfiConverterMapStringTokenBalanceINSTANCE = FfiConverterMapStringTokenBalance{}

func (c FfiConverterMapStringTokenBalance) Lift(rb RustBufferI) map[string]TokenBalance {
	return LiftFromRustBuffer[map[string]TokenBalance](c, rb)
}

func (_ FfiConverterMapStringTokenBalance) Read(reader io.Reader) map[string]TokenBalance {
	result := make(map[string]TokenBalance)
	length := readInt32(reader)
	for i := int32(0); i < length; i++ {
		key := FfiConverterStringINSTANCE.Read(reader)
		value := FfiConverterTokenBalanceINSTANCE.Read(reader)
		result[key] = value
	}
	return result
}

func (c FfiConverterMapStringTokenBalance) Lower(value map[string]TokenBalance) C.RustBuffer {
	return LowerIntoRustBuffer[map[string]TokenBalance](c, value)
}

func (c FfiConverterMapStringTokenBalance) LowerExternal(value map[string]TokenBalance) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[map[string]TokenBalance](c, value))
}

func (_ FfiConverterMapStringTokenBalance) Write(writer io.Writer, mapValue map[string]TokenBalance) {
	if len(mapValue) > math.MaxInt32 {
		panic("map[string]TokenBalance is too large to fit into Int32")
	}

	writeInt32(writer, int32(len(mapValue)))
	for key, value := range mapValue {
		FfiConverterStringINSTANCE.Write(writer, key)
		FfiConverterTokenBalanceINSTANCE.Write(writer, value)
	}
}

type FfiDestroyerMapStringTokenBalance struct{}

func (_ FfiDestroyerMapStringTokenBalance) Destroy(mapValue map[string]TokenBalance) {
	for key, value := range mapValue {
		FfiDestroyerString{}.Destroy(key)
		FfiDestroyerTokenBalance{}.Destroy(value)
	}
}

type FfiConverterMapStringSequencePayment struct{}

var FfiConverterMapStringSequencePaymentINSTANCE = FfiConverterMapStringSequencePayment{}

func (c FfiConverterMapStringSequencePayment) Lift(rb RustBufferI) map[string][]Payment {
	return LiftFromRustBuffer[map[string][]Payment](c, rb)
}

func (_ FfiConverterMapStringSequencePayment) Read(reader io.Reader) map[string][]Payment {
	result := make(map[string][]Payment)
	length := readInt32(reader)
	for i := int32(0); i < length; i++ {
		key := FfiConverterStringINSTANCE.Read(reader)
		value := FfiConverterSequencePaymentINSTANCE.Read(reader)
		result[key] = value
	}
	return result
}

func (c FfiConverterMapStringSequencePayment) Lower(value map[string][]Payment) C.RustBuffer {
	return LowerIntoRustBuffer[map[string][]Payment](c, value)
}

func (c FfiConverterMapStringSequencePayment) LowerExternal(value map[string][]Payment) ExternalCRustBuffer {
	return RustBufferFromC(LowerIntoRustBuffer[map[string][]Payment](c, value))
}

func (_ FfiConverterMapStringSequencePayment) Write(writer io.Writer, mapValue map[string][]Payment) {
	if len(mapValue) > math.MaxInt32 {
		panic("map[string][]Payment is too large to fit into Int32")
	}

	writeInt32(writer, int32(len(mapValue)))
	for key, value := range mapValue {
		FfiConverterStringINSTANCE.Write(writer, key)
		FfiConverterSequencePaymentINSTANCE.Write(writer, value)
	}
}

type FfiDestroyerMapStringSequencePayment struct{}

func (_ FfiDestroyerMapStringSequencePayment) Destroy(mapValue map[string][]Payment) {
	for key, value := range mapValue {
		FfiDestroyerString{}.Destroy(key)
		FfiDestroyerSequencePayment{}.Destroy(value)
	}
}

/**
 * Typealias from the type name used in the UDL file to the custom type.  This
 * is needed because the UDL type name is used in function/method signatures.
 * It's also what we have an external type that references a custom type.
 */
type u128 = *big.Int

type FfiConverterTypeu128 struct{}

var FfiConverterTypeu128INSTANCE = FfiConverterTypeu128{}

func (FfiConverterTypeu128) Lower(value u128) RustBufferI {
	builtinValue := value.String()
	ffiValue := FfiConverterStringINSTANCE.Lower(builtinValue)
	return GoRustBuffer{
		inner: ffiValue,
	}
}

func (FfiConverterTypeu128) Write(writer io.Writer, value u128) {
	builtinValue := value.String()
	FfiConverterStringINSTANCE.Write(writer, builtinValue)
}

func (FfiConverterTypeu128) Lift(value RustBufferI) u128 {
	builtinValue := FfiConverterStringINSTANCE.Lift(value)
	result, _ := new(big.Int).SetString(builtinValue, 10)
	return result

}

func (FfiConverterTypeu128) Read(reader io.Reader) u128 {
	builtinValue := FfiConverterStringINSTANCE.Read(reader)
	result, _ := new(big.Int).SetString(builtinValue, 10)
	return result

}

type FfiDestroyerTypeu128 struct{}

func (FfiDestroyerTypeu128) Destroy(value u128) {
	builtinValue := value.String()
	FfiDestroyerString{}.Destroy(builtinValue)
}

const (
	uniffiRustFuturePollReady      int8 = 0
	uniffiRustFuturePollMaybeReady int8 = 1
)

type rustFuturePollFunc func(C.uint64_t, C.UniffiRustFutureContinuationCallback, C.uint64_t)
type rustFutureCompleteFunc[T any] func(C.uint64_t, *C.RustCallStatus) T
type rustFutureFreeFunc func(C.uint64_t)

//export breez_sdk_spark_uniffiFutureContinuationCallback
func breez_sdk_spark_uniffiFutureContinuationCallback(data C.uint64_t, pollResult C.int8_t) {
	h := cgo.Handle(uintptr(data))
	waiter := h.Value().(chan int8)
	waiter <- int8(pollResult)
}

func uniffiRustCallAsync[E any, T any, F any](
	errConverter BufReader[*E],
	completeFunc rustFutureCompleteFunc[F],
	liftFunc func(F) T,
	rustFuture C.uint64_t,
	pollFunc rustFuturePollFunc,
	freeFunc rustFutureFreeFunc,
) (T, *E) {
	defer freeFunc(rustFuture)

	pollResult := int8(-1)
	waiter := make(chan int8, 1)

	chanHandle := cgo.NewHandle(waiter)
	defer chanHandle.Delete()

	for pollResult != uniffiRustFuturePollReady {
		pollFunc(
			rustFuture,
			(C.UniffiRustFutureContinuationCallback)(C.breez_sdk_spark_uniffiFutureContinuationCallback),
			C.uint64_t(chanHandle),
		)
		pollResult = <-waiter
	}

	var goValue T
	var ffiValue F
	var err *E

	ffiValue, err = rustCallWithError(errConverter, func(status *C.RustCallStatus) F {
		return completeFunc(rustFuture, status)
	})
	if err != nil {
		return goValue, err
	}
	return liftFunc(ffiValue), nil
}

//export breez_sdk_spark_uniffiFreeGorutine
func breez_sdk_spark_uniffiFreeGorutine(data C.uint64_t) {
	handle := cgo.Handle(uintptr(data))
	defer handle.Delete()

	guard := handle.Value().(chan struct{})
	guard <- struct{}{}
}

// Connects to the Spark network using the provided configuration and mnemonic.
//
// # Arguments
//
// * `request` - The connection request object
//
// # Returns
//
// Result containing either the initialized `BreezSdk` or an `SdkError`
func Connect(request ConnectRequest) (*BreezSdk, error) {
	res, err := uniffiRustCallAsync[SdkError](
		FfiConverterSdkErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) unsafe.Pointer {
			res := C.ffi_breez_sdk_spark_rust_future_complete_pointer(handle, status)
			return res
		},
		// liftFn
		func(ffi unsafe.Pointer) *BreezSdk {
			return FfiConverterBreezSdkINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_func_connect(FfiConverterConnectRequestINSTANCE.Lower(request)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_pointer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_pointer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

// Connects to the Spark network using an external signer.
//
// This method allows using a custom signer implementation instead of providing
// a seed directly.
//
// # Arguments
//
// * `request` - The connection request object with external signer
//
// # Returns
//
// Result containing either the initialized `BreezSdk` or an `SdkError`
func ConnectWithSigner(request ConnectWithSignerRequest) (*BreezSdk, error) {
	res, err := uniffiRustCallAsync[SdkError](
		FfiConverterSdkErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) unsafe.Pointer {
			res := C.ffi_breez_sdk_spark_rust_future_complete_pointer(handle, status)
			return res
		},
		// liftFn
		func(ffi unsafe.Pointer) *BreezSdk {
			return FfiConverterBreezSdkINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_func_connect_with_signer(FfiConverterConnectWithSignerRequestINSTANCE.Lower(request)),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_pointer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_pointer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

func DefaultConfig(network Network) Config {
	return FfiConverterConfigINSTANCE.Lift(rustCall(func(_uniffiStatus *C.RustCallStatus) RustBufferI {
		return GoRustBuffer{
			inner: C.uniffi_breez_sdk_spark_fn_func_default_config(FfiConverterNetworkINSTANCE.Lower(network), _uniffiStatus),
		}
	}))
}

// Creates a default external signer from a mnemonic.
//
// This is a convenience factory method for creating a signer that can be used
// with `connect_with_signer` or `SdkBuilder::new_with_signer`.
//
// # Arguments
//
// * `mnemonic` - BIP39 mnemonic phrase (12 or 24 words)
// * `passphrase` - Optional passphrase for the mnemonic
// * `network` - Network to use (Mainnet or Regtest)
// * `key_set_config` - Optional key set configuration. If None, uses default configuration.
//
// # Returns
//
// Result containing the signer as `Arc<dyn ExternalSigner>`
func DefaultExternalSigner(mnemonic string, passphrase *string, network Network, keySetConfig *KeySetConfig) (ExternalSigner, error) {
	_uniffiRV, _uniffiErr := rustCallWithError[SdkError](FfiConverterSdkError{}, func(_uniffiStatus *C.RustCallStatus) unsafe.Pointer {
		return C.uniffi_breez_sdk_spark_fn_func_default_external_signer(FfiConverterStringINSTANCE.Lower(mnemonic), FfiConverterOptionalStringINSTANCE.Lower(passphrase), FfiConverterNetworkINSTANCE.Lower(network), FfiConverterOptionalKeySetConfigINSTANCE.Lower(keySetConfig), _uniffiStatus)
	})
	if _uniffiErr != nil {
		var _uniffiDefaultValue ExternalSigner
		return _uniffiDefaultValue, _uniffiErr
	} else {
		return FfiConverterExternalSignerINSTANCE.Lift(_uniffiRV), nil
	}
}

// Creates a `PostgresStorageConfig` with the given connection string and default pool settings.
func DefaultPostgresStorageConfig(connectionString string) PostgresStorageConfig {
	return FfiConverterPostgresStorageConfigINSTANCE.Lift(rustCall(func(_uniffiStatus *C.RustCallStatus) RustBufferI {
		return GoRustBuffer{
			inner: C.uniffi_breez_sdk_spark_fn_func_default_postgres_storage_config(FfiConverterStringINSTANCE.Lower(connectionString), _uniffiStatus),
		}
	}))
}

// Fetches the current status of Spark network services relevant to the SDK.
//
// This function queries the Spark status API and returns the worst status
// across the Spark Operators and SSP services.
func GetSparkStatus() (SparkStatus, error) {
	res, err := uniffiRustCallAsync[SdkError](
		FfiConverterSdkErrorINSTANCE,
		// completeFn
		func(handle C.uint64_t, status *C.RustCallStatus) RustBufferI {
			res := C.ffi_breez_sdk_spark_rust_future_complete_rust_buffer(handle, status)
			return GoRustBuffer{
				inner: res,
			}
		},
		// liftFn
		func(ffi RustBufferI) SparkStatus {
			return FfiConverterSparkStatusINSTANCE.Lift(ffi)
		},
		C.uniffi_breez_sdk_spark_fn_func_get_spark_status(),
		// pollFn
		func(handle C.uint64_t, continuation C.UniffiRustFutureContinuationCallback, data C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_poll_rust_buffer(handle, continuation, data)
		},
		// freeFn
		func(handle C.uint64_t) {
			C.ffi_breez_sdk_spark_rust_future_free_rust_buffer(handle)
		},
	)

	if err == nil {
		return res, nil
	}

	return res, err
}

func InitLogging(logDir *string, appLogger *Logger, logFilter *string) error {
	_, _uniffiErr := rustCallWithError[SdkError](FfiConverterSdkError{}, func(_uniffiStatus *C.RustCallStatus) bool {
		C.uniffi_breez_sdk_spark_fn_func_init_logging(FfiConverterOptionalStringINSTANCE.Lower(logDir), FfiConverterOptionalCallbackInterfaceLoggerINSTANCE.Lower(appLogger), FfiConverterOptionalStringINSTANCE.Lower(logFilter), _uniffiStatus)
		return false
	})
	return _uniffiErr.AsError()
}
