// Copyright (c) 2017 Arista Networks, Inc.
// Use of this source code is governed by the Apache License 2.0
// that can be found in the COPYING file.

package stats_test

import (
	"bytes"
	"encoding/json"
	"testing"

	"github.com/aristanetworks/goarista/monitor/stats"
)

var expected0 = []byte(`{
  "stats": {
    "count": 0,
    "min": 0,
    "max": 0,
    "avg": 0.00
  },
  "buckets": [
    {
      "range": "[0,20)",
      "count": 0,
      "percentage": 0.0
    },
    {
      "range": "[20,40)",
      "count": 0,
      "percentage": 0.0
    },
    {
      "range": "[40,60)",
      "count": 0,
      "percentage": 0.0
    },
    {
      "range": "[60,80)",
      "count": 0,
      "percentage": 0.0
    },
    {
      "range": "[80,100)",
      "count": 0,
      "percentage": 0.0
    },
    {
      "range": "[100,120)",
      "count": 0,
      "percentage": 0.0
    },
    {
      "range": "[120,140)",
      "count": 0,
      "percentage": 0.0
    },
    {
      "range": "[140,160)",
      "count": 0,
      "percentage": 0.0
    },
    {
      "range": "[160,180)",
      "count": 0,
      "percentage": 0.0
    },
    {
      "range": "[180,inf)",
      "count": 0,
      "percentage": 0.0
    }
  ]
}
`)

var expected42 = []byte(`{
  "stats": {
    "count": 1,
    "min": 42,
    "max": 42,
    "avg": 42.00
  },
  "buckets": [
    {
      "range": "[0,20)",
      "count": 0,
      "percentage": 0.0
    },
    {
      "range": "[20,40)",
      "count": 0,
      "percentage": 0.0
    },
    {
      "range": "[40,60)",
      "count": 1,
      "percentage": 100.0
    },
    {
      "range": "[60,80)",
      "count": 0,
      "percentage": 0.0
    },
    {
      "range": "[80,100)",
      "count": 0,
      "percentage": 0.0
    },
    {
      "range": "[100,120)",
      "count": 0,
      "percentage": 0.0
    },
    {
      "range": "[120,140)",
      "count": 0,
      "percentage": 0.0
    },
    {
      "range": "[140,160)",
      "count": 0,
      "percentage": 0.0
    },
    {
      "range": "[160,180)",
      "count": 0,
      "percentage": 0.0
    },
    {
      "range": "[180,inf)",
      "count": 0,
      "percentage": 0.0
    }
  ]
}
`)

func testJSON(t *testing.T, h *stats.Histogram, exp []byte) {
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetIndent("", "  ")
	err := enc.Encode(h.Value())
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(buf.Bytes(), exp) {
		t.Error("unexpected json")
		t.Errorf("Expected: %s", exp)
		t.Errorf("Got: %s", buf.Bytes())
	}
	var v interface{}
	err = json.Unmarshal(buf.Bytes(), &v)
	if err != nil {
		t.Errorf("Failed to parse JSON: %s\nJSON was: %s", err, buf.Bytes())
	}
}

// Ensure we can JSONify the histogram into valid JSON.
func TestJSON(t *testing.T) {
	h := stats.NewHistogram(
		stats.HistogramOptions{NumBuckets: 10, GrowthFactor: 0,
			SmallestBucketSize: 20, MinValue: 0})
	testJSON(t, h, expected0)
	if err := h.Add(42); err != nil {
		t.Fatal(err)
	}
	testJSON(t, h, expected42)
}
