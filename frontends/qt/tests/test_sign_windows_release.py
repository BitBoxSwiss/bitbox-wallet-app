# SPDX-License-Identifier: Apache-2.0

import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest


QT = Path(__file__).resolve().parents[1]
PAYLOAD = ("BitBox.exe", "libserver.dll", "breez_sdk_spark_bindings.dll")
PLUGINS = ("nsDialogs.dll", "StartMenu.dll", "System.dll")


def run_tool(*command, cwd=None, input=None):
    result = subprocess.run(command, cwd=cwd, input=input, text=True,
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    if result.returncode:
        raise AssertionError(result.stdout)


class WindowsReleaseTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        temporary = tempfile.TemporaryDirectory()
        cls.addClassCleanup(temporary.cleanup)
        root = Path(temporary.name)
        cls.cert = root / "release.pem"
        cls.key = root / "release.key"
        cls.vendor_cert = root / "vendor.pem"
        cls.vendor_key = root / "vendor.key"
        for cert, key in [(cls.cert, cls.key), (cls.vendor_cert, cls.vendor_key)]:
            run_tool("openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1",
                     "-subj", f"/CN={cert.stem}", "-addext", "extendedKeyUsage=codeSigning",
                     "-keyout", key, "-out", cert)

        fixture = root / "fixture"
        payload = fixture / "windows"
        (payload / "platforms").mkdir(parents=True)
        (fixture / "APP_VERSION").write_bytes(b"1.2.3\r\n")
        shutil.copyfile(QT / "sign-windows-release.py", fixture / "sign-windows-release.py")
        shutil.copyfile(QT / "setup.nsi", fixture / "setup.nsi")
        shutil.copyfile(QT / "resources/win/icon.ico", fixture / "icon.ico")
        run_tool("makensis", "-V2", "-", cwd=fixture,
                 input='OutFile "windows/BitBox.exe"\nSection\nSectionEnd\n')
        plugins = Path(os.environ.get("NSISDIR", "/usr/share/nsis")) / "Plugins"
        for name in PAYLOAD[1:]:
            shutil.copyfile(plugins / "amd64-unicode/System.dll", payload / name)
        run_tool("osslsigncode", "sign", "-certs", cls.vendor_cert, "-key", cls.vendor_key,
                 "-in", plugins / "amd64-unicode/nsDialogs.dll", "-out", payload / "platforms/vendor.dll")
        cls.archive = shutil.make_archive(str(root / "fixture"), "gztar", fixture)

        cls.signer = root / "test signer"
        cls.signer.write_text("""#!/bin/sh
set -eu
name=${1##*/}
echo "$name" >> "$SIGNED/log"
if [ "$name" = "${FAIL_SIGNING:-}" ]; then exit 1; fi
osslsigncode sign -certs "$TEST_CERT" -key "$TEST_KEY" -in "$1" -out "$1.signed"
mv "$1.signed" "$1"
cp "$1" "$SIGNED/$name"
""")
        cls.signer.chmod(0o700)

        # Trust the disposable release root only for this test suite's verifier.
        verifier = root / "osslsigncode"
        verifier.write_text("""#!/bin/sh
if [ "$1" = verify ]; then
    set -- "$@" -CAfile "$TEST_CERT"
fi
exec "$REAL_OSSLSIGNCODE" "$@"
""")
        verifier.chmod(0o700)

    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        self.bundle = root / "extracted archive"
        shutil.unpack_archive(self.archive, self.bundle, filter="data")
        self.output = root / "release directory"
        self.output.mkdir()
        self.installer = self.output / "BitBox-1.2.3-win64-installer.exe"
        self.signed = root / "signing calls"
        self.signed.mkdir()

    def package(self, fail_signing="", trust_signer=True):
        env = {**os.environ, "TEST_CERT": str(self.cert), "TEST_KEY": str(self.key),
               "SIGNED": str(self.signed), "FAIL_SIGNING": fail_signing}
        if trust_signer:
            env["REAL_OSSLSIGNCODE"] = shutil.which("osslsigncode")
            env["PATH"] = str(self.signer.parent) + os.pathsep + env["PATH"]
        return subprocess.run(
            [sys.executable, self.bundle / "sign-windows-release.py", self.signer],
            cwd=self.output, env=env, text=True,
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        )

    # The CLI signs the release binaries and preserves a vendor DLL whose root is absent on Linux.
    def test_signed_release(self):
        result = self.package()
        self.assertEqual(result.returncode, 0, result.stdout)
        calls = (self.signed / "log").read_text().splitlines()
        self.assertCountEqual(calls, [*PAYLOAD, *PLUGINS, "uninstall.exe", "BitBox-installer.exe"])
        self.assertEqual(calls[-2:], ["uninstall.exe", "BitBox-installer.exe"])
        extracted = self.output / "installed"
        run_tool("7z", "x", "-y", f"-o{extracted}", self.installer)
        for name in PAYLOAD:
            self.assertEqual((extracted / name).read_bytes(), (self.signed / name).read_bytes())
        for name in PLUGINS:
            self.assertEqual((extracted / "$PLUGINSDIR" / name).read_bytes(), (self.signed / name).read_bytes())
        for name in [*PAYLOAD, *PLUGINS, "uninstall.exe"]:
            run_tool("osslsigncode", "verify", "-CAfile", self.cert, "-in", self.signed / name)
        run_tool("osslsigncode", "verify", "-CAfile", self.cert, "-in", self.installer)
        vendor = Path("platforms/vendor.dll")
        self.assertEqual((extracted / vendor).read_bytes(), (self.bundle / "windows" / vendor).read_bytes())

    # If Breez starts shipping a signed DLL, its vendor signature must survive packaging.
    def test_presigned_approved_binary(self):
        payload = self.bundle / "windows"
        breez = payload / "breez_sdk_spark_bindings.dll"
        shutil.copyfile(payload / "platforms/vendor.dll", breez)
        result = self.package()
        self.assertEqual(result.returncode, 0, result.stdout)
        self.assertNotIn(breez.name, (self.signed / "log").read_text().splitlines())
        extracted = self.output / "installed"
        run_tool("7z", "x", "-y", f"-o{extracted}", self.installer, breez.name)
        self.assertEqual((extracted / breez.name).read_bytes(), breez.read_bytes())

    # An unfamiliar unsigned binary must be named before the first signing call.
    def test_unexpected_unsigned_dll(self):
        payload = self.bundle / "windows"
        shutil.copyfile(payload / "libserver.dll", payload / "platforms/new.DLL")
        result = self.package()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Unexpected unsigned binary platforms/new.DLL", result.stdout)
        self.assertFalse((self.signed / "log").exists())
        self.assertFalse(self.installer.exists())

    # An unreadable certificate table on an approved binary must never trigger re-signing.
    def test_unreadable_signature(self):
        payload = self.bundle / "windows"
        (payload / "libserver.dll").write_bytes((payload / "platforms/vendor.dll").read_bytes() + b"damage")
        result = self.package()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Unreadable embedded signature", result.stdout)
        self.assertIn("libserver.dll", result.stdout)
        self.assertFalse((self.signed / "log").exists())

    # The release must still abort if the signer succeeds but its certificate does not verify.
    def test_untrusted_release_signature(self):
        result = self.package(trust_signer=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Signature verification failed", result.stdout)
        self.assertEqual((self.signed / "log").read_text().splitlines(), ["BitBox.exe"])
        self.assertFalse(self.installer.exists())

    # A missing required file aborts preflight even when the remaining payload is signable.
    def test_missing_required_file(self):
        (self.bundle / "windows/libserver.dll").unlink()
        result = self.package()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Missing required binary", result.stdout)
        self.assertIn("libserver.dll", result.stdout)
        self.assertFalse((self.signed / "log").exists())

    # Extra unsigned NSIS plug-ins must be caught in both installation and uninstallation sections.
    def test_additional_unsigned_plugin(self):
        recipe = self.bundle / "setup.nsi"
        original = recipe.read_text()
        for section in ("Section -Main SEC0000", "Section /o -un.Main UNSEC0000"):
            with self.subTest(section=section):
                recipe.write_text(original.replace(section, section + "\nUserInfo::GetName"))
                result = self.package()
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("Unexpected unsigned NSIS plug-in UserInfo.dll", result.stdout)
                self.assertNotIn("BitBox-installer.exe", (self.signed / "log").read_text().splitlines())
                self.assertFalse(self.installer.exists())

    # The uninstaller can embed an additional vendor-signed plug-in whose CA is absent on Linux.
    def test_presigned_additional_plugin(self):
        plugins = self.bundle / "vendor plugins"
        plugins.mkdir()
        nsis = Path(os.environ.get("NSISDIR", "/usr/share/nsis"))
        vendor_plugin = plugins / "UserInfo.dll"
        run_tool("osslsigncode", "sign", "-certs", self.vendor_cert, "-key", self.vendor_key,
                 "-in", nsis / "Plugins/x86-unicode/UserInfo.dll", "-out", vendor_plugin)
        recipe = self.bundle / "setup.nsi"
        section = "Section /o -un.Main UNSEC0000"
        recipe.write_text(f'!addplugindir /x86-unicode "{plugins}"\n' +
                          recipe.read_text().replace(section, section + "\nUserInfo::GetName"))
        result = self.package()
        self.assertEqual(result.returncode, 0, result.stdout)
        extracted = self.output / "plugins"
        run_tool("7z", "x", "-y", f"-o{extracted}", self.signed / "uninstall.exe", "$PLUGINSDIR/UserInfo.dll")
        self.assertEqual((extracted / "$PLUGINSDIR/UserInfo.dll").read_bytes(), vendor_plugin.read_bytes())

    # Failure at either final signing stage preserves a previously published installer.
    def test_signer_failure(self):
        self.installer.write_bytes(b"previous release")
        for name in ("uninstall.exe", "BitBox-installer.exe"):
            with self.subTest(name=name):
                result = self.package(fail_signing=name)
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual((self.signed / "log").read_text().splitlines()[-1], name)
                self.assertEqual(self.installer.read_bytes(), b"previous release")


if __name__ == "__main__":
    unittest.main()
