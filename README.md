# SAAJSAAZ — GitHub and Vercel edition

The approved festive website, WhatsApp booking flow and password-protected `/admin`, prepared for Vercel. Payment and booking confirmation stay with the SAAJSAAZ team on WhatsApp.

Start with [DEPLOY.md](DEPLOY.md). Upload this folder's contents to a new GitHub repository, then import that repository into Vercel. This edition uses hosted **Turso/libSQL** storage so organiser edits and sessions survive deployments. It does not use Sites, Cloudflare bindings or Google Sheets.

## Development

Use Node 24:

```sh
npm ci
npm test
npm run build
```

The build emits Vercel Build Output API v3: static CSS, JavaScript and illustrations plus a bundled Node function in `.vercel/output`. Credentials are read at runtime, never bundled into browser assets. No database credentials are needed for the build or automated tests.

For optional local use: `npm run local`, then visit `http://localhost:2000`. Stop any existing website on that port first. A fresh local install generates its own organiser credentials and prints them in the terminal; local edits persist in `.local-data/`. Hosted credentials are configured separately in Vercel.

## Organiser editing

Open `/admin` and sign in. Edit event dates, daily times, name, copy, venue, workshop dates/descriptions, prices and booking availability. Review the draft and save. Homepage reels support validated Instagram links, captions, ordering and show/hide. Unsaved changes are marked and warn before leaving.

The public site refreshes saved details periodically. Booking quotes check the latest revision; outdated selections must be reviewed. Event URLs remain stable when names change. Completed events remain readable and close at their configured end time using Asia/Kolkata.

Pass coverage, totals, FAQs and WhatsApp messages use the saved event configuration. Continue opens another tab and offers a copy-message fallback. Opening WhatsApp never confirms a booking. Instagram controls its native player; Watch on Instagram links remain usable if an embed is blocked.

## Content and persistence

`data/events.json` contains the current approved public content exported from the local website. The first hosted request seeds this content only if the hosted database is empty. Rebuilds do not overwrite organiser edits or restore deleted reels. New event slugs can be added to the seed configuration and deployed; existing slugs keep their saved content.

Use separate databases for production and preview if preview edits must not affect the live event. Back up hosted data through the database provider. Never upload `.local-data`, `.env`, database files or credentials to GitHub.

Tests cover booking validation/formatting, event/reel persistence, authentication, revision conflicts, the hosted database adapter and the Vercel request bridge. GitHub Actions runs tests and builds on pushes and pull requests.

Original event: Raas Garba 2026, 17–18 October 2026, 6–9 PM IST; workshop 13–14 October; kids ₹299, adults ₹499; Bungalow, Near Jwala Medical, Gandhi Chowk, Merta City; WhatsApp +91 94602 22677. One kids' pass and two adult passes total ₹1,297.

Official references: [Vercel Build Output API](https://vercel.com/docs/build-output-api), [Turso TypeScript client](https://docs.turso.tech/sdk/ts/reference).
