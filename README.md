# Ethmar · Setup & Compare

Ethmar is a browser-based tool for comparing production runs from CSV and Excel exports. Analysts define how files should be interpreted; managers use those saved setups to compare results and inspect the original evidence.

It is a read-only analysis tool, not an ERP replacement. It does not write changes back to source systems.

## Demo roles

The first screen offers two roles:

- **Analyst:** prepare files, map columns, define measurements, and manage reusable setups.
- **Manager:** select a saved setup, upload a production file, check compatibility, and compare runs.

**Demo sign-in is not real security.** There are no usernames or passwords, and role selection does not protect data from other people using the same browser. Real accounts and server-enforced permissions are not implemented.

The role is retained for the current tab across refreshes. Signing out does not delete saved setups or imported data; **Delete my data** is a separate action.

## Analyst workflow

1. **Upload and check a file.** Use CSV or Excel `.xlsx`. Older `.xls` files must first be converted to `.xlsx`. Review reading settings and choose the appropriate Excel sheet.
2. **Prepare data if needed.** Guided preparation can select headers, exclude rows, fill values down, combine columns, convert units, or apply simple two-column arithmetic. Preparation produces a derived table; original values remain unchanged.
3. **Confirm what each row represents.** Choose one event per row or one run per row. The detected suggestion must be confirmed by the analyst.
4. **Confirm columns and activities.** Review detected mappings, resolve columns needing attention, select the run identifier, and define activity values and timing sources.
5. **Configure measurements.** Choose templates, names, units, required settings, headline cards, comparison attributes, and tolerance. Advanced settings are available when needed.
6. **Save the setup.** The Done screen provides Save / Export setup, independent file testing, editing, and a test-only Preview as manager link.

### Saved setups

Open **Saved setups** from the analyst header or Done screen. Each card shows:

- Name and last edited date/time.
- Row shape and original filename, when recorded.
- Counts of activities, measurements, required measurements, and preparation steps.

Actions include **View**, **Edit**, **Duplicate**, **Rename**, **Export JSON**, and **Delete**. Import a setup JSON file at the top of the screen. View shows the full settings without allowing edits.

Deleting a setup requires confirmation and removes it from the manager's available choices. Editing saved settings does not replace the analyst's currently open file. Older setups may show **Not recorded** for their original filename.

> Setups are stored on this browser. Use Export to keep them or move them to another device.

## Manager workflow

1. Sign in as **Manager**.
2. Select a saved setup. The last-used available setup is the default; managers can view setups but cannot edit them.
3. Upload a fresh production file or choose sample data. The normal manager flow does not automatically reuse the analyst's file.
4. Review the compatibility result:
   - **Matches:** continue to comparison.
   - **Matches with notes:** continue, with explanations of missing optional data or excluded records.
   - **Does not match:** stop and review the exact differences. Use **Copy message for analyst** to share them.
5. Choose a **Baseline** and a **Compared run**.
6. Read the plain-language answer, headline measurements, differences, and detailed numbers. Open evidence for formulas, source rows, and notes.
7. Review **Possible explanations to check** when useful. These are local, rule-based hypotheses—not AI output or conclusions about causes.
8. Export the comparison as CSV or open the printable report. **Upload a different file** remains available.

### Compatibility rules

- Missing run identification, a different row shape, or an unreadable file stops comparison.
- If a required measurement's necessary column or activity is absent from the whole file, the file does not match.
- If only some runs lack necessary data, other runs remain usable; affected values explain why they cannot be calculated.
- Missing optional measurements or comparison attributes produces notes and unavailable values, never invented zeros.
- Columns are matched by saved header names, not their order. Similar names may be suggested, but are not silently substituted.
- Extra columns remain available in source evidence. Unknown activity values and unparseable inputs are reported and excluded from affected calculations.
- For Excel, the saved sheet name is used when present; otherwise the manager is asked to select a sheet.

## Measurements and evidence

The standard production setup includes:

| Measurement | Standard interpretation |
| --- | --- |
| Scrap rate | Scrap quantity ÷ material input quantity × 100 |
| Changeover | Recorded changeover duration |
| Unplanned downtime | Recorded unplanned-stop duration, kept separate from changeover |
| Good output | Total recorded good-output quantity |

These are setup-defined measurements, not mandatory fixed columns. **Scrap rate is required by default; the others are optional.** Analysts can change required settings and define other measurements.

