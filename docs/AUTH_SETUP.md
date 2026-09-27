# Shifts authentication setup

The application uses Supabase Auth for email/password signup, confirmation emails, Google sign-in, refreshable sessions, and password-reset emails. The FastAPI backend verifies each private request with Supabase's `/auth/v1/user` endpoint. A browser-generated user ID is no longer accepted as authentication. Missing configuration fails closed.

## 1. Environment values

In Supabase, create or select a project and obtain its project URL and **publishable key** from the project settings/API keys. A legacy **anon** key also works. These are public client configuration values. Never use a secret key or `service_role` key in frontend variables.

Add these to the existing root `.env` (retain the existing Groq and other provider values):

```dotenv
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY
FRONTEND_ORIGINS=https://YOUR_FRONTEND_DOMAIN
```

Create `frontend/.env.local`:

```dotenv
VITE_API_URL=http://localhost:8000
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY
```

For legacy keys, use `SUPABASE_ANON_KEY` and `VITE_SUPABASE_ANON_KEY` instead. Both services must point to the same project. `FRONTEND_ORIGINS` accepts comma-separated exact origins without trailing slashes; existing localhost:5173 and production origins remain allowed. Set `VITE_API_URL` to the production API when deploying.

Use Node 22.12+ and run `npm ci` in `frontend`. Restart the backend and Vite after configuring their environments. Vite embeds public variables at build time: configure them in the frontend hosting dashboard and rebuild for production. Set backend variables in the backend hosting dashboard too.

## 2. Email signup and redirect URLs

In Supabase Authentication, enable the Email provider, account signup, and email confirmation. Set the minimum password length to at least 8. The UI validates a minimum of 8 characters, confirmation matching, and displays provider password-policy rejections.

Set **Site URL** to your final frontend origin. Add exact entries to **Redirect URLs** for each environment you use:

```text
http://localhost:5173/
http://localhost:5173/?auth=reset
http://127.0.0.1:5173/
http://127.0.0.1:5173/?auth=reset
https://YOUR_FRONTEND_DOMAIN/
https://YOUR_FRONTEND_DOMAIN/?auth=reset
```

Use your actual deployed domain, and include a base path if hosting under one. Keep confirmation and recovery email templates using Supabase's `{{ .ConfirmationURL }}` so the provider verifies the one-time link before redirecting to the app. Do not replace the verification link with a plain link to the app.

This client-only application uses the SDK's implicit redirect flow: Supabase verifies email links, the SDK consumes the returned session from the URL fragment, and the fragment is removed. No custom callback server or SPA path rewrite is required. Recovery links use `?auth=reset`, and the recovery screen persists across reloads until the password is updated. The account ID sent by a browser is never proof of identity for the API.

## 3. Working email delivery

Configure a custom SMTP provider under Supabase Authentication email settings, including a verified sender address/domain. Supabase's default email service restricts recipients and has low sending limits; it is not a production delivery solution. Set SMTP credentials directly in the Supabase dashboard, not in this repository or frontend. Review the SMTP provider's domain verification and Supabase email rate limits.

Both signup confirmation and forgot-password emails use this delivery configuration. The app reports a sent request only after Supabase accepts it; delivery to an actual inbox must still be verified. The reset response avoids disclosing whether an email has an account.

## 4. Google sign-in

1. Configure the OAuth consent screen in Google Cloud and create an OAuth client with application type **Web application**. Add your test users if the consent screen is in testing mode.
2. Add the frontend origins you use to Google's authorized JavaScript origins.
3. Copy the callback URL shown in Supabase's Google provider settings into Google's **Authorized redirect URIs**. For a standard hosted project it is `https://YOUR_PROJECT.supabase.co/auth/v1/callback`.
4. Enable Google in Supabase Authentication providers and enter the Google client ID and secret there. Keep the secret in Supabase; it is not a frontend environment variable.
5. Save and test **Continue with Google**. The app requests account selection and Supabase returns to the allowlisted frontend URL.

The Google callback is the Supabase URL. The post-login app redirect is the frontend URL; these serve different purposes.

## 5. Account and data behavior

- Chat, image chat, and memory endpoints require `Authorization: Bearer <access-token>`. The API verifies the user through Supabase and derives storage identity from its UUID. A forged, missing, expired or rejected token cannot access private routes.
- `/`, `/health`, `/modes/list`, and API documentation remain public. The root readiness route no longer creates anonymous memory. Uploaded image files remain temporary and are never exposed by a shared static file endpoint.
- Chat history remains **browser-local**, stored separately under `shifts-conversations-v2:<account-id>`. This does not add cloud history synchronization. Local browser storage is not encrypted against someone with access to the browser profile/devtools.
- Legacy anonymous history is retained under its old key but is not automatically attached to an account: its ownership cannot be verified. Existing anonymous backend memory is also not assigned to a signed-in account.
- Account changes remount the chat UI and abort active requests. Sign-out clears the current Supabase session, propagates to open tabs, and hides account history. History remains available when the same account signs in again on that browser.
- The SDK refreshes sessions. API session validation is performed online and adds a Supabase round trip to private requests. Provider outages return 503; there is no insecure anonymous fallback. As with Supabase sessions generally, already issued access tokens can remain valid until expiry after logout; use an appropriate token lifetime in Supabase.

## 6. Validation

Offline/backend checks, from the repository root:

```powershell
python -m pytest tests -q -p no:cacheprovider
```

Frontend checks, from `frontend`:

```powershell
npm.cmd run lint
npm.cmd run build
node --test tests/revealResponse.test.mjs
npm.cmd run test:auth
```

Browser tests use installed Microsoft Edge in headless mode and launch Vite on port 4175 with fake provider configuration. Every Supabase/Google call is intercepted; no live email or provider account is used. They cover signup, invalid credentials, Google redirect/callback, password reset and reload, expired links, rate limits, account isolation, sign-out across tabs, and desktop/mobile layout. For another environment, change `channel` in `frontend/playwright.config.mjs` to an installed Playwright-supported browser. Screenshots are written to ignored `frontend/test-results/` folders.

Implementation verification: 71 backend tests, 12 browser auth tests, and 4 response-display tests passed; frontend lint and production build passed. Desktop login, mobile signup/recovery, and the mobile account menu were visually inspected. These checks do not verify a real Supabase project, Google consent, or SMTP delivery, which require the deployment configuration above.

The build still reports the existing large-bundle warning. `npm audit --omit=dev` reports 3 moderate findings in the existing `react-syntax-highlighter` / `refractor` / `prismjs` dependency chain; no Supabase package appears in that report. A broad dependency upgrade was not part of this authentication change.

Before launch, verify with the actual configured project:

1. Sign up with a real email, receive and follow confirmation, sign in, reload, and sign out.
2. Request a password reset, receive the email, follow its one-time link, set a new password, sign out, then confirm the old password fails and the new password succeeds. Check expired/reused links too.
3. Sign in through Google's actual consent screen and confirm the account appears in Supabase.
4. Use two accounts and multiple tabs. Verify one account cannot see the other's chat history or memory and that sign-out hides chats in every tab.
5. Verify the deployed frontend origin and reset URL, not only localhost. Confirm the API rejects requests without valid bearer tokens.

Official references: [password authentication](https://supabase.com/docs/guides/auth/passwords), [Google provider](https://supabase.com/docs/guides/auth/social-login/auth-google), [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [password reset API](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail), [sign-out behavior](https://supabase.com/docs/reference/javascript/auth-signout).
