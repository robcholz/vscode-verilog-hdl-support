#!/usr/bin/env node
// SPDX-License-Identifier: MIT
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'third_party/verible');
const target = `${process.platform}-${process.arch}`;
const supported = ['darwin-arm64', 'darwin-x64', 'linux-x64', 'linux-arm64', 'win32-x64'];
if (!supported.includes(target)) { throw new Error(`Cannot build bundled Verible for ${target}`); }
const release = 'v0.0-4071-g8d9f2c97';
const git = (...args) => execFileSync('git', args, { cwd: source, encoding: 'utf8' }).trim();
const commit = git('rev-parse', 'HEAD');
const gitlink = execFileSync('git', ['ls-files', '--stage', 'third_party/verible'], {
  cwd: root, encoding: 'utf8',
}).split(/\s+/)[1];
if (commit !== gitlink || git('rev-parse', `${release}^{commit}`) !== commit || git('status', '--porcelain')) {
  throw new Error('Verible must be the clean, release-tagged submodule commit recorded by the parent repository');
}
const bazel = process.env.VERIBLE_BAZEL ?? 'bazel';
const formatter = '//verible/verilog/tools/formatter:verible-verilog-format';
const buildArgs = ['build', '-c', 'opt', '--jobs=4', '--stamp', '--verbose_failures'];
if (process.platform === 'linux') { buildArgs.push('--config=create_static_linked_executables'); }
if (process.platform === 'win32') { buildArgs.push('--features=static_link_msvcrt', '--dynamic_mode=off'); }
execFileSync(bazel, [...buildArgs, formatter], { cwd: source, stdio: 'inherit' });
const bazelInfo = key => execFileSync(bazel, ['info', key], { cwd: source, encoding: 'utf8' }).trim();
const binaryName = process.platform === 'win32' ? 'verible-verilog-format.exe' : 'verible-verilog-format';
const bundleRoot = path.join(root, 'resources/verible');
// Always stage exactly one target. Never leave another platform's binary in a VSIX.
fs.rmSync(bundleRoot, { recursive: true, force: true });
const destination = path.join(bundleRoot, target);
fs.mkdirSync(destination, { recursive: true });
fs.copyFileSync(path.join(bazelInfo('bazel-bin'), 'verible/verilog/tools/formatter', binaryName),
  path.join(destination, binaryName));
if (process.platform !== 'win32') { fs.chmodSync(path.join(destination, binaryName), 0o755); }

// Retain upstream legal files verbatim, including third-party and code-generator exceptions.
// Collect from all fetched Bazel repositories, conservatively including build-tool notices.
const legalName = /^(LICENSES?|LICENCES?|COPYING|COPYRIGHT|NOTICE|AUTHORS)([._-].*)?$/i;
const noticeDir = path.join(destination, 'notices');
const collected = [];
function collect(directory, relative = '') {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name.startsWith('bazel-') || entry.name === 'node_modules') { continue; }
    const absolute = path.join(directory, entry.name);
    const item = path.join(relative, entry.name);
    if (entry.isDirectory()) { collect(absolute, item); }
    else if (entry.isFile() && legalName.test(entry.name)) {
      const output = path.join(noticeDir, item);
      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.copyFileSync(absolute, output);
      collected.push(item.replaceAll('\\', '/'));
    }
  }
}
collect(source, 'verible');
const external = path.join(bazelInfo('output_base'), 'external');
for (const entry of fs.readdirSync(external, { withFileTypes: true })) {
  // Canonical repositories are directories; aliases may be symlinks to the same repository.
  if (entry.isDirectory()) { collect(path.join(external, entry.name), `dependencies/${entry.name}`); }
}
for (const required of [/abseil/, /re2/]) {
  if (!collected.some(name => required.test(name) && /LICENSE|COPYING/i.test(name))) {
    throw new Error(`Missing required dependency license: ${required}`);
  }
}
fs.writeFileSync(path.join(destination, 'build-info.json'), JSON.stringify({
  release, commit, target, bazelVersion: fs.readFileSync(path.join(source, '.bazelversion'), 'utf8').trim(),
  source: 'https://github.com/chipsalliance/verible',
}, null, 2) + '\n');
fs.writeFileSync(path.join(destination, 'NOTICES.md'),
  `# Bundled Verible\n\nCopyright The Verible Authors. Apache-2.0.\n\n`
  + `Built without source changes from ${release} (${commit}) using the Git submodule.\n\n`
  + `Source: https://github.com/chipsalliance/verible/tree/${commit}\n\n`
  + `The following upstream license, copyright, author and notice files are reproduced verbatim.\n`
  + `This conservative set also includes notices for fetched build tools.\n\n`
  + collected.sort().map(name => `- [${name}](notices/${name})`).join('\n') + '\n');
console.log(`Staged ${target}: ${binaryName} and ${collected.length} legal files`);
