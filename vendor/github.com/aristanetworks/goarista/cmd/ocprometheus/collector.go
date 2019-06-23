// Copyright (c) 2017 Arista Networks, Inc.
// Use of this source code is governed by the Apache License 2.0
// that can be found in the COPYING file.

package main

import (
	"encoding/json"
	"math"
	"strings"
	"sync"

	"github.com/aristanetworks/glog"
	"github.com/aristanetworks/goarista/gnmi"
	"github.com/golang/protobuf/proto"
	"github.com/golang/protobuf/ptypes/any"
	pb "github.com/openconfig/gnmi/proto/gnmi"
	"github.com/prometheus/client_golang/prometheus"
)

// A metric source.
type source struct {
	addr string
	path string
}

// Since the labels are fixed per-path and per-device we can cache them here,
// to avoid recomputing them.
type labelledMetric struct {
	metric       prometheus.Metric
	labels       []string
	defaultValue float64
	stringMetric bool
}

type collector struct {
	// Protects access to metrics map
	m       sync.Mutex
	metrics map[source]*labelledMetric

	config *Config
}

func newCollector(config *Config) *collector {
	return &collector{
		metrics: make(map[source]*labelledMetric),
		config:  config,
	}
}

// Process a notification and update or create the corresponding metrics.
func (c *collector) update(addr string, message proto.Message) {
	resp, ok := message.(*pb.SubscribeResponse)
	if !ok {
		glog.Errorf("Unexpected type of message: %T", message)
		return
	}

	notif := resp.GetUpdate()
	if notif == nil {
		return
	}

	device := strings.Split(addr, ":")[0]
	prefix := gnmi.StrPath(notif.Prefix)
	// Process deletes first
	for _, del := range notif.Delete {
		path := prefix + gnmi.StrPath(del)
		key := source{addr: device, path: path}
		c.m.Lock()
		if _, ok := c.metrics[key]; ok {
			delete(c.metrics, key)
		} else {
			// TODO: replace this with a prefix tree
			p := path + "/"
			for k := range c.metrics {
				if k.addr == device && strings.HasPrefix(k.path, p) {
					delete(c.metrics, k)
				}
			}
		}
		c.m.Unlock()
	}

	// Process updates next
	for _, update := range notif.Update {
		path := prefix + gnmi.StrPath(update.Path)
		value, suffix, ok := parseValue(update)
		if !ok {
			continue
		}

		var strUpdate bool
		var floatVal float64
		var strVal string

		switch v := value.(type) {
		case float64:
			strUpdate = false
			floatVal = v
		case string:
			strUpdate = true
			strVal = v
		}

		if suffix != "" {
			path += "/" + suffix
		}

		src := source{addr: device, path: path}
		c.m.Lock()
		// Use the cached labels and descriptor if available
		if m, ok := c.metrics[src]; ok {
			if strUpdate {
				// Skip string updates for non string metrics
				if !m.stringMetric {
					c.m.Unlock()
					continue
				}
				// Display a default value and replace the value label with the string value
				floatVal = m.defaultValue
				m.labels[len(m.labels)-1] = strVal
			}

			m.metric = prometheus.MustNewConstMetric(m.metric.Desc(), prometheus.GaugeValue,
				floatVal, m.labels...)
			c.m.Unlock()
			continue
		}

		c.m.Unlock()
		// Get the descriptor and labels for this source
		metric := c.config.getMetricValues(src)
		if metric == nil || metric.desc == nil {
			glog.V(8).Infof("Ignoring unmatched update %v at %s:%s with value %+v",
				update, device, path, value)
			continue
		}

		if strUpdate {
			if !metric.stringMetric {
				// Skip string updates for non string metrics
				continue
			}
			// Display a default value and replace the value label with the string value
			floatVal = metric.defaultValue
			metric.labels[len(metric.labels)-1] = strVal
		}

		// Save the metric and labels in the cache
		c.m.Lock()
		lm := prometheus.MustNewConstMetric(metric.desc, prometheus.GaugeValue,
			floatVal, metric.labels...)
		c.metrics[src] = &labelledMetric{
			metric:       lm,
			labels:       metric.labels,
			defaultValue: metric.defaultValue,
			stringMetric: metric.stringMetric,
		}
		c.m.Unlock()
	}
}

// parseValue takes in an update and parses a value and suffix
// Returns an interface that contains either a string or a float64 as well as a suffix
// Unparseable updates return (0, empty string, false)
func parseValue(update *pb.Update) (interface{}, string, bool) {
	intf, err := gnmi.ExtractValue(update)
	if err != nil {
		return 0, "", false
	}

	switch value := intf.(type) {
	// float64 or string expected as the return value
	case int64:
		return float64(value), "", true
	case uint64:
		return float64(value), "", true
	case float32:
		return float64(value), "", true
	case *pb.Decimal64:
		val := gnmi.DecimalToFloat(value)
		if math.IsInf(val, 0) || math.IsNaN(val) {
			return 0, "", false
		}
		return val, "", true
	case json.Number:
		valFloat, err := value.Float64()
		if err != nil {
			return value, "", true
		}
		return valFloat, "", true
	case *any.Any:
		return value.String(), "", true
	case []interface{}:
		// extract string represetation for now
		return gnmi.StrVal(update.Val), "", false
	case map[string]interface{}:
		if vIntf, ok := value["value"]; ok {
			if num, ok := vIntf.(json.Number); ok {
				valFloat, err := num.Float64()
				if err != nil {
					return num, "value", true
				}
				return valFloat, "value", true
			}
		}
	case bool:
		if value {
			return float64(1), "", true
		}
		return float64(0), "", true
	case string:
		return value, "", true
	default:
		glog.V(9).Infof("Ignoring update with unexpected type: %T", value)
	}

	return 0, "", false
}

// Describe implements prometheus.Collector interface
func (c *collector) Describe(ch chan<- *prometheus.Desc) {
	c.config.getAllDescs(ch)
}

// Collect implements prometheus.Collector interface
func (c *collector) Collect(ch chan<- prometheus.Metric) {
	c.m.Lock()
	for _, m := range c.metrics {
		ch <- m.metric
	}
	c.m.Unlock()
}
