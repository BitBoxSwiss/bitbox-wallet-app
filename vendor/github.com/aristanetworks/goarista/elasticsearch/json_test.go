// Copyright (c) 2018 Arista Networks, Inc.  All rights reserved.
// Arista Networks, Inc. Confidential and Proprietary.
// Subject to Arista Networks, Inc.'s EULA.
// FOR INTERNAL USE ONLY. NOT FOR DISTRIBUTION.

package elasticsearch

import (
	"encoding/json"
	"reflect"
	"testing"

	"github.com/aristanetworks/goarista/gnmi"
	pb "github.com/openconfig/gnmi/proto/gnmi"
)

func stringToGNMIPath(path string) *pb.Path {
	p, _ := gnmi.ParseGNMIElements(gnmi.SplitPath(path))
	return p
}

func gnmiUpdate(path string, value *pb.TypedValue) *pb.Update {
	return &pb.Update{
		Path: stringToGNMIPath(path),
		Val:  value,
	}
}

func toPtr(val interface{}) interface{} {
	switch tv := val.(type) {
	case string:
		return &tv
	case int:
		i64 := int64(tv)
		return &i64
	case bool:
		return &tv
	case float64:
		return &tv
	default:
		return &tv
	}
}

func TestDataConversion(t *testing.T) {
	cases := []struct {
		in   *pb.Notification
		data []Data
	}{
		{
			in: &pb.Notification{
				Timestamp: 123,
				Prefix:    stringToGNMIPath("foo"),
				Update: []*pb.Update{
					gnmiUpdate("String", &pb.TypedValue{Value: &pb.TypedValue_StringVal{
						StringVal: "hello"}}),
					gnmiUpdate("Int", &pb.TypedValue{Value: &pb.TypedValue_IntVal{
						IntVal: -123}}),
					gnmiUpdate("Bool", &pb.TypedValue{Value: &pb.TypedValue_BoolVal{
						BoolVal: true}}),
				}},
			data: []Data{
				Data{
					Timestamp:   "123",
					DatasetID:   "0",
					Path:        "/foo/String",
					Key:         []byte("/String"),
					KeyString:   toPtr("/String").(*string),
					ValueString: toPtr("hello").(*string)},
				Data{
					Timestamp: "123",
					DatasetID: "0",
					Path:      "/foo/Int",
					Key:       []byte("/Int"),
					KeyString: toPtr("/Int").(*string),
					ValueLong: toPtr(-123).(*int64)},
				Data{
					Timestamp: "123",
					DatasetID: "0",
					Path:      "/foo/Bool",
					Key:       []byte("/Bool"),
					KeyString: toPtr("/Bool").(*string),
					ValueBool: toPtr(true).(*bool)},
			},
		},
		{
			in: &pb.Notification{
				Timestamp: 234,
				Prefix:    stringToGNMIPath("bar"),
				Update: []*pb.Update{
					gnmiUpdate("Decimal", &pb.TypedValue{Value: &pb.TypedValue_DecimalVal{
						DecimalVal: &pb.Decimal64{Digits: -123, Precision: 2}}}),
				}},
			data: []Data{
				Data{
					Timestamp:   "234",
					DatasetID:   "0",
					Path:        "/bar/Decimal",
					Key:         []byte("/Decimal"),
					KeyString:   toPtr("/Decimal").(*string),
					ValueDouble: toPtr(-1.23).(*float64)},
			},
		},
		{
			in: &pb.Notification{
				Timestamp: 345,
				Prefix:    stringToGNMIPath("baz"),
				Update: []*pb.Update{
					gnmiUpdate("Leaflist", &pb.TypedValue{Value: &pb.TypedValue_LeaflistVal{
						LeaflistVal: &pb.ScalarArray{Element: []*pb.TypedValue{
							&pb.TypedValue{Value: &pb.TypedValue_StringVal{StringVal: "hello"}},
							&pb.TypedValue{Value: &pb.TypedValue_IntVal{IntVal: -123}},
							&pb.TypedValue{Value: &pb.TypedValue_BoolVal{BoolVal: true}},
						}}}}),
				}},
			data: []Data{
				Data{
					Timestamp: "345",
					DatasetID: "0",
					Path:      "/baz/Leaflist",
					Key:       []byte("/Leaflist"),
					KeyString: toPtr("/Leaflist").(*string),
					Value: []*field{
						&field{String: toPtr("hello").(*string)},
						&field{Long: toPtr(-123).(*int64)},
						&field{Bool: toPtr(true).(*bool)}}},
			},
		},
		{
			// JsonVal -> ValueString
			in: &pb.Notification{
				Timestamp: 456,
				Prefix:    stringToGNMIPath("foo"),
				Update: []*pb.Update{gnmiUpdate("bar",
					&pb.TypedValue{Value: &pb.TypedValue_JsonVal{
						//JsonVal: []byte(`[ {"json": "val"}]`)}})}},
						JsonVal: []byte("67")}})}},
			data: []Data{
				Data{
					Timestamp:   "456",
					DatasetID:   "0",
					Path:        "/foo/bar",
					Key:         []byte("/bar"),
					KeyString:   toPtr("/bar").(*string),
					ValueDouble: toPtr(float64(67)).(*float64)},
			},
		},
	}
	for _, tc := range cases {
		maps, err := NotificationToMaps("0", tc.in)
		if err != nil {
			t.Fatalf("issue converting %v to data map. Err: %v", tc.in, err)
		}
		if len(maps) != len(tc.data) {
			t.Fatalf("number of output notifications (%d) does not match expected %d",
				len(maps), len(tc.data))
		}
		byteArr, err := json.Marshal(maps)
		if err != nil {
			t.Fatalf("error while trying to marshal map: %v", err)
		}

		data := []Data{}
		json.Unmarshal(byteArr, &data)

		if !reflect.DeepEqual(data, tc.data) {
			gotPretty, _ := json.MarshalIndent(data, "", " ")
			wantPretty, _ := json.MarshalIndent(tc.data, "", " ")
			t.Fatalf("reflect struct array mismatch!\n Got: %+v\n Want: %+v",
				string(gotPretty), string(wantPretty))
		}
	}
}
