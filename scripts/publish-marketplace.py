#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
"""Publish the complete CI-tested VSIX set; never rebuild or expose credentials."""
import argparse
import importlib.util
import os
from pathlib import Path
import subprocess

spec = importlib.util.spec_from_file_location('prepare_release', Path(__file__).with_name('prepare-release.py'))
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


def publish(root, artifacts, ref, commit, auth, dry_run, env, run=subprocess.run):
    manifest, _ = release.validate_source(root, ref, allow_branch=dry_run)
    if (manifest['publisher'], manifest['name']) != ('robcholz', 'veriloghdl-bundled'):
        raise ValueError('Marketplace publication is restricted to robcholz.veriloghdl-bundled')
    release.validate_artifacts(artifacts, manifest, commit)
    if auth not in ('oidc', 'pat'):
        raise ValueError('MARKETPLACE_AUTH must be oidc or pat')
    if not dry_run:
        if auth == 'pat' and not env.get('VSCE_PAT', '').strip():
            raise ValueError('Configure the VSCE_PAT GitHub environment secret for PAT publishing')
        if auth == 'oidc' and not all(env.get(key, '').strip() for key in ('AZURE_CLIENT_ID', 'AZURE_TENANT_ID')):
            raise ValueError('Configure AZURE_CLIENT_ID and AZURE_TENANT_ID and the GitHub OIDC federation')
    command = ['vsce', 'publish', '--skip-duplicate']
    child_env = dict(env)
    if auth == 'oidc':
        command.append('--azure-credential')
        # VSCE gives PATs precedence over Azure credentials; never accidentally use one.
        child_env.pop('VSCE_PAT', None)
    command.extend(['--packagePath', *(str(artifacts / f'veriloghdl-{target}.vsix') for target in release.TARGETS)])
    if dry_run:
        print(f'Dry run: verified five packages for {manifest["publisher"]}.{manifest["name"]} v{manifest["version"]}; no upload')
    else:
        run(command, check=True, env=child_env)
    return command


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ref', required=True)
    parser.add_argument('--artifacts', type=Path, required=True)
    parser.add_argument('--auth', default=os.environ.get('MARKETPLACE_AUTH') or 'oidc')
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    commit = subprocess.check_output(['git', 'ls-files', '--stage', 'third_party/verible'],
                                     cwd=root, text=True).split()[1]
    publish(root, args.artifacts, args.ref, commit, args.auth, args.dry_run, os.environ)


if __name__ == '__main__':
    main()
