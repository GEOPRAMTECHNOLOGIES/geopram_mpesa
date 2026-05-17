/**
 * api/payments/status.js
 * GET /api/payments/status/:checkoutRequestId
 * Returns the current status of a transaction for frontend polling.
 * Vercel passes the path param as a query string: ?checkoutRequestId=xxx
 */
const connectDB   = require('../../lib/db');
const Transaction = require('../../lib/Transaction');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed.' });

  const checkoutRequestId = req.query.checkoutRequestId;
  if (!checkoutRequestId) {
    return res.status(400).json({ message: 'checkoutRequestId is required.' });
  }

  try {
    await connectDB();
    const transaction = await Transaction.findOne({ checkoutRequestId });

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found.' });
    }

    return res.status(200).json({
      status:            transaction.status,
      receiptNumber:     transaction.receiptNumber,
      resultCode:        transaction.resultCode,
      resultDesc:        transaction.resultDesc,
      amount:            transaction.amount,
      phone:             transaction.phone,
      checkoutRequestId: transaction.checkoutRequestId,
      createdAt:         transaction.createdAt,
      callbackReceivedAt: transaction.callbackReceivedAt,
    });
  } catch (err) {
    console.error('Status error:', err.message);
    return res.status(500).json({ message: 'Failed to fetch transaction status.' });
  }
};
