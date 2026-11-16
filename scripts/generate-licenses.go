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

type LicenseFile struct {
	// Directory whose license applies to this package.
	Dir  string
	Text string
}

func ptr(s string) *string {
	return &s
}

func fail(err error) {
	fmt.Fprintln(os.Stderr, err)
	os.Exit(1)
}

// Discover dependencies using vendored packages only.
func listPackages(cwd string, patterns []string) ([]byte, error) {
	args := []string{"list", "-mod=vendor", "-deps", "-json"}
	args = append(args, patterns...)

	cmd := exec.Command("go", args...)
	cmd.Dir = cwd
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

// Return a repository URL when it can be inferred,
// otherwise link to pkg.go.dev.
func repository(path string) *string {
	parts := strings.Split(path, "/")

	if len(parts) >= 3 {
		switch parts[0] {
		case "github.com", "bitbucket.org":
			return ptr("https://" + strings.Join(parts[:3], "/"))
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

// Find a license in this directory or its immediate
// legal/metadata subdirectories.
func licenseFile(dir string) *LicenseFile {
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

			return &LicenseFile{
				Dir:  dir,
				Text: string(data),
			}
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

// Check the package directory first, then ascend toward
// the module root. Never leave the module directory.
func vendorLicense(moduleDir, packageDir string) *LicenseFile {
	root := filepath.Clean(moduleDir)
	dir := filepath.Clean(packageDir)

	rel, err := filepath.Rel(root, dir)
	if err != nil || rel == ".." ||
		strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return nil
	}

	for {
		if license := licenseFile(dir); license != nil {
			return license
		}

		if dir == root {
			break
		}

		dir = filepath.Dir(dir)
	}

	return nil
}

// Convert a license directory into a module or package name.
//
// Example:
// vendor/github.com/example/lib/crypto
// becomes github.com/example/lib/crypto.
func licenseEntryName(
	modulePath, moduleDir, licenseDir string,
) (string, error) {
	rel, err := filepath.Rel(moduleDir, licenseDir)
	if err != nil {
		return "", err
	}

	if rel == "." {
		return modulePath, nil
	}

	if rel == ".." ||
		strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return "", fmt.Errorf(
			"license directory outside module: %s",
			licenseDir,
		)
	}

	return modulePath + "/" + filepath.ToSlash(rel), nil
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

	if _, err := os.Stat(
		filepath.Join(vendorRoot, "modules.txt"),
	); err != nil {
		fail(fmt.Errorf(
			"vendor/modules.txt not found; run from project root: %w",
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

	// Deduplicate entries by module, version, and
	// license directory. Multiple packages can inherit
	// the same license.
	entries := make(map[string]Entry)

	// Track module versions whose root license is already
	// included, and cache module-root license lookups.
	moduleRoots := make(map[string]*LicenseFile)
	moduleSeen := make(map[string]bool)

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
			continue
		}

		version := m.Version
		if version == "" {
			version = "(local)"
		}

		moduleKey := m.Path + "\x00" + version
		moduleDir := filepath.Join(
			vendorRoot,
			filepath.FromSlash(m.Path),
		)

		repoPath := m.Path
		if m.Replace != nil &&
			m.Replace.Path != "" &&
			m.Replace.Version != "" {
			repoPath = m.Replace.Path
		}
		repo := repository(repoPath)

		// Check the module root once. Its license becomes
		// the default entry for the module.
		rootLicense, checked := moduleRoots[moduleKey]
		if !checked {
			rootLicense = licenseFile(moduleDir)
			moduleRoots[moduleKey] = rootLicense
		}

		if !moduleSeen[moduleKey] {
			moduleSeen[moduleKey] = true

			if rootLicense != nil {
				text := ptr(rootLicense.Text)
				key := moduleKey + "\x00" + moduleDir

				entries[key] = Entry{
					Name:        m.Path,
					Versions:    []string{version},
					License:     identify(text),
					Repository:  repo,
					LicenseText: text,
				}
			}
		}

		// Check every package, including those belonging
		// to a module already encountered.
		license := vendorLicense(moduleDir, p.Dir)

		if license == nil {
			fmt.Fprintf(
				os.Stderr,
				"Missing license file: %s (%s@%s)\n",
				p.ImportPath,
				m.Path,
				version,
			)
			continue
		}

		// A package inherits the module's default license
		// when the text is identical.
		if rootLicense != nil &&
			license.Text == rootLicense.Text {
			continue
		}

		name, err := licenseEntryName(
			m.Path,
			moduleDir,
			license.Dir,
		)
		if err != nil {
			fail(err)
		}

		// Group packages inheriting the same override.
		key := moduleKey + "\x00" + license.Dir
		if _, exists := entries[key]; exists {
			continue
		}

		text := ptr(license.Text)
		entries[key] = Entry{
			Name:        name,
			Versions:    []string{version},
			License:     identify(text),
			Repository:  repo,
			LicenseText: text,
		}
	}

	result := make([]Entry, 0, len(entries))

	for _, entry := range entries {
		if entry.LicenseText != nil && entry.License == nil {
			fmt.Fprintf(
				os.Stderr,
				"Unrecognized license: %s@%s\n",
				entry.Name,
				entry.Versions[0],
			)
		}

		result = append(result, entry)
	}

	sort.Slice(result, func(i, j int) bool {
		if result[i].Name != result[j].Name {
			return result[i].Name < result[j].Name
		}
		return result[i].Versions[0] < result[j].Versions[0]
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
		"Generated %s (%d license entries, %d modules)\n",
		*output,
		len(result),
		len(moduleSeen),
	)
}
