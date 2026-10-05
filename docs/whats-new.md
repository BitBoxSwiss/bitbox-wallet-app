# Adding What's new notes

Publish a single `latest.json` for the latest supported app version in
[app-updates](https://gitlab.com/shiftcrypto/app-updates), alongside its images:

```text
www/whats-new/
├── latest.json
└── images/
    └── 4.53.0-settings.png
```

The production app fetches
`https://bitboxapp.shiftcrypto.io/whats-new/latest.json`.

```json
{
  "schemaVersion": 1,
  "version": "4.53.0",
  "highlights": [
    {
      "group": "common",
      "image": "images/4.53.0-settings.png",
      "content": {
        "en": {
          "title": "Search your settings",
          "description": "Find settings using the search field.",
          "imageAlt": "The settings search field.",
          "link": {
            "href": "https://blog.bitbox.swiss/en/",
            "text": "Read the release blog"
          }
        }
      }
    }
  ]
}
```

- `version` uses `major.minor.patch`. Notes are shown only when it matches the
  installed app version exactly. Array order determines page order.
- Groups: `common` applies everywhere; `mobile` applies to Android and iOS;
  `desktop`, `android`, and `ios` apply only to their respective platforms.
- Supply complete translations under the app's language codes (`en`, `de`, etc.).
  English is required. Missing translations fall back through the app's language
  hierarchy to English, including alt text and links. Copy is plain text;
  `\n` creates a line break. Release copy does not go through Weblate.
- `image` is optional: a relative path under the configured directory, with no
  parent traversal, query, or fragment. Provide `imageAlt` in each translation.
  Use PNG/JPEG up to 2 MiB and 16 megapixels. Images use the backend HTTP client
  and its proxy settings; failures leave text and navigation usable.
- `link` is optional. For a page with a link, include `{href, text}` in each
  translation. Use HTTPS URLs allowed by the app's external-link allowlist;
  `https://blog.bitbox.swiss/` is supported. Append a `common` page for a final
  blog CTA. Opening a link keeps the dialog open and uses the system browser,
  whose proxy settings are separate from the app's.
- Keep JSON under 1 MiB with at most 20 highlights. Publish images with or before
  the JSON; use new filenames when replacing images. An empty `highlights` array hides
  all pages. The app checks once per launch while upgrade notes remain pending.
- Fresh installations skip their current version. Dismissal is remembered per
  version; edits never reopen dismissed notes. Missing/invalid content remains
  pending after an upgrade and is retried on later launches. Notice IDs are
  not part of this format.
- A valid document targeting a newer version marks the installed version handled,
  stopping further checks until another app upgrade. A document targeting an older
  version is skipped and retried next launch, allowing delayed publication.
- The config stores the highest encountered version in `backend.whatsNew.version`
  and handled releases as `frontend["whats-new-<version>"] = true`. Fresh installs
  mark their current version handled immediately. Fetch failures leave the key
  absent so the app can retry. Downgrades preserve the highest version and skip notes.

## Publishing

Update `www/whats-new/latest.json`, all available translations, and images in one
`app-updates` merge request. Merge to `staging` for testing, then promote the approved changes
to `main` for production through that repository's deployment workflow. Its
Docker image includes the whole `www/` directory automatically.

Replace the document for each supported release; older JSON files are unnecessary.
If content is not ready when releasing the app, publish the new `version` with
`"highlights": []`, then fill it in later. This stops older apps checking while
the matching version continues retrying. Changing content requires no app rebuild
or Weblate merge. Missing files return HTTP 403 on this host and remain retryable.