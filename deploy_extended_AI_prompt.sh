#!/usr/bin/env bash
set -euo pipefail

# Load variables from .env
if [[ ! -f ".env" ]]; then
  echo ".env file not found" >&2
  exit 1
fi
set -a
source .env
set +a

if [[ -z "${EXTENDED_AI_PROMPT-}" ]]; then
  echo "EXTENDED_AI_PROMPT is not set in your .env file." >&2
  exit 1
fi

# Dump the prompt (with newlines) into a temp file
TMPFILE=$(mktemp)
printf "%s" "$EXTENDED_AI_PROMPT" > "$TMPFILE"

for ENV in production preview development; do
  # List current vars, check if ours exists
  if vercel env ls "$ENV" | grep -q "EXTENDED_AI_PROMPT"; then
    vercel env rm EXTENDED_AI_PROMPT "$ENV" -y
    echo "🗑 Removed old EXTENDED_AI_PROMPT from $ENV"
  else
    echo "ℹ️  EXTENDED_AI_PROMPT not found in $ENV, skipping removal"
  fi

  # Add the new value, reading from the file
  vercel env add EXTENDED_AI_PROMPT "$ENV" < "$TMPFILE"
  echo "✅ Updated EXTENDED_AI_PROMPT for $ENV"
done

rm -f "$TMPFILE"

