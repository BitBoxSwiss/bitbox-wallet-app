# Frontend dependency licenses

Frontend builds and CI reject production dependencies with missing or unapproved
license declarations.

To check locally, run in `frontends/web`:

```sh
npm ci --ignore-scripts
npm run check-licenses
```

## Resolve a failure

Review the reported package's license and notices. Revert or replace the update,
or approve the license in `frontends/web/scripts/check-licenses.mjs`.

Add a license to `allowedLicenses` only if it is approved for every package. For
a license allowed only for one package, add an exact package/license entry to
`exceptions` instead:

```js
const exceptions = { 'example-package': 'MPL-2.0' };
```

Explain exceptions in the PR. Rerun the check and commit policy changes with the
dependency update.

The check covers installed production dependencies, including transitive packages
and nested versions. It excludes development and Go dependencies. Optional packages
are checked where installed, so retain their exceptions for other platforms. An
exception applies to every installed version of a package.

Only `package.json` license declarations are checked, not license text. Missing
declarations always fail. Excepting `SEE LICENSE IN LICENSE.md` requires manually
reviewing that file on subsequent updates.
