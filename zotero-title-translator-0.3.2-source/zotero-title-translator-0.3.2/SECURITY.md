# Security Policy

## Supported versions

Security fixes are provided for the latest published release.

## Reporting a vulnerability

Do not include API keys, private titles, Zotero profiles or other secrets in a public
issue. Use GitHub's private vulnerability reporting feature for this repository when
available.

Repository: https://github.com/zhouyi654/zotero-title-translator

Include:

- affected plugin version;
- Zotero version and operating system;
- minimal reproduction steps;
- the affected component;
- impact assessment;
- sanitized logs.

## Credential handling

The current release stores API keys in local Zotero preferences without extra
encryption. This is a known limitation. Users should use restricted, revocable keys.

A future major update may migrate credentials to Mozilla Login Manager. Such a migration
must preserve existing users' settings and delete plaintext values only after successful
verification.

## Secret hygiene for contributors

Never commit:

- real API keys;
- `.env` files;
- Zotero profile files;
- debug logs containing credentials;
- private library exports;
- release signing keys.
