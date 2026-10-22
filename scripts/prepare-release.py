#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
"""Validate a version tag and its five already-tested VSIX release assets."""
import argparse
import json
from pathlib import Path
import re
import subprocess
import xml.etree.ElementTree as ET
import zipfile

TARGETS = ('darwin-arm64', 'darwin-x64', 'linux-x64', 'linux-arm64', 'win32-x64')


def validate_source(root, ref, allow_branch=False):
    manifest = json.loads((root / 'package.json').read_text())
    version = manifest['version']
    if not re.fullmatch(r'(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)', version):
        raise ValueError('Release version must be major.minor.patch')
    lock = json.loads((root / 'package-lock.json').read_text())
    if lock.get('version') != version or lock.get('packages', {}).get('', {}).get('version') != version:
        raise ValueError('package.json and package-lock.json versions must agree')
    if ref != f'refs/tags/v{version}' and not (allow_branch and ref.startswith('refs/heads/')):
        raise ValueError(f'Release tag must be v{version}; got {ref}')
    changelog = (root / 'CHANGELOG.md').read_text()
    section = re.search(r'^## \[' + re.escape(version) + r'\][^\n]*\n(.*?)(?=^## |\Z)',
                        changelog, flags=re.MULTILINE | re.DOTALL)
    if not section or not section.group(1).strip():
        raise ValueError(f'CHANGELOG.md needs release notes for {version}')
    return manifest, section.group(1).strip()


def validate_artifacts(directory, manifest, commit):
    expected = {f'veriloghdl-{target}.vsix' for target in TARGETS}
    actual = {item.name for item in directory.glob('*.vsix')}
    if actual != expected:
        raise ValueError(f'Expected exactly five platform VSIXs; missing={expected - actual}, extra={actual - expected}')
    namespace = {'v': 'http://schemas.microsoft.com/developer/vsx-schema/2011'}
    for target in TARGETS:
        with zipfile.ZipFile(directory / f'veriloghdl-{target}.vsix') as archive:
            names = set(archive.namelist())
            package = json.loads(archive.read('extension/package.json'))
            for key in ('name', 'publisher', 'version'):
                if package.get(key) != manifest[key]:
                    raise ValueError(f'{target} has mismatched {key}')
            identity = ET.fromstring(archive.read('extension.vsixmanifest')).find('v:Metadata/v:Identity', namespace)
            if identity is None or any(identity.get(key) != value for key, value in {
                'TargetPlatform': target, 'Version': manifest['version'],
                'Publisher': manifest['publisher'], 'Id': manifest['name'],
            }.items()):
                raise ValueError(f'{target} has mismatched VSIX identity')
            prefix = f'extension/resources/verible/{target}/'
            info = json.loads(archive.read(prefix + 'build-info.json'))
            if info.get('target') != target or info.get('commit') != commit or not info.get('notices'):
                raise ValueError(f'{target} has mismatched Verible provenance or missing notice inventory')
            binary = prefix + ('verible-verilog-format.exe' if target == 'win32-x64' else 'verible-verilog-format')
            binaries = {name for name in names if re.search(r'/verible-verilog-format(?:\.exe)?$', name)}
            if binaries != {binary}:
                raise ValueError(f'{target} must include exactly its native formatter')
            if any(name.startswith('extension/resources/verible/') and not name.startswith(prefix) for name in names):
                raise ValueError(f'{target} contains another platform bundle')
            required = {binary, prefix + 'NOTICES.md', prefix + 'notices/verible/LICENSE',
                        'extension/LICENSE.txt', 'extension/THIRD_PARTY_NOTICES.md'}
            required.update(prefix + 'notices/' + notice for notice in info['notices'])
            if not required.issubset(names):
                raise ValueError(f'{target} is missing legal files or its executable: {required - names}')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ref', required=True)
    parser.add_argument('--allow-branch', action='store_true', help='Validate a branch for a manual dry run')
    parser.add_argument('--artifacts', type=Path)
    parser.add_argument('--notes', type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    manifest, notes = validate_source(root, args.ref, args.allow_branch)
    if args.artifacts:
        gitlink = subprocess.check_output(['git', 'ls-files', '--stage', 'third_party/verible'],
                                          cwd=root, text=True).split()[1]
        validate_artifacts(args.artifacts, manifest, gitlink)
    if args.notes:
        platforms = '\n'.join(f'- `{target}`: `veriloghdl-{target}.vsix`' for target in TARGETS)
        args.notes.write_text(notes + '\n\n### Downloads\n\n' + platforms
                              + '\n\nEach VSIX includes the native Verible formatter and redistribution notices. '
                              'All builds, formatter tests, and packaged-binary smoke tests ran in GitHub Actions.\n')
    print(f'Release inputs verified: v{manifest["version"]}')


if __name__ == '__main__':
    main()
