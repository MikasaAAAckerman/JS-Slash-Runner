# JS-Slash-Runner (English Translation)

> [!NOTE]
> This is an English translation of the original [JS-Slash-Runner](https://github.com/N0VI028/JS-Slash-Runner) project. 
> All credit for the original work goes to the original author.

To install extension in SillyTavern, use the following URL:
```
https://github.com/endege/JS-Slash-Runner.git
```
Refresh browser page so it shows up in the Extensions tab.
auto_update is set to false.


> [!Warning]
> Executing custom JavaScript code may pose security risks:
>
> - Malicious scripts could steal API keys, chat logs, or other sensitive data
> - Some scripts may perform dangerous operations like unauthorized requests
>
> Before running any scripts:
>
> 1. Carefully review the script content and verify its source
> 2. Understand the script's functionality and potential impact  
> 3. If in doubt, don't run scripts from untrusted sources
>
> We are not responsible for any damages caused by third-party scripts.

This extension allows you to run external JavaScript code in SillyTavern.

Since SillyTavern doesn't natively support direct JavaScript execution, this extension uses iframes to isolate and execute scripts, enabling you to run external code in certain restricted contexts.

## Installation

To install this extension in SillyTavern, use the following URL:
```
https://github.com/endege/JS-Slash-Runner-EN
```

## Documentation

- [Documentation](https://n0vi028.github.io/JS-Slash-Runner-Doc/)

## Contribution Guidelines

### Project Structure

Following SillyTavern UI plugin requirements, this project bundles source code directly in the `dist/` folder which is committed to the repository. This can cause frequent merge conflicts during development.

To handle this, the repository's `.gitattribute` is configured to always use the current version for conflicts in the `dist/` folder. This is safe because after pushing, CI will rebuild the `dist/` folder with the latest version, making your local `dist/` contents irrelevant.

To enable this feature, run this command once:

```bash
git config --global merge.ours.driver true
```

### Manual Compilation

For detailed VSCode setup and usage instructions, refer to:
[Frontend Plugin Development VSCode Configuration](https://sillytavern-stage-girls-dog.readthedocs.io/tool_and_experience/js_slash_runner/index.html)

Prerequisites:
- Node.js 22+ 
- pnpm (can be installed via npm if you already have Node 22+):

```bash
npm install -g pnpm
```

Then install all project dependencies with:

```bash
pnpm install
```

To build the project:

```bash
pnpm build
```

Alternatively, use `pnpm watch` for continuous compilation. This will automatically rebuild when files change - just refresh the SillyTavern page to use the latest plugin version.

## License

- [Aladdin License](LICENSE)

## References

- [SillyTavern HTML Injector](https://greasyfork.org/zh-CN/scripts/503174-sillytavern-st%E9%85%92%E9%A6%86-html%E4%BB%A3%E7%A0%81%E6%B3%A8%E5%85%A5%E5%99%A8)
- [Dynamic Audio Extension](https://github.com/SillyTavern/Extension-Audio)
