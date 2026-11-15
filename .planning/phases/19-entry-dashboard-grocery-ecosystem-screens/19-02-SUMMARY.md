---
phase: 19-entry-dashboard-grocery-ecosystem-screens
plan: 02
subsystem: auth
tags: [auth, onboarding, md3, material-design, textField, cards]

# Dependency graph
requires:
  - phase: 18-adaptive-md3-navigation-shell-route-chrome
    provides: MD3 shell, Icon contract, and token bridge
  - phase: 19-01
    provides: Tonal MD3 surface tokens and card patterns
provides:
  - Centered 440px surfaceContainer cards for sign-in, sign-up, magic link, and password recovery
  - OnboardingLayout with Icon arrow_back, display typography, and MD3 surface background
  - CreateHouseholdStep and JoinHouseholdStep tonal action cards with floating-label TextFields
  - InstallStep MD3 guidance card with Material Symbols share and smartphone icons
affects: [onboarding, auth, e2e]

# Actuals
actuals:
  tokens: 12263
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Centered 440px surfaceContainer tonal card layout for unauthenticated flows
    - Floating-label TextField inputs with synchronized onInput and useFieldErrors validation
    - Preserved build-time string contracts and lazy-route isolation

key-files:
  created: []
  modified:
    - apps/web/src/screens/onboarding/OnboardingLayout.tsx
    - apps/web/src/screens/onboarding/SignInScreen.tsx
    - apps/web/src/screens/onboarding/SignUpScreen.tsx
    - apps/web/src/screens/onboarding/MagicLinkRequestScreen.tsx
    - apps/web/src/screens/onboarding/MagicLinkCodeScreen.tsx
    - apps/web/src/screens/onboarding/ForgotPasswordScreen.tsx
    - apps/web/src/screens/onboarding/SetPasswordScreen.tsx
    - apps/web/src/screens/onboarding/CreateHouseholdStep.tsx
    - apps/web/src/screens/onboarding/JoinHouseholdStep.tsx
    - apps/web/src/screens/onboarding/InstallStep.tsx
    - apps/web/src/screens/onboarding/magic-link.test.tsx
    - apps/web/src/screens/onboarding/onboarding.test.tsx

key-decisions:
  - "Preserve exact build contract string 'Email me a sign-in link' in SignInScreen under HESTIA_PUBLIC_MAGIC_LINK_ENABLED gating"
  - "Keep ForgotPasswordScreen informational card without input form aligning with self-hosted admin reset pattern"
  - "Update onboarding step button CTAs to 'Create household group' and 'Join household group' per MD3 copywriting contract"

patterns-established:
  - "Centered 440px tonal surface cards for all onboarding and authentication forms"

requirements-completed:
  - AUTH-06
  - AUTH-07

coverage:
  - id: D1
    description: "Centered 440px surfaceContainer cards for sign-in, sign-up, magic link, and password recovery"
    requirement: AUTH-06
    verification:
      - kind: unit
        ref: "apps/web/src/screens/onboarding/onboarding.test.tsx"
        status: pass
      - kind: unit
        ref: "apps/web/src/screens/onboarding/magic-link.test.tsx"
        status: pass
      - kind: other
        ref: "node apps/web/scripts/check-build.mjs"
        status: pass
    human_judgment: false
  - id: D2
    description: "OnboardingLayout MD3 frame with Material Symbols arrow_back navigation and display typography"
    requirement: AUTH-07
    verification:
      - kind: unit
        ref: "apps/web/src/screens/onboarding/onboarding.test.tsx"
        status: pass
    human_judgment: false
  - id: D3
    description: "Household creation, join, and PWA install steps rendered as tonal MD3 action and guidance cards"
    requirement: AUTH-07
    verification:
      - kind: unit
        ref: "apps/web/src/screens/onboarding/onboarding.test.tsx"
        status: pass
    human_judgment: false

# Metrics
duration: 15min
completed: 2026-11-15
status: complete
commits: 3
plan_head_before: f583e8764f139e8810dda506a01058de2371d9a7
plan_head_after: dc3e7aa0a903542982d852f4d80992850977b072
---

# Phase 19 Plan 02: Auth & Onboarding Summary

**Centered 440px MD3 surfaceContainer cards with floating-label TextFields, exact magic-link copy preservation, and Material Symbols navigation across all authentication and onboarding screens.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-11-15T10:20:27Z
- **Completed:** 2026-11-15T10:35:45Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

- Refactored `OnboardingLayout` to eliminate Lucide `ChevronLeft`, render Material Symbols `Icon name="arrow_back"`, style the headline with `text-display` typography, and use the MD3 surface background canvas.
- Modernized `SignInScreen` and `SignUpScreen` inside centered `Card variant="flat"` (`max-w-[440px]`, `bg-[var(--md-sys-color-surface-container)]`) with floating-label `TextField` inputs, preserving the exact build-contract string `'Email me a sign-in link'` under `HESTIA_PUBLIC_MAGIC_LINK_ENABLED` gating.
- Overhauled secondary auth screens (`MagicLinkRequestScreen`, `MagicLinkCodeScreen`, `ForgotPasswordScreen`, `SetPasswordScreen`) into centered 440px surfaceContainer cards with MD3 `TextField` inputs and primary button actions.
- Upgraded `CreateHouseholdStep`, `JoinHouseholdStep`, and `InstallStep` into tonal MD3 action cards with `Icon name="share"` and `Icon name="smartphone"`, updating button CTAs to `"Create household group"` and `"Join household group"`.
- Verified 47 unit and screen tests across `onboarding.test.tsx` and `magic-link.test.tsx`, passed `check-build.mjs` verifying shell budget (156.4 KB <= 200 KB) and copy contracts, and passed full workspace typechecking.

## Task Commits

Each task was committed atomically:

1. **Task 1: OnboardingLayout MD3 frame and core auth screens with centered cards** - `29b2d78` (feat)
2. **Task 2: Secondary auth screens on centered tonal cards** - `1d69ea5` (feat)
3. **Task 3: Household onboarding and install steps with MD3 action cards** - `dc3e7aa` (feat)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Scope constraint] Adjusted commitlint scope and casing for task commits**
- **Found during:** Task 1 commit
- **Issue:** Commit message `feat(19-02): OnboardingLayout...` was rejected by commitlint because the scope had to be one of `[web, service, shared, recurrence, matching, db, e2e, docker]` and the subject had to be lowercased.
- **Fix:** Used standard `feat(web): update onboarding frame and core auth screens with centered cards` format.
- **Commit:** `29b2d78`

## Self-Check: PASSED

- All 10 modified components exist on disk.
- All 3 commit hashes (`29b2d78`, `1d69ea5`, `dc3e7aa`) are verified ancestors of HEAD.
- `check-build.mjs` passes with gzipped shell budget under 200 KB and magic link copy verified.
