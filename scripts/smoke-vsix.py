#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
"""CI-only: verify and run the formatter extracted from the actual VSIX."""
import json
import os
from pathlib import Path
import platform
import stat
import subprocess
import sys
import tempfile
import zipfile

vsix, target = sys.argv[1:]
with tempfile.TemporaryDirectory(prefix='vsix smoke with spaces ') as temporary:
    root = Path(temporary)
    with zipfile.ZipFile(vsix) as archive:
        manifest = archive.read('extension.vsixmanifest').decode()
        assert f'TargetPlatform="{target}"' in manifest, manifest
        archive.extractall(root)
    bundle = root / 'extension/resources/verible' / target
    binary = bundle / ('verible-verilog-format.exe' if os.name == 'nt' else 'verible-verilog-format')
    binary.chmod(binary.stat().st_mode | stat.S_IXUSR)
    info = json.loads((bundle / 'build-info.json').read_text())
    assert info['target'] == target
    assert info['notices']
    for notice in info['notices']:
        assert (bundle / 'notices' / notice).is_file(), notice
    assert (bundle / 'notices/verible/LICENSE').is_file()
    # Native architecture and no separately installed formatter are required.
    if os.name == 'nt':
        system = os.environ['SystemRoot']
        clean_env = {**os.environ, 'PATH': str(Path(system) / 'System32')}
    else:
        clean_env = {**os.environ, 'PATH': '/usr/bin:/bin'}
    subprocess.run([str(binary), '--version'], check=True, env=clean_env)
    for suffix, source in [('.v', 'module   m;wire a;assign a=1;endmodule\n'),
                           ('.sv', 'module   m;logic a;always_comb begin a=1;end endmodule\n')]:
        input_file = root / ('input with spaces' + suffix)
        input_file.write_text(source)
        invocation = [str(binary), '--inplace', '--indentation_spaces=4', str(input_file)]
        subprocess.run(invocation, check=True, env=clean_env)
        formatted = input_file.read_text()
        assert formatted != source and 'module m;' in formatted and '\nendmodule' in formatted, formatted
        subprocess.run(invocation, check=True, env=clean_env)
        assert input_file.read_text() == formatted, 'Formatting must be idempotent'
    if platform.system() == 'Linux':
        result = subprocess.run(['ldd', str(binary)], capture_output=True, text=True)
        assert result.returncode == 0, result.stderr
        assert 'not found' not in result.stdout, result.stdout
        assert 'libstdc++' not in result.stdout and 'libgcc_s' not in result.stdout, result.stdout
        print(result.stdout)
    print(f'Packaged {target} formatter smoke test passed at {binary}')
