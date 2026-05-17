# GEOPRAM M-Pesa STK Push — Vercel Serverless

Node.js M-Pesa STK Push app rebuilt for **Vercel serverless** deployment. Each route is an independent serverless function — no Express server, no `server.js`.

## Project Structure

```
├── api/
│   ├── payments/
│   │   ├── initiate.js     POST  /api/payments/initiate
│   │   ├── callback.js     POST  /api/payments/callback
│   │   └── status.js       GET   /api/payments/status/:id
│   └── admin/
│       ├── login.js        POST  /api/admin/login
│       ├── transactions.js GET   /api/admin/transactions
│       ├── summary.js      GET   /api/admin/summary
│       ├── export.js       GET   /api/admin/export
│       └── stk-push.js     POST  /api/admin/stk-push
├── lib/
│   ├── db.js               Cached Mongoose connection
│   ├── Transaction.js      Mongoose model
│   ├── mpesa.js            Daraja helpers
│   └── auth.js             JWT helpers
├── public/
│   ├── index.html          Payment page  →  /
│   ├── payment.js
│   ├── admin.html          Admin dashboard  →  /admin
│   └── admin.js
├── vercel.json             Route config
├── package.json
└── .env.example
```

## Deploy to Vercel

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "feat: vercel serverless M-Pesa app"
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git push -u origin main
```

### 2. Import into Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import your GitHub repo
3. Leave **Framework Preset** as **Other**
4. Click **Deploy** (first deploy will fail — add env vars next)

### 3. Set Environment Variables

In Vercel → Project → **Settings → Environment Variables**, add:

| Variable | Value |
|---|---|
| `DARAJA_CONSUMER_KEY` | from Safaricom Daraja portal |
| `DARAJA_CONSUMER_SECRET` | from Safaricom Daraja portal |
| `DARAJA_BUSINESS_SHORT_CODE` | `4574727` |
| `DARAJA_PARTY_B` | `8112723` (if different from shortcode) |
| `DARAJA_PASSKEY` | from Safaricom Daraja portal |
| `DARAJA_CALLBACK_URL` | `https://your-project.vercel.app/api/payments/callback` |
| `MONGO_URI` | your MongoDB Atlas connection string |
| `ADMIN_USERNAME` | your admin username |
| `ADMIN_PASSWORD` | your admin password |
| `JWT_SECRET` | a long random string (32+ chars) |

### 4. Redeploy

After adding env vars, trigger a **Redeploy** in Vercel.

## Pages

- **Payment page**: `https://your-project.vercel.app/`
- **Admin dashboard**: `https://your-project.vercel.app/admin`

## Important Notes

- `DARAJA_CALLBACK_URL` **must** be your live Vercel HTTPS URL — Safaricom cannot reach `localhost`.
- The Mongoose connection is cached per serverless instance to avoid connection exhaustion.
- Safaricom always expects a `200 OK` from the callback endpoint — the code always returns one.
