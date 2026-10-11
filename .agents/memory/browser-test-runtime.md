---
name: Browser test runtime
description: Why browser regression tests use system Chromium on Replit.
---

Use Nix-provided Chromium for local browser tests in Replit rather than assuming Playwright's downloaded Linux binary can launch.

**Why:** The downloaded headless shell failed before opening a page because the Nix environment did not supply its expected shared libraries (including libglib). Installing system Chromium supplies a compatible browser with its library closure.

**How to apply:** Keep portable Playwright browser fallback for other environments. Test only in nonpersistent contexts; never reuse a creator's browser profile to validate reload or IndexedDB recovery.
