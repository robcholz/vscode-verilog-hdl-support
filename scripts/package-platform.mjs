#!/usr/bin/env node
// SPDX-License-Identifier: MIT
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv[2] ?? `${process.platform}-${process.arch}`;
if (!['darwin-arm64', 'darwin-x64', 'linux-x64', 'linux-arm64', 'win32-x64'].includes(target)) {
  throw new Error(`Unsupported VSIX target: ${target}`);
}
const bundleRoot = path.join(root, 'resources/verible');
const targets = fs.readdirSync(bundleRoot);
if (targets.length !== 1 || targets[0] !== target) {
  throw new Error(`Stage exactly one ${target} bundle with npm run build:verible before packaging`);
}
const bundle = path.join(bundleRoot, target);
const info = JSON.parse(fs.readFileSync(path.join(bundle, 'build-info.json'), 'utf8'));
if (info.target !== target) { throw new Error('Bundle target does not match VSIX target'); }
if (!Array.isArray(info.notices) || info.notices.length === 0) { throw new Error('Missing legal file inventory'); }
for (const notice of info.notices) { fs.accessSync(path.join(bundle, 'notices', notice)); }
for (const name of ['NOTICES.md', 'notices/verible/LICENSE',
  target.startsWith('win32') ? 'verible-verilog-format.exe' : 'verible-verilog-format']) {
  fs.accessSync(path.join(bundle, name));
}
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
// Only fixed npm scripts run through cmd on Windows; executable paths/formatter args never use a shell.
execFileSync(npm, ['run', 'package:prepare'], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
execFileSync(npm, ['exec', '--yes', '--package=@vscode/vsce@3.6.0', '--', 'vsce', 'package',
  '--target', target, '--out', `veriloghdl-${target}.vsix`], {
  cwd: root, stdio: 'inherit', shell: process.platform === 'win32',
});
