#!/usr/bin/env python3
"""
Update BitBox02 bundled firmware binaries in this folder.

This replaces the 4 "current" bundled firmwares (BitBox02 + BitBox02 Nova, Multi + BTC-only)
while keeping the fixed v9.17.1 files intact.

Expected input directory layout:
  firmware-bitbox02-btconly.v<version>.signed.bin
  firmware-bitbox02-multi.v<version>.signed.bin
  firmware-bitbox02nova-btconly.v<version>.signed.bin
  firmware-bitbox02nova-multi.v<version>.signed.bin

The input files must be plain .bin files (not gzipped). The script writes:
  - the gzipped binaries (*.bin.gz)
  - the sha256 of the original .bin (*.bin.sha256)
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import os
import re
import struct
import sys
from pathlib import Path


ASSETS_DIR = Path(__file__).resolve().parent
FIXED_VERSION = "9.17.1"

VARIANTS = (
    "firmware-bitbox02-btconly",
    "firmware-bitbox02-multi",
    "firmware-bitbox02nova-btconly",
    "firmware-bitbox02nova-multi",
)

MAGIC_LEN = 4
MAGIC_BITBOX02_MULTI = struct.pack(">I", 0x653F362B)
MAGIC_BITBOX02_BTCONLY = struct.pack(">I", 0x11233B0B)
MAGIC_BITBOX02NOVA_MULTI = struct.pack(">I", 0x5B648CEB)
MAGIC_BITBOX02NOVA_BTCONLY = struct.pack(">I", 0x48714774)

MAX_FIRMWARE_SIZE = 884736
NUM_ROOT_KEYS = 3
NUM_SIGNING_KEYS = 3
VERSION_LEN = 4
SIGNING_PUBKEYS_DATA_LEN = VERSION_LEN + NUM_SIGNING_KEYS * 64 + NUM_ROOT_KEYS * 64
FIRMWARE_DATA_LEN = VERSION_LEN + NUM_SIGNING_KEYS * 64
SIGDATA_LEN = SIGNING_PUBKEYS_DATA_LEN + FIRMWARE_DATA_LEN

MAGIC_BY_VARIANT = {
    "firmware-bitbox02-multi": MAGIC_BITBOX02_MULTI,
    "firmware-bitbox02-btconly": MAGIC_BITBOX02_BTCONLY,
    "firmware-bitbox02nova-multi": MAGIC_BITBOX02NOVA_MULTI,
    "firmware-bitbox02nova-btconly": MAGIC_BITBOX02NOVA_BTCONLY,
}


def _normalize_version_tag(version: str) -> str:
    version = version.strip()
    if version.startswith("v"):
        version_num = version[1:]
    else:
        version_num = version
    if version_num == FIXED_VERSION:
        raise ValueError(f"refusing to update fixed version v{FIXED_VERSION}")
    if not re.fullmatch(r"\d+\.\d+\.\d+", version_num):
        raise ValueError(f"invalid --version {version!r}; expected like 9.24.0 (or v9.24.0)")
    return f"v{version_num}"


def _sha256_firmware_payload(path: Path, *, variant: str) -> str:
    signed_firmware = path.read_bytes()
    if len(signed_firmware) < MAGIC_LEN + SIGDATA_LEN:
        raise ValueError(f"signed firmware too small to parse (len={len(signed_firmware)}): {path}")

    magic, rest = signed_firmware[:MAGIC_LEN], signed_firmware[MAGIC_LEN:]
    sigdata, firmware = rest[:SIGDATA_LEN], rest[SIGDATA_LEN:]
    _ = sigdata

    expected_magic = MAGIC_BY_VARIANT.get(variant)
    if expected_magic is None:
        raise ValueError(f"unknown variant {variant!r} for {path}")
    if magic != expected_magic:
        raise ValueError(
            f"unexpected magic for {path.name}: got {magic.hex()}, expected {expected_magic.hex()} ({variant})"
        )

    if len(firmware) > MAX_FIRMWARE_SIZE:
        raise ValueError(f"firmware part too large (len={len(firmware)} > {MAX_FIRMWARE_SIZE}): {path}")

    return hashlib.sha256(firmware).digest().hex()


def _ensure_not_gzipped(path: Path) -> None:
    with path.open("rb") as f:
        header = f.read(2)
    if header == b"\x1f\x8b":
        raise ValueError(f"input file looks gzipped, expected plain .bin: {path}")


def _find_single(glob_pattern: str) -> Path:
    matches = sorted(ASSETS_DIR.glob(glob_pattern))
    if len(matches) != 1:
        raise RuntimeError(f"expected exactly 1 match for {glob_pattern!r}, found {len(matches)}: {matches}")
    return matches[0]


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Update BitBox02 bootloader bundled firmware assets")
    parser.add_argument("--dir", required=True, type=Path, help="directory containing the 4 signed .bin files")
    parser.add_argument("--version", required=True, help="firmware version, e.g. 9.24.0 (or v9.24.0)")
    parser.add_argument("--dry-run", action="store_true", help="print actions, do not modify files")
    args = parser.parse_args(argv)

    src_dir = args.dir.resolve()
    if not src_dir.is_dir():
        raise ValueError(f"--dir is not a directory: {src_dir}")

    version_tag = _normalize_version_tag(args.version)
    expected_src_bins: list[Path] = []
    expected_src_by_variant: dict[str, Path] = {}
    for variant in VARIANTS:
        expected_src_by_variant[variant] = src_dir / f"{variant}.{version_tag}.signed.bin"
        expected_src_bins.append(expected_src_by_variant[variant])

    missing = [p for p in expected_src_bins if not p.is_file()]
    if missing:
        missing_str = "\n".join(str(p) for p in missing)
        raise FileNotFoundError(f"missing expected input firmware file(s):\n{missing_str}")

    for src_bin in expected_src_bins:
        _ensure_not_gzipped(src_bin)
    # Validate signed firmware format and magic prefixes before touching the assets folder.
    for variant, src_bin in expected_src_by_variant.items():
        _sha256_firmware_payload(src_bin, variant=variant)

    # Resolve current bundled firmware files to delete (excluding fixed v9.17.1 legacy assets).
    current_assets_gz: list[Path] = []
    current_assets_sha: list[Path] = []
    for variant in VARIANTS:
        current_assets_gz.append(_find_single(f"{variant}.v*.signed.bin.gz"))
        current_assets_sha.append(_find_single(f"{variant}.v*.signed.bin.sha256"))

    # Ensure we don't touch the fixed files.
    for p in current_assets_gz + current_assets_sha:
        if f".v{FIXED_VERSION}." in p.name:
            raise RuntimeError(f"refusing to touch fixed asset: {p}")

    planned_deletes = current_assets_gz + current_assets_sha
    planned_adds: list[tuple[Path, Path]] = []  # (src_bin, dst_gz)
    for src_bin in expected_src_bins:
        planned_adds.append((src_bin, ASSETS_DIR / (src_bin.name + ".gz")))

    if args.dry_run:
        print("Would delete:")
        for p in planned_deletes:
            print(f"  {p}")
        print("Would add/replace:")
        for src_bin, dst_gz in planned_adds:
            dst_sha = ASSETS_DIR / (src_bin.name + ".sha256")
            print(f"  {dst_gz}  (from {src_bin})")
            print(f"  {dst_sha}  (sha256 of {src_bin.name})")
        return 0

    for p in planned_deletes:
        p.unlink()

    for variant, src_bin in expected_src_by_variant.items():
        sha256_hex = _sha256_firmware_payload(src_bin, variant=variant)

        dst_gz = ASSETS_DIR / (src_bin.name + ".gz")
        with src_bin.open("rb") as src_f, dst_gz.open("wb") as dst_f:
            with gzip.GzipFile(fileobj=dst_f, mode="wb", compresslevel=9, mtime=0) as gz_f:
                gz_f.write(src_f.read())

        dst_sha = ASSETS_DIR / (src_bin.name + ".sha256")
        dst_sha.write_text(sha256_hex + "\n", encoding="utf-8")

    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
