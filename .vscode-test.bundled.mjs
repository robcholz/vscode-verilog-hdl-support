// SPDX-License-Identifier: MIT
import { defineConfig } from '@vscode/test-cli';
import * as os from 'node:os';
import * as path from 'node:path';
export default defineConfig({
  files: ['out/src/test/bundledVerible.test.js', 'out/src/test/format.test.js', 'out/src/test/toolRunner.test.js'],
  launchArgs: [`--user-data-dir=${path.join(os.tmpdir(), `veriloghdl-bundle-test-${process.pid}`)}`],
});
