# Username and password sign-in

No domain, Resend account, email delivery setup or new Netlify variables are needed. The existing `SITE_URL`, `SESSION_SECRET` and Netlify Blob storage are used. Google sign-in remains available.

## Create accounts

1. Sign in as the existing administrator with Google.
2. Open **Fellows** and select the academic year.
3. Open **Edit fellow**, fill **Display name** and **Staff ID No.**, and save. Display name is the representative name on the schedule and PDF; a blank display name falls back to the nickname. Staff IDs are stored as text, preserving leading zeros, and must be unique across fellow records. They are private to the admin and relevant fellow.
4. Scroll to **Username & password access**, select the fellow, and press **Create login**. The saved Staff ID is automatically used as the username; it cannot be entered independently here. Admin accounts still have a separately chosen username.
5. Save the temporary password shown once and share it privately with that person. It cannot be retrieved later; use **Reset password** if lost.
6. The fellow opens `/login`, enters the username and temporary password, and chooses a personal password before accessing the workspace. Personal passwords are 15–128 characters; a phrase of several words works well.

You can also select **Me — administrator** to create your own admin password login. This makes future Google sign-in optional. Keep Google access as a recovery method for your admin account.

## Manage access

- **Reset password** ends existing password sessions and generates a new temporary password, with a required first-sign-in change.
- **Disable login** ends existing password sessions and prevents further password sign-ins. **Enable & reset** restores it with a new temporary password.
- Signed-in password users can choose **Change password** in the top bar. A normal change requires the current password and ends other password sessions.
- Account controls apply to username/password login. Google and email-code sign-in remain controlled separately by the fellow's sign-in email. To remove all access, also remove the corresponding sign-in email from the fellow record. Preserve the intended roster record and history.
- Changing a saved Staff ID changes that fellow’s login username immediately while preserving their password. Their existing account does not need to be recreated. Existing accounts without a Staff ID keep their original username until one is saved.
- Accounts are linked to the academic year and fellow ID, independently of email. New cohorts do not inherit old accounts or permissions. To give the same person access to another cohort, create a separate username for that year. Changing a fellow's email does not transfer their password account to another person; disable the old login if replacing a fellow's identity.
- A disabled or reset account invalidates its signed password sessions on the next request. The app refreshes schedule data automatically; a new sign-in restores access after a reset.

## Storage and security

Credential data is stored separately from schedule data in the private `rama-derm-password-auth` Netlify Blob store. Passwords use salted scrypt with N=32768, r=8 and p=3, an OWASP-listed memory/CPU trade-off. Plaintext passwords are never stored, logged, included in schedule responses, or included in schedule PDF/JSON exports. A private schedule backup does not contain password accounts; if credential storage is lost, recreate the accounts through Google admin access.

Temporary sign-in authorizes only the password-change page, not private schedule APIs. Sessions use Secure, HttpOnly, SameSite cookies and are checked against the current account version. Server-side limits protect login attempts by username, IP, and site, and password changes by IP. No public self-registration or email password-reset flow is enabled.
