#!/usr/bin/env bash
# Negative controls for nonts-comment-check.mjs (D-10). Builds a scratch repository and, for each
# of five file types, prints `nonts-control-{type}={mutant} {comment-only}`: the checker's verdict on
# a code-changing mutant, then on a comment-only change. The expected line is `FAIL OK`.
# Usage: bash nonts-comment-controls.sh {scratch-dir}
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
CHECK="$HERE/nonts-comment-check.mjs"
DIR="${1:?scratch dir}"
rm -rf "$DIR"
mkdir -p "$DIR"
git -C "$DIR" init -q
git -C "$DIR" config user.email controls@example.invalid
git -C "$DIR" config user.name controls

cat > "$DIR/stack.yml" <<'EOF'
# Stack (Technical Architecture, "Compose layout").
services:
  web:
    image: example:1
    ports:
      - '8080:80'
EOF
cat > "$DIR/run.sh" <<'EOF'
#!/usr/bin/env bash
# Runs the thing (Technical Architecture, "Backups").
echo "start"
EOF
cat > "$DIR/seed.sql" <<'EOF'
-- Seed rows (Seed Data, "Bills").
insert into t (a) values ('x');
EOF
cat > "$DIR/tokens.css" <<'EOF'
/* Tokens (Branding). */
:root {
  --brand: #123456;
}
EOF
mkdir -p "$DIR/fx"
cat > "$DIR/fx/page.html" <<'EOF'
<html>
<body>
<p>A fixture page (Handoff, "Done when").</p>
<script type="application/ld+json">{"@type":"Recipe","name":"Soup"}</script>
</body>
</html>
EOF
git -C "$DIR" add -A
git -C "$DIR" commit -q -m base
BASE="$(git -C "$DIR" rev-parse HEAD)"

reset() { git -C "$DIR" checkout -q -- . ; }
verdict() { if node "$CHECK" --repo "$DIR" --base "$BASE" "$@" >/dev/null 2>&1; then echo OK; else echo FAIL; fi; }
status=0
report() { # type mutant comment-only
  echo "nonts-control-$1=$2 $3"
  [ "$2 $3" = "FAIL OK" ] || status=1
}

sed -i "s/example:1/example:2/" "$DIR/stack.yml"; m="$(verdict -- stack.yml)"; reset
sed -i 's/(Technical Architecture, "Compose layout")//' "$DIR/stack.yml"; c="$(verdict -- stack.yml)"; reset
report yaml "$m" "$c"

sed -i 's/echo "start"/echo "stop"/' "$DIR/run.sh"; m="$(verdict -- run.sh)"; reset
sed -i 's/ (Technical Architecture, "Backups")//' "$DIR/run.sh"; c="$(verdict -- run.sh)"; reset
report hash "$m" "$c"

sed -i "s/values ('x')/values ('y')/" "$DIR/seed.sql"; m="$(verdict -- seed.sql)"; reset
sed -i 's/ (Seed Data, "Bills")//' "$DIR/seed.sql"; c="$(verdict -- seed.sql)"; reset
report sql "$m" "$c"

sed -i 's/#123456/#654321/' "$DIR/tokens.css"; m="$(verdict -- tokens.css)"; reset
sed -i 's/ (Branding)//' "$DIR/tokens.css"; c="$(verdict -- tokens.css)"; reset
report css "$m" "$c"

sed -i 's/"Soup"/"Stew"/' "$DIR/fx/page.html"; m="$(verdict --html -- fx)"; reset
sed -i 's/ (Handoff, "Done when")//' "$DIR/fx/page.html"; c="$(verdict --html -- fx)"; reset
report html "$m" "$c"

exit "$status"
