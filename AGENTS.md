# Repository Guidelines for bitbox-wallet-app

## Architecture Overview
BitBoxApp is a cryptocurrency hardware wallet companion app. A Go backend provides an HTTP API
consumed by a React/TypeScript single-page app. The same frontend is embedded in desktop
(Qt WebEngine), Android, and iOS shells via platform-specific bridges.

### Project Structure & Module Organization
The repository powers the BitBoxApp. Core Go services live under `backend/` with entrypoints in
`cmd/` (e.g., `cmd/servewallet`). Frontend clients reside in `frontends/` (`web` for React, `qt` for
the desktop app, `android` and `ios` for mobile artifacts). Shared assets and docs sit in `docs/`,
while automation lives in `scripts/`. Use `vendor/` for pinned Go modules.

Key backend packages:
- `backend/coins/btc/` — Bitcoin (also used for LTC); `backend/coins/eth/` — Ethereum + ERC20 tokens
- `backend/coins/btc/handlers/handlers.go` — account-level HTTP handlers shared by all account types
- `backend/devices/bitbox02/` — BitBox02 USB/Bluetooth device drivers
- `backend/handlers/handlers.go` — top-level HTTP routing (gorilla/mux)

## Build, Test, and Development Commands

### Requirements
See `go.mod` and `frontends/web/package.json` for required Go and Node.js versions. Run
`make envinit` once to install golangci-lint, gomobile, moq, mockery, goimports, and other
dev tooling.

### Getting Started
Run `make buildweb` before the first `make webdev` to install npm dependencies. Then run
`make servewallet` and `make webdev` in separate terminals.

### Key Make Targets
- `make servewallet` starts the Go backend (port **8082**) in **testnet** mode by default.
  Pair with `make webdev` (port **8080**) for live UI development.
- Backend variants: `make servewallet-mainnet`, `make servewallet-regtest`,
  `make servewallet-simulator`, `make servewallet-prodservers`.
- The Go backend does **not** hot-reload — restart it after code changes. The Vite frontend
  hot-reloads automatically.
- `make buildweb` performs a clean web build (`npm ci && npm run build`) used by desktop packages.
- `make webtest` and `make webtestwatch` run Vitest unit tests (one-shot and watch mode).
- `make webe2etest` runs Playwright E2E tests. `make weblint` runs ESLint + type-check.
  `make webfix` auto-fixes lint issues.
- `make ci` (or `./scripts/ci.sh`) mirrors CI: Go race tests (with `GORACE="halt_on_error=1"`),
  frontend build, linting, and i18n format checks. Use it before large pull requests.
- `make go-vendor` re-vendors Go dependencies.
- All Go commands require `-mod=vendor` (e.g., `go build -mod=vendor ./...`).

## Backend Patterns

### API Endpoints
Routes are registered via `gorilla/mux` in `backend/handlers/handlers.go`. Two handler wrapper
functions exist:
- `getAPIRouter` — handler signature `func(r *http.Request) (interface{}, error)`; errors
  serialized as `{ "error": "..." }`. **Do not use this variant in new code.**
- `getAPIRouterNoError` — handler signature `func(r *http.Request) interface{}`; the response can
  include an error message or error code (e.g. `{ "success": false, "errorMessage": "...",
  "errorCode": "..." }`). **Always use this variant for new handlers.**

### Writing a Handler
All handlers are methods on the `Handlers` struct. Request/response types are typically defined
**inline** within the handler function. See `backend/handlers/handlers.go` for examples.

Handlers such as those in `backend/handlers/handlers.go` should stay thin: parse the request (body,
query params, route params, etc.), call the appropriate backend/account function, and convert the
result to JSON output. Avoid implementing business logic, validation flow, or other decision-making
in handlers. If a handler change would make it reasonable to add a handler unit test to verify
handler logic beyond input parsing, that is usually a design smell. Move that logic into an
appropriate backend package, and keep handlers as request/response adapters.

### Error Handling
Use the `errp` package in `backend/util/errp/` for error wrapping and typed error codes. See the
package for available functions and error code patterns.

### Logging
Structured logging via `github.com/sirupsen/logrus`. Obtain a logger with
`logging.Get().WithGroup("handlers")` and use `.WithField("key", value).Info("message")`.

## Frontend Patterns

### Stack
React with TypeScript, Vite (bundler), CSS Modules (styling), i18next (i18n), React Router (hash-based routing).

### Component Anatomy
All components are functional with explicit TypeScript types. Props types are named `TProps`
(prefixed with `T`). Use named exports only — no default exports. Default values go in function
parameter destructuring. See `src/components/balance/balance.tsx` for a typical example.

