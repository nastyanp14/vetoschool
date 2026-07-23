# Vetoschool Auth Setup

## Google OAuth

The frontend uses Supabase OAuth only:

- provider: `google`
- redirect: `{current origin}/auth/callback`

Do not add Google OAuth secrets to Vite environment variables or frontend code.

Configure Supabase:

1. Open Supabase Dashboard -> Authentication -> Providers -> Google.
2. Enable Google provider.
3. Enter the Google OAuth Client ID.
4. Enter the Google OAuth Client Secret.
5. Copy the exact Supabase callback URL shown on that page. For this project it is normally:
   `https://teapriepxqctgjfhposm.supabase.co/auth/v1/callback`

Configure Google Cloud OAuth Client:

- Authorized JavaScript origins:
  - `https://vetoschool.eu`
  - `http://127.0.0.1:5173`
  - `http://localhost:5173`
- Authorized redirect URI:
  - `https://teapriepxqctgjfhposm.supabase.co/auth/v1/callback`

Configure Supabase URL Configuration:

- Site URL:
  - `https://vetoschool.eu`
- Redirect URLs:
  - `https://vetoschool.eu/**`
  - `http://127.0.0.1:5173/**`
  - `http://localhost:5173/**`

`Unsupported provider: missing OAuth secret` means the Google provider is enabled without a saved Client Secret, or the wrong Google credential mode is selected. This cannot be fixed safely in frontend code.

## Admin Delete Student Edge Function

The browser must never delete Supabase Auth users directly. The admin page calls the `admin-delete-user` Edge Function with the current user's Bearer token.

Required Supabase Edge Function secrets:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Deploy after changing the function:

```bash
supabase functions deploy admin-delete-user
```

If the dashboard still shows `getClaims is not a function`, the deployed Edge Function is stale. Redeploy `admin-delete-user` from this repository.
