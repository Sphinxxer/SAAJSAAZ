# Launch on Vercel

## 1. Upload to GitHub

1. Extract the supplied `saajsaaz-github-upload.zip`.
2. Create a new repository, for example `saajsaaz-website`.
3. Choose **Add file → Upload files**. Drag the extracted **contents** into GitHub, keeping `package.json`, `vercel.json` and `README.md` at the repository root. Do not upload the ZIP itself or nest the project inside an extra folder.
4. Commit the upload. Include `.gitignore`, `.env.example` and `.github/workflows/check.yml`; GitHub Desktop or Git is useful if your file browser hides dotfiles.

This package contains no organiser password, password hash, database token, local database, installed dependencies or previous deployment bundle.

## 2. Create persistent storage

Create a **libSQL database** in [Turso](https://turso.tech/). Copy its connection URL and a database access token from your account. Use a libSQL-compatible database for this package's `@libsql/client`; do not choose a different engine requiring another driver.

The function creates the three required tables automatically on its first request and seeds the event data only into an empty database. No SQL import or dashboard editing is required.

## 3. Import the repository into Vercel

Choose **Add New → Project**, import the new GitHub repository, and use:

| Setting | Value |
| --- | --- |
| Framework preset | Other |
| Root directory | Repository root |
| Node.js version | 24.x |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Output directory | Leave the override disabled; build generates `.vercel/output` |

`vercel.json` already sets the install/build commands and framework selection. Do not select Next.js or set the output directory to `public`; pages and admin need the server function.

Before deployment, add these four **Environment Variables**:

| Variable | Value |
| --- | --- |
| `TURSO_DATABASE_URL` | The libSQL connection URL from your database |
| `TURSO_AUTH_TOKEN` | Your database access token |
| `ADMIN_USERNAME` | `Admin` |
| `ADMIN_PASSWORD_HASH` | The existing PBKDF2 hash supplied privately, or a hash generated locally |

Set the values for **Production**. If using Vercel preview deployments, configure their variables too. A preview connected to the production database can edit production content; choose a separate preview database when needed.

To retain the requested existing organiser password, use the private administrator settings file supplied separately. This file is **not part of the GitHub upload**. The password remains the one previously chosen by the organiser.

Alternatively run `npm run admin:hash` in a trusted local terminal, enter your chosen password, and copy only the generated hash into Vercel. Passwords/hashes/tokens belong in hosting environment settings, never GitHub or frontend code.

Press **Deploy**. Environment variable changes require a new deployment. The build can succeed without runtime secrets, but the website returns 503 until all four runtime variables are configured correctly.

## 4. Check the live website

1. Open the Vercel URL and a direct `/events/raas-garba-2026/` link.
2. Open `/admin`, sign in and check the saved event dates, prices, workshop and reels.
3. Check one kids' pass plus two adult passes totals ₹1,297. Continue should open WhatsApp in another tab; do not send a test booking.
4. Test one reversible organiser edit and restore it. Redeploy and confirm the saved content persists.
5. Check mobile layout and real Instagram fallback links. The final WhatsApp composer requires a signed-in WhatsApp session.

After 18 October 2026 at 9 PM IST, the original event closes automatically. If deploying later, closed bookings are expected; do not change the event dates merely to make a test booking.

## Troubleshooting

- **503:** check all four environment variables, token permissions and database URL, then redeploy. Tokens and password hashes must be copied without added quotation marks.
- **Admin rejects login:** username is case-sensitive. Ensure the hash corresponds to your password.
- **Blank/stale public content:** confirm Framework = Other and output directory override is disabled; a static-only deployment cannot run this app.
- **Original data returns after deployments:** ensure the same hosted database is configured for that environment. Production does not write to a local SQLite file.
- **Instagram or WhatsApp sign-in wall:** external services control access; use the provided Watch on Instagram or copy-message fallback.

References: [Vercel Build Output API](https://vercel.com/docs/build-output-api), [Vercel environment variables](https://vercel.com/docs/environment-variables), [Turso client reference](https://docs.turso.tech/sdk/ts/reference).
