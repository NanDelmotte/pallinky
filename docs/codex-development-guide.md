# Developing Pallinky With Codex

This guide explains how to use the Codex app to continue developing and
operating Pallinky. You make the decisions; Codex investigates the code,
recommends technical approaches, implements changes, and explains the result in
plain English.

## Quick Start

For each distinct feature, bug, or review:

1. Open Pallinky in the Codex app.
2. Start a new thread in **Worktree** mode for a meaningful code change.
3. Invoke `$pallinky-start-change` and describe the user outcome and what
   "done" looks like.
4. Answer product questions and approve consequential decisions.
5. Let Codex implement, test, review, and commit the change.
6. Invoke `$pallinky-ready-for-review` when the work looks complete.
7. Complete the manual testing checklist Codex provides.
8. Approve a push only when you are satisfied with the result.
9. Review the pull request and merge it manually.
10. When a release is needed, run the appropriate GitHub Action manually.

Use a fresh thread for each distinct change. Continue an existing thread for
follow-up work on the same branch or pull request.

## Starting A Task

Use `$pallinky-start-change` for new work. Give Codex the outcome, relevant
context, and what "done" looks like. Include screenshots or examples for visual
changes. Codex will ask the right questions and pull in the relevant Superpowers
workflow.

## Pallinky Project Skills

Pallinky includes three project-specific skills. They wrap the usual Superpowers
workflows and keep the repository-specific rules close to the task:

- `$pallinky-start-change`: shape and begin a focused feature or bug fix.
- `$pallinky-ready-for-review`: verify completed work, prepare manual tests,
  and package the completion report.
- `$pallinky-recover`: explain confusing or failed work and recommend the
  safest next action without losing changes.

These skills live in `.agents/skills` and travel with the repository. Use them
as shortcuts; the safety rules in `AGENTS.md` still apply automatically.

## Worktrees And Branches

A Worktree is a separate working copy that lets Codex make isolated Git changes
without disturbing other work. Start meaningful code changes there, and use
Local only when Codex recommends it for a tiny docs tweak or for existing local
test setup. Parallel work is possible with separate Worktrees, but large tasks
are easier to review when kept serial.

If you are unsure where work lives, ask:

```text
I am unsure which workspace mode or branch I am using. Check the current state
and recommend the safest next action without losing work.
```

## Implementation And Testing

Before a change is ready, two layers of verification must pass:

1. Codex runs the relevant automated checks, such as tests, linting, type
   checks, builds, and code review.
2. You manually test the affected user journey using a checklist written by
   Codex.

Codex should identify every affected surface and provide separate manual test
steps where needed. Shared code may require checking both mobile and web.

## Reviewing The Result

Invoke `$pallinky-ready-for-review` when the work looks complete. It prepares
the completion report and the manual testing checklist before you decide
whether to push.

Before asking you to approve a push, merge, migration, or release, Codex should
provide a completion report containing:

- What changed, in plain English
- Automated checks that passed or failed
- Manual testing steps for every affected surface
- Known risks and unresolved issues
- Branch and commit details
- Whether a push, merge, migration, or release is recommended
- Rollback instructions for consequential changes

Do not merge when automated checks fail, manual testing is incomplete, or known
blocking issues remain.

## Commits, Pushes, And Pull Requests

Codex may automatically create small, clearly named commits on the task branch
after verification.

Codex must ask before every push. After you explicitly approve a push, Codex
may push the branch and create or update its pull request. The pull request
should contain the completion report, test results, manual testing checklist,
risks, and rollback information.

If the branch needs updating from `main`, Codex should tell you. After your
approval, it may rebase the branch, resolve explained conflicts, and verify the
result.

A force-push needs separate approval. Codex must explain why it is necessary
and use `--force-with-lease`, never an unrestricted force-push.

You must merge pull requests manually after all checks and manual testing pass.
Codex must not merge them.

## Releases

Releases are always started manually from the GitHub Actions tab. Codex may
recommend the correct workflow and explain its impact, checks, and rollback,
but it must not trigger a release workflow.

Current release workflows:

- **Fly Web Deploy**: deploys the production web app.
- **Mobile iOS Dev Build (EAS)**: creates a development iOS build for testing.
- **Mobile iOS Prod Build (EAS)**: creates a production iOS build and requires
  `confirm_production=release`.

See [deployment.md](deployment.md) for the current deployment process.

## Production And Database Safety

Codex must receive explicit approval before any production operation. Before
approval, it must explain:

- Expected impact
- Verification steps
- Rollback plan

For a database migration, Codex must additionally explain the data impact,
backup status, development testing results, and rollback approach. Production
migrations require separate explicit approval.

Codex may inspect production logs or read-only production data only after
explicit approval. It must explain what it needs, use the narrowest access
available, and avoid exposing secrets or personal data. Any production write
requires separate approval.

## Permission Requests

Approve the narrowest permission option when the reason is clear. Before
approving production access, network access, destructive commands, or writes
outside Pallinky, ask:

```text
Explain why this permission is needed, what it can change, and the safest
narrower alternative.
```

Reject requests you do not understand and ask Codex to explain them in plain
English.

## When Work Fails

Incomplete or failed work stays on its branch and open pull request. Do not
merge it.

Ask Codex to diagnose failed checks or unexpected behavior. If the thread
becomes confusing, start a fresh review thread and reference the branch or pull
request.

Invoke `$pallinky-recover` whenever you are unsure about the current branch,
task state, failed checks, or safest next action.

Escalate and pause when Codex reports:

- Potential data loss or security exposure
- Unexpected production-data changes
- A failed production deployment or rollback
- Costs, legal concerns, or account-access problems
- Repeated inability to verify a change

For an urgent production bug, ask Codex to:

1. Diagnose and explain the likely impact.
2. Create an isolated hotfix branch.
3. Add or update a regression test.
4. Verify every affected surface.
5. Prepare a focused pull request.
6. Wait for you to merge and trigger the release manually.
7. Confirm production behavior and document follow-up work.

## Never Do This

- Never paste secrets or personal user data into Codex prompts.
- Never approve a permission request you do not understand.
- Never merge with failed checks or incomplete manual testing.
- Never manually edit production data without a reviewed plan.
- Never trigger a production release without understanding impact and rollback.
- Never mix unrelated changes in one thread, branch, or pull request.
