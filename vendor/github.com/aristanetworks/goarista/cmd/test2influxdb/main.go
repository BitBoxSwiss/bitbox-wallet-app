// Copyright (c) 2018 Arista Networks, Inc.
// Use of this source code is governed by the Apache License 2.0
// that can be found in the COPYING file.

// test2influxdb writes results from 'go test -json' to an influxdb
// database.
//
// Example usage:
//
//  go test -json | test2influxdb [options...]
//
// Points are written to influxdb with tags:
//
//  package
//  type    "package" for a package result; "test" for a test result
//  Additional tags set by -tags flag
//
// And fields:
//
//  test    string  // "NONE" for whole package results
//  elapsed float64 // in seconds
//  pass    float64 // 1 for PASS, 0 for FAIL
//  Additional fields set by -fields flag
//
// "test" is a field instead of a tag to reduce cardinality of data.
//
package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/aristanetworks/glog"
	client "github.com/influxdata/influxdb1-client/v2"
	"golang.org/x/tools/benchmark/parse"
)

const (
	// Benchmark field names
	fieldNsPerOp           = "nsPerOp"
	fieldAllocedBytesPerOp = "allocedBytesPerOp"
	fieldAllocsPerOp       = "allocsPerOp"
	fieldMBPerS            = "MBPerSec"
)

type tag struct {
	key   string
	value string
}

type tags []tag

func (ts *tags) String() string {
	s := make([]string, len(*ts))
	for i, t := range *ts {
		s[i] = t.key + "=" + t.value
	}
	return strings.Join(s, ",")
}

func (ts *tags) Set(s string) error {
	for _, fieldString := range strings.Split(s, ",") {
		kv := strings.Split(fieldString, "=")
		if len(kv) != 2 {
			return fmt.Errorf("invalid tag, expecting one '=': %q", fieldString)
		}
		key := strings.TrimSpace(kv[0])
		if key == "" {
			return fmt.Errorf("invalid tag key %q in %q", key, fieldString)
		}
		val := strings.TrimSpace(kv[1])
		if val == "" {
			return fmt.Errorf("invalid tag value %q in %q", val, fieldString)
		}

		*ts = append(*ts, tag{key: key, value: val})
	}
	return nil
}

type field struct {
	key   string
	value interface{}
}

type fields []field

func (fs *fields) String() string {
	s := make([]string, len(*fs))
	for i, f := range *fs {
		var valString string
		switch v := f.value.(type) {
		case bool:
			valString = strconv.FormatBool(v)
		case float64:
			valString = strconv.FormatFloat(v, 'f', -1, 64)
		case int64:
			valString = strconv.FormatInt(v, 10) + "i"
		case string:
			valString = v
		}

		s[i] = f.key + "=" + valString
	}
	return strings.Join(s, ",")
}

func (fs *fields) Set(s string) error {
	for _, fieldString := range strings.Split(s, ",") {
		kv := strings.Split(fieldString, "=")
		if len(kv) != 2 {
			return fmt.Errorf("invalid field, expecting one '=': %q", fieldString)
		}
		key := strings.TrimSpace(kv[0])
		if key == "" {
			return fmt.Errorf("invalid field key %q in %q", key, fieldString)
		}
		val := strings.TrimSpace(kv[1])
		if val == "" {
			return fmt.Errorf("invalid field value %q in %q", val, fieldString)
		}
		var value interface{}
		var err error
		if value, err = strconv.ParseBool(val); err == nil {
			// It's a bool
		} else if value, err = strconv.ParseFloat(val, 64); err == nil {
			// It's a float64
		} else if value, err = strconv.ParseInt(val[:len(val)-1], 0, 64); err == nil &&
			val[len(val)-1] == 'i' {
			// ints are suffixed with an "i"
		} else {
			value = val
		}

		*fs = append(*fs, field{key: key, value: value})
	}
	return nil
}

var (
	flagAddr        = flag.String("addr", "http://localhost:8086", "adddress of influxdb database")
	flagDB          = flag.String("db", "gotest", "use `database` in influxdb")
	flagMeasurement = flag.String("m", "result", "`measurement` used in influxdb database")
	flagBenchOnly   = flag.Bool("bench", false, "if true, parses and stores benchmark "+
		"output only while ignoring test results")

	flagTags   tags
	flagFields fields
)

type duplicateTestsErr map[string][]string // package to tests

func (dte duplicateTestsErr) Error() string {
	var b bytes.Buffer
	if _, err := b.WriteString("duplicate tests found:"); err != nil {
		panic(err)
	}
	for pkg, tests := range dte {
		if _, err := b.WriteString(
			fmt.Sprintf("\n\t%s: %s", pkg, strings.Join(tests, " ")),
		); err != nil {
			panic(err)
		}
	}
	return b.String()
}

