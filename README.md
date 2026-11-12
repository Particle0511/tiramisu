# Tiramisu

Seller protection for PayPal disputes. Tiramisu watches a seller's disputes, builds each response from the seller's own records, and sends nothing to PayPal until the seller approves the exact text with their password.

This is a hackathon project. It runs on the PayPal Sandbox with test accounts and test money only.

Live demo: https://YOUR-SERVICE.onrender.com

## What it does

- **Disputes and deadlines.** Syncs disputes from the PayPal Sandbox and shows each response deadline.
- **Evidence checklist.** Shows the records each dispute type needs, with what was found and what is missing.
- **Evidence-backed drafts.** An AI drafts a response from the seller's records. Every statement must link to a real record, and any statement without support is removed before the seller sees it.
- **Approval before sending.** Every action to PayPal waits for the seller to read the exact text and confirm with their password.
- **Prevention Radar.** Flags overdue deadlines, missing tracking numbers, thin evidence and flagged buyer messages.
- **Refund limit.** The seller sets a ceiling. A refund above it is blocked, even after approval.
- **Message screening.** Buyer messages that try to give the AI instructions are flagged and kept away from it.
- **Activity history.** Every action is saved in a hash-chained log, and the chain can be verified from the app.
- **Connect your own PayPal Sandbox.** Each seller can connect their own Sandbox app keys, which are checked with PayPal and stored encrypted.

## How it is built

| Part | Technology |
|---|---|
| Frontend | React 19, Vite, TypeScript, React Router |
| Backend | Node.js, Express, TypeScript, Zod |
| Database and sign-in | Supabase (PostgreSQL with row-level security, Supabase Auth) |
| AI | Any OpenAI-compatible API, configured by environment variables |
| Payments data | PayPal Sandbox Disputes API and webhooks |

In production one Node service serves both the API and the built website, so everything is on a single address.

## Security model

- Every request is checked against Supabase Auth. The workspace comes only from the verified user, never from the request.
- Each seller's data is separated at the database level with row-level security, and the app connects with a restricted database login.
- Approving an action or changing a limit asks for the account password again.
- Sellers' PayPal secrets are encrypted with AES-256-GCM, bound to the workspace, and never returned by the API or written to logs.
- Webhooks are verified with PayPal's signature check, and each event is stored once.
- Rate limits, security headers and a strict CORS list are on by default.

Report a vulnerability as described in `SECURITY.md`.

## Run it locally

You need Node.js 22, a free Supabase project, a PayPal developer account with a Sandbox app, and an API key for an OpenAI-compatible AI service.

1. Install dependencies.

   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```

2. Create the database. In the Supabase SQL Editor, run the files in `backend/src/db/migrations` in order, from `001` to `012`.

3. Create `backend/.env` from `.env.example` and fill in the values in the table below. Create `frontend/.env` with the two `VITE_` values.

4. In Supabase, open Authentication and turn off email confirmation for easy testing.

5. Start both servers.

   ```bash
   cd backend && npm run dev
   cd frontend && npm run dev
   ```

6. Open http://localhost:5173, create an account, and click Load demo data on the Overview page to try every screen.

Run the tests with `npm test` inside `backend`.

## Environment variables

Backend (`backend/.env`):

| Name | Purpose |
|---|---|
| `NODE_ENV` | `development` or `production` |
| `PORT` | Server port. Hosting providers set this themselves. |
| `LOG_LEVEL` | `info` by default |
| `FRONTEND_ORIGIN` | The website address allowed by CORS. Must start with `https://` in production. |
| `DATABASE_URL` | Postgres connection string for the restricted app login |
| `DATABASE_CA_BASE64` | Optional database CA certificate |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Your Supabase publishable key |
| `PAYPAL_BASE_URL` | `https://api-m.sandbox.paypal.com` |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | The project's own Sandbox app keys, used for the owner's workspace |
| `PAYPAL_WEBHOOK_ID` | ID of the webhook registered for that Sandbox app |
| `PAYPAL_SYNC_ALLOWED_EMAILS` | Emails allowed to use the project's own keys |
| `WEBHOOK_TENANT_EMAIL` | The account that receives webhook disputes |
| `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` | The AI service used for drafts |
| `CREDENTIALS_ENCRYPTION_KEY` | Encrypts sellers' PayPal secrets. See `backend/src/crypto/vault.ts` for the format. Keep it secret, and do not change it after sellers have connected, or their stored keys can no longer be decrypted. |

Frontend (`frontend/.env`, public values only):

| Name | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Same as `SUPABASE_URL` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Same as `SUPABASE_PUBLISHABLE_KEY` |

Never commit a `.env` file.

## PayPal setup

1. At developer.paypal.com, switch to Sandbox and create an app of the Merchant type.
2. Sign in to Tiramisu, open Settings, and paste the Client ID and Secret into the PayPal connection card.
3. Create a sandbox buyer and seller, pay from the buyer, and open an item-not-received dispute as the buyer.
4. Click Sync from PayPal.

## Deploy

The project deploys as one free Render web service with a free Supabase database. The steps are in `DEPLOY.md` if present, or follow the same order: push to GitHub, create the Render service, set the environment variables, register the webhook, and add a free uptime monitor.

## Known limits

- Sandbox only. Nothing here moves real money.
- A webhook belongs to one PayPal app, so only the owner's workspace gets live events. Other sellers use the Sync button.
- Asking sellers to paste their own Sandbox keys suits testing. A production version would use PayPal's partner onboarding instead.
- The free hosting tier sleeps after a period of inactivity, so the first visit can take up to a minute.
- Evidence checklists are working assumptions. Verify them against PayPal's seller documentation. The completeness figure is the share of required items found and is not a chance of winning.

## License

See `LICENSE`.