### Page Components and the Wrapper Pattern
Page-level components in `src/routes/` often use a wrapper/inner split. The wrapper resolves
the account from a route code and passes fully typed props to the inner component. See
`src/routes/account/send/send.tsx` for an example.

### Discriminated Unions
Used extensively for success/failure API responses and mutually exclusive props. See
`src/api/account.ts` for response types and `src/components/forms/button.tsx` for prop unions.

### Data Loading Hooks
Key custom hooks in `src/hooks/` handle all async data:

- **`useLoad(apiCall, deps)`** — Calls a promise, returns `undefined` while loading, re-calls when
  deps change. Always checks `mounted.current` before `setState`.
- **`useSubscribe(subscription)`** — Subscribes to a WebSocket event, returns `undefined` until the
  first event. Unsubscribes on unmount.
- **`useSync(apiCall, subscription)`** — Loads data once via `apiCall`, then stays in sync via
  `subscription`. Best for data that changes in real time (account status, balance).
- **`useMountedRef()`** — Returns a ref that is `true` while mounted, `false` after unmount. Used
  to guard async `setState` calls.
- **`useDefault(value, fallback)`** — Returns `fallback` when `value` is `undefined`.
- **`useDebounce(value, delay)`** — Debounces a value by `delay` ms.

**Convention:** `undefined` means "loading". Never use a separate `isLoading` boolean. Render a
skeleton or nothing while the value is `undefined`.

**Important:**
- Check `src/hooks/` before writing new logic — reuse existing hooks.
- Extract reusable hooks instead of writing long `useEffect` chains, and write tests for them.

### State Management
React Context API — contexts live in `src/contexts/`. Each context has a definition file and a
provider file. All providers are composed in `<Providers>` in `contexts/providers.tsx`. See
existing contexts for the pattern.

### Styling
CSS Modules co-located with components. See `src/style/variables.css` for shared design tokens.

### Translations
Use `useTranslation()` from `react-i18next` to get `t()`. Translation keys live in
`src/locales/{lang}/app.json` (namespace: `app`). English (`en/app.json`) is the reference. Keys
are nested by feature area and must be **sorted alphabetically**. New user-facing strings must have
a translation key — never hardcode display text.

### Form Components
Shared form components live in `src/components/forms/`. See the directory for available components
(`Button`, `Input`, `Select`, `Checkbox`, etc.) and their prop patterns. Validation is done in
component state — no form library is used.

## Coding Style & Naming Conventions

### Go
- Must pass `gofmt` and `goimports`. Linting via `golangci-lint run` (config in `.golangci.yml`).

### TypeScript / React
- ESLint config in `eslint.config.js`.
- Components are PascalCased, co-located with styles and tests.
- Types prefixed with `T` (`TProps`, `TBalance`, `TAccount`).
- Named exports only — no default exports.
- Path alias: `@/` maps to `src/` (e.g., `import { getBalance } from '@/api/account'`).

### File Naming
- Components: `my-component.tsx` (kebab-case filenames, PascalCase component names)
- Styles: `my-component.module.css`
- Tests: `my-component.test.tsx`
- Hooks: `hooks/mount.ts`, `hooks/api.ts`
- API modules: `api/account.ts`, `api/rates.ts`

## Testing Guidelines
Place Go tests in `_test.go` files and run `go test -mod=vendor ./...` (optionally via
`scripts/coverage.sh` to emit `coverage.cov`). Frontend unit specs live beside components as
`*.test.ts(x)`; invoke `make webtest` for the suite. Use `make webe2etest` for Playwright smoke
flows and document new scenarios in `frontends/web/tests/README.md` if they require fixtures.

### Frontend Test Patterns
See `src/components/forms/button.test.tsx` for component test examples and `src/hooks/api.test.ts`
for hook test examples. Key patterns: use `render` + `screen` queries, wrap in `MemoryRouter` for
routing components, use `renderHook` for hooks, and mock API calls with `vi.fn()`.

## Review Guidelines
- when reviewing a removed function call, check that the removed behavior was not required and was not dropped by accident during a refactor.
- when reviewing a removed function call, check if the callee became unused and should also be removed.
- when reviewing handlers such as those in `backend/handlers/handlers.go`, check that they only
  parse the request, call the appropriate backend/account function, and convert the result to JSON
  output. If a handler contains business logic or has involved unit tests, treat that as a design
  issue and suggest moving the logic appropriate backend package.

## Commit & Pull Request Guidelines
Follow the existing `context: summary` convention (lowercase imperative, no trailing period)—e.g.,
`frontend: simplify account selector`. Keep commits atomic and under ~500 lines when
possible.
