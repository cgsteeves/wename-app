# Supabase Edge Function Deployment Log

## Project: cwpanlrimbccdgzchkdo

### Deployed Functions (2026-04-23)

| Function | Status | Version | Deployed At (UTC) |
|---|---|---|---|
| send-magic-link | ACTIVE | 5 | 2026-04-23 18:56:35 |
| delete-account | ACTIVE | 4 | 2026-04-23 18:56:41 |
| submit-deletion-request | ACTIVE | 4 | 2026-04-23 18:56:42 |

### Secrets Configured

| Secret | Status |
|---|---|
| SENDGRID_API_KEY | Set (via `supabase secrets set`) |
| SUPABASE_SERVICE_ROLE_KEY | Auto-provided by Supabase |
| SUPABASE_URL | Auto-provided by Supabase |
| SUPABASE_ANON_KEY | Auto-provided by Supabase |

### Auth Providers

| Provider | Status |
|---|---|
| Google OAuth | Enabled (client ID configured) |
| Email (Magic Link) | Enabled via send-magic-link function |

### App Configuration

- `EXPO_PUBLIC_SUPABASE_ANON_KEY`: Updated to legacy JWT-format key.
  The newer `sb_publishable_` key format is rejected by Supabase Edge
  Functions; the legacy JWT anon key is required for edge function auth.

### Runbook: Why the Legacy JWT Anon Key Is Required

`authService.ts` calls edge functions with these headers:
```
Authorization: Bearer <EXPO_PUBLIC_SUPABASE_ANON_KEY>
apikey: <EXPO_PUBLIC_SUPABASE_ANON_KEY>
```

Supabase Edge Function gateway validates the `Authorization` header as a JWT.
The newer `sb_publishable_` key format is **not a JWT** and fails gateway
validation with `UNAUTHORIZED_INVALID_JWT_FORMAT`. Only the legacy
`eyJ...` (HS256 JWT) format is accepted for this header.

**Avoid regressing to `sb_publishable_` unless the client call pattern also
changes** (e.g., by removing the `Authorization: Bearer` header and relying
solely on the `apikey` header, if Supabase adds that support for functions).

If Supabase rotates or expires the legacy key, obtain the new legacy JWT key
from the Supabase dashboard → Project Settings → API → "Legacy anon key",
and update `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

### Smoke Test Results (2026-04-23)

- `send-magic-link`: `{"success":true}` for valid email — email delivered via SendGrid
- `delete-account`: `{"error":"Invalid or expired session"}` without user JWT (correct)
- `submit-deletion-request`: `{"error":"Invalid email address"}` for bad input (correct)
- Google OAuth: `external_google_enabled=true`, client ID set

### Dashboard Link

https://supabase.com/dashboard/project/cwpanlrimbccdgzchkdo/functions
