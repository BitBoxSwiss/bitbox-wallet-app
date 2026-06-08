#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0

import os
import json
import re
import sys

def load_json(file_path):
    with open(file_path, 'r', encoding='utf-8') as file:
        return json.load(file)

def find_placeholders(text):
    return re.findall(r'{{\s*[\w]+\s*}}', text)

def check_placeholders(en_placeholders, other_placeholders):
    return sorted(en_placeholders) == sorted(other_placeholders)

def extract_placeholders(data, path=''):
    placeholders = {}
    for key, value in data.items():
        current_path = f"{path}.{key}" if path else key
        if isinstance(value, dict):
            placeholders.update(extract_placeholders(value, current_path))
        elif isinstance(value, str):
            placeholders[current_path] = find_placeholders(value)
    return placeholders

def check_nested_keys(en_data, lang_data, path=''):
    issues = []
    for key in en_data:
        current_path = f"{path}.{key}" if path else key
        if key not in lang_data:
            #issues.append(f"Missing key '{current_path}' in translation.")
            pass
        elif isinstance(en_data[key], dict):
            if not isinstance(lang_data[key], dict):
                issues.append(f"Type mismatch at '{current_path}': expected dict, found {type(lang_data[key])}.")
            else:
                issues.extend(check_nested_keys(en_data[key], lang_data[key], current_path))
        elif isinstance(en_data[key], str):
            if lang_data[key] != "":
                en_placeholders = find_placeholders(en_data[key])
                lang_placeholders = find_placeholders(lang_data[key])
                if not check_placeholders(en_placeholders, lang_placeholders):
                    issues.append(f"Placeholder mismatch at '{current_path}': '{lang_data[key]}' - found {lang_placeholders}; expected {en_placeholders}")
    return issues

def main():
    base_path = 'frontends/web/src/locales'
    en_file_path = os.path.join(base_path, 'en/app.json')
    en_data = load_json(en_file_path)

    issues_found = False
    for lang_dir in os.listdir(base_path):
        if lang_dir == 'en':
            continue
        lang_file_path = os.path.join(base_path, lang_dir, 'app.json')
        if not os.path.isfile(lang_file_path):
            print(f"Skipping {lang_dir}, no app.json found.")
            continue

        lang_data = load_json(lang_file_path)
        issues = check_nested_keys(en_data, lang_data)
        if issues:
            issues_found = True
            print(f"Issues found in {lang_dir}:")
            for issue in issues:
                print(f"  - {issue}")

    if issues_found:
        return 1
    return 0

if __name__ == "__main__":
    sys.exit(main())
