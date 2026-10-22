#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
"""CI-only publishing tests. No test contacts the Marketplace or needs credentials."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import unittest


def load_script(name, filename):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(filename))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


fixtures = load_script('release_tests', 'test-release.py')
marketplace = load_script('publish_marketplace', 'publish-marketplace.py')


class MarketplaceTests(unittest.TestCase):
    def setUp(self):
        self.fixture = fixtures.ReleaseTests()
        self.fixture.setUp()
        self.addCleanup(self.fixture.doCleanups)
        self.fixture.manifest.update(name='veriloghdl-bundled', publisher='robcholz')
        (self.fixture.root / 'package.json').write_text(json.dumps(self.fixture.manifest))
        self.fixture.write_all()
        self.env = {'VSCE_PAT': 'test-placeholder', 'AZURE_CLIENT_ID': 'client-id', 'AZURE_TENANT_ID': 'tenant-id'}
        self.calls = []

    def publish(self, ref='refs/tags/v1.29.1', auth='oidc', dry_run=False, env=None, run=None):
        return marketplace.publish(
            self.fixture.root, self.fixture.artifacts, ref, self.fixture.commit,
            auth, dry_run, self.env if env is None else env,
            run=run or (lambda *args, **kwargs: self.calls.append((args, kwargs))))

    def test_oidc_publishes_exactly_the_five_prebuilt_packages_without_pat(self):
        self.publish()
        (command,), options = self.calls[0]
        self.assertEqual(command[:4], ['vsce', 'publish', '--skip-duplicate', '--azure-credential'])
        self.assertEqual(command[4], '--packagePath')
        self.assertEqual({Path(item).name for item in command[5:]},
                         {f'veriloghdl-{target}.vsix' for target in fixtures.release.TARGETS})
        self.assertEqual(len(command[5:]), 5)
        self.assertNotIn('VSCE_PAT', options['env'])
        self.assertNotIn('test-placeholder', command)
        self.assertTrue(options['check'])

    def test_pat_uses_environment_only_and_preserves_paths_with_spaces(self):
        directory = self.fixture.root / 'artifacts with spaces'
        self.fixture.artifacts.rename(directory)
        self.fixture.artifacts = directory
        self.publish(auth='pat')
        (command,), options = self.calls[0]
        self.assertNotIn('--azure-credential', command)
        self.assertEqual(options['env']['VSCE_PAT'], 'test-placeholder')
        self.assertTrue(all('artifacts with spaces' in item for item in command[4:]))
        self.assertNotIn('test-placeholder', command)

    def test_missing_authentication_fails_before_any_publish(self):
        for auth, env in [('pat', {}), ('oidc', {}), ('oidc', {'AZURE_CLIENT_ID': 'id'})]:
            with self.subTest(auth=auth, env=env), self.assertRaisesRegex(ValueError, 'Configure'):
                self.publish(auth=auth, env=env)
        self.assertEqual(self.calls, [])

    def test_rejects_unknown_authentication(self):
        with self.assertRaisesRegex(ValueError, 'oidc or pat'):
            self.publish(auth='unknown')
        self.assertEqual(self.calls, [])

    def test_real_publishing_rejects_branch_and_wrong_tag(self):
        for ref in ['refs/heads/main', 'refs/tags/v1.29.0']:
            with self.subTest(ref=ref), self.assertRaises(ValueError):
                self.publish(ref=ref)
        self.assertEqual(self.calls, [])

    def test_branch_dry_run_validates_assets_without_credentials_or_processes(self):
        command = self.publish(ref='refs/heads/main', dry_run=True, env={})
        self.assertIn('--packagePath', command)
        self.assertEqual(self.calls, [])
        (self.fixture.artifacts / 'veriloghdl-linux-x64.vsix').unlink()
        with self.assertRaisesRegex(ValueError, 'exactly five'):
            self.publish(ref='refs/heads/main', dry_run=True, env={})

    def test_upstream_identity_cannot_be_published(self):
        manifest = {**self.fixture.manifest, 'publisher': 'mshr-h'}
        (self.fixture.root / 'package.json').write_text(json.dumps(manifest))
        with self.assertRaisesRegex(ValueError, 'robcholz.veriloghdl-bundled'):
            self.publish()
        self.assertEqual(self.calls, [])

    def test_mismatched_package_prevents_all_publication(self):
        self.fixture.write_vsix('win32-x64', version='1.29.0')
        with self.assertRaisesRegex(ValueError, 'mismatched'):
            self.publish()
        self.assertEqual(self.calls, [])

    def test_publishing_failure_propagates_for_retrying_the_failed_job(self):
        def failed(command, **_kwargs):
            raise subprocess.CalledProcessError(1, command)
        with self.assertRaises(subprocess.CalledProcessError):
            self.publish(run=failed)

    @unittest.skipUnless(os.environ.get('VERILOGHDL_REQUIRE_VSCE') == '1', 'CLI verification runs in CI')
    def test_pinned_cli_supports_prebuilt_packages_oidc_and_duplicate_skipping(self):
        help_text = subprocess.check_output(['vsce', 'publish', '--help'], text=True)
        for flag in ['--packagePath', '--azure-credential', '--skip-duplicate']:
            self.assertIn(flag, help_text)


if __name__ == '__main__':
    unittest.main()
