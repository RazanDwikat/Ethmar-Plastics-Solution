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

Build one phase at a time and stop after each phase, explain how to try it, and wait for user approval before starting the next. The user requested design-only work first.

**Why:** The user explicitly added approval gates to the agreed phased approach.

**How to apply:** Keep mapping, data checks, and comparison/evidence as separately approved phases. The clean demo's 45-minute downtime must be outside changeover. Demo 2 duplicates E-01 scrap and omits E-02 material input; demo 3 includes a conflicting event ID with a different quantity and downtime overlapping changeover. In the comparison phase, add a plain-language summary of which run had more waste, whether its mold change was longer, and its separate downtime, using clear units such as 6 h and 45 min.

Unmapped CSV columns remain in original source rows and may become named custom fields. Users choose evidence/source-only visibility or also comparison-attribute use; differing comparison values trigger nonblocking “compare with care” notices. Save custom-field choices in mapping profiles.

**Why:** The user explicitly requested extensible contextual fields without causal implications or loss of raw columns.

**How to apply:** Keep display names separate from source column names, preserve values when definitions are removed, and never treat a custom attribute difference as a cause.
