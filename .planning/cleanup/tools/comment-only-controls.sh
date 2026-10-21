#!/usr/bin/env bash
# Negative controls for comment-only-check.mjs (D-10). Builds a scratch repository, applies six
# mutations and prints `control-{n}={expected} {actual}` lines; exits 1 when any pair differs.
# Usage: bash comment-only-controls.sh {scratch-dir}
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
CHECK="$HERE/comment-only-check.mjs"
DIR="${1:?scratch dir}"
rm -rf "$DIR"
mkdir -p "$DIR"
git -C "$DIR" init -q
git -C "$DIR" config user.email controls@example.invalid
git -C "$DIR" config user.name controls

cat > "$DIR/view.tsx" <<'EOF'
export function View(): JSX.Element {
  return (
    <div>
      {/* (Design › Screens › 4) */}
      <p>Hello (Design › 4)</p>
    </div>
  );
}
EOF
cat > "$DIR/rules.ts" <<'EOF'
// The total rounds half-up (Technical Architecture, "Money").
export const label = 'cheese';
// eslint-disable-next-line no-console
export const noisy = (): void => console.log(label);
EOF
cat > "$DIR/rules.test.ts" <<'EOF'
import { describe, expect, it } from 'vitest';
import { label } from './rules.ts';

describe('Rules (Engineering Practices, "Testing")', () => {
  it('has a label', () => {
    expect(label).toBe('cheese');
  });
});
EOF
git -C "$DIR" add -A
git -C "$DIR" commit -q -m base
BASE="$(git -C "$DIR" rev-parse HEAD)"

reset() { git -C "$DIR" checkout -q -- . ; }
verdict() { if node "$CHECK" --repo "$DIR" --base "$BASE" "$@" >/dev/null 2>&1; then echo OK; else echo FAIL; fi; }
status=0
report() { # n expected actual
  echo "control-$1=$2 $3"
  [ "$2" = "$3" ] || status=1
}

# 1. comment text edited
sed -i 's| (Technical Architecture, "Money")||' "$DIR/rules.ts"
report 1 OK "$(verdict -- rules.ts)"
reset

# 2. a whole JSX comment container deleted
sed -i '/{\/\* (Design/d' "$DIR/view.tsx"
report 2 OK "$(verdict -- view.tsx)"
reset

# 3. a code string changed
sed -i "s|'cheese'|'Xcheese'|" "$DIR/rules.ts"
report 3 FAIL "$(verdict -- rules.ts)"
reset

# 4. a line holding an eslint-disable directive deleted
sed -i '/eslint-disable-next-line/d' "$DIR/rules.ts"
report 4 FAIL "$(verdict -- rules.ts)"
reset

# 5. --titles with a describe title changed passes; with a code string also changed it fails
sed -i 's| (Engineering Practices, "Testing")||' "$DIR/rules.test.ts"
first="$(verdict --titles -- rules.test.ts)"
sed -i "s|toBe('cheese')|toBe('Xcheese')|" "$DIR/rules.test.ts"
second="$(verdict --titles -- rules.test.ts)"
echo "control-5a=OK $first"
echo "control-5b=FAIL $second"
if [ "$first" = OK ] && [ "$second" = FAIL ]; then combined=OK; else combined=FAIL; fi
report 5 OK "$combined"
reset

# 6. a title changed without --titles
sed -i 's| (Engineering Practices, "Testing")||' "$DIR/rules.test.ts"
report 6 FAIL "$(verdict -- rules.test.ts)"
reset

exit "$status"
