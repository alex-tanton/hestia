---
status: testing
phase: 20-meals-bills-chores-settings-screens
source: [20-VERIFICATION.md]
started: 2026-11-15T19:38:00Z
updated: 2026-11-15T19:38:00Z
---

## Current Test

number: 1
name: Responsive layout transition for PlannerScreen across breakpoints (<840px vs >=840px)
expected: |
  At <840px, compact Week Switcher with horizontal Day Anchor Pills (<md-tabs>) and planned-only vertical agenda renders; at >=840px, transitions smoothly to a 7-column tonal card board.
awaiting: user response

## Tests

### 1. Responsive layout transition for PlannerScreen across breakpoints (<840px vs >=840px)
expected: At <840px, compact Week Switcher with horizontal Day Anchor Pills (<md-tabs>) and planned-only vertical agenda renders; at >=840px, transitions smoothly to a 7-column tonal card board.
result: [pending]

### 2. Responsive Dialog Canvas (<600px full-screen canvas, >=600px centered modal max-w-[720px]) for RecipeForm, BillForm, ChoreForm
expected: On viewports <600px, multi-field forms open full-screen with top-anchored title and actions; on viewports >=600px, dialogs appear centered with max-w-[720px] and rounded-2xl tonal container.
result: [pending]

### 3. ModalBottomSheet swipe-to-dismiss and touch ergonomics for MealPlacementSheet, PlaceOnPlannerSheet, PaymentEditSheet, ErrandSheet
expected: Sheets slide up anchored to viewport bottom with dim scrim, drag downward or click backdrop to dismiss cleanly.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
