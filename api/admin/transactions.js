/**
 * api/admin/transactions.js
 * GET /api/admin/transactions
 */
const connectDB         = require('../../lib/db');
const Transaction       = require('../../lib/Transaction');
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
    const { status, search, page = 1, limit = 50 } = req.query;
    const filter = {};

    if (['SUCCESS', 'FAILED', 'PENDING'].includes(status)) filter.status = status;

    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email:    { $regex: search, $options: 'i' } },
        { phone:    { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    await connectDB();
    const [transactions, total] = await Promise.all([
      Transaction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      Transaction.countDocuments(filter),
    ]);

    return res.status(200).json({ transactions, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error('Transactions error:', err.message);
    return res.status(500).json({ message: 'Failed to load transactions.' });
  }
};
