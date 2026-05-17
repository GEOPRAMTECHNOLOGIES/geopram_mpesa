/**
 * api/payments/initiate.js
 * POST /api/payments/initiate
 * Initiates a Safaricom Daraja STK Push and saves a PENDING transaction.
 */
const axios       = require('axios');
const connectDB   = require('../../lib/db');
const Transaction = require('../../lib/Transaction');
const { getDarajaToken, buildStkPassword, normalisePhone } = require('../../lib/mpesa');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed.' });

  try {
    const { fullName, email, phone, amount } = req.body || {};

    if (!fullName || !email || !phone || !amount) {
      return res.status(400).json({ message: 'fullName, email, phone and amount are all required.' });
    }

    const CALLBACK_URL     = process.env.DARAJA_CALLBACK_URL;
    const BUSINESS_SHORT_CODE = process.env.DARAJA_BUSINESS_SHORT_CODE;
    const PARTY_B          = process.env.DARAJA_PARTY_B || BUSINESS_SHORT_CODE;

    if (!CALLBACK_URL) {
      return res.status(500).json({ message: 'DARAJA_CALLBACK_URL is not configured.' });
    }

    const token              = await getDarajaToken();
    const { password, timestamp } = buildStkPassword();
    const sanitisedPhone     = normalisePhone(phone);

    const payload = {
      BusinessShortCode: BUSINESS_SHORT_CODE,
      Password:          password,
      Timestamp:         timestamp,
      TransactionType:   'CustomerPayBillOnline',
      Amount:            Number(amount),
      PartyA:            sanitisedPhone,
      PartyB:            PARTY_B,
      PhoneNumber:       sanitisedPhone,
      CallBackURL:       CALLBACK_URL,
      AccountReference:  'GEOPRAM Services',
      TransactionDesc:   'Payment to GEOPRAM Services',
    };

    const { data } = await axios.post(
      'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      payload,
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );

    const { CheckoutRequestID, MerchantRequestID, ResponseCode, ResponseDescription } = data;

    if (!CheckoutRequestID) {
      return res.status(502).json({ message: 'Unexpected Daraja response.', details: data });
    }

    await connectDB();
    const transaction = new Transaction({
      fullName,
      email,
      phone:             sanitisedPhone,
      amount:            Number(amount),
      checkoutRequestId: CheckoutRequestID,
      merchantRequestId: MerchantRequestID,
      status:            'PENDING',
    });
    await transaction.save();

    return res.status(200).json({
      message:             'STK Push initiated. Please enter your M-Pesa PIN.',
      checkoutRequestId:   CheckoutRequestID,
      merchantRequestId:   MerchantRequestID,
      responseCode:        ResponseCode,
      responseDescription: ResponseDescription,
    });
  } catch (err) {
    console.error('STK initiate error:', err.response?.data || err.message);
    return res.status(500).json({
      message: 'Failed to initiate STK Push.',
      error:   err.response?.data || err.message,
    });
  }
};
