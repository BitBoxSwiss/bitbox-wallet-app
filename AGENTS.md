# Repository Guidelines for bitbox-wallet-app

## Project Structure & Module Organization
The repository powers the BitBoxApp. Core Go services live under `backend/` with entrypoints in
`cmd/` (e.g., `cmd/servewallet`). Frontend clients reside in `frontends/` (`web` for React, `qt` for
the desktop app, `android` and `ios` for mobile artifacts). Shared assets and docs sit in `docs/`,
while automation lives in `scripts/`. Use `vendor/` for pinned Go modules and keep `config/` aligned
with the scenarios documented in `docs/BUILD.md`.

## Build, Test, and Development Commands
- `make envinit` installs golangci-lint, gomobile, and other dev tooling. Run once per environment
  refresh.
- `make servewallet` starts the Go backend against the vendored modules; pair it with `make webdev`
  (which calls `npm start`) for live UI development.
- `make buildweb` performs a clean web build (`npm ci && npm run build`) used by desktop packages.
- `make webtest`, `make webe2etest`, and `make weblint` proxy to the React test, Playwright, and
  ESLint pipelines under `frontends/web`.
- `./scripts/ci.sh` mirrors CI: Go race tests, frontend build, and packaging checks. Use it before
  large pull requests.

## Coding Style & Naming Conventions
Go code must stay gofmt/goimports clean; prefer package-level names that mirror directory names
(`backend/accounts`, `backend/rates`). TypeScript follows the ESLint config surfaced by `npm run
lint`; keep React components PascalCased and colocate styles alongside component folders. When
adding Make targets or scripts, stick to lowercase hyphenated names (`servewallet-prodservers`).

## Testing Guidelines
Place Go tests in `_test.go` files and run `go test -mod=vendor ./...` (optionally via
`scripts/coverage.sh` to emit `coverage.cov`). Frontend unit specs live beside components as
`*.test.ts(x)`; invoke `make webtest` for the suite. Use `make webe2etest` for Playwright smoke
flows and document new scenarios in `frontends/web/tests/README.md` if they require fixtures.

## Commit & Pull Request Guidelines
Follow the existing `context: summary` convention (lowercase imperative, no trailing period)—e.g.,
`frontend: simplify account selector`. Keep commits atomic and under ~500 lines when
possible.
