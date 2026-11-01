# Email-code sign-in on Netlify

Google sign-in continues to work. Email sign-in becomes available after the two server variables below are configured. No password database is needed.

1. Create a Resend account at https://resend.com. Add and verify a sending domain you control at https://resend.com/domains using the required DNS records. The default `resend.dev` sender can only send test messages to your own Resend account email; it cannot serve the fellows. A `netlify.app` site address is not a sending domain you control.
2. Create a sending API key in Resend. In Netlify → your project → Project configuration → Environment variables, add these variables with the **Functions** scope (or all scopes), for the production context:
   - `RESEND_API_KEY`: the private Resend API key.
   - `EMAIL_FROM`: a sender on the verified domain, e.g. `RAMA Derm <schedule@your-domain.org>`.
3. Keep `SITE_URL`, `SESSION_SECRET`, `ADMIN_EMAIL`, and the existing Google settings. Never put secrets in GitHub, client code, `VITE_` variables, or chat. The sender can differ from the administrator's login email.
4. Trigger one new production deploy so the function receives the updated configuration.
5. In the admin fellow editor, save each fellow's exact email address. Outlook, hospital, Yahoo, iCloud and other deliverable addresses are supported. Email sign-in is limited to these registered addresses and `ADMIN_EMAIL`; the public calendar requires no login.
6. Open `/login`, request a code, then enter the newest six-digit code in the same browser within 10 minutes. Test with a registered non-Google address. Verify that it opens fellow access, and separately verify admin access with `ADMIN_EMAIL`.

Codes are single-use and stored as keyed hashes in a separate Netlify Blob store. Each code permits at most five attempts. A resend invalidates the previous code, with a 60-second cooldown and per-address, IP and site-wide sending limits. No codes are returned to the client or written to logs. Access to schedules and private records is checked against the current roster on every API request.

If email delivery fails, check the Resend dashboard for sender verification, API-key permissions, quota, bounces and spam filtering. The browser receives a generic error; it never receives provider credentials. Google sign-in remains available while email delivery is configured. Read https://resend.com/docs/api-reference/emails/send-email and https://resend.com/docs/knowledge-base/403-error-resend-dev-domain for provider details.
