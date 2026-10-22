# HDL support for VS Code <img src="images/icon.png" alt="HDL support for VS Code icon" width="56" style="vertical-align: middle;" />

Verilog & SystemVerilog (Bundled Verible), with extension identity `robcholz.veriloghdl-bundled`, is a fork of [mshr-h/vscode-verilog-hdl-support](https://github.com/mshr-h/vscode-verilog-hdl-support). It provides syntax highlighting, snippets, classic Ctags-backed editing features, linting, formatting, waveform viewing, inactive preprocessor highlighting, and optional external language servers.

[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/10949/badge)](https://www.bestpractices.dev/projects/10949)
[Ask DeepWiki](https://deepwiki.com/mshr-h/vscode-verilog-hdl-support)

![sample](images/sample.gif)

## Installation

For this fork, download the matching platform VSIX from [GitHub Releases](https://github.com/robcholz/vscode-verilog-hdl-support/releases) after a version tag is released, or download the matching `veriloghdl-<target>` VSIX artifact from the [Bundled Verible VSIX workflow](https://github.com/robcholz/vscode-verilog-hdl-support/actions/workflows/bundled-vsix.yml). Install it using VS Code’s **Extensions: Install from VSIX…** command.

The upstream extension is available from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=mshr-h.VerilogHDL) or [Open VSX Registry](https://open-vsx.org/extension/mshr-h/veriloghdl).

## Features

- Syntax highlighting for Verilog, SystemVerilog, VHDL, Verilog-AMS, UCF, SDC, XDC, Tcl, UPF, and Verilog filelists.
- Verilog, SystemVerilog, and Verilog-AMS snippets.
- Inactive Verilog/SystemVerilog preprocessor region highlighting.
- Classic Ctags-backed completion, document symbols, hover, definition lookup, peek definition, and module instantiation.
- File linting with Icarus Verilog, ModelSim, Verilator, Vivado `xvlog`, Slang, or Verible Verilog Lint.
- Formatting with `verilog-format`, iStyle, or `verible-verilog-format`.
- VCD viewing with the embedded [Fliplot](https://github.com/raczben/fliplot) viewer or optional [Vaporview](https://marketplace.visualstudio.com/items?itemName=lramseyer.vaporview).
- Optional external language servers: svls, veridian, HDL Checker, verible-verilog-ls, vhdl_ls, and tclsp.

The extension does not scan or index an HDL workspace automatically. Cross-file project intelligence is available only through an external language server or another dedicated extension.

## Commands

- **Verilog: Instantiate Module** — choose a module from the workspace and insert an instantiation using the classic Ctags flow.
- **Verilog: Rerun lint tool** — rerun the configured linter on the active Verilog/SystemVerilog file.
- **Verilog: Doctor** — inspect configured Ctags, linter, formatter, language-server, WSL, include-path, and configuration-file setup without modifying HDL files.
- **Verilog: Open Waveform** — open a VCD with the configured viewer.
- **Verilog: Open Fliplot Waveform Viewer** — open the embedded viewer directly.

## Ctags Integration

The built-in editing providers use [Universal Ctags](https://github.com/universal-ctags/ctags), which supports SystemVerilog better than older Ctags implementations.

Configure Ctags with:

```json
{
    "verilog.ctags.enabled": true,
    "verilog.ctags.path": "ctags"
}
```

The built-in Ctags integration generates tags in memory for the currently opened file. It does not create a workspace-wide tag database or automatically index other HDL files. An independent extension such as [Ctags Companion](https://github.com/gediminasz/ctags-companion) can provide broader workspace or external-library lookup.

Universal Ctags installation options:

- Windows: [ctags-win32 builds](https://github.com/universal-ctags/ctags-win32)
- Linux: [Universal Ctags build instructions](https://github.com/universal-ctags/ctags/blob/master/docs/autotools.rst)
- macOS: [Homebrew Universal Ctags](https://github.com/universal-ctags/homebrew-universal-ctags)

## Linting

Set `verilog.linting.linter` to one of:

- `iverilog`
- `modelsim`
- `verilator`
- `xvlog`
- `slang`
- `verible-verilog-lint`
- `none`

The selected executable must be on `PATH`, or its installation directory can be set with `verilog.linting.path`. Automatic linting uses the classic behavior: configured linters run when Verilog/SystemVerilog documents are opened and saved. The command **Verilog: Rerun lint tool** runs it manually.

Include directories configured through each linter's `includePath` setting can be absolute or workspace-relative. Custom arguments are split into an argument array and are not executed as a shell command.

### Vivado xvlog working directory

Vivado `xvlog` may create `xsim.dir`, `xvlog.pb`, and related compiler files in its current working directory. Each lint run now uses its own extension-managed temporary directory as the process working directory. The source file, configured include directories, and relative `-f`/project-file arguments are resolved before the process starts. The directory is removed after success, failure, or cancellation.

The extension does not inject a `-work` option. In particular, it does not use the invalid `-work work=<path>` form that prevented diagnostics on some Windows/Vivado versions. Custom xvlog arguments remain supported.

On Windows, the shared tool runner resolves `xvlog.exe`, `xvlog.cmd`, or `xvlog.bat` and passes arguments without building an unsafe shell command string.

## Formatting

Use VS Code's **Format Document** command immediately after installing the matching platform VSIX. Both Verilog and SystemVerilog default to the bundled `verible-verilog-format`. No formatter installation, PATH entry, Homebrew, Java, or runtime download is needed. If several extensions provide formatting, choose **Format Document With… → Configure Default Formatter → Verilog-HDL/SystemVerilog**.

The fork's **Bundled Verible VSIX** GitHub Actions workflow produces these separate packages. Each contains one native formatter and its redistribution notices:

| Extension host | VSIX target | CI build/test host |
| --- | --- | --- |
| macOS Apple Silicon | `darwin-arm64` | macOS 15 ARM64 |
| macOS Intel | `darwin-x64` | macOS 15 Intel |
| Linux x64 | `linux-x64` | Ubuntu 22.04, glibc 2.35+ |
| Linux ARM64 | `linux-arm64` | Ubuntu 24.04 ARM64, glibc 2.39+ |
| Windows x64 | `win32-x64` | Windows Server 2025, static C/C++ runtime |

These are source builds from the pinned Verible submodule, rather than downloaded upstream formatter binaries. macOS builds target macOS 12 or later; CI exercises macOS 15. Windows ARM64, 32-bit hosts, BSD, and browser-only extension hosts are unsupported. Linux links to system glibc and bundles its C++ runtime; GCC runtime license/exception notices are included. Other OS versions are not CI-tested. Unsupported or missing bundles report an error with instructions to configure an external formatter; there is no silent fallback to PATH.

The target and executable path are resolved on the **extension host**. For SSH, containers, or WSL Remote, install the VSIX matching the remote host; a Windows client connected to WSL uses the Linux package. The executable is resolved relative to the installed extension directory, including directories containing spaces. Unix execute permissions are restored if extraction removed them. Existing linter WSL settings and external tool invocation remain available.

### Custom formatters and executable paths

Verilog still supports `verilog-format` and iStyle; SystemVerilog supports Verible. Existing formatter selections, argument settings, and explicit executable paths take precedence.

The exact path value `verible-verilog-format` (the setting default) selects the bundle, even when that value is saved explicitly. To use an external binary, set `verilog.formatting.veribleVerilogFormatter.path` to an absolute path, relative path, or a different executable name. For an external Verible on PATH with the default name, use its full path. Do not put shell quotes around the path; paths with spaces are passed as a single process argument.

```json
{
    "verilog.formatting.verilogHDL.formatter": "verible-verilog-format",
    "verilog.formatting.systemVerilog.formatter": "verible-verilog-format",
    "verilog.formatting.veribleVerilogFormatter.path": "/opt/custom tools/verible-verilog-format",
    "verilog.formatting.veribleVerilogFormatter.arguments": "--indentation_spaces=4 --column_limit=100"
}
```

On Windows, for example, use `"C:\\Custom Tools\\verible-verilog-format.exe"`. External executables must be runnable on the extension host. Range formatting is not supported. The `verilog-format` settings path still supports `~` and `${env:VAR}` expansion.

### Building the platform VSIX

Verible is pinned by the Git gitlink in `third_party/verible` to release **v0.0-4071-g8d9f2c97**, commit `8d9f2c973c386ea81834614767c1ffbebbf0ab1d`. Builds check the clean submodule against the gitlink and release tag. No formatter assets or checksum manifest are downloaded or consulted. Verible's own Bazel module dependency metadata is preserved unchanged.

Push a branch named `bundle-verible-from-submodule` or `main` to run the release pipeline as a dry run, open a PR to `main`, or manually run **Bundled Verible VSIX** to build, test, and upload all five packages in CI. Pushing a matching version tag runs the same release pipeline and publishes its tested assets, as described below. Tag runs also publish those same packages to the Marketplace after credentials are configured below. Artifact names are `veriloghdl-<target>`. The macOS Apple Silicon artifact is `veriloghdl-darwin-arm64`.

For contributors who choose to build locally (these commands are documentation only; this implementation task runs builds exclusively in CI), install Node.js 24, the Bazel version in `third_party/verible/.bazelversion`, and a native C++ toolchain. Windows also needs LLVM/clang-cl and `winflexbison3`, as in `.github/actions/build-verible/action.yml`. Bazel uses Java during the build; users of the VSIX do not need it.

```sh
git clone --recurse-submodules https://github.com/robcholz/vscode-verilog-hdl-support.git
cd vscode-verilog-hdl-support
git checkout bundle-verible-from-submodule
git submodule update --init --recursive
git -C third_party/verible fetch origin tag v0.0-4071-g8d9f2c97
npm ci
npm run build:verible
npm run compile-tests
npm run compile
# Linux: prefix the next command with xvfb-run -a
npm run test:bundled
npm run package -- darwin-arm64  # use the native host target from the table
npm run verify:vsix -- veriloghdl-darwin-arm64.vsix darwin-arm64
python scripts/smoke-vsix.py veriloghdl-darwin-arm64.vsix darwin-arm64
```

`npm run build:verible` stages only the native target and verbatim upstream license/notice files from Verible and fetched Bazel dependencies. `npm run package` refuses a missing or mismatched bundle; it never initiates a native build. The VSIX verifier rejects submodule sources, missing legal files, extra platform bundles, and multiple formatter executables. CI pins its VS Code test host to the declared minimum version, 1.107.0, and runs formatter resolution/invocation tests and smoke-tests both `.v` and `.sv` with the binary extracted from the actual VSIX, using a directory with spaces and a restricted PATH.

### Git tags and GitHub releases

The **Release platform VSIX packages and publish Marketplace** workflow (`.github/workflows/publish-marketplace.yml`) runs when a `v<major>.<minor>.<patch>` tag is pushed. It:

1. Checks that the tag, `package.json`, both root versions in `package-lock.json`, and the versioned changelog entry agree.
2. Runs the upstream checks and builds/tests all five native VSIXs in CI.
3. Verifies every VSIX's extension identity, version, target, pinned Verible source commit, single native binary, and notice inventory.
4. Creates a GitHub release from the changelog notes with the five tested VSIXs attached.
5. Publishes those exact five packages as `robcholz.veriloghdl-bundled` using a separate, tag-only Marketplace job. It never rebuilds them during publication.

No release is created if any required check or platform fails. The workflow uses the repository's GitHub token; no publishing PAT is needed for GitHub releases. Branch pushes and manual runs against a branch exercise the same gates and artifacts but do not create a release or authenticate to the Marketplace. They validate the publishing plan without credentials.

For a new version, update `package.json`, the two root extension versions in `package-lock.json`, and `CHANGELOG.md`, then commit and push the source changes. After approving the release, the maintainer can push the matching tag; for the prepared version:

```sh
git tag -a v1.29.1 -m "Verilog-HDL/SystemVerilog 1.29.1: bundled Verible"
git push origin v1.29.1
```

Download links will appear under [GitHub Releases](https://github.com/robcholz/vscode-verilog-hdl-support/releases). The Apple Silicon asset is `veriloghdl-darwin-arm64.vsix`; install it using **Extensions: Install from VSIX…**. GitHub releases and VS Code Marketplace listings are separate distribution channels.

### VS Code Marketplace availability

This fork's publisher is `robcholz`, its extension name is `veriloghdl-bundled`, and its display name is **Verilog & SystemVerilog (Bundled Verible)**. The first successful authenticated tag run will create the Marketplace listing. The upstream listing does not contain this fork's changes.

To publish manually, sign in at [Manage Publishers & Extensions](https://marketplace.visualstudio.com/manage), select the `robcholz` publisher, and upload a CI-built VSIX as a new **Visual Studio Code** extension. Upload the remaining four platform packages under the same extension and version. Use packages built after the publisher-identity change; older packages still belong to upstream's identity. VS Code selects the package matching the extension host automatically.

After publication, search Extensions for `@id:robcholz.veriloghdl-bundled`. If you have multiple HDL extensions installed, choose this fork as the formatter in your settings:

```json
{
  "[verilog]": { "editor.defaultFormatter": "robcholz.veriloghdl-bundled" },
  "[systemverilog]": { "editor.defaultFormatter": "robcholz.veriloghdl-bundled" }
}
```

### Automatic Marketplace publishing: one-time setup

Create a GitHub Actions environment named **`marketplace`** in [repository settings](https://github.com/robcholz/vscode-verilog-hdl-support/settings/environments). Restrict its deployment rules to **tags** matching `v*`. Leave required reviewers unset for unattended tag publishing. Store the variables/secrets below in that environment. The workflow fails with setup instructions if authentication is missing; it does not silently skip a release.

**Recommended: Microsoft Entra ID with GitHub OIDC.** No PAT or client secret is stored.

1. Create an Entra application/service principal (or user-assigned managed identity) and note its client ID and tenant ID.
2. Add a federated credential trusting this GitHub environment:

   ```text
   Issuer:   https://token.actions.githubusercontent.com
   Subject:  repo:robcholz/vscode-verilog-hdl-support:environment:marketplace
   Audience: api://AzureADTokenExchange
   ```

3. Grant that identity **Contributor** access to the `robcholz` Marketplace publisher. Follow Microsoft's [identity authorization instructions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#secure-automated-publishing-to-visual-studio-marketplace); the Marketplace member identifier is the identity's Azure DevOps profile ID, not its client ID. Obtain that ID while authenticated as the publishing identity using `az rest --url https://app.vssps.visualstudio.com/_apis/profile/profiles/me --resource 499b84ac-1321-427f-aa17-267ca6975798 --query id --output tsv`.
4. Set these GitHub **environment variables**:

   | Variable | Value |
   | --- | --- |
   | `MARKETPLACE_AUTH` | `oidc` (also the default) |
   | `AZURE_CLIENT_ID` | Publishing identity's client ID |
   | `AZURE_TENANT_ID` | Identity's Entra tenant ID |

The job uses [Azure Login's OIDC support](https://github.com/Azure/login#login-with-openid-connect-oidc-recommended) and `vsce --azure-credential`. Its login allows no Azure subscription; the workflow needs no subscription ID or Azure resource deployment permissions. The identity still needs access to the Marketplace publisher.

**PAT alternative:** Set environment variable `MARKETPLACE_AUTH=pat` and environment **secret** `VSCE_PAT` to an Azure DevOps PAT owned by an account with publishing access to `robcholz`. Create the PAT with **All accessible organizations** and the custom **Marketplace → Manage** scope, following Microsoft's [PAT instructions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#get-a-personal-access-token). This is not a GitHub token. Choose a short expiration and rotate it in GitHub before expiry. Microsoft states that global Azure DevOps PATs retire on **December 1, 2026**; use OIDC for a lasting setup. Do not paste credentials into this repository or chat.

Push a matching version tag only after this setup. A failed Marketplace job leaves the tested GitHub release available. Fix authentication and **re-run failed jobs** on that same run: VSCE skips platform/version combinations already uploaded, allowing a partially completed five-platform upload to resume. Uploads are sequential, so a failure can leave some platforms published. Branch dry runs and publishing tests never upload or require real credentials.


## Waveform Viewing

Set `verilog.waveform.viewer` to:

- `auto` — use Vaporview when installed, otherwise Fliplot
- `vaporview`
- `fliplot`

Use **Verilog: Open Waveform** for the configured behavior or **Verilog: Open Fliplot Waveform Viewer** to open the bundled viewer directly.

## Inactive Preprocessor Highlighting

The lightweight editor scanner highlights inactive branches controlled by `` `ifdef``, `` `ifndef``, `` `elsif``, `` `else``, and `` `endif``.

```json
{
    "verilog.preprocessor.defines": ["SIMULATION", "USE_VENDOR_IP"],
    "verilog.preprocessor.inactiveCode.enabled": true,
    "verilog.preprocessor.inactiveCode.opacity": 0.45
}
```

This scanner uses macros defined in the current document plus `verilog.preprocessor.defines`. It does not resolve include files, filelists, or simulator arguments.

## Optional Language Servers

External language servers are disabled by default and configured under `verilog.languageServer`. Multiple servers can be enabled, although overlapping providers may produce duplicate results.

| Language server | Verilog | SystemVerilog | VHDL / Tcl-family |
| --- | :---: | :---: | :---: |
| [svls](https://github.com/dalance/svls) | — | yes | — |
| [veridian](https://github.com/vivekmalneedi/veridian) | — | yes | — |
| [HDL Checker](https://github.com/suoto/hdl_checker) | yes | yes | VHDL |
| [verible-verilog-ls](https://github.com/chipsalliance/verible) | yes | yes | — |
| [vhdl_ls](https://github.com/VHDL-LS/rust_hdl) | — | — | VHDL |
| [tclsp](https://github.com/nmoroze/tclint) | — | — | Tcl, SDC, XDC, UPF |

Use **Verilog: Doctor** to check enabled server executables, arguments, and configuration paths.

## Migration from v1.26–v1.28

Stable v1.29 returns to the classic v1.25 architecture. The extension-owned project model, semantic index, hierarchy, project diagnostics, compile-unit linting, HDL Explorer, and managed slang-server runtime are no longer part of the stable extension.

Existing `.slang/server.json` files are not read, created, modified, or deleted. Obsolete settings may remain in user or workspace settings, but the extension no longer consumes them. Review VS Code settings and remove keys under the former project, semantic-diagnostics, hierarchy, HDL Explorer, and managed slang-server namespaces when convenient.

Ctags-backed editing features and the optional external language-server integrations are available again.

## Troubleshooting

1. Run **Verilog: Doctor** and inspect the `Verilog Doctor` output channel.
2. The default formatter is bundled. For external tools, confirm the selected Ctags, linter, formatter, or language-server executable is available on the extension host's `PATH`, or configure its path explicitly.
3. For multi-root workspaces, place relative include/config paths under the workspace folder containing the active file.
4. If Ctags navigation cannot find another file, remember that the built-in integration only tags the current document; use an external language server or Ctags workspace extension for cross-file lookup.
5. If xvlog fails without a normal VRFC diagnostic, check the Verilog output log for its exit status and stderr summary. Temporary-directory cleanup failures are logged separately and do not hide diagnostics.
6. On Windows, restart VS Code after changing Vivado or Ctags environment variables so the extension host receives the updated `PATH`.

## Contributing and Licenses

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development instructions and [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) for bundled third-party notices.
