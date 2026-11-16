package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
)

type Module struct {
	Path    string
	Version string
	Dir     string
	Main    bool
	Replace *Module
}

type Package struct {
	ImportPath string
	Dir        string
	Module     *Module
	Error      *struct {
		Err string
	}
}

type Entry struct {
	Name        string   `json:"name"`
	Versions    []string `json:"versions"`
	License     *string  `json:"license"`
	Repository  *string  `json:"repository"`
	LicenseText *string  `json:"licenseText"`
}

func ptr(s string) *string {
	return &s
}

func fail(err error) {
	fmt.Fprintln(os.Stderr, err)
	os.Exit(1)
}

// Run go list in vendor mode, explicitly disabling network access.
func listPackages(cwd string, patterns []string) ([]byte, error) {
	args := []string{"list", "-mod=vendor", "-deps", "-json"}
	args = append(args, patterns...)

	cmd := exec.Command("go", args...)
	cmd.Dir = cwd

	// Prevent Go from downloading modules or toolchains.
	cmd.Env = append(os.Environ(),
		"GOPROXY=off",
		"GOSUMDB=off",
		"GOTOOLCHAIN=local",
		"GOWORK=off",
	)

	data, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf(
			"go %s: %w\n%s",
			strings.Join(args, " "),
			err,
			data,
		)
	}

	return data, nil
}

// Return a source repository URL where it can be inferred,
// otherwise link to pkg.go.dev.
func repository(path string) *string {
	parts := strings.Split(path, "/")

	if len(parts) >= 3 {
		switch parts[0] {
		case "github.com", "bitbucket.org":
			return ptr("https://" + strings.Join(parts[:3], "/"))

		case "gitlab.com":
			// Nested GitLab namespaces are ambiguous.
			// Prefer the documentation page rather than guessing.
		}
	}

	return ptr("https://pkg.go.dev/" +
		strings.Join(escapeSegments(path), "/"))
}

func escapeSegments(path string) []string {
	parts := strings.Split(path, "/")
	for i := range parts {
		parts[i] = url.PathEscape(parts[i])
	}
	return parts
}

var licenseName = regexp.MustCompile(
	`(?i)^(LICENSE|LICENCE|COPYING)([._-].*)?$`,
)

// Read a license from a directory or its immediate
// legal/metadata subdirectories.
func licenseFile(dir string) *string {
	if dir == "" {
		return nil
	}

	candidates := []string{
		dir,
		filepath.Join(dir, "LICENSES"),
		filepath.Join(dir, "licenses"),
		filepath.Join(dir, "legal"),
	}

	for _, candidate := range candidates {
		files, err := os.ReadDir(candidate)
		if err != nil {
			continue
		}

		for _, f := range files {
			if f.IsDir() || !licenseName.MatchString(f.Name()) {
				continue
			}

			data, err := os.ReadFile(
				filepath.Join(candidate, f.Name()),
			)
			if err != nil || len(bytes.TrimSpace(data)) == 0 {
				continue
			}

			return ptr(string(data))
		}
	}

	return nil
}

// Identify common licenses from their text.
// Unknown licenses are intentionally left as null.
func identify(t *string) *string {
	if t == nil {
		return nil
	}

	s := strings.ToLower(strings.Join(strings.Fields(*t), " "))

	switch {
	case strings.Contains(s, "apache license") &&
		strings.Contains(s, "version 2.0"):
		return ptr("Apache-2.0")

	case strings.Contains(s,
		"permission is hereby granted, free of charge, to any person obtaining a copy"):
		return ptr("MIT")

	case strings.Contains(s,
		"redistribution and use in source and binary forms") &&
		strings.Contains(s, "neither the name"):
		return ptr("BSD-3-Clause")

	case strings.Contains(s,
		"redistribution and use in source and binary forms"):
		return ptr("BSD-2-Clause")

	case strings.Contains(s, "mozilla public license") &&
		strings.Contains(s, "version 2.0"):
		return ptr("MPL-2.0")

	case strings.Contains(s, "gnu affero general public license") &&
		strings.Contains(s, "version 3"):
		return ptr("AGPL-3.0-only")

	case strings.Contains(s, "gnu lesser general public license") &&
		strings.Contains(s, "version 3"):
		return ptr("LGPL-3.0-only")

	case strings.Contains(s, "gnu general public license") &&
		strings.Contains(s, "version 3"):
		return ptr("GPL-3.0-only")

	case strings.Contains(s, "isc license") ||
		strings.Contains(s,
			"permission to use, copy, modify, and/or distribute this software"):
		return ptr("ISC")
	}

	return nil
}

