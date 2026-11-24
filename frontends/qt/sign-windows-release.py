#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0

import argparse
import os
from pathlib import Path
import re
import shutil
import struct
import subprocess
import sys
import tempfile


APP_BINARIES = ("BitBox.exe", "libserver.dll", "breez_sdk_spark_bindings.dll")
NSIS_PLUGINS = ("nsDialogs.dll", "StartMenu.dll", "System.dll")


def windows_binaries(directory):
    return sorted(
        path for path in directory.rglob("*")
        if path.is_file() and path.suffix.lower() in {".exe", ".dll"}
    )


def has_embedded_signature(path):
    # Distinguish an unsigned PE from a malformed certificate table before
    # deciding which binaries to submit to the release signer.
    with path.open("rb") as image:
        try:
            if image.read(2) != b"MZ":
                raise ValueError
            image.seek(0x3C)
            pe_offset, = struct.unpack("<I", image.read(4))
            image.seek(pe_offset)
            signature, optional_size = struct.unpack("<4s16xH2x", image.read(24))
            header = image.read(optional_size)
            if signature != b"PE\0\0" or len(header) != optional_size:
                raise ValueError
            # PE32 and PE32+ have different data-directory offsets. Entry 4
            # contains the certificate table's file offset and size.
            magic, = struct.unpack_from("<H", header)
            directory_offset = {0x10B: 96, 0x20B: 112}[magic]
            count, = struct.unpack_from("<I", header, directory_offset - 4)
            if directory_offset + count * 8 > len(header):
                raise ValueError
            if count <= 4 or struct.unpack_from("<II", header, directory_offset + 4 * 8) == (0, 0):
                return False
        except (KeyError, ValueError, struct.error):
            raise ValueError(f"Invalid PE header in {path}") from None

    # Decode the embedded signature without checking upstream certificate chains.
    with tempfile.TemporaryDirectory() as temporary:
        result = subprocess.run([
            "osslsigncode", "extract-signature", "-pem", "-in", path,
            "-out", Path(temporary) / "signature.pem",
        ], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    if result.returncode:
        raise ValueError(f"Unreadable embedded signature in {path}\n{result.stdout.rstrip()}")
    return True


def sign(path, signer):
    print(f"Signing {path.name}", flush=True)
    subprocess.run([signer, path], check=True)
    result = subprocess.run(["osslsigncode", "verify", "-in", path],
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    if result.returncode:
        raise ValueError(f"Signature verification failed for {path}\n{result.stdout.rstrip()}")


def unsigned_payload(payload):
    approved = {payload / name for name in APP_BINARIES}
    for path in sorted(approved):
        if not path.is_file():
            raise ValueError(f"Missing required binary {path}")
    unsigned = []
    for path in windows_binaries(payload):
        if has_embedded_signature(path):
            continue
        if path not in approved:
            raise ValueError(f"Unexpected unsigned binary {path.relative_to(payload)}")
        unsigned.append(path)
    return unsigned


def check_embedded_plugins(installer, uninstaller, signed_plugins):
    found = set()
    # The uninstaller has its own plug-in payload inside the outer NSIS archive.
    for executable in (installer, uninstaller):
        extracted = executable.with_suffix(".contents")
        subprocess.run(["7z", "x", "-y", f"-o{extracted}", executable, "$PLUGINSDIR/*"], check=True)
        embedded = extracted / "$PLUGINSDIR"
        for path in windows_binaries(embedded):
            name = path.relative_to(embedded).as_posix()
            if name in NSIS_PLUGINS:
                if path.read_bytes() != (signed_plugins / name).read_bytes():
                    raise ValueError(f"{executable.name} contains a different copy of {name}")
                found.add(name)
            elif not has_embedded_signature(path):
                raise ValueError(f"Unexpected unsigned NSIS plug-in {name} in {executable.name}")
    for name in NSIS_PLUGINS:
        if name not in found:
            raise ValueError(f"Missing embedded NSIS plug-in {name}")


def package(signer):
    for tool in ("osslsigncode", "makensis", "7z"):
        if shutil.which(tool) is None:
            raise ValueError(f"Missing required tool {tool}")
    bundle = Path(__file__).resolve().parent
    version = (bundle / "APP_VERSION").read_text(encoding="ascii").strip()
    if not re.fullmatch(r"[0-9]+\.[0-9]+\.[0-9]+", version) or any(
            int(part) > 65535 for part in version.split(".")):
        raise ValueError(f"Invalid Windows app version {version!r}")
    destination = Path.cwd() / f"BitBox-{version}-win64-installer.exe"

    # Build beside the destination so publishing the verified installer is atomic.
    with tempfile.TemporaryDirectory(dir=destination.parent, prefix=".bitbox-windows-") as temporary:
        work = Path(temporary)
        for name in ("setup.nsi", "icon.ico"):
            shutil.copyfile(bundle / name, work / name)
        payload = work / "windows"
        shutil.copytree(bundle / "windows", payload)
        unsigned = unsigned_payload(payload)

        nsis = Path(os.environ.get("NSISDIR", "/usr/share/nsis"))
        signed_plugins = work / "signed-plugins"
        signed_plugins.mkdir()
        for name in NSIS_PLUGINS:
            shutil.copyfile(nsis / "Plugins/x86-unicode" / name, signed_plugins / name)
        for path in unsigned:
            sign(path, signer)
        for name in NSIS_PLUGINS:
            sign(signed_plugins / name, signer)

        # Fixed names keep host paths out of NSIS's shell command. The callback
        # resolves the signer's real path so it can find its own configuration.
        (work / "sign-windows-release.py").symlink_to(Path(__file__).resolve())
        (work / "sign-file").symlink_to(signer)
        hook = 'python3 sign-windows-release.py ./sign-file --uninstaller "%1"'
        subprocess.run([
            "makensis", f"-DVERSION={version}.0", "-DBINDIR=windows", "-DICONFILE=icon.ico",
            '-X!addplugindir /x86-unicode "signed-plugins"',
            f"-X!uninstfinalize '{hook}' = 0", "setup.nsi",
        ], cwd=work, check=True)
        installer = work / "BitBox-installer.exe"
        check_embedded_plugins(installer, work / "uninstall.exe", signed_plugins)
        sign(installer, signer)
        installer.replace(destination)
    print(f"Created {destination}")


def main():
    parser = argparse.ArgumentParser(description="Sign and package an extracted BitBox Windows build.")
    parser.add_argument("signer", type=Path, help="executable that signs one file in place")
    parser.add_argument("--uninstaller", type=Path, help=argparse.SUPPRESS)
    args = parser.parse_args()
    signer = args.signer.resolve(strict=True)
    if not signer.is_file() or not os.access(signer, os.X_OK):
        raise ValueError(f"Signer is not executable: {signer}")
    if args.uninstaller is None:
        package(signer)
    else:
        # NSIS passes an extensionless temporary PE. smctl expects an EXE filename.
        named = Path.cwd() / "uninstall.exe"
        shutil.copyfile(args.uninstaller, named)
        sign(named, signer)
        shutil.copyfile(named, args.uninstaller)


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        sys.exit(str(error))
