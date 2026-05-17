# GEOPRAM M-Pesa STK Push Backend

This repository contains a Node.js backend and browser client for GEOPRAM Services to initiate Safaricom Daraja STK Push payments, receive M-Pesa callback responses, and display admin transaction records.

## Features

- Initiate M-Pesa STK Push using Short Code `4574727` and Till Number `8112723`
- Store transaction data before payment and update records after callback
- `/callback` endpoint to receive Safaricom Daraja payment results
- Transaction status polling for real-time confirmation in the browser
- Admin dashboard with search, filter, export, and summary views
- MongoDB persistence via Mongoose
- Admin login protected with JWT

## Setup

1. Copy `.env.example` to `.env`.
2. Configure the required values:
   - `MONGO_URI`
   - `DARAJA_CONSUMER_KEY`
   - `DARAJA_CONSUMER_SECRET`
   - `DARAJA_PASSKEY`
   - `DARAJA_CALLBACK_URL`
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD`
   - `JWT_SECRET`
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the server:
   ```bash
   npm run dev
   ```

## API Endpoints

- `POST /api/payments/initiate` — initiate STK Push
- `POST /api/payments/callback` — receive Daraja callback
- `GET /api/payments/status/:checkoutRequestId` — get current payment status
- `POST /api/admin/login` — authenticate admin
- `GET /api/admin/transactions` — list admin transactions
- `GET /api/admin/summary` — transaction counts
- `GET /api/admin/export` — export transactions to CSV

## Frontend

- Payment page: `/`
- Admin dashboard: `/admin`

## Important Notes

- Your callback URL must be HTTPS and accessible by Safaricom.
- Make sure your Daraja app is configured for production with Lipa Na M-Pesa active.
- The backend stores both successful and failed payments, using `ResultCode` to determine status.
