// Copyright (c) 2018 Arista Networks, Inc.  All rights reserved.
// Arista Networks, Inc. Confidential and Proprietary.
// Subject to Arista Networks, Inc.'s EULA.
// FOR INTERNAL USE ONLY. NOT FOR DISTRIBUTION.

package elasticsearch

type field struct {
	Name   string   `json:"name,omitempty"`
	String *string  `json:"string,omitempty"`
	Double *float64 `json:"double,omitempty"`
	Long   *int64   `json:"long,omitempty"`
	Bool   *bool    `json:"bool,omitempty"`
	Ptr    *string  `json:"ptr,omitempty"`
	// If the string looks like an ip address
	// we also index it here as ip address
	IP string `json:"ip,omitempty"`
	// If the string looks like a mac address
	// we also index it here as mac address
	MAC string `json:"mac,omitempty"`
}

// Data represents the document format for a notification
type Data struct {
	// The timestamp in nanosecond resolution
	Timestamp string
	// Organization ID
	OrgID       string
	DatasetType string
	// The datasetID
	DatasetID string
	// The stringified path
	Path string
	// The codec encoded key
	Key []byte
	// The key data
	// this array will have each entry as an object with "name" field
	// and "<type>" field for value.
	// If name is not set, the data is put in one of the simple type fields
	// The problem with nested types is that each entry in the array is creating a doc
	// and the number of docs is exploding which is not good.
	// So one optimization is to flatten for simple values and not use the nested field.
	KeyData   []*field `json:",omitempty"`
	KeyString *string  `json:",omitempty"`
	KeyDouble *float64 `json:",omitempty"`
	KeyLong   *int64   `json:",omitempty"`
	KeyBool   *bool    `json:",omitempty"`
	KeyPtr    *string  `json:",omitempty"`
	// If the simple string looks like an ip address
	// we also index it here as ip address
	KeyIP string `json:",omitempty"`
	// If the simple string looks like a mac address
	// we also index it here as mac address
	KeyMAC string `json:",omitempty"`
	// The value data
	// this array will have each entry as an object with "name" field
	// and "<type>" field for value.
	// If name is not set, the data was a simple value
	// The problem with nested types is that each entry in the array is creating a doc
	// and the number of docs is exploding which is not good.
	// So one optimization is to flatten for simple values and not use the nested field.
	Value       []*field `json:",omitempty"`
	ValueString *string  `json:",omitempty"`
	ValueDouble *float64 `json:",omitempty"`
	ValueLong   *int64   `json:",omitempty"`
	ValueBool   *bool    `json:",omitempty"`
	ValuePtr    *string  `json:",omitempty"`
	// If the simple string looks like an ip address
	// we also index it here as ip address
	ValueIP string `json:",omitempty"`
	// If the simple string looks like a mac address
	// we also index it here as mac address
	ValueMAC string `json:",omitempty"`

	// Present when it's a delete
	// In this case, value will not be present
	Del *bool `json:",omitempty"`
	// Present when it's a deleteAll
	// In this case, key and value will not be present
	DelAll *bool `json:",omitempty"`
}

