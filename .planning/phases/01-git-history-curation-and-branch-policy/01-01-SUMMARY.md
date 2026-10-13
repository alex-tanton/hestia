---
phase: 01-git-history-curation-and-branch-policy
plan: 01
subsystem: infra
tags: [git, history-rewrite, commitlint, husky, worktree, branch-policy]

requires: []
provides:
  - "backup/pre-curation branch and ../hearth-aside/pre-curation.bundle (two independent copies of the original history)"
  - "Local-only .planning/ and .claude/ (per-clone exclude, commit_docs=false), files intact on disk"
  - "../hearth-curate worktree on curated-main at b96ca32 with Husky hooks installed"
  - "curation/todo.txt (43 pick, 8 fixup, 11 exec) and 11 commitlint-clean messages in curation/msgs/"
  - "01-REWRITE-PROPOSAL.md with Gate 1 recorded under Owner approvals: approve-personal, 43 product commits + 1 policy commit, published email alex.c.tanton@gmail.com"
affects: [01-02, 01-03, 01-04, 01-05]

actuals:
  tokens: 11200
  tasks: 3
  commits: 0
plan_head_before: 38f3a8878d8e0899406b31f025239ccfae1b876f
plan_head_after: 38f3a8878d8e0899406b31f025239ccfae1b876f

tech-stack:
  added: []
  patterns:
    - "History work only in a sibling worktree; primary checkout never switched, reset or cleaned"
    - "Scripted rebase todo with exec amend -F per reworded commit, so the amend fires pre-commit typecheck and commit-msg commitlint"

key-files:
  created:
    - .planning/phases/01-git-history-curation-and-branch-policy/curation/todo.txt
    - .planning/phases/01-git-history-curation-and-branch-policy/curation/msgs/ (11 files)
    - .planning/phases/01-git-history-curation-and-branch-policy/01-REWRITE-PROPOSAL.md
  modified:
    - .git/info/exclude
    - .planning/config.json

key-decisions:
  - "bee9a62 stays a plain pick: commitlint one-commit run exits 0 and the scope-enum negative control fails, so the 12-exec fallback is not used"
  - "MSGDIR in todo.txt uses the /c/Users/... Git Bash form, which the plan's verify regex requires and which git resolves under sh -c"
  - "8a7e756 is re-flowed into three paragraphs (bill move, Flipp queue, coverage gate and spec text) with no word changed"
  - "Gate 1 (owner, 2026-10-11): approve-personal. 43 product commits (above D-01's ~35-40, accepted knowingly) + 1 policy commit; published author and committer email alex.c.tanton@gmail.com; stale spec references kept; no extra folds"

requirements-completed: []  # GIT-01, GIT-02, GIT-04 span plans 01-02 to 01-05; this plan delivers only the first half of GIT-02 (owner approval of the plan), so none is marked complete here

duration: ~10min
completed: 2026-10-11
status: complete
---

# Phase 1 Plan 01: Safety Net, Pipeline Proof, and Rewrite Proposal Summary

**Original history is backed up twice, planning files are local-only and intact, the worktree/hooks/commitlint/fast-forward path is proven without publishing, and the owner approved the 51-to-43 commit rewrite proposal at Gate 1 (`approve-personal`, published email `alex.c.tanton@gmail.com`).**

The plan is `autonomous: false` and ran in two parts: Tasks 1 and 2, then the Gate 1 checkpoint (Task 3, `blocking-human`), which the owner resolved this session. Nothing was rewritten, nothing was pushed, and `main` has not moved.

## Performance

- **Duration:** about 10 min of execution (start time was not captured by the init step; estimated from artifact timestamps), plus a short continuation to record the gate
- **Completed through Task 2:** 2026-10-11T21:03Z; **Gate 1 recorded:** 2026-10-11
- **Tasks:** 3 of 3 complete (Task 3 is the Gate 1 checkpoint, approved by the owner)
- **Files:** 2 modified outside the tracked tree (`.git/info/exclude`, `.planning/config.json`), 13 created under `.planning/phases/01-.../`

## Accomplishments

