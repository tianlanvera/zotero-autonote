# Contributing

Contributions and bug reports are welcome.

## Local checks

Requirements:

- Node.js 20 or newer
- `zip` and `unzip`
- Zotero 10.0.x for manual integration testing

Run the automated tests:

```bash
npm test
```

Build and verify the XPI:

```bash
npm run build
unzip -t dist/zotero-autonote-*.xpi
```

Before submitting a change, make sure no API keys, private PDF text, Zotero profile data, or absolute local paths are included.

