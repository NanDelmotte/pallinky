---
name: pallinky-ready-for-review
description: Use when Pallinky implementation work appears complete and needs verification, review preparation, a manual-test checklist, or a push decision.
---

# Prepare A Pallinky Change For Review

1. Inspect the full branch diff and confirm it matches the requested outcome.
2. Use Superpowers requesting-code-review and verification-before-completion.
3. Run all relevant tests, lint, type checks, and builds. Report failures
   honestly and fix blocking issues before continuing.
4. Identify every affected surface and write a manual testing checklist.
5. Update relevant documentation, then create small clear commits if needed.
6. Provide the `AGENTS.md` completion report.
7. Ask for explicit approval before pushing. After approval, push and create or
   update the pull request. Never merge or trigger a release.
