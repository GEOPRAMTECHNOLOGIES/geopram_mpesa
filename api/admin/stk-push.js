/**
 * api/admin/stk-push.js
 * POST /api/admin/stk-push
 * Allows admin to trigger an STK push directly from the dashboard.
 */
const axios                = require('axios');
const connectDB            = require('../../lib/db');
const Transaction          = require('../../lib/Transaction');
const { verifyAdminToken } = require('../../lib/auth');
const { getDarajaToken, buildStkPassword, normalisePhone } = require('../../lib/mpesa');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed.' });

  try {
    verifyAdminToken(req);
  } catch (err) {
    return res.status(err.status || 401).json({ message: err.message });
  }

  try {
    const { phoneNumber, amount, accountReference, transactionDesc } = req.body || {};

    if (!phoneNumber || !amount) {
      return res.status(400).json({ message: 'phoneNumber and amount are required.' });
    }

    const BUSINESS_SHORT_CODE = process.env.DARAJA_BUSINESS_SHORT_CODE;
    const PARTY_B             = process.env.DARAJA_PARTY_B || BUSINESS_SHORT_CODE;
    const CALLBACK_URL        = process.env.DARAJA_CALLBACK_URL;

    const formattedPhone      = normalisePhone(phoneNumber);
    const token               = await getDarajaToken();
    const { password, timestamp } = buildStkPassword();

    const payload = {
      BusinessShortCode: BUSINESS_SHORT_CODE,
      Password:          password,
      Timestamp:         timestamp,
      TransactionType:   'CustomerPayBillOnline',
      Amount:            Number(amount),
      PartyA:            formattedPhone,
      PartyB:            PARTY_B,
      PhoneNumber:       formattedPhone,
      CallBackURL:       CALLBACK_URL,
      AccountReference:  accountReference || 'GEOPRAM',
      TransactionDesc:   transactionDesc  || 'Payment for services',
    };

    const { data } = await axios.post(
      'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      payload,
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );

    await connectDB();
    const transaction = new Transaction({
      fullName:          'Admin STK Push',
      email:             'admin@geopram.co.ke',
      phone:             formattedPhone,
      amount:            Number(amount),
      checkoutRequestId: data.CheckoutRequestID,
      merchantRequestId: data.MerchantRequestID,
      status:            'PENDING',
      resultDesc:        'Admin-initiated STK Push, awaiting customer confirmation.',
    });
    await transaction.save();

    return res.status(200).json({
      message:           'STK Push sent successfully.',
      checkoutRequestID: data.CheckoutRequestID,
      merchantRequestID: data.MerchantRequestID,
      customerMessage:   data.CustomerMessage,
    });
  } catch (err) {
    console.error('Admin STK Push error:', err.response?.data || err.message);
    return res.status(500).json({
      message: 'Failed to send STK Push.',
      error:   err.response?.data?.errorMessage || err.message || 'Unknown error',
    });
  }
};