func init() {
	flag.Var(&flagTags, "tags", "set additional `tags`. Ex: name=alice,food=pasta")
	flag.Var(&flagFields, "fields", "set additional `fields`. Ex: id=1234i,long=34.123,lat=72.234")
}

func main() {
	flag.Parse()

	c, err := client.NewHTTPClient(client.HTTPConfig{
		Addr: *flagAddr,
	})
	if err != nil {
		glog.Fatal(err)
	}

	if err := run(c, os.Stdin); err != nil {
		glog.Fatal(err)
	}
}

func run(c client.Client, r io.Reader) error {
	batch, err := client.NewBatchPoints(client.BatchPointsConfig{Database: *flagDB})
	if err != nil {
		return err
	}

	var parseErr error
	if *flagBenchOnly {
		parseErr = parseBenchmarkOutput(r, batch)
	} else {
		parseErr = parseTestOutput(r, batch)
	}

	// Partial results can still be published with certain parsing errors like
	// duplicate test names.
	// The process still exits with a non-zero code in this case.
	switch parseErr.(type) {
	case nil, duplicateTestsErr:
		if err := c.Write(batch); err != nil {
			return err
		}
		glog.Infof("wrote %d data points", len(batch.Points()))
	}

	return parseErr
}

// See https://golang.org/cmd/test2json/ for a description of 'go test
// -json' output
type testEvent struct {
	Time    time.Time // encodes as an RFC3339-format string
	Action  string
	Package string
	Test    string
	Elapsed float64 // seconds
	Output  string
}

func createTags(e *testEvent) map[string]string {
	tags := make(map[string]string, len(flagTags)+2)
	for _, t := range flagTags {
		tags[t.key] = t.value
	}
	resultType := "test"
	if e.Test == "" {
		resultType = "package"
	}
	tags["package"] = e.Package
	tags["type"] = resultType
	return tags
}

func createFields(e *testEvent) map[string]interface{} {
	fields := make(map[string]interface{}, len(flagFields)+3)
	for _, f := range flagFields {
		fields[f.key] = f.value
	}
	// Use a float64 instead of a bool to be able to SUM test
	// successes in influxdb.
	var pass float64
	if e.Action == "pass" {
		pass = 1
	}
	fields["pass"] = pass
	fields["elapsed"] = e.Elapsed
	if e.Test != "" {
		fields["test"] = e.Test
	}
	return fields
}

func parseTestOutput(r io.Reader, batch client.BatchPoints) error {
	// pkgs holds packages seen in r. Unfortunately, if a test panics,
	// then there is no "fail" result from a package. To detect these
	// kind of failures, keep track of all the packages that never had
	// a "pass" or "fail".
	//
	// The last seen timestamp is stored with the package, so that
	// package result measurement written to influxdb can be later
	// than any test result for that package.
	pkgs := make(map[string]time.Time)
	d := json.NewDecoder(r)
	for {
		e := &testEvent{}
		if err := d.Decode(e); err != nil {
			if err != io.EOF {
				return err
			}
			break
		}

		switch e.Action {
		case "pass", "fail":
		default:
			continue
		}

		if e.Test == "" {
			// A package has completed.
			delete(pkgs, e.Package)
		} else {
			pkgs[e.Package] = e.Time
		}

		point, err := client.NewPoint(
			*flagMeasurement,
			createTags(e),
			createFields(e),
			e.Time,
		)
		if err != nil {
			return err
		}

		batch.AddPoint(point)
	}

	for pkg, t := range pkgs {
		pkgFail := &testEvent{
			Action:  "fail",
			Package: pkg,
		}
		point, err := client.NewPoint(
			*flagMeasurement,
			createTags(pkgFail),
			createFields(pkgFail),
			// Fake a timestamp that is later than anything that
			// occurred for this package
			t.Add(time.Millisecond),
		)
		if err != nil {
			return err
		}

		batch.AddPoint(point)
	}

	return nil
}

func createBenchmarkTags(pkg string, b *parse.Benchmark) map[string]string {
	tags := make(map[string]string, len(flagTags)+2)
	for _, t := range flagTags {
		tags[t.key] = t.value
	}
	tags["package"] = pkg
	tags["benchmark"] = b.Name

	return tags
}

func createBenchmarkFields(b *parse.Benchmark) map[string]interface{} {
	fields := make(map[string]interface{}, len(flagFields)+4)
	for _, f := range flagFields {
		fields[f.key] = f.value
	}

	if b.Measured&parse.NsPerOp != 0 {
		fields[fieldNsPerOp] = b.NsPerOp
	}
	if b.Measured&parse.AllocedBytesPerOp != 0 {
		fields[fieldAllocedBytesPerOp] = float64(b.AllocedBytesPerOp)
	}
	if b.Measured&parse.AllocsPerOp != 0 {
		fields[fieldAllocsPerOp] = float64(b.AllocsPerOp)
	}
	if b.Measured&parse.MBPerS != 0 {
		fields[fieldMBPerS] = b.MBPerS
	}
	return fields
}

