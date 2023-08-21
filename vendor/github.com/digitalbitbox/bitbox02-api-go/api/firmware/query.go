// Copyright 2018-2019 Shift Cryptosecurity AG
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
	"container/ring"
	"fmt"
	"time"

	"github.com/digitalbitbox/bitbox02-api-go/api/firmware/messages"
	"github.com/digitalbitbox/bitbox02-api-go/util/errp"
	"github.com/digitalbitbox/bitbox02-api-go/util/semver"
	"google.golang.org/protobuf/proto"
)

const (
	// sinve v7.0.0, requets and responses are framed with hww* codes.

	// hwwReq* are HWW-level framing opcodes of requests.

	// New request.
	hwwReqNew = "\x00"
	// Poll an outstanding request for completion.
	hwwReqRetry = "\x01"
	// Cancel any outstanding request.
	// hwwReqCancel = "\x02"
	// INFO api call (used to be OP_INFO api call), graduated to the toplevel framing so it works
	// the same way for all firmware versions.
	hwwInfo = "i"

	// hwwRsp* are HWW-level framing pocodes of responses.

	// Request finished, payload is valid.
	hwwRspAck = "\x00"
	// Request is outstanding, retry later with hwwOpRetry.
	hwwRspNotready = "\x01"
	// Device is busy, request was dropped. Client should retry the exact same msg.
	hwwRspBusy = "\x02"
	// Bad request.
	hwwRspNack = "\x03"
)

func (device *Device) rawQueryV7(msg []byte) ([]byte, error) {
	var status string
	var payload []byte
	// saving 11 timestamps to show the last 10 intervals.
	lastQueryTimes := ring.New(11)
	for {
		lastQueryTimes.Value = time.Now()
		lastQueryTimes = lastQueryTimes.Next()
		responseBytes, err := device.communication.Query(append([]byte(hwwReqNew), msg...))
		if err != nil {
			return nil, err
		}
		if len(responseBytes) == 0 {
			return nil, errp.New("unexpected response")
		}
		status, payload = string(responseBytes[:1]), responseBytes[1:]
		if status == hwwRspBusy {
			time.Sleep(time.Second)
			continue
		}
		break
	}

	for {
		switch status {
		case hwwRspAck:
			return payload, nil
		case hwwRspBusy:
			return nil, errp.New("unexpected hwwRspBusy response")
		case hwwRspNack:
			lastQueryTimes = lastQueryTimes.Prev()
			if lastQueryTimes.Prev().Value == nil {
				device.log.Debug("unexpected NACK response in first loop iteration")
			} else {
				logStr := "unexpected NACK response; last successful retry query intervals (newest first) were: "
				for i := 0; i < lastQueryTimes.Len()-1; i++ {
					if lastQueryTimes.Value == nil || lastQueryTimes.Prev().Value == nil {
						break
					}
					t := lastQueryTimes.Value
					lastQueryTimes = lastQueryTimes.Prev()
					tPrev := lastQueryTimes.Value
					logStr += fmt.Sprintf("%v; ", t.(time.Time).Sub(tPrev.(time.Time)))
				}
				device.log.Debug(logStr)
			}
			return nil, errp.New("unexpected NACK response")
		case hwwRspNotready:
			time.Sleep(200 * time.Millisecond)
			lastQueryTimes.Value = time.Now()
			lastQueryTimes = lastQueryTimes.Next()
			responseBytes, err := device.communication.Query([]byte(hwwReqRetry))
			if err != nil {
				return nil, err
			}
			if len(responseBytes) == 0 {
				return nil, errp.New("unexpected response")
			}
			status, payload = string(responseBytes[:1]), responseBytes[1:]
		}
	}
}

func (device *Device) rawQuery(msg []byte) ([]byte, error) {
	if device.version.AtLeast(semver.NewSemVer(7, 0, 0)) {
		return device.rawQueryV7(msg)
	}
	return device.communication.Query(msg)
}

func (device *Device) query(request proto.Message) (*messages.Response, error) {
	device.queryLock.Lock()
	defer device.queryLock.Unlock()
	if device.sendCipher == nil || !device.channelHashDeviceVerified || !device.channelHashAppVerified {
		return nil, errp.New("handshake must come first")
	}
	requestBytes, err := proto.Marshal(request)
	if err != nil {
		return nil, errp.WithStack(err)
	}

	requestBytesEncrypted, err := device.sendCipher.Encrypt(nil, nil, requestBytes)
	if err != nil {
		return nil, errp.WithStack(err)
	}
	if device.version.AtLeast(semver.NewSemVer(4, 0, 0)) {
		requestBytesEncrypted = append([]byte(opNoiseMsg), requestBytesEncrypted...)
	}

	responseBytes, err := device.rawQuery(requestBytesEncrypted)
	if err != nil {
		return nil, err
	}
	if len(responseBytes) == 0 {
		return nil, errp.New("noise communication failed: empty response")
	}
	if device.version.AtLeast(semver.NewSemVer(7, 0, 0)) {
		// From v7.0.0, encrypted noise responses are framed
		if string(responseBytes[:1]) != responseSuccess {
			return nil, errp.New("handshake query failed")
		}
		responseBytes = responseBytes[1:]
	}

	responseBytesDecrypted, err := device.receiveCipher.Decrypt(nil, nil, responseBytes)
	if err != nil {
		return nil, errp.WithStack(err)
	}

	response := &messages.Response{}
	if err := proto.Unmarshal(responseBytesDecrypted, response); err != nil {
		return nil, errp.WithStack(err)
	}

	if errorResponse, ok := response.Response.(*messages.Response_Error); ok {
		return nil, errp.WithStack(NewError(errorResponse.Error.Code, errorResponse.Error.Message))
	}

	return response, nil
}
