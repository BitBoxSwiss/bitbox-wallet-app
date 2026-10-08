# Adding What's new notes

Publish one JSON file per app version in
[app-updates](https://gitlab.com/shiftcrypto/app-updates), alongside its images:

```text
www/whats-new/
├── 4.53.0.json
└── images/
    └── 4.53.0-settings.png
```

The app fetches `<version>.json` from these base URLs:

| Environment | Base URL |
| --- | --- |
| Production | `https://bitboxapp.shiftcrypto.io/whats-new/` |
| Development | `https://bitboxapp.shiftcrypto.dev/whats-new/` |

The backend selects the development URL when using development servers.
Override `whatsNewProdURL` or `whatsNewDevURL` with Go's `-ldflags -X` for
local testing.

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

- `version` must match the app version exactly. Array order determines page order.
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
- The config stores the highest encountered version in `backend.whatsNew.version`
  and handled releases as `frontend["whats-new-<version>"] = true`. Fresh installs
  mark their current version handled immediately. Fetch failures leave the key
  absent so the app can retry. Downgrades preserve the highest version and skip notes.

## Publishing

Add the JSON, all available translations, and images in one `app-updates`
merge request. Merge to `staging` for testing, then promote the approved changes
to `main` for production through that repository's deployment workflow. Its
Docker image includes the whole `www/` directory automatically.

Content changes require no app rebuild or Weblate merge. Keep older version
files available. Missing files return HTTP 403 on this host; the app keeps
upgrade notes pending and retries on a later launch.

## Local testing

Use a temporary directory for sample content so it cannot enter a release:

```sh
notes_dir=$(mktemp -d)
cp backend/testdata/whats-new/4.53.0.json "$notes_dir/4.53.0.json"
mkdir "$notes_dir/images"
cp frontends/web/src/assets/bitbox-logo-inverted.png "$notes_dir/images/preview.png"
python3 -m http.server 8083 --bind 127.0.0.1 --directory "$notes_dir"
```

In another terminal, from the repo root, start the backend with the fixture's
version and directory (HTTP is accepted only for loopback IP addresses):

```sh
make servewallet GO_LDFLAGS='-X github.com/BitBoxSwiss/bitbox-wallet-app/backend/versioninfo.versionString=4.53.0 -X github.com/BitBoxSwiss/bitbox-wallet-app/backend.whatsNewDevURL=http://127.0.0.1:8083/'
```

Run `make webdev` in a third terminal. Stop the backend before editing its
`appfolder.dev/config.json`. To simulate an upgrade, set `backend.whatsNew` to
`{"version":"4.52.0"}` and remove `frontend["whats-new-4.53.0"]` if present,
preserving all other settings, then
restart. Do not commit this config or temporary content. On a clean profile,
the first launch establishes a baseline and shows no notes.

Check long copy, images, language fallback, and platform filtering. Close the
notes and relaunch to confirm they stay dismissed. For late publication, start
with the version file absent, then restore it and restart the backend. Changing
content during an open dialog takes effect only on the next eligible launch.