Available templates: **Ratio, Duration, Total, Difference, Count, Rate per hour, Average, and Custom formula**.

Custom formulas use arithmetic over per-run totals, counts, durations, or existing measurements. A safe parser validates expressions and circular references; there is no `eval`, executable code, function language, or row-by-row formula execution. Missing inputs and division by zero produce explicit unavailable results. Output units do not implicitly convert formula values; conversions such as `* 60` must be explicit.

Evidence shows the formula and actual operands, original source values and line references, exclusions, preparation lineage when applicable, and mapping details.

Data integrity rules include:

- Identical duplicate events are counted once, with both source rows retained for inspection.
- Conflicting duplicates make affected measurements unavailable rather than guessing a value.
- Changeover and unplanned downtime are never automatically combined or adjusted for overlap.
- Comparability differences are notices, not claims of causation.

## Data storage and limitations

- Production-file parsing, preparation, calculations, and explanation rules run in the browser.
- IndexedDB stores the analyst workspace, saved setups, and manager setup preference locally.
- There is no server-backed production-data storage or cross-device setup synchronization in the current app.
- Clearing browser site data can remove local work. Browser storage is not a backup.
- Setup JSON exports contain reusable settings, not a backup of the original production file. Keep original files separately.
- The analyst upload currently limits files to 20 MB. Large-file preparation can still be demanding for the browser.
- The repository includes API/database workspace packages, but the current Ethmar comparison flow does not require a database or API credentials.

## Development

### Requirements

- **Node.js 24**
- **pnpm 10** (this workspace rejects npm/yarn installation)
- A modern browser with IndexedDB support

Run commands from the repository root.

```bash
pnpm install --frozen-lockfile
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/ethmar dev
```

For local development, open `http://localhost:5173`. In the existing Replit workspace, the managed `artifacts/ethmar: web` workflow supplies its own port and preview routing; use that workflow rather than starting a duplicate server.

`PORT` and `BASE_PATH` are required by the Vite configuration, including during builds. They are configuration values, not credentials. No secret is needed for the browser-only app.

### Build and preview

```bash
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/ethmar build
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/ethmar serve
```

The frontend build is written to `artifacts/ethmar/dist/public`.

### Checks and tests

```bash
# App type checking and unit tests
pnpm --filter @workspace/ethmar typecheck
pnpm --filter @workspace/ethmar test

# Browser-test type checking
pnpm --filter @workspace/ethmar typecheck:e2e

# Browser tests against an already running local app
ETHMAR_E2E_URL=http://localhost:5173 pnpm --filter @workspace/ethmar test:e2e
```

Browser tests do not start the app automatically. Their default URL is `http://localhost:80/`, for the workspace preview proxy. Set `ETHMAR_E2E_URL` when using another address.

The Playwright configuration uses system `chromium` when available, including the Nix-provided browser in this workspace. On a local machine without it, install Playwright's Chromium:

```bash
pnpm --filter @workspace/ethmar exec playwright install chromium
```

Browser-test output goes to `generated-artifacts/ethmar-e2e`. Tests use isolated browser contexts rather than the user's saved browser data.

To check or build the entire workspace, use `pnpm typecheck` or `pnpm build`. Those commands include packages beyond Ethmar; the app-specific commands above are sufficient for frontend work.

## Repository map

```text
artifacts/ethmar/
  src/
    App.tsx          App state, role navigation, and analyst workflow
    components/      Setup, saved setups, comparison, and evidence UI
    lib/             Parsing, preparation, validation, calculations, and storage
  e2e/               Playwright browser regression tests
  vite.config.ts     Frontend development/build configuration
artifacts/api-server/ Supporting API workspace package
lib/                 Shared API, schema, and database packages
scripts/             Workspace utilities
generated-artifacts/ Generated output, including browser-test results
```

The main app uses **React, TypeScript, and Vite**. Unit tests use Node's test runner through `tsx`; browser tests use Playwright.

## Sample data

Synthetic datasets are defined in [`artifacts/ethmar/src/lib/samples.ts`](artifacts/ethmar/src/lib/samples.ts):

- **Clean production log:** event-based runs with separate, non-overlapping changeover and downtime in the main example.
- **Duplicate & missing input:** a repeated scrap event and a run without material input.
- **Conflict & overlapping time:** conflicting quantities for one event and overlapping stop/changeover times.
- **Cake factory:** one row per run, demonstrating a different process and column layout.

Samples are for demonstration and testing, not real production records.
