const express = require('express');
const { authenticateAdmin } = require('./auth');
const Transaction = require('../models/Transaction');

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