- **Safety net (T-01-01).** `backup/pre-curation` at `38f3a88` (contains the planning commits; `.planning/ROADMAP.md` present in it), `../hearth-aside/pre-curation.bundle` created and `git bundle verify` clean, and copies of `.planning/` and `.claude/` in `../hearth-aside/planning-copy/`.
- **Local-only planning (D-03, T-01-03).** `.planning/` and `.claude/` appended once each to `.git/info/exclude` (existing `BUILD_PROMPT.md` line kept); `commit_docs` set to `false`. Every planning file is still on disk, and no `.gitignore` or `.prettierignore` entry was added.
- **Curation worktree.** `../hearth-curate` on `curated-main` at `b96ca32`; `pnpm install --frozen-lockfile` took 32 s and created `.husky/_/h`, so hooks will fire.
- **Commitlint baseline, matching research exactly.** 13 of 51 original commits fail, all and only on `body-max-line-length`: `3ae2afd 46d170e 279b398 8d2b6de c4198c9 bafa74f 0ae57b4 114cd99 b1cd32c 8a7e756 801f9fd 1030b35 95b0bd2`. No other rule and no other commit fails.
- **bee9a62 empirically cleared.** `commitlint --from bee9a62~1 --to bee9a62` exit 0. Negative control `test(shared,nope): negative control` fails with `scope must be one of [web, service, shared, recurrence, matching, db, e2e, docker] [scope-enum]`; positive control `test(shared,matching): ...` passes. bee9a62 remains a plain `pick`, 11 exec lines, 11 message files.
- **Remote path.** Dry-run push of `b96ca32:refs/heads/main` printed `7da55e3..b96ca32` (fast-forward) over SSH; `git ls-remote origin` still lists only `main` at `7da55e3`.
- **Todo and messages.** `todo.txt` has 43 pick, 8 fixup, 11 exec; its pick/fixup set equals the 51 product SHAs exactly once each. All 11 messages pass `commitlint --edit`, none has a line over 100 (max 97), subjects and `Co-Authored-By` trailers are byte-identical to the originals, and word sequences are unchanged except the one appended sentence in `1030b35`.
- **Proposal.** `01-REWRITE-PROPOSAL.md` carries all 10 required sections, all 51 SHAs, the 14 dropped planning commits, the push consequences including the queued Deploy run (D-06), the CI prediction labelled as a prediction with RESEARCH Pitfall 7's numbers, and rollback.

## Task Commits

No task commits, by design. Phase rule 2 and the plan's `<output>` block: everything changed in the primary checkout is a local-only planning file under D-03 and is never committed, and the only commits this phase creates are the rewritten history and the policy commit on `curated-main` in `../hearth-curate` (plans 01-02 onward). `commits: 0` is therefore the measured value, with `plan_head_before` equal to `plan_head_after` (`38f3a88`). It is not the "uncommitted code" condition: nothing tracked was changed.

## Files Created/Modified

- `.git/info/exclude` - adds `.planning/` and `.claude/`
- `.planning/config.json` - `commit_docs` false
- `.planning/phases/01-git-history-curation-and-branch-policy/curation/todo.txt` - scripted rebase todo for plan 01-02
- `.planning/phases/01-git-history-curation-and-branch-policy/curation/msgs/{3ae2afd,46d170e,279b398,8d2b6de,c4198c9,bafa74f,0ae57b4,b1cd32c,8a7e756,801f9fd,1030b35}.txt` - reworded messages
- `.planning/phases/01-git-history-curation-and-branch-policy/01-REWRITE-PROPOSAL.md` - owner-facing proposal and gate record
- Outside the repo, `../hearth-aside/`: `pre-curation.bundle`, `planning-copy/`, `logs/` (baseline, bee9a62, scope control and positive control, dry run, SHA-reference and stale-spec scans)

## Decisions Made

- bee9a62 not reworded (see Accomplishments). Fallback step 2a not applied.
- Product tip, base, and every range anchored on SHAs; the 14 planning commits above `b96ca32` are excluded by construction, so planning commits added later cannot leak in.
- Stale spec references (`PRD`, `Handoff`, `Design N`) are kept as written and put to the owner as Gate 1 decision (b): 25 of 51 original bodies match, 22 survive the folds, 5 of those are already reworded, 17 would need a new reword.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Node cannot read Git Bash `/c/...` paths passed to `commitlint --edit`**
- **Found during:** Task 1 step 8a (scope-enum negative control)
- **Issue:** `"$(cd ../hearth-aside/logs && pwd)/scope-control-msg.txt"` produced `/c/Users/...`, which Node on Windows resolved as `C:\c\Users\...` (ENOENT). The first control run therefore exited 1 for the wrong reason and did not name `scope-enum`.
- **Fix:** Converted with `cygpath -m` and re-ran both the negative control (now fails on `scope-enum`) and a positive control. Same conversion used for the 11 message-file commitlint checks in Task 2 step 5. The plan's Task 2 verify command passed unchanged because `$PWD` was already in `C:/...` form in that shell.
- **Files modified:** `../hearth-aside/logs/commitlint-scope-control.txt` (overwritten with the valid run)
- **Verification:** log ends `exit=1` and names `scope-enum`; Task 1 verify passed.
- **Commit:** none (log file outside the repo)

**2. [Rule 1 - Bug] Wrong `exit=` line in the baseline log**
- **Found during:** Task 1 step 8
- **Issue:** I appended `exit=$?` after a redirect and recorded the exit of `echo` (`exit=0`) instead of commitlint's.
- **Fix:** Removed the line and wrote the real value, `exit=1`.
- **Files modified:** `../hearth-aside/logs/commitlint-baseline.txt`