// Locate the closest applicable license in vendor/.
//
// A module may be nested within another module's path.
// We therefore stop at the module's vendor root and never
// accidentally attribute a parent module's license.
func vendorLicense(vendorRoot, modulePath, packageDir string) *string {
	moduleDir := filepath.Join(
		vendorRoot,
		filepath.FromSlash(modulePath),
	)

	// First try the module root.
	if text := licenseFile(moduleDir); text != nil {
		return text
	}

	// Some packages have their own license in a subdirectory.
	// Search from the package directory upward to the module root.
	if packageDir == "" {
		return nil
	}

	dir := filepath.Clean(packageDir)
	root := filepath.Clean(moduleDir)

	rel, err := filepath.Rel(root, dir)
	if err != nil || rel == ".." ||
		strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return nil
	}

	for dir != root {
		if text := licenseFile(dir); text != nil {
			return text
		}

		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}

	return nil
}

func main() {
	output := flag.String(
		"output",
		"public/licenses-go.json",
		"output JSON file",
	)
	flag.Parse()

	cwd, err := os.Getwd()
	if err != nil {
		fail(err)
	}

	vendorRoot := filepath.Join(cwd, "vendor")

	// Ensure we're running from a vendored Go project.
	if _, err := os.Stat(
		filepath.Join(vendorRoot, "modules.txt"),
	); err != nil {
		fail(fmt.Errorf(
			"vendor/modules.txt not found; run from the project root: %w",
			err,
		))
	}

	patterns := flag.Args()
	if len(patterns) == 0 {
		patterns = []string{"./..."}
	}

	data, err := listPackages(cwd, patterns)
	if err != nil {
		fail(err)
	}

	decoder := json.NewDecoder(bytes.NewReader(data))
	entries := make(map[string]Entry)

	for {
		var p Package

		err := decoder.Decode(&p)
		if err == io.EOF {
			break
		}
		if err != nil {
			fail(err)
		}

		if p.Error != nil {
			fail(fmt.Errorf(
				"package resolution: %s",
				p.Error.Err,
			))
		}

		m := p.Module
		if m == nil || m.Main || m.Path == "" {
			// Skip standard library and main module packages.
			continue
		}

		version := m.Version
		if version == "" {
			version = "(local)"
		}

		key := m.Path + "\x00" + version

		// Deduplicate before reading license files.
		if _, exists := entries[key]; exists {
			continue
		}

		// In vendor mode, package directories normally point
		// directly into the vendor/ directory.
		packageDir := p.Dir

		// Resolve license files using the original module path.
		// Local replacements may require special handling.
		lt := vendorLicense(
			vendorRoot,
			m.Path,
			packageDir,
		)

		if lt == nil {
			fmt.Fprintf(
				os.Stderr,
				"Missing license file: %s@%s\n",
				m.Path,
				version,
			)
		}

		lic := identify(lt)

		if lic == nil && lt != nil {
			fmt.Fprintf(
				os.Stderr,
				"Unrecognized license: %s@%s\n",
				m.Path,
				version,
			)
		}

		repo := repository(m.Path)

		if m.Replace != nil &&
			m.Replace.Path != "" &&
			m.Replace.Version != "" {
			repo = repository(m.Replace.Path)
		}

		entries[key] = Entry{
			Name:        m.Path,
			Versions:    []string{version},
			License:     lic,
			Repository:  repo,
			LicenseText: lt,
		}
	}

	result := make([]Entry, 0, len(entries))
	for _, entry := range entries {
		result = append(result, entry)
	}

	sort.Slice(result, func(i, j int) bool {
		return result[i].Name < result[j].Name
	})

	data, err = json.MarshalIndent(result, "", "  ")
	if err != nil {
		fail(err)
	}

	if err := os.MkdirAll(
		filepath.Dir(*output),
		0755,
	); err != nil {
		fail(err)
	}

	if err := os.WriteFile(
		*output,
		append(data, '\n'),
		0644,
	); err != nil {
		fail(err)
	}

	fmt.Printf(
		"Generated %s (%d dependencies)\n",
		*output,
		len(result),
	)
}
