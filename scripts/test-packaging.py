#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
"""CI checks for the package verifier's acceptance and rejection paths."""
from pathlib import Path
import os
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent.parent
BASE = [
    'package.json', 'dist/extension.js', 'configs/verilog.configuration.json',
    'syntaxes/systemverilog.tmLanguage.json', 'snippets/verilog.json',
    'media/fliplot/defaults.json', 'THIRD_PARTY_NOTICES.md',
]

class PackageVerifierTests(unittest.TestCase):
    def verify(self, target='linux-x64', omit=None, extras=()):
        prefix = 'resources/verible/' + target
        binary = 'verible-verilog-format.exe' if target.startswith('win32') else 'verible-verilog-format'
        entries = BASE + [prefix + '/' + item for item in
                          ['NOTICES.md', 'build-info.json', 'notices/verible/LICENSE', binary]]
        entries = [entry for entry in entries if not omit or not entry.endswith(omit)]
        with tempfile.TemporaryDirectory() as temporary:
            listing = Path(temporary) / 'listing.txt'
            listing.write_text('\n'.join('extension/' + entry for entry in entries + list(extras)))
            result = subprocess.run(['node', str(ROOT / 'scripts/check-vsix-contents.mjs'), 'fixture.vsix', target],
                                    env={**os.environ, 'VERILOGHDL_VSIX_LISTING_FILE': str(listing)},
                                    text=True, capture_output=True)
            return result

    def test_accepts_each_platform(self):
        for target in ['linux-x64', 'linux-arm64', 'darwin-arm64', 'darwin-x64', 'win32-x64']:
            with self.subTest(target=target):
                result = self.verify(target)
                self.assertEqual(result.returncode, 0, result.stderr)

    def test_rejects_missing_binary_and_notices(self):
        for name in ['verible-verilog-format', 'NOTICES.md', 'build-info.json', 'notices/verible/LICENSE']:
            with self.subTest(name=name):
                self.assertNotEqual(self.verify(omit=name).returncode, 0)

    def test_rejects_other_platform_and_multiple_binaries(self):
        result = self.verify(extras=['resources/verible/darwin-arm64/verible-verilog-format'])
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('exactly one', result.stderr)
        self.assertIn("another target's bundle", result.stderr)

    def test_rejects_submodule_sources(self):
        for entry in ['third_party/verible/LICENSE', '.gitmodules', 'src/extension.ts']:
            with self.subTest(entry=entry):
                self.assertNotEqual(self.verify(extras=[entry]).returncode, 0)

if __name__ == '__main__':
    unittest.main()
