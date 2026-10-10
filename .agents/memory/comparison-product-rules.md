---
name: Comparison product rules
description: User-confirmed scope and integrity constraints for the Ethmar comparison MVP.
---

Ethmar Plastics needs a read-only comparison tool over approved ERP exports, not an ERP replacement. No login, live ERP connection, or write-back is in MVP scope. Save imports and reusable mappings in the same browser/device only.

**Why:** The user chose the simplest options that meet a checkable, generic factory-comparison brief.

**How to apply:** Preserve imported values and source line references. Evidence must include the formula with actual values, interpreting mapping, included rows, and excluded rows with reasons. Generic ratio, duration, and total templates are allowed; a free-form formula language is not.

Identical repetitions of an event ID within an import count once with visible exclusions. Conflicting rows sharing an event ID block affected metrics. Missing required data blocks affected calculations; imbalance and overlapping-time warnings remain visible without silent repairs.

**Why:** The user explicitly approved this distinction between immutable evidence and calculation exclusions.

**How to apply:** Never merge or adjust changeover and unplanned downtime automatically. Any two runs remain comparable; missing comparison attributes are “not assessed.” Explanations cannot claim causation.

The clean demo must show E-01/E-02 scrap rates of 5%/10%, a 5-percentage-point difference, changeover of 4h/6h with a 2h difference, and E-02 unplanned downtime of 45min separately. Both runs have line L1; product stays unmapped.

**Why:** These are the user's explicit acceptance case and missing-attribute demonstration.

**How to apply:** Group runs by the mapped run ID, or order ID when chosen during mapping if no run column is mapped. Include a second demo with one duplicate and one missing row.

The user requested design-only work first, initially approving each phase separately. They now request merging the three approved prototypes into one experience with Setup for analysts and Compare for managers, without removing features. Stop after showing the redesign and explaining how to test.

**Why:** The user explicitly replaced the separate-phase navigation with a simpler unified experience for nontechnical users.

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
