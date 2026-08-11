# Zotero Title Translator

English | [中文](README.md)

[![CI](https://github.com/zhouyi654/zotero-title-translator/actions/workflows/ci.yml/badge.svg)](https://github.com/zhouyi654/zotero-title-translator/actions/workflows/ci.yml)
[![GitHub Release](https://img.shields.io/github/v/release/zhouyi654/zotero-title-translator)](https://github.com/zhouyi654/zotero-title-translator/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

An open-source translation plugin for **Zotero 9**. It translates publication titles and abstracts while preserving the original Zotero metadata. Translations are stored separately in the item's `Extra` field and can be displayed in the item list and information pane.

**Compatibility: Zotero 9.0.x.** The manifest intentionally uses `strict_max_version: 9.0.*`, so compatibility is only declared for the latest minor line that has actually been tested.

> Current version: **0.3.11**. The project is still in an early public stage. Test your provider configuration with a small number of items before running collection- or library-wide translation.

## Features

- Translate one or multiple selected titles.
- Translate abstracts without overwriting the original abstract.
- Translate the current collection or the whole Zotero library.
- Optional automatic translation for newly imported items.
- Show translated titles in a dedicated item-tree column.
- Synchronize `titleTranslation` and `abstractTranslation` with compatible Zotero item-pane fields.
- Manual editing and clearing of saved translations.
- Custom terminology rules and terminology import/export.
- Optional PDF2zh Next terminology bridge.
- Multiple providers: MyMemory, LibreTranslate, Ollama, Google Cloud Translation, DeepL, Microsoft Translator, Qwen-MT, SiliconFlow, Volcano Ark, DeepSeek, Gemini, OpenAI, and custom OpenAI-compatible endpoints.

## Installation

1. Open the repository's **Releases** page.
2. Download `zotero-title-translator-<version>.xpi` from the latest release.
3. In Zotero, open **Tools → Plugins**.
4. Drag the `.xpi` file into the Plugins window, or use **Install Add-on From File…**.
5. Restart Zotero if prompted.

Do not install GitHub's automatically generated “Source code” archives. Zotero requires the `.xpi` file.

## First configuration

Open **Zotero Settings → Title Translator**, choose a translation provider, configure the required endpoint/model/API key, and test a single non-Chinese item first.

Remote providers receive the title or abstract that you ask the plugin to translate. Local Ollama or a local LibreTranslate instance can keep translation requests on the current machine. See [PRIVACY.md](PRIVACY.md) and [SECURITY.md](SECURITY.md).

## Translation storage

The plugin does not overwrite the original Zotero `title` or `abstractNote` fields. Translations are stored in `Extra` as:

```text
titleTranslation: Translated title
abstractTranslation: Translated abstract
```

Older `ZoteroTitleTranslation` values are migrated to `titleTranslation`.

## Development

Requirements:

- Node.js 20+
- Python 3.10+
- Zotero 9 for integration testing

Run the complete static/unit test suite:

```bash
npm test
```

Build and verify the XPI:

```bash
npm run build
```

Validate metadata, build the XPI, generate the update manifest, and verify the artifacts:

```bash
npm run release:check
npm run build
npm run release:manifest
npm run release:verify
```

If GitHub Actions has not yet been installed in the repository, run once:

```bash
npm run workflows:install
```

This copies the version-controlled templates from `scripts/workflow_templates/` to `.github/workflows/`.

The release workflow is documented in [`docs/RELEASING.md`](docs/RELEASING.md).

## Support and contributions

Bug reports and feature requests should go to GitHub Issues. Please remove API keys, private titles, Zotero profiles, and unredacted logs before posting.

See [`CONTRIBUTING.md`](CONTRIBUTING.md), [`SECURITY.md`](SECURITY.md), and [`PRIVACY.md`](PRIVACY.md).

## License

MIT License. See [LICENSE](LICENSE).
