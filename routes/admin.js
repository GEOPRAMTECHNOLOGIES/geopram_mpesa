const express = require('express');
const { authenticateAdmin } = require('./auth');
const Transaction = require('../models/Transaction');
const axios = require('axios'); // For making HTTP requests to M-Pesa API

const router = express.Router();

router.get('/transactions', authenticateAdmin, async (req, res) => {
  try {
    const { status, search, page = 1, limit = 50 } = req.query;
    const filter = {};

    if (status === 'SUCCESS' || status === 'FAILED' || status === 'PENDING') {
      filter.status = status;
    }

    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const transactions = await Transaction.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Transaction.countDocuments(filter);

    res.json({ transactions, total, page: Number(page), limit: Number(limit) });
  } catch (error) {
    console.error('Admin transactions error:', error.message || error);
    res.status(500).json({ message: 'Failed to load transactions.' });
  }
});

router.get('/summary', authenticateAdmin, async (req, res) => {
  try {
    const totalSuccess = await Transaction.countDocuments({ status: 'SUCCESS' });
    const totalFailed = await Transaction.countDocuments({ status: 'FAILED' });
    const totalPending = await Transaction.countDocuments({ status: 'PENDING' });
    res.json({ totalSuccess, totalFailed, totalPending });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load summary.' });
  }
});

router.post('/stk-push', authenticateAdmin, async (req, res) => {
  try {
    const { phoneNumber, amount, accountReference, transactionDesc } = req.body;
    
    // Validate required fields
    if (!phoneNumber || !amount) {
      return res.status(400).json({ 
        message: 'Phone number and amount are required' 
      });
    }
    
    // Format phone number (ensure it starts with 254)
    const formattedPhoneNumber = phoneNumber.startsWith('0') 
      ? '254' + phoneNumber.substring(1) 
      : phoneNumber.startsWith('254') 
        ? phoneNumber 
        : '254' + phoneNumber;
    
    // M-Pesa STK Push request
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
    const password = Buffer.from(
      process.env.DARAJA_BUSINESS_SHORT_CODE + 
      process.env.DARAJA_PASSKEY + 
      timestamp
    ).toString('base64');
    
    const stkPushPayload = {
      BusinessShortCode: process.env.DARAJA_BUSINESS_SHORT_CODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: formattedPhoneNumber,
      PartyB: process.env.DARAJA_PARTY_B || process.env.DARAJA_BUSINESS_SHORT_CODE,
      PhoneNumber: formattedPhoneNumber,
      CallBackURL: `${process.env.BASE_URL || ''}/api/mpesa/callback`,
      AccountReference: accountReference || 'GEOPRAM',
      TransactionDesc: transactionDesc || 'Payment for services'
    };
    
    // Get access token first
    const auth = Buffer.from(
      `${process.env.DARAJA_CONSUMER_KEY}:${process.env.DARAJA_CONSUMER_SECRET}`
    ).toString('base64');
    
    const tokenResponse = await axios.get(
      'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
      {
        headers: {
          Authorization: `Basic ${auth}`
        }
      }
    );
    
    const accessToken = tokenResponse.data.access_token;
    
    // Send STK push
    const stkResponse = await axios.post(
      'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      stkPushPayload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    // Log the transaction
    const transaction = new Transaction({
      fullName: 'STK Push Customer',
      email: 'customer@geopram.co.ke',
      phone: formattedPhoneNumber,
      amount: Number(amount),
      receiptNumber: '',
      status: 'PENDING',
      resultCode: null,
      resultDesc: 'STK Push sent, awaiting customer response',
      callbackReceivedAt: new Date()
    });
    
    await transaction.save();
    
    res.json({
      message: 'STK Push sent successfully',
      checkoutRequestID: stkResponse.data.CheckoutRequestID,
      merchantRequestID: stkResponse.data.MerchantRequestID,
      customerMessage: stkResponse.data.CustomerMessage
    });
  } catch (error) {
    console.error('STK Push error:', error.response?.data || error.message || error);
    res.status(500).json({ 
      message: 'Failed to send STK Push',
      error: error.response?.data?.errorMessage || error.message || 'Unknown error'
    });
  }
});

router.get('/export', authenticateAdmin, async (req, res) => {
  try {
    const { format = 'csv', status, search } = req.query;
    const filter = {};

    if (status === 'SUCCESS' || status === 'FAILED' || status === 'PENDING') {
      filter.status = status;
    }
    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    const transactions = await Transaction.find(filter).sort({ createdAt: -1 });

    if (format === 'csv') {
      const header = [
        'Full Name',
        'Email',
        'Phone',
        'Amount',
        'Receipt Number',
        'Status',
        'Result Code',
        'Result Description',
        'Date & Time',
      ];
      const rows = transactions.map((tx) => [
        tx.fullName,
        tx.email,
        tx.phone,
        tx.amount,
        tx.receiptNumber || '',
        tx.status,
        tx.resultCode ?? '',
        tx.resultDesc || '',
        tx.callbackReceivedAt ? tx.callbackReceivedAt.toISOString() : tx.createdAt.toISOString(),
      ]);

      const csv = [header.join(','), ...rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))].join('\n');
      res.header('Content-Type', 'text/csv');
      res.attachment('geopram_transactions.csv');
      return res.send(csv);
    }

    res.json({ transactions });
  } catch (error) {
    console.error('Export error:', error.message || error);
    res.status(500).json({ message: 'Failed to export transactions.' });
  }
});

module.exports = router;
