# Frontend dependency licenses

Frontend builds and CI reject production dependencies with missing or unapproved
license declarations. New packages and changed declarations require review, even
when the license is allowed. Version updates with unchanged licenses pass.

To check locally, run in `frontends/web`:

```sh
npm ci --ignore-scripts
npm run check-licenses
```

## Resolve a failure

Review the reported package's license and notices. Revert or replace the update,
or record the reviewed declaration under `packages` in
`frontends/web/licenses.json`, keeping names sorted.

For a license allowed only for one package, add the same exact package/license
entry to `exceptions` as well:

```json
{
  "exceptions": { "example-package": "MPL-2.0" },
  "packages": { "example-package": "MPL-2.0" }
}
```

Preserve existing entries and explain exceptions in the PR. Change the global
allowlist in `frontends/web/scripts/check-licenses.mjs` only for licenses approved
for every package. Rerun the check and commit policy changes with the dependency
update.

The check covers installed production dependencies, including transitive packages
and nested versions. It excludes development and Go dependencies. Optional packages
are checked where installed, so retain their entries for other platforms. One
recorded declaration applies to every installed version of a package.

Only `package.json` license declarations are compared, not license text. Missing
declarations always fail. Excepting `SEE LICENSE IN LICENSE.md` requires manually
reviewing that file on subsequent updates.
