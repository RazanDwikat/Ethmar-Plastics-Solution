---
name: Comparison product rules
description: User-confirmed scope and integrity constraints for the Ethmar comparison MVP.
---

Ethmar Plastics needs a read-only comparison tool over approved ERP exports, not an ERP replacement. No real accounts, live ERP connection, or write-back is in MVP scope. Save imports and reusable mappings in the same browser/device only.

Demo sign-in is a role choice, not authentication or a privacy boundary between people using the same browser. Analyst can prepare setups and use the test-only Preview as manager link, but the Analyst Setup header must not offer Compare · manager; Manager cannot open Setup. Keep the role in tab session storage and make the lack of real security explicit. Signing out must not delete setups or imported data; deletion is a separate action.

**Why:** The user requested a simple first-screen demo role selector while preserving all existing local-only features.

**How to apply:** Never add credentials or imply server-enforced access controls. Retain the demo disclaimer and separate sign-out from data deletion.

New tabs opened by another tab can inherit sessionStorage, so storage alone is not sufficient for demo-role isolation.

**Why:** Browser testing showed an opener-created tab incorrectly inherited the Manager choice.

**How to apply:** Keep tab ownership separate from the copied storage, preserve refresh in the same browsing context, and test both independent tabs and opener-created tabs. This is demo behavior, not an authentication boundary.

Analysts may explicitly prepare a derived table using guided header selection, row exclusions, fill-down, column combination, unit multiplication and simple two-column arithmetic. Original uploads remain immutable; each prepared value must trace back to its original cells and operations. Preparation is optional, saved with the setup and automatically replayed for manager files; managers cannot edit it.

**Why:** The user requested guided preparation without code while keeping original evidence and analyst/manager separation.

**How to apply:** Mapping and downstream calculations use the prepared table; row-shape confirmation follows preparation. Exclusions must remain visible with original lines and reasons. An inapplicable saved step must stop manager compatibility rather than silently repairing or skipping it.

**Why:** The user chose the simplest options that meet a checkable, generic factory-comparison brief.

**How to apply:** Preserve imported values and source line references. Evidence must include the formula with actual values, interpreting mapping, included rows, and excluded rows with reasons. The later Custom formula request permits guided arithmetic on per-run totals, not arbitrary code or a row-by-row formula language.

The real application must parse CSV and Excel entirely in the browser: no file data may be uploaded to a server. Browser persistence uses IndexedDB only when its phase is approved. Keep the approved design and implement one approved phase at a time: A file inspection, B mapping/settings/profiles/persistence, C calculation checks, D comparison/evidence/export, E final polish/tests.

**Why:** The user's implementation brief explicitly requires privacy and approval after each phase, superseding the earlier design-only scope.

**How to apply:** Stop after each phase and explain exact testing steps. Keep future phases unavailable rather than presenting sample-only behavior as working production features. Phase B template examples must be clearly illustrative; actual imported-run results belong to Phase C. Never introduce server storage for imports.

Identical repetitions of an event ID within an import count once with visible exclusions. Conflicting rows sharing an event ID block affected metrics. Missing required data blocks affected calculations; imbalance and overlapping-time warnings remain visible without silent repairs.

**Why:** The user explicitly approved this distinction between immutable evidence and calculation exclusions.

**How to apply:** Never merge or adjust changeover and unplanned downtime automatically. Any two runs remain comparable; missing comparison attributes are “not assessed.” Explanations cannot claim causation.

For one-row-per-run exports, repeated summary rows must not be summed as separate events. Exact repeats count once; differing summaries make only disagreeing measures unavailable, while matching measure values count once.

**Why:** The event-row duplicate policy cannot safely be applied as additive arithmetic to run summaries; that would inflate production totals.

**How to apply:** Keep every original summary visible, explain exclusions, and retain independently valid measures. Duration-only sources cannot establish time overlap; report “not assessed” rather than claiming no overlap.

The clean demo must show E-01/E-02 scrap rates of 5%/10%, a 5-percentage-point difference, changeover of 4h/6h with a 2h difference, and E-02 unplanned downtime of 45min separately. Both runs have line L1; product stays unmapped.

