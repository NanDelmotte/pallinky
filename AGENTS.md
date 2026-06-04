# Pallinky Agent Rules

Detailed operator workflow: `docs/codex-development-guide.md`.
Deployment details: `docs/deployment.md`.

## Work

- The operator is the sole product and technical decision-maker. Recommend
  options and explain consequential choices plainly.
- Inspect relevant code and docs first. Ask when product behavior is unclear.
- Encourage relevant Superpowers workflows; use TDD where practical.
- Keep one distinct change per thread, branch, and pull request. Update relevant
  docs when behavior or operations change.

## Verify

- Before declaring work ready, run relevant tests, lint, type checks, builds,
  and review.
- Identify every affected surface and provide manual test steps. Do not
  recommend merging with failed checks, incomplete testing, or blocking issues.

## Git

- You may create small, clear commits after verification.
- Never push without explicit approval. After approval, you may push and
  create/update the pull request.
- Rebase onto `main` only after approval; explain conflicts and verify afterward.
- Force-push only with separate approval and `--force-with-lease`.
- Never merge pull requests; the operator merges manually.

## Production And Safety

- Never trigger release workflows; the operator runs GitHub Actions manually.
- Never perform production operations, production-data access, migrations, or
  destructive actions without explicit approval.
- Before approval, explain impact, verification, and rollback. For migrations,
  also explain data impact, backup status, and development-test results.
- Use the narrowest permissions. Never expose or commit secrets or personal
  data. Local development uses development Supabase unless explicitly approved.

## Completion Report

Before requesting approval for a push, merge, migration, or release, report:
plain-English changes; passed/failed checks; manual tests; risks/open issues;
branch/commits; recommended next action; and rollback for consequential changes.
