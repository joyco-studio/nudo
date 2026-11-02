# Visual snapshots

These tests compare the actual rendered material with a **human-reviewed PNG**. They complement the editor's semantic/pixel tests; they do not replace them or turn a timeout into success. The initial cases are `ink-swirl`, `pencil` and `poster`.

## The everyday review loop

1. Open the PR's **Visual snapshots** check. Download **visual-report** from its run. Open the HTML report to compare the expected image, current image and diff. A missing baseline is a review request, not a passing test.
2. If a difference is intentional, check out the PR branch at the exact commit tested by that run, then run:

   ```sh
   node scripts/visual-accept.mjs RUN_ID ink-swirl
   ```

   Accept several reviewed cases by naming each one: `RUN_ID ink-swirl pencil`. The command needs GitHub CLI (`gh`) already signed in with read access to the repository's Actions artifacts. It fetches the already-rendered CI image, so a different local GPU or OS cannot alter the accepted baseline.
3. Review `git diff`, commit the selected PNGs in `apps/editor/visual/__screenshots__/` and push the same PR branch. The next check compares against those images. The helper never commits or pushes, never accepts unspecified cases, and refuses stale runs or local baseline edits.

Accepting a baseline means **“I reviewed this image and this is the intended result.”** Never accept a blank, broken or merely different image just to make CI green. Baseline changes remain visible in the ordinary PR diff and code review. Nothing is automatically approved by CI or a bot.

If the branch advanced after the run, use a fresh run for its current HEAD. Do not bypass the provenance check or copy a stale reference from another branch. Artifacts expire after 14 days; rerun the check if they expired.

## First baselines

The first run intentionally fails when no approved reference exists. It still produces review candidates for scenes that completed rendering successfully. Review each image as above, accept only the correct cases and commit them. A case that did not finish rendering has no candidate to approve; fix the renderer/test rather than manufacturing a reference.

## Local diagnosis

```sh
pnpm visual:test
```

Use the Playwright report to inspect failures. Local screenshots may differ because of the OS or renderer, so use the CI artifact acceptance flow above for canonical references. For experimental regeneration, `pnpm visual:update` exists, but its output is **not approved** and should not be committed without review in the canonical environment.

The canonical environment is the `mcr.microsoft.com/playwright:v1.64.1-noble` container, Chromium with software rendering, one worker and no retries. Its version must match the exact Playwright version in the lockfile. Upgrade the container and dependency together, review any resulting image changes, and avoid reusing old-version baselines blindly.

## Scope and speed

The small material canvases start at 400 × 250 pixels with device pixel ratio 1, fixed scene/camera/light/time and a render-completion signal. This is a deliberate material check, not a full-editor UI snapshot. Add targeted larger views for fine detail rather than raising every test's resolution. Keep cases curated: do not re-add every expensive integration test to this suite.

The workflow runs once for a PR update and on `main`, cancels obsolete runs, and has a ten-minute job budget. Rendering errors and readiness timeouts remain failures. Capture output is generated only after readiness; pixel differences are evaluated separately. Existing editor E2E tests and PR #6's trimming strategy remain separate.

## Security and permissions

The workflow uses a read-only token and never commits files, posts comments or runs privileged `pull_request_target` code. Acceptance is an explicit local action. The helper validates the workflow path, repository, completed run, exact checked-out commit, candidate manifest, PNG signature and content hash before copying the named images. It does not execute anything downloaded from the artifact.
