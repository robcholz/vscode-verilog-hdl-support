// SPDX-License-Identifier: MIT
import * as assert from 'assert';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import which from 'which';
import {
  type FormatProviderDependencies,
  buildIStyleVerilogFormatterArgs,
  buildVeribleVerilogFormatArgs,
  buildVerilogFormatArgs,
  SystemVerilogFormatProvider,
  VerilogFormatProvider,
} from '../providers/FormatProvider';
import { BundledVeribleError, resolveVeribleExecutable } from '../tools/BundledVerible';
import { getRepositoryRoot } from './pathTestUtils';
import { ToolRunError, type ToolRunOptions, type ToolRunResult } from '../tools/ToolRunner';

suite('Formatting', () => {
  test('verilog-format settings path is expanded when the file exists', () => {
    process.env.VERILOG_FORMAT_TEST_HOME = path.join(os.tmpdir(), 'format home');
    const settingsPath = path.join(
      process.env.VERILOG_FORMAT_TEST_HOME,
      '.verilog-format.properties'
    );
    const args = buildVerilogFormatArgs(
      '/tmp/input.v',
      path.join('${env:VERILOG_FORMAT_TEST_HOME}', '.verilog-format.properties'),
      undefined,
      (candidate) => candidate === settingsPath
    );

    assert.deepStrictEqual(args, ['-f', '/tmp/input.v', '-s', settingsPath]);
  });

  test('verilog-format settings argument is omitted when the file is missing', () => {
    const args = buildVerilogFormatArgs(
      '/tmp/input.v',
      '~/.verilog-format.properties',
      undefined,
      () => false
    );

    assert.deepStrictEqual(args, ['-f', '/tmp/input.v']);
  });

  test('iStyle custom arguments are split like linter arguments', () => {
    const args = buildIStyleVerilogFormatterArgs(
      '/tmp/input.v',
      '  --flag "two words"   --define=VALUE  ',
      'ANSI'
    );

    assert.deepStrictEqual(args, [
      '-n',
      '--flag',
      'two words',
      '--define=VALUE',
      '--style=ansi',
      '/tmp/input.v',
    ]);
  });

  test('verible custom arguments are split like linter arguments', () => {
    const args = buildVeribleVerilogFormatArgs('/tmp/input.sv', '--flag "two words"');

    assert.deepStrictEqual(args, ['--inplace', '--flag', 'two words', '/tmp/input.sv']);
  });

  test('verible-verilog-format formats via configured binary', async function () {
    const veriblePath = which.sync('verible-verilog-format', { nothrow: true });
    if (!veriblePath) {
      this.skip();
      return;
    }

    const formatConfig = vscode.workspace.getConfiguration('verilog.formatting.systemVerilog');
    const veribleConfig = vscode.workspace.getConfiguration(
      'verilog.formatting.veribleVerilogFormatter'
    );
    const previousFormatter = formatConfig.get('formatter');
    const previousPath = veribleConfig.get('path');
    const previousArgs = veribleConfig.get('arguments');
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'verible-test-'));
    const tempFilePath = path.join(tempRoot, 'input.sv');

    try {
      await formatConfig.update(
        'formatter',
        'verible-verilog-format',
        vscode.ConfigurationTarget.Global
      );
      await veribleConfig.update('path', veriblePath, vscode.ConfigurationTarget.Global);
      await veribleConfig.update('arguments', '', vscode.ConfigurationTarget.Global);

      const input = 'module   m;endmodule';
      fs.writeFileSync(tempFilePath, input);
      execFileSync(veriblePath, ['--inplace', tempFilePath]);
      const expected = fs.readFileSync(tempFilePath, 'utf8');

      const document = await vscode.workspace.openTextDocument({
        language: 'systemverilog',
        content: input,
      });

      const provider = new SystemVerilogFormatProvider();
      const tokenSource = new vscode.CancellationTokenSource();
      const edits = await provider.provideDocumentFormattingEdits(
        document,
        { insertSpaces: true, tabSize: 2 },
        tokenSource.token
      );

      assert.strictEqual(edits?.length, 1);
      assert.strictEqual(edits?.[0].newText, expected);
    } finally {
      await formatConfig.update(
        'formatter',
        previousFormatter,
        vscode.ConfigurationTarget.Global
      );
      await veribleConfig.update('path', previousPath, vscode.ConfigurationTarget.Global);
      await veribleConfig.update('arguments', previousArgs, vscode.ConfigurationTarget.Global);
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test('formatter success returns a whole-document TextEdit and cleans up temp file', async () => {
    const formatConfig = vscode.workspace.getConfiguration('verilog.formatting.systemVerilog');
    const veribleConfig = vscode.workspace.getConfiguration(
      'verilog.formatting.veribleVerilogFormatter'
    );
    const previousFormatter = formatConfig.get('formatter');
    const previousPath = veribleConfig.get('path');
    const previousArgs = veribleConfig.get('arguments');
    let tempFilePath = '';

    const dependencies: FormatProviderDependencies = {
      runTool: async (options: ToolRunOptions): Promise<ToolRunResult> => {
        tempFilePath = options.args[options.args.length - 1];
        fs.writeFileSync(tempFilePath, 'module m;\nendmodule\n');
        return {
          exitCode: 0,
          signal: null,
          stdout: '',
          stderr: '',
          command: options.command,
          args: options.args,
        };
      },
    };

    try {
      await formatConfig.update(
        'formatter',
        'verible-verilog-format',
        vscode.ConfigurationTarget.Global
      );
      await veribleConfig.update('path', 'fake-verible', vscode.ConfigurationTarget.Global);
      await veribleConfig.update('arguments', '', vscode.ConfigurationTarget.Global);

      const document = await vscode.workspace.openTextDocument({
        language: 'systemverilog',
        content: 'module   m;endmodule',
      });

      const provider = new SystemVerilogFormatProvider(dependencies);
      const tokenSource = new vscode.CancellationTokenSource();
      const edits = await provider.provideDocumentFormattingEdits(
        document,
        { insertSpaces: true, tabSize: 2 },
        tokenSource.token
      );

      assert.strictEqual(edits?.length, 1);
      assert.strictEqual(edits?.[0].newText, 'module m;\nendmodule\n');
      assert.deepStrictEqual(
        edits?.[0].range,
        new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length))
      );
      assert.ok(tempFilePath.length > 0);
      assert.ok(!fs.existsSync(tempFilePath));
    } finally {
      await formatConfig.update(
        'formatter',
        previousFormatter,
        vscode.ConfigurationTarget.Global
      );
      await veribleConfig.update('path', previousPath, vscode.ConfigurationTarget.Global);
      await veribleConfig.update('arguments', previousArgs, vscode.ConfigurationTarget.Global);
    }
  });

  test('formatter failure returns no edits and cleans up temp file', async () => {
    const formatConfig = vscode.workspace.getConfiguration('verilog.formatting.systemVerilog');
    const veribleConfig = vscode.workspace.getConfiguration(
      'verilog.formatting.veribleVerilogFormatter'
    );
    const previousFormatter = formatConfig.get('formatter');
    const previousPath = veribleConfig.get('path');
    const previousArgs = veribleConfig.get('arguments');
    let tempFilePath = '';

    const dependencies: FormatProviderDependencies = {
      runTool: async (options: ToolRunOptions): Promise<ToolRunResult> => {
        tempFilePath = options.args[options.args.length - 1];
        return {
          exitCode: 1,
          signal: null,
          stdout: 'formatter stdout',
          stderr: 'formatter stderr',
          command: options.command,
          args: options.args,
        };
      },
    };

    try {
      await formatConfig.update(
        'formatter',
        'verible-verilog-format',
        vscode.ConfigurationTarget.Global
      );
      await veribleConfig.update('path', 'fake-verible', vscode.ConfigurationTarget.Global);
      await veribleConfig.update('arguments', '', vscode.ConfigurationTarget.Global);

      const document = await vscode.workspace.openTextDocument({
        language: 'systemverilog',
        content: 'module   m;endmodule',
      });

      const provider = new SystemVerilogFormatProvider(dependencies);
      const tokenSource = new vscode.CancellationTokenSource();
      const edits = await provider.provideDocumentFormattingEdits(
        document,
        { insertSpaces: true, tabSize: 2 },
        tokenSource.token
      );

      assert.deepStrictEqual(edits, []);
      assert.ok(tempFilePath.length > 0);
      assert.ok(!fs.existsSync(tempFilePath));
    } finally {
      await formatConfig.update(
        'formatter',
        previousFormatter,
        vscode.ConfigurationTarget.Global
      );
      await veribleConfig.update('path', previousPath, vscode.ConfigurationTarget.Global);
      await veribleConfig.update('arguments', previousArgs, vscode.ConfigurationTarget.Global);
    }
  });
});

