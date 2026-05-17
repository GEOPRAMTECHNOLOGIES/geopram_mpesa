const express = require('express');
const axios = require('axios');
const Transaction = require('../models/Transaction');

const router = express.Router();

const BUSINESS_SHORT_CODE = '4574727';
const TILL_NUMBER = '8112723';
const CALLBACK_URL = process.env.DARAJA_CALLBACK_URL;
const CONSUMER_KEY = process.env.DARAJA_CONSUMER_KEY;
const CONSUMER_SECRET = process.env.DARAJA_CONSUMER_SECRET;
const PASSKEY = process.env.DARAJA_PASSKEY;

const getDarajaAuthToken = async () => {
  if (!CONSUMER_KEY || !CONSUMER_SECRET) {
    throw new Error('Daraja consumer key and secret are required.');
  }

  const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');
  const response = await axios.get('https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
    headers: {
      Authorization: `Basic ${auth}`,
    },
  });

  return response.data.access_token;
};

const buildStkPushPassword = () => {
  const timestamp = new Date().toISOString().replace(/[-T:\.Z]/g, '').slice(0, 14);
  const password = Buffer.from(`${BUSINESS_SHORT_CODE}${PASSKEY}${timestamp}`).toString('base64');
  return { password, timestamp };
};

router.post('/initiate', async (req, res) => {
  try {
    const { fullName, email, phone, amount } = req.body;

    if (!fullName || !email || !phone || !amount) {
      return res.status(400).json({ message: 'Full name, email, phone and amount are required.' });
    }

    if (!CALLBACK_URL) {
      return res.status(500).json({ message: 'DARAJA_CALLBACK_URL is not configured.' });
    }

    const token = await getDarajaAuthToken();
    const { password, timestamp } = buildStkPushPassword();

    const payload = {
      BusinessShortCode: BUSINESS_SHORT_CODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Number(amount),
      PartyA: phone.replace(/[^0-9]/g, ''),
      PartyB: TILL_NUMBER,
      PhoneNumber: phone.replace(/[^0-9]/g, ''),
      CallBackURL: CALLBACK_URL,
      AccountReference: 'GEOPRAM Services',
      TransactionDesc: 'Payment to GEOPRAM Services',
    };

    const response = await axios.post('https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest', payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const { CheckoutRequestID, MerchantRequestID, ResponseCode, ResponseDescription } = response.data;

    if (!CheckoutRequestID) {
      return res.status(502).json({ message: 'Unexpected Daraja response', details: response.data });
    }

    const transaction = new Transaction({
      fullName,
      email,
      phone,
      amount: Number(amount),
      checkoutRequestId: CheckoutRequestID,
      merchantRequestId: MerchantRequestID,
      status: 'PENDING',
    });
    await transaction.save();

    return res.json({
      message: 'STK Push initiated. Awaiting customer confirmation.',
      checkoutRequestId: CheckoutRequestID,
      merchantRequestId: MerchantRequestID,
      responseCode: ResponseCode,
      responseDescription: ResponseDescription,
    });
  } catch (error) {
    console.error('STK Push initiation failed:', error.response?.data || error.message || error);
    return res.status(500).json({
      message: 'Failed to initiate STK Push.',
      error: error.response?.data || error.message,
    });
  }
});

router.post('/callback', async (req, res) => {
  try {
    const callbackData = req.body;
    console.log('Daraja callback received:', JSON.stringify(callbackData, null, 2));
    const stkCallback = callbackData?.Body?.stkCallback;

    if (!stkCallback) {
      return res.status(400).json({ message: 'Invalid callback body.' });
    }

    const { ResultCode, ResultDesc, CheckoutRequestID, MerchantRequestID, CallbackMetadata } = stkCallback;
    const callbackReceivedAt = new Date();
    const receiptNumber = CallbackMetadata?.Item?.find((item) => item.Name === 'MpesaReceiptNumber')?.Value || null;
    const amount = CallbackMetadata?.Item?.find((item) => item.Name === 'Amount')?.Value || null;
    const phone = CallbackMetadata?.Item?.find((item) => item.Name === 'PhoneNumber')?.Value || null;

    const transaction = await Transaction.findOne({ checkoutRequestId: CheckoutRequestID });

    if (!transaction) {
      console.warn('Callback transaction not found for CheckoutRequestID', CheckoutRequestID);
      return res.status(404).json({ message: 'Transaction not found.' });
    }

    transaction.merchantRequestId = MerchantRequestID || transaction.merchantRequestId;
    transaction.status = ResultCode === 0 ? 'SUCCESS' : 'FAILED';
    transaction.resultCode = ResultCode;
    transaction.resultDesc = ResultDesc;
    transaction.receiptNumber = receiptNumber;
    transaction.amount = amount || transaction.amount;
    transaction.phone = phone || transaction.phone;
    transaction.callbackReceivedAt = callbackReceivedAt;
    await transaction.save();

    // Acknowledge receipt in Daraja format
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Success' });
  } catch (error) {
    console.error('Callback processing error:', error.message || error);
    res.status(500).json({ message: 'Failed to process callback.' });
  }
});

// Simulate Daraja callback for local testing without ngrok or production keys
router.post('/simulate-callback', async (req, res) => {
  try {
    const {
      checkoutRequestId,
      resultCode = 0,
      resultDesc = 'The payment was successful',
      amount = null,
      mpesaReceipt = null,
      phone = null,
    } = req.body;

    if (!checkoutRequestId) {
      return res.status(400).json({ message: 'checkoutRequestId is required to simulate callback.' });
    }

    const transaction = await Transaction.findOne({ checkoutRequestId });
    if (!transaction) return res.status(404).json({ message: 'Transaction not found.' });

    transaction.status = resultCode === 0 ? 'SUCCESS' : 'FAILED';
    transaction.resultCode = resultCode;
    transaction.resultDesc = resultDesc;
    if (amount) transaction.amount = amount;
    if (mpesaReceipt) transaction.receiptNumber = mpesaReceipt;
    if (phone) transaction.phone = phone;
    transaction.callbackReceivedAt = new Date();
    await transaction.save();

    // Return Daraja-style acknowledgement
    return res.status(200).json({ ResultCode: 0, ResultDesc: 'Success' });
  } catch (err) {
    console.error('Simulate callback error:', err);
    return res.status(500).json({ message: 'Failed to simulate callback.' });
  }
});

router.get('/status/:checkoutRequestId', async (req, res) => {
  try {
    const { checkoutRequestId } = req.params;
    const transaction = await Transaction.findOne({ checkoutRequestId });
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found.' });
    }
    res.json({
      status: transaction.status,
      receiptNumber: transaction.receiptNumber,
      resultCode: transaction.resultCode,
      resultDesc: transaction.resultDesc,
      amount: transaction.amount,
      phone: transaction.phone,
      checkoutRequestId: transaction.checkoutRequestId,
      createdAt: transaction.createdAt,
      callbackReceivedAt: transaction.callbackReceivedAt,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch transaction status.' });
  }
});

module.exports = router;
