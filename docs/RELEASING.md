# Releasing

1. Update `manifest.json` and `CHANGELOG.md`.
2. Run:

   ```bash
   npm test
   python build_xpi.py --check
   ```

3. Commit the release changes.
4. Push a tag matching the manifest version:

   ```bash
   git tag v0.3.2
   git push origin v0.3.2
   ```

5. `.github/workflows/release.yml` builds the XPI, creates `updates.json`,
   computes the SHA-256 hash and publishes both files to GitHub Releases.

The manifest update URL is:

```text
https://github.com/zhouyi654/zotero-title-translator/releases/latest/download/updates.json
```

GitHub redirects that stable URL to the `updates.json` asset in the latest release.