var index = map[string]interface{}{
	"settings": map[string]interface{}{
		"index": map[string]interface{}{
			"codec":              "best_compression",
			"number_of_shards":   5,
			"number_of_replicas": 2,
		},
		"analysis": map[string]interface{}{
			"analyzer": map[string]interface{}{
				"mac_analyzer": map[string]interface{}{
					"tokenizer": "mac_tokenizer",
					"filter": []string{
						"lowercase",
					},
				},
				"path_analyzer": map[string]interface{}{
					"tokenizer": "path_tokenizer",
				},
			},
			"tokenizer": map[string]interface{}{
				"mac_tokenizer": map[string]interface{}{
					"type":     "edgeNGram",
					"min_gram": "2",
					"max_gram": "17",
				},
				"path_tokenizer": map[string]interface{}{
					"type":      "path_hierarchy",
					"delimiter": "/",
				},
			},
		},
	},

	// ID of the doc is:
	// {orgid}-{dataset_id}-{md5 "{tsnano}-{codec_path}-{codec_key}"}
	// Note: For DeleteAll the "-codec_key" is ommited
	// id in elasticsearch can be 512 bytes max, so we use sha1 to hash.
	// We theorically can have collision. It will unlikely happen.
	// In case there is a collision, too bad, we'll have corrupted data.
	// We have the datasetid in the id, so in the unlikely case we have a collision,
	// this collision cannot happen across organizations/devices.
	"mappings": map[string]interface{}{
		"_doc": map[string]interface{}{
			"properties": map[string]interface{}{
				// 		Timestamp in nanoseconds
				"Timestamp": map[string]interface{}{
					"type": "long",
				},
				// 		Organization id
				"OrgID": map[string]interface{}{
					"type": "long",
				},
				// 		Dataset type
				"DatasetType": map[string]interface{}{
					"type": "text",
				},
				// 		Dataset id
				"DatasetID": map[string]interface{}{
					"type": "long",
				},
				// 		base64 encoded of codec encoded representation of the path
				// 		"path": {
				// 			"type": "binary"
				// 		},
				// 		The stringified version of the path
				"Path": map[string]interface{}{
					"type": "keyword",
				},
				// 		base64 encoded of codec encoded representation of the key
				"Key": map[string]interface{}{
					"type":       "binary",
					"doc_values": true,
				},
				// this array will have each entry as an object with "name" field
				// and "<type>" field for value.
				// If name is not set, the data was a simple value
				"KeyData": map[string]interface{}{
					"type": "nested",
					"properties": map[string]interface{}{
						"name": map[string]interface{}{
							"type": "text",
						},
						"long": map[string]interface{}{
							"type": "long",
						},
						"string": map[string]interface{}{
							"type": "text",
						},
						"double": map[string]interface{}{
							"type": "double",
						},
						"bool": map[string]interface{}{
							"type": "boolean",
						},
						"ptr": map[string]interface{}{
							"type": "keyword",
						},
						"ip": map[string]interface{}{
							"type": "ip",
						},
						"mac": map[string]interface{}{
							"type":            "text",
							"analyzer":        "mac_analyzer",
							"search_analyzer": "keyword",
						},
					},
				},
				"KeyLong": map[string]interface{}{
					"type": "long",
				},
				"KeyString": map[string]interface{}{
					"type": "text",
				},
				"KeyDouble": map[string]interface{}{
					"type": "double",
				},
				"KeyBool": map[string]interface{}{
					"type": "boolean",
				},
				"KeyPtr": map[string]interface{}{
					"type": "keyword",
				},
				"KeyIP": map[string]interface{}{
					"type": "ip",
				},
				"KeyMAC": map[string]interface{}{
					"type":            "text",
					"analyzer":        "mac_analyzer",
					"search_analyzer": "keyword",
				},
				// 		this array will have each entry as an object with "name" field
				// 		and "<type>" field for value.
				// 		If name is not set, the data was a simple value
				"Value": map[string]interface{}{
					"type": "nested",
					"properties": map[string]interface{}{
						"name": map[string]interface{}{
							"type": "text",
						},
						"long": map[string]interface{}{
							"type": "long",
						},
						"string": map[string]interface{}{
							"type": "text",
						},
						"double": map[string]interface{}{
							"type": "double",
						},
						"bool": map[string]interface{}{
							"type": "boolean",
						},
						"ptr": map[string]interface{}{
							"type": "keyword",
						},
						"ip": map[string]interface{}{
							"type": "ip",
						},
						"mac": map[string]interface{}{
							"type":            "text",
							"analyzer":        "mac_analyzer",
							"search_analyzer": "keyword",
						},
					},
				},
				"ValueLong": map[string]interface{}{
					"type": "long",
				},
				"ValueString": map[string]interface{}{
					"type": "text",
				},
				"ValueDouble": map[string]interface{}{
					"type": "double",
				},
				"ValueBool": map[string]interface{}{
					"type": "boolean",
				},
				"ValuePtr": map[string]interface{}{
					"type": "keyword",
				},
				"ValueIP": map[string]interface{}{
					"type": "ip",
				},
				"ValueMAC": map[string]interface{}{
					"type":            "text",
					"analyzer":        "mac_analyzer",
					"search_analyzer": "keyword",
				},
				// 		Present when it's a delete
				// 		In this case, value will not be present
				"Del": map[string]interface{}{
					"type": "boolean",
				},
				//      Present when it's a deleteAll
				//      In this case, key and value will not be present
				"DelAll": map[string]interface{}{
					"type": "boolean",
				},
				"query": map[string]interface{}{
					"type": "percolator",
				},
			},
		},
	},
}

// excludedFields are fields that are not affected by init options
// this is mainly to make excluded numeric types queryable
var excludedFields = map[string]interface{}{
	"Timestamp":   struct{}{},
	"OrgID":       struct{}{},
	"DatasetType": struct{}{},
	"DatasetID":   struct{}{},
}
