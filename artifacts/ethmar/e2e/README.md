# Browser regressions

From the workspace root, with the Ethmar workflow running:

```sh
pnpm --filter @workspace/ethmar exec playwright install chromium
pnpm --filter @workspace/ethmar test:e2e
```

The default target is the local preview proxy (`http://localhost:80/`).
On Replit the configured Nix Chromium supplies its own shared libraries and is
used automatically; the browser install command is only needed on machines
without system Chromium.
To use another running instance, set `ETHMAR_E2E_URL` to its full URL,
including any base path and a trailing slash. The suite does not start or
replace application workflows.

Every test receives a new nonpersistent browser context, including a separate
IndexedDB. No test clears a user's storage or seeds shared data. Reload tests
stay in the same context so they exercise real IndexedDB recovery. Source
fixtures are synthetic in-memory CSV uploads; downloads stay in temporary test
storage. Failure screenshots and traces go to the ignored
`generated-artifacts/ethmar-e2e` directory. No retry hides flaky failures.

Coverage includes both preparation entry points, inline radio placement,
confirmation timing, valid and invalid drafts, producer dependencies, saved
JSON content, manager replay with fresh values, immutable originals, blocked
compatibility, clipboard success/denial, and stale-comparison invalidation.
These complement `pnpm --filter @workspace/ethmar test` (pure recipe,
calculation, compatibility and saved-data validation tests).
