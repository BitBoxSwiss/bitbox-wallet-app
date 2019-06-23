// Copyright (c) 2016 Arista Networks, Inc.
// Use of this source code is governed by the Apache License 2.0
// that can be found in the COPYING file.

package elasticsearch

import (
	"encoding/json"
	"fmt"
	"math"
	"strings"

	"github.com/openconfig/gnmi/proto/gnmi"
)

// EscapeFieldName escapes field names for Elasticsearch
func EscapeFieldName(name string) string {
	return strings.Replace(name, ".", "_", -1)
}

// SetKey fills a Data map's relevant key if the key is a simple type.
func SetKey(m map[string]interface{}, key interface{}) error {
	// In the case of gnmi, these will always be strings
	if str, ok := key.(string); ok {
		m["KeyString"] = &str
		return nil
	}
	return fmt.Errorf("unknown type %v", key)
}

// SetValue fills a Data map's relevant Value fields
func SetValue(m map[string]interface{}, val interface{}) error {
	if str := toStringPtr(val); str != nil {
		m["ValueString"] = str
	} else if long := toLongPtr(val); long != nil {
		m["ValueLong"] = long
	} else if bl := toBoolPtr(val); bl != nil {
		m["ValueBool"] = bl
	} else if dub := toDoublePtr(val); dub != nil {
		m["ValueDouble"] = dub
	} else if arr := toValueArray(val); arr != nil {
		m["Value"] = arr
	} else if json := toJSONValue(val); json != nil {
		switch tv := json.(type) {
		case string:
			m["ValueString"] = &tv
		case int, uint:
			m["ValueLong"] = &tv
		case bool:
			m["ValueBool"] = &tv
		case float32:
			m["ValueDouble"] = &tv
		case float64:
			m["ValueDouble"] = &tv
		}
	} else {
		// this type may not be supported yet, or could not convert
		return fmt.Errorf("unknown type %v", val)
	}
	return nil
}

//  *TypedValue_StringVal
func toStringPtr(val interface{}) *string {
	if tv, ok := val.(*gnmi.TypedValue_StringVal); ok {
		return &tv.StringVal
	}
	return nil
}

//	*TypedValue_IntVal, *TypedValue_UintVal
func toLongPtr(val interface{}) *int64 {
	switch tv := val.(type) {
	case *gnmi.TypedValue_IntVal:
		val := int64(tv.IntVal)
		return &val
	case *gnmi.TypedValue_UintVal:
		val := int64(tv.UintVal)
		return &val
	}
	return nil
}

//	*TypedValue_BoolVal
func toBoolPtr(val interface{}) *bool {
	if tv, ok := val.(*gnmi.TypedValue_BoolVal); ok {
		return &tv.BoolVal
	}
	return nil
}

//	*TypedValue_FloatVal, *TypedValue_DecimalVal
func toDoublePtr(val interface{}) *float64 {
	switch tv := val.(type) {
	case *gnmi.TypedValue_FloatVal:
		val := float64(tv.FloatVal)
		if !math.IsInf(val, 0) && !math.IsNaN(val) {
			return &val
		}
	case *gnmi.TypedValue_DecimalVal:
		// convert to float64 for now
		val := float64(tv.DecimalVal.Digits)
		for i := 0; i < int(tv.DecimalVal.Precision); i++ {
			val /= 10
		}
		if !math.IsInf(val, 0) && !math.IsNaN(val) {
			return &val
		}
	}
	return nil
}

// Flatten a non-simple type into a []*field
func toValueArray(val interface{}) []*map[string]interface{} {
	if tv, ok := val.(*gnmi.TypedValue_LeaflistVal); ok {
		var fields []*map[string]interface{}
		// LeaflistVal should only have simple types
		for _, el := range tv.LeaflistVal.Element {
			m := make(map[string]interface{})
			if str := toStringPtr(el.Value); str != nil {
				m["String"] = str
			} else if long := toLongPtr(el.Value); long != nil {
				m["Long"] = long
			} else if bl := toBoolPtr(el.Value); bl != nil {
				m["Bool"] = bl
			} else if dub := toDoublePtr(el.Value); dub != nil {
				m["Double"] = dub
			} else {
				// this type is not supported yet
				return nil
			}
			fields = append(fields, &m)
		}
		return fields
	}
	return nil
}

// Unmarshall a json value
func toJSONValue(val interface{}) interface{} {
	if tv, ok := val.(*gnmi.TypedValue_JsonVal); ok {
		var out interface{}
		if err := json.Unmarshal(tv.JsonVal, &out); err != nil {
			return nil
		}
		return out
	}
	return nil
}