func parseBenchmarkOutput(r io.Reader, batch client.BatchPoints) error {
	// Unfortunately, test2json is not very reliable when it comes to benchmarks. At least
	// the following issues exist:
	//
	// - It doesn't guarantee a "pass" action for each successful benchmark test
	// - It might misreport the name of a benchmark (i.e. "Test" field)
	//   See https://github.com/golang/go/issues/27764.
	//   This happens for example when a benchmark panics: it might use the name
	//   of the preceeding benchmark from the same package that run
	//
	// The main useful element of the json data is that it separates the output by package,
	// which complements the features in https://godoc.org/golang.org/x/tools/benchmark/parse

	// Non-benchmark output from libraries like glog can interfere with benchmark result
	// parsing. filterOutputLine tries to filter out this extraneous info.
	// It returns a tuple with the output to parse and the name of the benchmark
	// if it is in the testEvent.
	filterOutputLine := func(e *testEvent) (string, string) {
		// The benchmark name is in the output of a separate test event.
		// It may be suffixed with non-benchmark-related logged output.
		// So if e.Output is
		//   "BenchmarkFoo  \tIrrelevant output"
		// then here we return
		//   "BenchmarkFoo  \t"
		if strings.HasPrefix(e.Output, "Benchmark") {
			if split := strings.SplitAfterN(e.Output, "\t", 2); len(split) == 2 {
				// Filter out output like "Benchmarking foo\t"
				if words := strings.Fields(split[0]); len(words) == 1 {
					return split[0], words[0]
				}
			}
		}
		if strings.Contains(e.Output, "ns/op\t") {
			return e.Output, ""
		}
		if strings.Contains(e.Output, "B/op\t") {
			return e.Output, ""
		}
		if strings.Contains(e.Output, "allocs/op\t") {
			return e.Output, ""
		}
		if strings.Contains(e.Output, "MB/s\t") {
			return e.Output, ""
		}
		return "", ""
	}

	// Extract output per package.
	type pkgOutput struct {
		output     bytes.Buffer
		timestamps map[string]time.Time
	}
	outputByPkg := make(map[string]*pkgOutput)
	d := json.NewDecoder(r)
	for {
		e := &testEvent{}
		if err := d.Decode(e); err != nil {
			if err != io.EOF {
				return err
			}
			break
		}

		if e.Package == "" {
			return fmt.Errorf("empty package name for event %v", e)
		}
		if e.Time.IsZero() {
			return fmt.Errorf("zero timestamp for event %v", e)
		}

		line, bname := filterOutputLine(e)
		if line == "" {
			continue
		}

		po, ok := outputByPkg[e.Package]
		if !ok {
			po = &pkgOutput{timestamps: make(map[string]time.Time)}
			outputByPkg[e.Package] = po
		}
		po.output.WriteString(line)

		if bname != "" {
			po.timestamps[bname] = e.Time
		}
	}

	// Extract benchmark info from output
	type pkgBenchmarks struct {
		benchmarks []*parse.Benchmark
		timestamps map[string]time.Time
	}
	benchmarksPerPkg := make(map[string]*pkgBenchmarks)
	dups := make(duplicateTestsErr)
	for pkg, po := range outputByPkg {
		glog.V(5).Infof("Package %s output:\n%s", pkg, &po.output)

		set, err := parse.ParseSet(&po.output)
		if err != nil {
			return fmt.Errorf("error parsing package %s: %s", pkg, err)
		}

		for name, benchmarks := range set {
			switch len(benchmarks) {
			case 0:
			case 1:
				pb, ok := benchmarksPerPkg[pkg]
				if !ok {
					pb = &pkgBenchmarks{timestamps: po.timestamps}
					benchmarksPerPkg[pkg] = pb
				}
				pb.benchmarks = append(pb.benchmarks, benchmarks[0])
			default:
				dups[pkg] = append(dups[pkg], name)
			}
		}
	}

	// Add a point per benchmark
	for pkg, pb := range benchmarksPerPkg {
		for _, bm := range pb.benchmarks {
			t, ok := pb.timestamps[bm.Name]
			if !ok {
				return fmt.Errorf("implementation error: no timestamp for benchmark %s "+
					"in package %s", bm.Name, pkg)
			}

			tags := createBenchmarkTags(pkg, bm)
			fields := createBenchmarkFields(bm)
			point, err := client.NewPoint(
				*flagMeasurement,
				tags,
				fields,
				t,
			)
			if err != nil {
				return err
			}
			batch.AddPoint(point)
			glog.V(5).Infof("point: %s", point)
		}
	}

	glog.Infof("Parsed %d benchmarks from %d packages",
		len(batch.Points()), len(benchmarksPerPkg))

	if len(dups) > 0 {
		return dups
	}
	return nil
}
