# Changelog

All notable changes to Zotero AutoNote are documented here.

## 0.2.7 - 2026-10-12

- Prepare the project for public GitHub hosting.
- Add an MIT license, security guidance, contribution instructions, CI, and release documentation.
- Remove placeholder homepage and update URLs.
- Declare compatibility with the tested Zotero 10.0 release line.

## 0.2.6 - 2026-10-12

- Parse Zotero `dateAdded` values as UTC.
- Retry automatic generation while a PDF file or its indexed text is not ready.
- Avoid sending automatic AI requests without PDF text.

## 0.2.5 - 2026-10-09

- Remove the daily automatic-generation limit.

## 0.2.4 - 2026-10-09

- Remove token and API-request usage logging.
- Require a PDF for automatic generation while retaining unrestricted manual generation.

