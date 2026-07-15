#!/bin/bash
set -e

echo "=== Step 1: Checking Cloudflare Session ==="
USER_EMAIL=$(npx wrangler whoami 2>&1 | grep -o -E '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' | head -n 1)

if [[ "$USER_EMAIL" != "gavvavamsikrishna@gmail.com" ]]; then
  echo "Error: You are currently logged in as '$USER_EMAIL'."
  echo "Please log in with your personal account by running:"
  echo "  npx wrangler login"
  echo "And make sure you select your personal email: gavvavamsikrishna@gmail.com"
  exit 1
fi

echo "Successfully verified login as: $USER_EMAIL"

echo "=== Step 2: Creating D1 Database 'nexblob' ==="
DB_CREATE_OUT=$(npx wrangler d1 create nexblob 2>&1 || true)
echo "$DB_CREATE_OUT"

DB_ID=$(echo "$DB_CREATE_OUT" | grep -o -E 'database_id = "[a-f0-9-]+"' | cut -d'"' -f2)

if [ -z "$DB_ID" ]; then
  # Try checking if database already exists
  echo "Checking if database already exists..."
  DB_ID=$(npx wrangler d1 list 2>&1 | grep nexblob | awk '{print $2}')
fi

if [ -z "$DB_ID" ]; then
  echo "Error: Failed to create or find D1 database 'nexblob'"
  exit 1
fi

echo "Using Database ID: $DB_ID"

echo "=== Step 3: Updating wrangler.jsonc ==="
sed -i -E "s/\"database_id\": \"[a-f0-9-]+\"/\"database_id\": \"$DB_ID\"/" wrangler.jsonc
echo "Updated wrangler.jsonc with database ID: $DB_ID"

echo "=== Step 4: Applying Migrations ==="
npx wrangler d1 migrations apply nexblob --remote
npx wrangler d1 migrations apply nexblob --local

echo "=== Step 5: Regenerating Types ==="
npm run cf-typegen

echo "=== Step 6: Deploying Application ==="
npm run deploy

echo "=== Step 7: Setting GEMINI_API_KEY Secret ==="
if [ -f .dev.vars ]; then
  API_KEY=$(grep GEMINI_API_KEY .dev.vars | cut -d'=' -f2 | tr -d '"' | tr -d "'")
  if [ ! -z "$API_KEY" ]; then
    echo "$API_KEY" | npx wrangler secret put GEMINI_API_KEY
    echo "GEMINI_API_KEY successfully set in production."
  else
    echo "Warning: GEMINI_API_KEY not found in .dev.vars."
  fi
else
  echo "Warning: .dev.vars file not found."
fi

echo "=== Migration & Deployment Complete! ==="
echo "Your live URL is displayed in the output above."
