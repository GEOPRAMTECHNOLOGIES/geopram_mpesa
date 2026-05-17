/**
 * lib/mpesa.js
 * Shared Safaricom Daraja API helpers.
 */
const axios = require('axios');

const DARAJA_BASE = 'https://api.safaricom.co.ke';

/**
 * Fetches a fresh OAuth access token from the Daraja API.
 */
async function getDarajaToken() {
  const key    = process.env.DARAJA_CONSUMER_KEY;
  const secret = process.env.DARAJA_CONSUMER_SECRET;
  if (!key || !secret) throw new Error('Daraja consumer credentials not configured.');

  const auth = Buffer.from(`${key}:${secret}`).toString('base64');
  const { data } = await axios.get(
    `${DARAJA_BASE}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${auth}` } }
  );
  if (!data.access_token) throw new Error('No access_token in Daraja response.');
  return data.access_token;
}

/**
 * Generates the base64 STK Push password and matching timestamp.
 */
function buildStkPassword() {
  const shortCode = process.env.DARAJA_BUSINESS_SHORT_CODE;
  const passkey   = process.env.DARAJA_PASSKEY;
  if (!shortCode || !passkey) throw new Error('DARAJA_BUSINESS_SHORT_CODE or DARAJA_PASSKEY not set.');

  const timestamp = new Date()
    .toISOString()
    .replace(/[^0-9]/g, '')
    .slice(0, 14);

  const password = Buffer.from(`${shortCode}${passkey}${timestamp}`).toString('base64');
  return { password, timestamp };
}

/**
 * Normalises a phone number to 254XXXXXXXXX format.
 */
function normalisePhone(raw) {
  const digits = String(raw).replace(/\D/g, '');
  if (digits.startsWith('254')) return digits;
  if (digits.startsWith('0'))   return '254' + digits.slice(1);
  return '254' + digits;
}

module.exports = { getDarajaToken, buildStkPassword, normalisePhone, DARAJA_BASE };
