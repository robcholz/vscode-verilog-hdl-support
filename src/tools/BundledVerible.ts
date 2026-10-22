// SPDX-License-Identifier: MIT
import * as fs from 'fs';
import * as path from 'path';

const supportedTargets = new Set([
  'darwin-arm64', 'darwin-x64', 'linux-x64', 'linux-arm64', 'win32-x64',
]);
const externalInstructions = 'Set verilog.formatting.veribleVerilogFormatter.path to an external '
  + 'formatter executable on this extension host, or select another formatter under verilog.formatting.';

export class BundledVeribleError extends Error {}

export interface VeribleResolutionOptions {
  extensionPath: string;
  platform?: string;
  arch?: string;
  ensureExecutable?: (binary: string, platform: string) => void;
}

function ensureExecutable(binary: string, platform: string): void {
  if (!fs.statSync(binary).isFile()) { throw new Error('Not a regular file'); }
  if (platform !== 'win32') {
    try {
      fs.accessSync(binary, fs.constants.X_OK);
    } catch {
      fs.chmodSync(binary, fs.statSync(binary).mode | 0o111);
      fs.accessSync(binary, fs.constants.X_OK);
    }
  }
}

/** Only the exact default name selects the bundle. External paths are passed through unchanged. */
export function resolveVeribleExecutable(
  configuredPath: string,
  options: VeribleResolutionOptions
): string {
  if (configuredPath !== 'verible-verilog-format') { return configuredPath; }
  // These describe the extension host (SSH/container/WSL), not the UI client.
  const platform = options.platform ?? process.platform;
  const target = `${platform}-${options.arch ?? process.arch}`;
  if (!supportedTargets.has(target)) {
    throw new BundledVeribleError(`Bundled Verible is unavailable for ${target}. ${externalInstructions}`);
  }
  const binary = path.join(options.extensionPath, 'resources', 'verible', target,
    platform === 'win32' ? 'verible-verilog-format.exe' : 'verible-verilog-format');
  try {
    (options.ensureExecutable ?? ensureExecutable)(binary, platform);
  } catch (error) {
    throw new BundledVeribleError(`Cannot execute bundled Verible for ${target}: ${String(error)}. `
      + `Reinstall the matching platform-specific VSIX. ${externalInstructions}`);
  }
  return binary;
}
