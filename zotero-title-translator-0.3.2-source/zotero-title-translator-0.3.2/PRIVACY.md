# Privacy

## Data processed by the plugin

The plugin reads the Zotero item title and, for non-Chinese titles, sends that title
to the translation provider selected by the user.

The plugin does not intentionally send:

- PDF files;
- annotations;
- notes;
- abstracts;
- creators;
- the full Zotero database;
- Zotero account credentials.

## Local-only options

When Ollama or LibreTranslate is running on the same computer and the plugin is
configured to use `localhost`, title text can remain on the local device.

## Remote providers

When a remote provider is selected, title text is transmitted to that provider.
The provider's own privacy policy, retention rules, regional processing and account
settings apply.

## Stored translations

Translated titles are stored in the Zotero item's `Extra` field as:

```text
ZoteroTitleTranslation: translated title
```

They may therefore be included in Zotero item synchronization.

## API keys

API keys are currently stored in the local Zotero preferences profile without
additional encryption by this plugin. They are not sent to the project maintainer,
but software or users with access to the local Zotero profile may be able to read them.

Use restricted, revocable keys and avoid saving high-privilege keys on shared computers.
