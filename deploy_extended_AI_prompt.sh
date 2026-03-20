#!/usr/bin/env bash
set -euo pipefail

# Extract EXTENDED_AI_PROMPT from .env without executing the file as shell code
if [[ ! -f ".env" ]]; then
  echo ".env file not found" >&2
  exit 1
fi

# Dump the prompt (with newlines) into a temp file
TMPFILE=$(mktemp)
trap 'rm -f "$TMPFILE"' EXIT

awk '
  BEGIN { in_prompt = 0 }
  in_prompt == 0 && /^EXTENDED_AI_PROMPT='\''/ {
    in_prompt = 1
    sub(/^EXTENDED_AI_PROMPT='\''/, "")
    print
    next
  }
  in_prompt == 1 && /^'\''$/ { exit }
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