**3. [Rule 1 - Bug] Literal backslash-n sequences survived in the first 8a7e756 file**
- **Found during:** Task 2 step 2
- **Issue:** The `sed` substitution did not take effect in this shell (double backslashes are collapsed in transit), so the first `8a7e756.txt` still held the sequences. The `1030b35` and 9 mechanical files were unaffected.
- **Fix:** Wrote the file directly with the Write tool as three paragraphs; verified with a Node check built on `String.fromCharCode(92)` that the word sequence equals the original and that no file in `msgs/` contains a literal backslash-n.
- **Files modified:** `curation/msgs/8a7e756.txt`

### Observations (not fixed, no plan impact)

- Task 1 acceptance says `git diff --name-only` lists only `.planning/config.json`. It also lists `.planning/STATE.md`, which was already modified before this plan started (visible in the initial git status), and `config.json` also carries a pre-existing `use_worktrees: false` addition. Neither was changed by this plan beyond `commit_docs`.
- The planning commits above `b96ca32` number 14, not 9 (RESEARCH) or 7 (CONTEXT). The proposal lists all 14. No effect on the rebuild, which is anchored on `b96ca32`.
- `git log` of the original range still shows `.planning/` tracked until plan 01-05 moves `main`; `.git/info/exclude` only takes effect for files that are untracked, which is the intended end state after the move.

**Total deviations:** 3 auto-fixed (1 blocking, 2 bug). **Impact:** none on deliverables; all three were environment or scripting slips caught by the plan's own checks.

## Authentication Gates

None. SSH to `github-personal` worked for `ls-remote` and the dry run.

## Known Stubs

None.

## Threat Flags

None. No new network endpoint, auth path, file access pattern, or trust-boundary schema change; T-01-04 (dry run) accepted as planned.

## Gate 1: approved by the owner

Task 3 was a `checkpoint:decision` with `gate="blocking-human"` and was never auto-approved. The owner answered `approve-personal` (real user input, 2026-10-11):

- Proposal approved as written: 43 product commits + 1 policy commit, 44 on top of `7da55e3`. The owner accepted that 43 is above D-01's ~35-40.
- Published author and committer email: `alex.c.tanton@gmail.com`. Plan 01-02 Task 2 applies one identity-rewrite pass over `curated-main` (trees, messages and dates unchanged) and sets repo-local `user.email`; the policy commit is created under that identity.
- No revisions: stale spec references kept as written, no extra folds, no dangling SHA references to handle.

Recorded in `01-REWRITE-PROPOSAL.md` under `## Owner approvals`:

```text
- Gate 1 (rewrite proposal): approve-personal - 2026-10-11 - 43 product commits + 1 policy commit
```

plus a second line recording the email and the (a) to (d) decisions. The Gate 1 acceptance regex matches exactly one line, and the count equals the 43 stated in `## Summary`. This line is the precondition of plan 01-02 Task 1. Gates 2 and 3 are still outstanding; nothing may be pushed before them.

## Notes for plan 01-02 and later

- Any command that hands an absolute path to a Node program (commitlint `--edit`, scripts) needs the `C:/...` form (`cygpath -m`); git itself accepts both forms and was verified to resolve `/c/...` inside `sh -c`.
- Do not type double backslashes in Bash tool commands; use the Write tool for files containing them, or `String.fromCharCode(92)` in Node.
- Each reword exec runs `pnpm install` first (about 32 s on a cold lockfile) and then the pre-commit typecheck; expect 11 of these.
- `MSYS_NO_PATHCONV=1` is needed for `git cat-file -e <ref>:<path>` forms in Git Bash.

## Next Phase Readiness

Gate 1 is cleared. Plan 01-02 may start: it rebuilds `curated-main` in `../hearth-curate` from `curation/todo.txt`, runs the `approve-personal` identity rewrite (43 commits `actanton@ncsu.edu` to `alex.c.tanton@gmail.com`), and adds the policy commit. Gates 2 (staging push) and 3 (`main` push) remain.

## Self-Check: PASSED

Tasks 1 and 2 verified earlier by the plan's own automated verify commands: `backup/pre-curation`, the verified bundle, `planning-copy/`, the two exclude lines, `commit_docs=false`, `../hearth-curate/.husky/_/h`, the scope-enum control and bee9a62 logs, the dry-run fast-forward line, `todo.txt` counts, 11 commitlint-clean messages, and the proposal headings and SHAs. Task 3 verified on continuation: exactly one line matches the Gate 1 regex with count 43; `git ls-remote origin` still lists only `main` at `7da55e3`; local `main` and `backup/pre-curation` at `38f3a88`; `curated-main` at `b96ca32`; no history rewritten.
