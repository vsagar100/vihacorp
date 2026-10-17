# Vihacorp

Vihacorp's IT services and consulting website, prepared for **Cloudflare Pages with GitHub integration**. Includes the public website, an enquiry form backed by Cloudflare D1, downloadable enquiry receipts, and a password-protected owner inbox at `/admin`.

## Deploy from GitHub

1. In Cloudflare, open **Workers & Pages → Create application → Pages → Connect to Git**. Choose GitHub and authorize access to `vsagar100/vihacorp`.
2. Select this repository and enter the following build settings:

| Setting | Value |
| --- | --- |
| Project name | `vihacorp` (or another available name) |
| Production branch | `main` |
| Framework preset | `None` |
| Build command | `pnpm run build` |
| Build output directory | `dist` |
| Root directory | Leave at the repository root |
| Environment variable | `NODE_VERSION` = `24` |
| Environment variable | `PNPM_VERSION` = `11.25.0` |

3. Save and deploy. Cloudflare assigns an available `<project-name>.pages.dev` address. Later pushes to `main` deploy automatically.

Choose **Pages**, rather than a Worker deployment flow. This repository uses Pages Functions. Its root `functions/` directory is detected automatically; do not upload only the `dist` folder through the dashboard.

The public pages can deploy before database setup. The form displays an error instead of claiming success if storage is unavailable.

## Enable enquiry storage and owner access

1. In Cloudflare, open **Storage & databases → D1 SQL Database → Create database**. Name it `vihacorp-enquiries`.
2. Open that database's **Console**. Copy the SQL from [`migrations/0001_initial.sql`](migrations/0001_initial.sql) and execute it **once on this new, empty database**. This creates the enquiry and rate-limit tables. Existing data from the previous website is not transferred by this repository.
3. Open the Pages project → **Settings → Bindings → Add → D1 database**. Set the binding name to **`DB`**, choose `vihacorp-enquiries`, and save it for **Production**.
4. Under the project's **Settings → Variables and Secrets**, add the following **encrypted secrets** for Production:

| Secret name | Value |
| --- | --- |
| `ADMIN_PASSWORD` | A unique, randomly generated password of 16–200 characters. Use this to log in at `/admin`. |
| `SESSION_SECRET` | A separate random value of at least 32 characters. Never reuse the admin password. |

You can generate a random value locally with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Run it separately for each secret. Keep the values in your password manager; do not commit them or send them in chat.

5. Redeploy the latest Pages deployment after adding the binding and secrets. If a compatibility date is requested, choose `2026-05-15` or later. No Node.js compatibility flag is required by the API handlers.
6. Submit a sample enquiry from the live website. Confirm that it returns a `VIHA-...` reference, then sign in at `https://<your-project>.pages.dev/admin` and check that the same enquiry appears.

**Notifications:** submissions are stored in D1 and shown in the admin inbox. Automatic email, SMS and WhatsApp notifications are **not configured**. Check `/admin` for new enquiries until a notification provider is connected.

Preview deployments should use a **separate test D1 database and separate secrets**. Configure those under Preview and redeploy if needed; keep production enquiry data restricted to Production.

## Local development

Requires Node.js 24 and pnpm 11.25.0. The dependency versions are pinned in `pnpm-lock.yaml`.

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm run build
```

For UI development, run `pnpm dev`. Vite alone does not serve the enquiry API.

For the full site with a local database:

```sh
cp .dev.vars.example .dev.vars
# Replace both example values in .dev.vars with local-only credentials.
pnpm db:local
pnpm run build
pnpm dev:full
```

The explicit `wrangler.local.jsonc` file is only for local use. Production bindings and secrets are managed in the Cloudflare dashboard; this repository intentionally has no root `wrangler.json`, `wrangler.jsonc` or `wrangler.toml` that could override them.

## Project structure

- `src/`: public website, admin interface and styles.
- `functions/api/enquiries.ts`: validated enquiry submissions and rate limits.
- `functions/api/admin/`: sign-in, sign-out and authenticated inbox API.
- `functions/_lib/security.ts`: request limits, signed session cookies and shared helpers.
- `migrations/`: database schema.
- `scripts/prerender.mjs`: adds the homepage content to the generated HTML for first paint and search engines.
- `scripts/test.mjs`: integration checks using the real handlers and an in-memory SQLite database.
- `public/_routes.json`: runs Functions only on API paths, leaving public assets static.

Admin sessions last eight hours, use signed HttpOnly/Secure cookies, and are not cached. Changing `SESSION_SECRET` and redeploying invalidates existing sessions. Enquiry records remain stored until the owner deletes them from D1. The inbox shows the latest 200 records; older records remain in the database. Back up data before making database changes.

Industry previews are illustrative examples, not claims of delivered client projects. Replace the example copy or add verified client work as the business grows.

## Cloudflare references

- [Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/)
- [Build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/)
- [Build image and version overrides](https://developers.cloudflare.com/pages/configuration/build-image/)
- [D1 bindings and secrets](https://developers.cloudflare.com/pages/functions/bindings/)
