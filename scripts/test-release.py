#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
"""CI-only tests for version tags and complete, consistent release artifacts."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

spec = importlib.util.spec_from_file_location('prepare_release', Path(__file__).with_name('prepare-release.py'))
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.manifest = {'name': 'veriloghdl', 'publisher': 'example-publisher', 'version': '1.29.1'}
        (self.root / 'package.json').write_text(json.dumps(self.manifest))
        self.lock = {'version': '1.29.1', 'packages': {'': {'version': '1.29.1'}}}
        (self.root / 'package-lock.json').write_text(json.dumps(self.lock))
        (self.root / 'CHANGELOG.md').write_text('# Changelog\n\n## [1.29.1] - 2026-10-21\n\n- Bundled formatter.\n\n## [1.29.0]\n\n- Previous release.\n')
        self.artifacts = self.root / 'artifacts'
        self.artifacts.mkdir()
        self.commit = '1' * 40

    def write_vsix(self, target, version='1.29.1', declared_target=None, commit=None, missing_license=False, extra_binary=False):
        prefix = f'extension/resources/verible/{target}'
        package = {**self.manifest, 'version': version}
        identity_target = declared_target or target
        xml = ('<PackageManifest xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011">'
               f'<Metadata><Identity Id="{self.manifest["name"]}" Publisher="{self.manifest["publisher"]}" Version="{version}" TargetPlatform="{identity_target}"/>'
               '</Metadata></PackageManifest>')
        info = {'target': target, 'commit': commit or self.commit, 'notices': ['verible/LICENSE']}
        entries = {
            'extension/package.json': json.dumps(package), 'extension.vsixmanifest': xml,
            f'{prefix}/build-info.json': json.dumps(info), f'{prefix}/NOTICES.md': 'Verible notices',
            f'{prefix}/notices/verible/LICENSE': 'Apache-2.0 fixture',
            'extension/LICENSE.txt': 'MIT fixture', 'extension/THIRD_PARTY_NOTICES.md': 'Notices fixture',
            f'{prefix}/' + ('verible-verilog-format.exe' if target == 'win32-x64' else 'verible-verilog-format'): 'binary fixture',
        }
        if missing_license:
            del entries[f'{prefix}/notices/verible/LICENSE']
        if extra_binary:
            entries['extension/resources/verible/unsupported/verible-verilog-format'] = 'extra fixture'
        with zipfile.ZipFile(self.artifacts / f'veriloghdl-{target}.vsix', 'w') as archive:
            for name, content in entries.items():
                archive.writestr(name, content)

    def write_all(self):
        for target in release.TARGETS:
            self.write_vsix(target)

    def test_matching_tag_and_changelog(self):
        manifest, notes = release.validate_source(self.root, 'refs/tags/v1.29.1')
        self.assertEqual(manifest, self.manifest)
        self.assertIn('Bundled formatter', notes)
        self.assertNotIn('Previous release', notes)

    def test_rejects_wrong_tag(self):
        for ref in ['refs/tags/v1.29.0', 'refs/tags/v1.29.1-extra', 'refs/tags/v1.29.1/extra']:
            with self.subTest(ref=ref), self.assertRaises(ValueError):
                release.validate_source(self.root, ref)

    def test_branch_validation_is_explicit_dry_run_only(self):
        with self.assertRaises(ValueError):
            release.validate_source(self.root, 'refs/heads/main')
        release.validate_source(self.root, 'refs/heads/main', allow_branch=True)

    def test_rejects_inconsistent_lockfile(self):
        for location in ['root', 'package']:
            with self.subTest(location=location):
                lock = json.loads(json.dumps(self.lock))
                if location == 'root':
                    lock['version'] = '0.0.0'
                else:
                    lock['packages']['']['version'] = '0.0.0'
                (self.root / 'package-lock.json').write_text(json.dumps(lock))
                with self.assertRaises(ValueError):
                    release.validate_source(self.root, 'refs/tags/v1.29.1')

    def test_rejects_missing_release_notes(self):
        (self.root / 'CHANGELOG.md').write_text('## [Unreleased]\n\nChanges\n')
        with self.assertRaises(ValueError):
            release.validate_source(self.root, 'refs/tags/v1.29.1')

    def test_accepts_exactly_five_matching_packages(self):
        self.write_all()
        release.validate_artifacts(self.artifacts, self.manifest, self.commit)

    def test_rejects_missing_or_extra_package(self):
        self.write_all()
        (self.artifacts / 'other.vsix').write_text('extra')
        with self.assertRaises(ValueError):
            release.validate_artifacts(self.artifacts, self.manifest, self.commit)
        (self.artifacts / 'other.vsix').unlink()
        (self.artifacts / 'veriloghdl-linux-x64.vsix').unlink()
        with self.assertRaises(ValueError):
            release.validate_artifacts(self.artifacts, self.manifest, self.commit)

    def test_rejects_wrong_version_target_commit_or_missing_notices(self):
        for options in [dict(version='1.29.0'), dict(declared_target='linux-arm64'),
                        dict(commit='2' * 40), dict(missing_license=True), dict(extra_binary=True)]:
            with self.subTest(options=options):
                self.write_all()
                self.write_vsix('linux-x64', **options)
                with self.assertRaises(ValueError):
                    release.validate_artifacts(self.artifacts, self.manifest, self.commit)


if __name__ == '__main__':
    unittest.main()
