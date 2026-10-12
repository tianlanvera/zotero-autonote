# Security and privacy

## API keys

Never commit an API key to this repository or paste one into an issue. Zotero AutoNote reads the key from the local Zotero preference `extensions.zotero-autonote.apiKey`.

The current implementation stores that value in the local Zotero profile preferences. It is hidden in the preferences UI, but it is not protected by an operating-system credential vault. Anyone who can read the Zotero profile may be able to recover it. Use a dedicated key with a spending limit and rotate it immediately if it is exposed.

## Data sent to an AI provider

When a note is generated, the plugin sends bibliographic metadata, the abstract, and available attachment text to the endpoint configured by the user. Review the provider's privacy policy before enabling automatic generation. The plugin does not record token-usage statistics or send separate telemetry.

## Reporting a vulnerability

Use GitHub's private security-advisory feature when it is enabled for the repository. Otherwise, open an issue containing only a non-sensitive description and ask the maintainer for a private contact channel. Do not include API keys, private PDFs, attachment text, or account information in a public issue.

