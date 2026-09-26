const mongoose = require('mongoose');

const cryptoDepositSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  network: { type: String, enum: ['bitcoin', 'ethereum', 'usdt'], required: true },
  depositAddressUsed: { type: String, required: true },

  amount: { type: Number, required: true },
  currencyEquivalent: { type: Number },
  txReference: { type: String },

  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' }
}, { timestamps: true });

module.exports = mongoose.model('CryptoDeposit', cryptoDepositSchema);
