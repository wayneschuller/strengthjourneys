#!/usr/bin/env bash
set -euo pipefail

# Extract EXTENDED_AI_PROMPT from .env without executing the file as shell code.
# Accept both dotenv multiline quote styles; double quotes allow apostrophes in
# natural-language prompts without truncating the value.
if [[ ! -f ".env" ]]; then
  echo ".env file not found" >&2
  exit 1
fi

# Dump the prompt (with newlines) into a temp file
TMPFILE=$(mktemp)
trap 'rm -f "$TMPFILE"' EXIT

awk '
  BEGIN {
    in_prompt = 0
    closing_quote = ""
  }
  in_prompt == 0 && /^EXTENDED_AI_PROMPT=/ {
    value = $0
    sub(/^EXTENDED_AI_PROMPT=/, "", value)
    opening_quote = substr(value, 1, 1)

    if (opening_quote != "\"" && opening_quote != "'\''") {
      next
    }

    in_prompt = 1
    closing_quote = opening_quote
    print substr(value, 2)
    next
  }
  in_prompt == 1 && $0 == closing_quote { exit }
  in_prompt == 1 { print }
' .env > "$TMPFILE"

if [[ ! -s "$TMPFILE" ]]; then
  echo "EXTENDED_AI_PROMPT block was not found in .env." >&2
  exit 1
fi

PROMPT_VALUE=$(cat "$TMPFILE")

for ENV in production preview development; do
  if vercel env rm EXTENDED_AI_PROMPT "$ENV" -y >/dev/null 2>&1; then
    echo "🗑 Removed old EXTENDED_AI_PROMPT from $ENV"
  else
    echo "ℹ️  EXTENDED_AI_PROMPT not found in $ENV, skipping removal"
  fi

  # Add the new value, reading from the file
  vercel env add EXTENDED_AI_PROMPT "$ENV" --value "$PROMPT_VALUE" --yes
  echo "✅ Updated EXTENDED_AI_PROMPT for $ENV"
done
