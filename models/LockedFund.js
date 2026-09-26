const mongoose = require('mongoose');

const lockedFundSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  principal: { type: Number, required: true },
  currency: { type: String, required: true },
  dailyInterestRate: { type: Number, default: 0.003 }, // 0.3% illustrative daily rate

  lockDate: { type: Date, default: Date.now },
  unlockDate: { type: Date, required: true },

  accruedInterest: { type: Number, default: 0 },
  lastAccrualDate: { type: Date, default: Date.now },

  status: {
    type: String,
    enum: ['active', 'unlocked', 'early_withdrawal_pending', 'early_withdrawal_completed'],
    default: 'active'
  },

  earlyWithdrawalChargeRate: { type: Number, default: 0.10 }, // 10% demo fee
  earlyWithdrawalFeeTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' }
}, { timestamps: true });

module.exports = mongoose.model('LockedFund', lockedFundSchema);
