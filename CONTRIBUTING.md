# Contributing

Issues and pull requests are welcome.

## Requirements

- Do not overwrite Zotero's original `title` field.
- Do not add undocumented or reverse-engineered translation endpoints.
- Do not bypass authentication, quotas, rate limits or payment controls.
- Remote providers must be documented in `PRIVACY.md`.
- Public free services must use conservative concurrency and retry behavior.
- New providers require request-construction and response-parsing tests.
- Do not commit real API keys or private Zotero data.

## Local checks

```bash
npm test
python build_xpi.py --check
```

## Pull requests

Describe:

- the user-facing change;
- affected providers;
- privacy or credential implications;
- Zotero versions tested;
- error and rate-limit behavior;
- tests added or updated.
