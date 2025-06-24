// Copyright 2025 Shift Crypto AG
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package firmware

import (
	"github.com/BitBoxSwiss/bitbox02-api-go/api/firmware/messages"
	"github.com/BitBoxSwiss/bitbox02-api-go/util/errp"
)

// nonAtomicQueryBluetooth is like nonAtomicQuery, but nested one level deeper for Bluetooth.
func (device *Device) nonAtomicQueryBluetooth(request *messages.BluetoothRequest) (*messages.BluetoothResponse, error) {
	if !device.SupportsBluetooth() {
		return nil, errp.New("this device does not support Bluetooth")
	}
	response, err := device.nonAtomicQuery(&messages.Request{
		Request: &messages.Request_Bluetooth{
			Bluetooth: request,
		},
	})
	if err != nil {
		return nil, err
	}
	bluetoothResponse, ok := response.Response.(*messages.Response_Bluetooth)
	if !ok {
		return nil, errp.New("unexpected reply")
	}
	return bluetoothResponse.Bluetooth, nil
}

// queryBluetooth is like query, but nested one level deeper for Bluetooth.
func (device *Device) queryBluetooth(request *messages.BluetoothRequest) (*messages.BluetoothResponse, error) {
	return atomicQueriesValue(device, func() (*messages.BluetoothResponse, error) {
		return device.nonAtomicQueryBluetooth(request)
	})
}

// BluetoothUpgrade attempts an upgrade of the Bluetooth firmware.
func (device *Device) BluetoothUpgrade(firmware []byte) error {
	return device.atomicQueries(func() error {
		currentResponse, err := device.nonAtomicQueryBluetooth(&messages.BluetoothRequest{
			Request: &messages.BluetoothRequest_UpgradeInit{
				UpgradeInit: &messages.BluetoothUpgradeInitRequest{
					FirmwareLength: uint32(len(firmware)),
				},
			},
		})
		if err != nil {
			return err
		}

		for {
			switch resp := currentResponse.Response.(type) {
			case *messages.BluetoothResponse_RequestChunk:
				chunkReq := resp.RequestChunk
				chunkData := firmware[chunkReq.Offset : chunkReq.Offset+chunkReq.Length]

				currentResponse, err = device.nonAtomicQueryBluetooth(&messages.BluetoothRequest{
					Request: &messages.BluetoothRequest_Chunk{
						Chunk: &messages.BluetoothChunkRequest{
							Data: chunkData,
						},
					},
				})
				if err != nil {
					return err
				}

			case *messages.BluetoothResponse_Success:
				// Upgrade complete
				return nil

			default:
				return errp.New("unexpected response type during bluetooth upgrade")
			}
		}
	})
}

// BluetoothToggleEnabled enables/disables Bluetooth.
func (device *Device) BluetoothToggleEnabled() error {
	response, err := device.queryBluetooth(&messages.BluetoothRequest{
		Request: &messages.BluetoothRequest_ToggleEnabled{
			ToggleEnabled: &messages.BluetoothToggleEnabledRequest{},
		},
	})
	if err != nil {
		return err
	}
	_, ok := response.Response.(*messages.BluetoothResponse_Success)
	if !ok {
		return errp.New("unexpected response")
	}
	return nil
}