The analyst Upload page should not offer built-in sample files. The separate manager upload experience must offer Sample data.

**Why:** The user removed sample choices from analyst upload, then explicitly requested samples for the separate manager experience.

**How to apply:** Keep the user's own CSV/Excel upload available and do not clear existing browser files or profiles as part of this UI change.

**Why:** These are the user's explicit acceptance case and missing-attribute demonstration.

**How to apply:** Group runs by the mapped run ID, or order ID when chosen during mapping if no run column is mapped. Include a second demo with one duplicate and one missing row.

The user requested design-only work first, then approved merging the three prototypes into one experience with Setup for analysts and Compare for managers, without removing features. The later real-app brief preserves that unified design and requires stopping after each implementation phase.

**Why:** The user explicitly replaced the separate-phase navigation with a simpler unified experience for nontechnical users.

The Manager comparison page must not show the standalone “Checks” box (Data quality, Differences between runs, Rows not used).

**Why:** The user explicitly asked to remove that box from the Manager page, identifying it in a screenshot.

**How to apply:** Keep underlying checks, run-health badges, detailed calculation view, evidence and exports intact; do not reintroduce the standalone panel.

**How to apply:** Keep all mapping, data checks, and comparison/evidence capabilities in the unified flow. Setup has upload, file check, confirm columns and done; advanced controls are collapsed. Use plain language, minimum 14px text, one primary button per screen, and icon-plus-text statuses. The clean demo's 45-minute downtime must be outside changeover. Demo 2 duplicates E-01 scrap and omits E-02 material input; demo 3 includes a conflicting event ID with a different quantity and downtime overlapping changeover. Summarize which run had more waste, whether its mold change was longer, and its separate downtime using clear units such as 6 h and 45 min.

Unmapped CSV columns remain in original source rows and may become named custom fields. Users choose evidence/source-only visibility or also comparison-attribute use; differing comparison values trigger nonblocking “compare with care” notices. Save custom-field choices in mapping profiles.

**Why:** The user explicitly requested extensible contextual fields without causal implications or loss of raw columns.

**How to apply:** Keep display names separate from source column names, preserve values when definitions are removed, and never treat a custom attribute difference as a cause.

Custom-field definition controls belong in Phase 1's mapping step only. Phase 3 consumes saved choices and displays comparison attributes, evidence and nonblocking notices; it must not own definition controls.

**Why:** The user explicitly located field definition in the analyst's mapping workflow and requested its removal from comparison.

**How to apply:** Include custom choices in complete mapping-profile snapshots and make the prototype handoff explicit; do not imply that shared custom context turns fixed demo metrics into a configurable calculation engine.

Similar-run suggestions are optional shortcuts, never restrictions: rank up to five by count of matching mapped line, mold, machine, input within tolerance and custom comparison attributes, then date proximity. Expose matching reasons and unassessed checks, retain blocking-issue badges, and allow selection from the full run list.

**Why:** The user requested transparent rule-based suggestions, no AI or hidden scoring, and no causal claims.

**How to apply:** Keep search/filter controls independent from suggestions and show “Cannot calculate” for blocked summaries rather than guessed values.

Setup must support factories beyond plastics: user-defined quantity/timed event labels and source values, event-row or run-row files, configurable units, optional recorded reasons, and Ratio, Duration, Total, Difference, Count, Rate per hour and Average templates. Plastics defaults retain Scrap / Material input.

**Why:** The user requested a generic factory tool and a cake-factory example without line or mold, using cleaning time.

**How to apply:** Derive measurement labels from definitions, preserve original reasons as recorded facts without causal claims, and never invent event counts from run-summary rows.

File inspection precedes mapping and must preserve original rows and line numbers. Shape guesses are overridable; unreadable files or lack of a run identifier require actionable explanations rather than guessed runs. Timed events may use start/end columns or a single duration column.

**Why:** The user requested explicit file-quality review before mapping and support for different timing representations.

**How to apply:** Do not imply CSV can prove merged spreadsheet cells; flag suspicious headings instead. Duration-only records cannot establish time overlap.

