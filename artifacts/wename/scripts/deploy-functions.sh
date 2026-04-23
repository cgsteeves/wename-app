#!/usr/bin/env bash
# Deploy all Supabase Edge Functions to project cwpanlrimbccdgzchkdo
# Requires: SUPABASE_ACCESS_TOKEN env var, supabase CLI installed
#
# Usage:
#   SUPABASE_ACCESS_TOKEN=<token> ./scripts/deploy-functions.sh
#
# To also set the SendGrid secret:
#   supabase secrets set SENDGRID_API_KEY=<key> --project-ref cwpanlrimbccdgzchkdo

set -e

PROJECT_REF="cwpanlrimbccdgzchkdo"

if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
  echo "Error: SUPABASE_ACCESS_TOKEN is not set" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

echo "Deploying send-magic-link..."
supabase functions deploy send-magic-link --project-ref "$PROJECT_REF"

echo "Deploying delete-account..."
supabase functions deploy delete-account --project-ref "$PROJECT_REF"

echo "Deploying submit-deletion-request..."
supabase functions deploy submit-deletion-request --project-ref "$PROJECT_REF"

echo ""
echo "All functions deployed successfully."
echo "Dashboard: https://supabase.com/dashboard/project/${PROJECT_REF}/functions"
echo ""
echo "Remember to set required secrets if not already done:"
echo "  supabase secrets set SENDGRID_API_KEY=<key> --project-ref ${PROJECT_REF}"
