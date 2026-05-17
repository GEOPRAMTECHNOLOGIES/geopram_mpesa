/**
 * api/admin/summary.js
 * GET /api/admin/summary
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
    await connectDB();
    const [totalSuccess, totalFailed, totalPending] = await Promise.all([
      Transaction.countDocuments({ status: 'SUCCESS' }),
      Transaction.countDocuments({ status: 'FAILED' }),
      Transaction.countDocuments({ status: 'PENDING' }),
    ]);
    return res.status(200).json({ totalSuccess, totalFailed, totalPending });
  } catch (err) {
    console.error('Summary error:', err.message);
    return res.status(500).json({ message: 'Failed to load summary.' });
  }
};