Setup is the analyst's preparation workflow, not a results dashboard. Confirmed setup ends with “Setup saved” and “Save / Export setup.” Independent file testing shows shape, mapping and quality; only the small test-only manager preview may use the analyst's file. Normal manager entry requires its own fresh file and a saved read-only setup.

**Why:** The user explicitly requested complete Analyst/Manager experience separation after objecting to comparison results under Setup.

**How to apply:** Preserve this separation and every existing feature. Manager compatibility must match exact original headers independent of order, retain extra columns, exclude and explain unknown activities and unparseable rows, and stop on missing columns or a different row shape. Row shape is chosen only by the analyst in Setup; managers use the saved choice automatically and must not be asked to determine it. Never infer shape from a custom header alone. Excel uses the saved sheet name or asks. Production data remains browser-only; use no accounts or server-side role enforcement.

**Why (row-shape ownership):** The user explicitly corrected the manager row-shape prompt: this decision belongs to analyst Setup, not managers.

Compatibility requirements are measurement-specific, superseding blanket rejection of missing mapped columns. Analysts choose Required per measurement: Scrap rate required by default, all others optional. Whole-file absence of a required measurement's column/event type blocks; absence in only some runs does not. Optional missing inputs/context yield notes and unavailable/not-assessed values, never zero. Similar headers may be suggested but never auto-mapped.

**Why:** The user explicitly refined the compatibility policy to distinguish whole-file requirements from incomplete individual runs.

**How to apply:** Persist Required flags and show them in the setup summary; preserve grouping, readable-file and row-shape safety checks, shared evidence/tooltips and Copy message for analyst. Missing/invalid values must not remove otherwise usable independent measurements from a run-summary row.

The analyst row-shape decision must be a visible standalone step immediately after File check, with two example cards, the detected guess preselected, and explicit confirmation saved with the setup. Manager compatibility automatically detects the new file shape and compares it with the saved setup; it never asks the manager to choose.

**Why:** The user specified this exact division of responsibility and requested removal of “No shape is assumed”.

**How to apply:** Preserve custom-header support, report shape mismatches in plain language with “Copy message for analyst”, and never silently alter the saved interpretation.

Manager results should consolidate checks and avoid repeated measurements. An absent downtime record is neutral information, not zero and not a data-quality warning; do not change calculations to implement this presentation.

**Why:** The user explicitly requested a simpler Manager page while preserving every feature and calculation.

**How to apply:** Show file/setup, run choices, short answer, four key metrics, one Checks section, collapsed All numbers, then export/print. Keep source evidence spreadsheet-style with immutable originals, highlighted operands, original line/cell references, and preparation lineage.

Open printable reports separately and require an explicit print action, rather than automatically invoking a native print dialog from Compare.

**Why:** Automatic native printing interrupted the main browser journey. A separate report keeps Setup and Compare available and gives the user control over when to print.

**How to apply:** Retain warnings and evidence in the report, with an equivalent local HTML download when popups are blocked.

Custom formula is a guided eighth template: arithmetic over per-run quantity/duration totals, counts and other measurements, with no functions, conditions, code execution or row-by-row calculations. Missing any part makes the whole result unavailable. Keep changeover and downtime separate as source measurements, even when an analyst explicitly combines them.

**Why:** The user extended the original template-only scope while requiring safe parsing, full evidence and overlap warnings.

**How to apply:** Keep references tied to source identities through renaming; validate cycles and missing sources before saving reusable setups. Required checks follow transitive dependencies. Time inputs are hours; output units label the arithmetic without implicit conversions, so the builder explains explicit `* 60` or `* 100`. Round display only, never intermediate calculations.

Possible explanations must be fixed local rules, without AI or network requests, and must never imply causation or personal blame. Custom attributes need explicit analyst opt-in; statements link recorded context to measurements rather than duplicating the detailed checks. The user wants one connected summary card: differences first, then what might be related and what to check, with all detailed rules still expandable rather than separate cards.

**Why:** The user wants hypotheses to investigate, not inferred causes or judgments about people.

**How to apply:** Preserve setup names, analyst check suggestions, original-row evidence, default collapsed presentation, and hypothesis labels in exports. The timing rule uses a disclosed 15-minute proximity window; relative measurement differences rank links, not causal importance.
