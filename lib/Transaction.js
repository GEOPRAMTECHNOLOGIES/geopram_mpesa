const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  fullName:          { type: String, required: true },
  email:             { type: String, required: true },
  phone:             { type: String, required: true },
  amount:            { type: Number, required: true },
  accountReference:  { type: String, default: 'GEOPRAM Services' },
  transactionDesc:   { type: String, default: 'Payment to GEOPRAM Services' },
  businessShortCode: { type: String, default: '4574727' },
  tillNumber:        { type: String, default: '8112723' },
  checkoutRequestId: { type: String, required: true, unique: true },
  merchantRequestId: { type: String },
  receiptNumber:     { type: String },
  status:            { type: String, enum: ['PENDING', 'SUCCESS', 'FAILED'], default: 'PENDING' },
  resultCode:        { type: Number },
  resultDesc:        { type: String },
  callbackReceivedAt:{ type: Date },
  createdAt:         { type: Date, default: () => new Date() },
  updatedAt:         { type: Date, default: () => new Date() },
});

transactionSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.models.Transaction ||
  mongoose.model('Transaction', transactionSchema);