suite('Bundled formatter invocation', () => {
  const config = vscode.workspace.getConfiguration('verilog.formatting.veribleVerilogFormatter');
  let previousPath: string | undefined;
  let previousArgs: string | undefined;
  setup(async () => {
    previousPath = config.inspect<string>('path')?.globalValue;
    previousArgs = config.inspect<string>('arguments')?.globalValue;
    await config.update('path', 'verible-verilog-format', vscode.ConfigurationTarget.Global);
    await config.update('arguments', '--indentation_spaces=4', vscode.ConfigurationTarget.Global);
  });
  teardown(async () => {
    await config.update('path', previousPath, vscode.ConfigurationTarget.Global);
    await config.update('arguments', previousArgs, vscode.ConfigurationTarget.Global);
  });

  for (const language of ['verilog', 'systemverilog']) {
    test(`${language} defaults to bundled Verible and passes argument arrays without quoting`, async () => {
      const selection = vscode.workspace.getConfiguration(`verilog.formatting.${language === 'verilog' ? 'verilogHDL' : 'systemVerilog'}`);
      assert.strictEqual(selection.get('formatter'), 'verible-verilog-format');
      const binary = path.join(os.tmpdir(), 'remote extension with spaces', 'verible-verilog-format');
      const dependencies: FormatProviderDependencies = {
        extensionPath: '/remote/extension',
        resolveVerible: (configuredPath, options) => {
          assert.strictEqual(configuredPath, 'verible-verilog-format');
          assert.strictEqual(options.extensionPath, '/remote/extension');
          return binary;
        },
        runTool: async options => {
          assert.strictEqual(options.command, binary);
          assert.deepStrictEqual(options.args.slice(0, -1), ['--inplace', '--indentation_spaces=4']);
          assert.ok(options.cancellationToken);
          fs.writeFileSync(options.args[options.args.length - 1], 'module m;\nendmodule\n');
          return { command: options.command, args: options.args, exitCode: 0, signal: null, stdout: '', stderr: '' };
        },
      };
      const provider = language === 'verilog' ? new VerilogFormatProvider(dependencies) : new SystemVerilogFormatProvider(dependencies);
      const document = await vscode.workspace.openTextDocument({ language, content: 'module   m;endmodule' });
      const token = new vscode.CancellationTokenSource();
      try {
        const edits = await provider.provideDocumentFormattingEdits(document, { tabSize: 2, insertSpaces: true }, token.token);
        assert.strictEqual(edits?.[0].newText, 'module m;\nendmodule\n');
      } finally { token.dispose(); }
    });

    test(`${language} finds the installed fork and actually formats with its source-built bundle`, async function () {
      this.timeout(15000);
      const root = getRepositoryRoot();
      try { resolveVeribleExecutable('verible-verilog-format', { extensionPath: root }); }
      catch (error) {
        if (process.env.VERILOGHDL_REQUIRE_BUNDLE === '1') { throw error; }
        this.skip(); return;
      }
      const provider = language === 'verilog'
        ? new VerilogFormatProvider()
        : new SystemVerilogFormatProvider();
      const input = language === 'verilog' ? 'module   m;wire a;endmodule' : 'module   m;logic a;endmodule';
      const document = await vscode.workspace.openTextDocument({ language, content: input });
      const token = new vscode.CancellationTokenSource();
      try {
        const edits = await provider.provideDocumentFormattingEdits(document, { tabSize: 4, insertSpaces: true }, token.token);
        assert.strictEqual(edits?.length, 1);
        assert.notStrictEqual(edits?.[0].newText, input);
        assert.ok(edits?.[0].newText.includes('module m;'));
      } finally { token.dispose(); }
    });
  }

  test('a bundle that cannot start shows external formatter instructions', async () => {
    let message = '';
    const provider = new SystemVerilogFormatProvider({
      resolveVerible: () => '/bundled/verible-verilog-format',
      runTool: async options => { throw new ToolRunError('Missing OS runtime', options.command, options.args, 'spawn'); },
      showError: error => { message = error; },
    });
    const document = await vscode.workspace.openTextDocument({ language: 'systemverilog', content: 'module m;endmodule' });
    const token = new vscode.CancellationTokenSource();
    try {
      assert.deepStrictEqual(await provider.provideDocumentFormattingEdits(document, { tabSize: 2, insertSpaces: true }, token.token), []);
      assert.ok(message.includes('verilog.formatting.veribleVerilogFormatter.path'));
    } finally { token.dispose(); }
  });

  test('unsupported bundle produces an actionable UI error and never invokes a tool', async () => {
    let message = '';
    const provider = new SystemVerilogFormatProvider({
      resolveVerible: () => { throw new BundledVeribleError('Unsupported host: set verilog.formatting.veribleVerilogFormatter.path'); },
      runTool: async () => assert.fail('Must not fall back to PATH'),
      showError: error => { message = error; },
    });
    const document = await vscode.workspace.openTextDocument({ language: 'systemverilog', content: 'module m;endmodule' });
    const token = new vscode.CancellationTokenSource();
    try {
      assert.deepStrictEqual(await provider.provideDocumentFormattingEdits(document, { tabSize: 2, insertSpaces: true }, token.token), []);
      assert.ok(message.includes('verilog.formatting.veribleVerilogFormatter.path'));
    } finally { token.dispose(); }
  });
});
