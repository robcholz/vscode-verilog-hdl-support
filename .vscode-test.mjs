import { defineConfig } from '@vscode/test-cli';
import * as os from 'node:os';
import * as path from 'node:path';

const testTempRoot = path.join(os.tmpdir(), `veriloghdl-vscode-test-${process.pid}`);

export default defineConfig({
  version: '1.107.0',
	files: 'out/src/test/*.test.js',
	launchArgs: [
		`--user-data-dir=${path.join(testTempRoot, 'user-data')}`,
	],
});
