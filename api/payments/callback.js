/**
 * api/payments/callback.js
 * POST /api/payments/callback
 * Receives Safaricom Daraja STK Push result and updates the transaction record.
 */
const connectDB   = require('../../lib/db');
const Transaction = require('../../lib/Transaction');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const stkCallback = req.body?.Body?.stkCallback;
    if (!stkCallback) {
      return res.status(400).json({ message: 'Invalid callback payload.' });
    }

    const {
      ResultCode,
      ResultDesc,
      CheckoutRequestID,
      MerchantRequestID,
      CallbackMetadata,
    } = stkCallback;

    const items        = CallbackMetadata?.Item || [];
    const find         = (name) => items.find((i) => i.Name === name)?.Value ?? null;
    const receiptNumber = find('MpesaReceiptNumber');
    const amount        = find('Amount');
    const phone         = find('PhoneNumber');

    await connectDB();
    const transaction = await Transaction.findOne({ checkoutRequestId: CheckoutRequestID });

    if (!transaction) {
      console.warn('Callback: no transaction found for', CheckoutRequestID);
      // Still return 200 to prevent Safaricom retry flood
      return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    transaction.merchantRequestId  = MerchantRequestID  || transaction.merchantRequestId;
    transaction.status             = ResultCode === 0 ? 'SUCCESS' : 'FAILED';
    transaction.resultCode         = ResultCode;
    transaction.resultDesc         = ResultDesc;
    transaction.receiptNumber      = receiptNumber ?? transaction.receiptNumber;
    transaction.amount             = amount        ?? transaction.amount;
    transaction.phone              = phone         ?? transaction.phone;
    transaction.callbackReceivedAt = new Date();
    await transaction.save();

    console.log(`Callback processed: ${transaction.status} — ${CheckoutRequestID}`);
    return res.status(200).json({ ResultCode: 0, ResultDesc: 'Success' });
  } catch (err) {
    console.error('Callback error:', err.message);
    // Return 200 so Safaricom does not keep retrying
    return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }
};
