// SPDX-License-Identifier: MIT
import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { resolveVeribleExecutable, BundledVeribleError } from '../tools/BundledVerible';

suite('Bundled Verible resolution', () => {
  const extensionPath = path.join(os.tmpdir(), 'remote extension host with spaces');
  for (const [platform, arch, target] of [
    ['darwin', 'arm64', 'darwin-arm64'], ['darwin', 'x64', 'darwin-x64'],
    ['linux', 'x64', 'linux-x64'], ['linux', 'arm64', 'linux-arm64'],
    ['win32', 'x64', 'win32-x64'],
  ] as const) {
    test(`resolves ${target} relative to the extension host installation`, () => {
      const binary = platform === 'win32' ? 'verible-verilog-format.exe' : 'verible-verilog-format';
      const expected = path.join(extensionPath, 'resources', 'verible', target, binary);
      assert.strictEqual(resolveVeribleExecutable('verible-verilog-format', {
        extensionPath, platform, arch, ensureExecutable: candidate => assert.strictEqual(candidate, expected),
      }), expected);
    });
  }

  for (const configuredPath of ['/custom tools/verible', './verible-verilog-format', 'my-verible',
    'C:\\Custom Tools\\verible.exe', '/usr/bin/verible-verilog-format', '']) {
    test(`preserves explicit override ${JSON.stringify(configuredPath)} even on unsupported hosts`, () => {
      assert.strictEqual(resolveVeribleExecutable(configuredPath, {
        extensionPath, platform: 'freebsd', arch: 'x64',
        ensureExecutable: () => assert.fail('Must not inspect or chmod an external executable'),
      }), configuredPath);
    });
  }

  for (const [platform, arch] of [['win32', 'arm64'], ['linux', 'arm'], ['linux', 'ia32'], ['freebsd', 'x64']]) {
    test(`unsupported host ${platform}-${arch} gives external formatter instructions`, () => {
      assert.throws(() => resolveVeribleExecutable('verible-verilog-format', {
        extensionPath, platform, arch,
      }), error => error instanceof BundledVeribleError &&
        error.message.includes(`${platform}-${arch}`) &&
        error.message.includes('verilog.formatting.veribleVerilogFormatter.path'));
    });
  }

  test('missing bundle fails without falling back to PATH', () => {
    assert.throws(() => resolveVeribleExecutable('verible-verilog-format', {
      extensionPath, platform: 'linux', arch: 'x64',
    }), /Reinstall.*platform-specific VSIX/);
  });

  test('restores Unix executable permissions and leaves file contents unchanged', function () {
    if (process.platform === 'win32') { this.skip(); return; }
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'verible permissions '));
    const binary = path.join(root, 'resources/verible/linux-x64/verible-verilog-format');
    try {
      fs.mkdirSync(path.dirname(binary), { recursive: true });
      fs.writeFileSync(binary, 'fixture', { mode: 0o644 });
      assert.strictEqual(resolveVeribleExecutable('verible-verilog-format', {
        extensionPath: root, platform: 'linux', arch: 'x64',
      }), binary);
      fs.accessSync(binary, fs.constants.X_OK);
      assert.strictEqual(fs.readFileSync(binary, 'utf8'), 'fixture');
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });

  test('permission failures provide a usable external override instruction', () => {
    assert.throws(() => resolveVeribleExecutable('verible-verilog-format', {
      extensionPath, platform: 'linux', arch: 'x64',
      ensureExecutable: () => { throw new Error('read-only installation'); },
    }), /verilog.formatting.veribleVerilogFormatter.path/);
  });
});
