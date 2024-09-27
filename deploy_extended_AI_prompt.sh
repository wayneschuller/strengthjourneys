#!/bin/bash
# Use Vercel CLI to upload local .env variable EXTENDED_AI_PROMPT to Vercel servers

# Load variables from the .env file
if [ -f ".env" ]; then
  # Use 'source' to properly load variables with special characters or newlines
  set -a
  source .env
  set +a
else
  echo ".env file not found"
  exit 1
fi

# Check if EXTENDED_AI_PROMPT is set in the .env file
if [[ -z "$EXTENDED_AI_PROMPT" ]]; then
  echo "EXTENDED_AI_PROMPT is not set in your .env file."
  exit 1
fi

# Encode EXTENDED_AI_PROMPT to base64 to preserve formatting
ENCODED_PROMPT=$(echo -n "$EXTENDED_AI_PROMPT" | base64)

# Loop over each environment, remove the existing variable, and add it back
for ENV in production preview development
do
  # Remove the existing EXTENDED_AI_PROMPT from the environment
  vercel env rm EXTENDED_AI_PROMPT $ENV -y
  echo "EXTENDED_AI_PROMPT has been removed from $ENV."

  # Add the new EXTENDED_AI_PROMPT to the environment
  vercel env add EXTENDED_AI_PROMPT $ENV <<< "$ENCODED_PROMPT"
  echo "EXTENDED_AI_PROMPT has been successfully updated for $ENV."
done