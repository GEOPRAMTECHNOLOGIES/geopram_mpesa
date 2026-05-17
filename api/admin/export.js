/**
 * api/admin/export.js
 * GET /api/admin/export?format=csv
 */
const connectDB            = require('../../lib/db');
const Transaction          = require('../../lib/Transaction');
const { verifyAdminToken } = require('../../lib/auth');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed.' });

  try {
    verifyAdminToken(req);
  } catch (err) {
    return res.status(err.status || 401).json({ message: err.message });
  }

  try {
    const { status, search } = req.query;
    const filter = {};

    if (['SUCCESS', 'FAILED', 'PENDING'].includes(status)) filter.status = status;
    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email:    { $regex: search, $options: 'i' } },
        { phone:    { $regex: search, $options: 'i' } },
      ];
    }

    await connectDB();
    const transactions = await Transaction.find(filter).sort({ createdAt: -1 });

    const header = ['Full Name','Email','Phone','Amount','Receipt Number','Status','Result Code','Result Description','Date & Time'];
    const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows   = transactions.map((tx) => [
      tx.fullName,
      tx.email,
      tx.phone,
      tx.amount,
      tx.receiptNumber || '',
      tx.status,
      tx.resultCode ?? '',
      tx.resultDesc  || '',
      tx.callbackReceivedAt ? tx.callbackReceivedAt.toISOString() : tx.createdAt.toISOString(),
    ].map(escape).join(','));

    const csv = [header.map(escape).join(','), ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="geopram_transactions.csv"');
    return res.status(200).send(csv);
  } catch (err) {
    console.error('Export error:', err.message);
    return res.status(500).json({ message: 'Failed to export transactions.' });
  }
};
