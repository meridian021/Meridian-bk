const mongoose = require('mongoose');

const fixedDepositSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  principal: { type: Number, required: true },
  currency: { type: String, required: true },
  durationDays: { type: Number, required: true },
  interestRate: { type: Number, required: true }, // simple illustrative rate for the term

  maturityDate: { type: Date, required: true },
  estimatedMaturityAmount: { type: Number, required: true },

  status: {
    type: String,
    enum: ['pending', 'active', 'matured', 'cancelled'],
    default: 'pending'
  }
}, { timestamps: true });

module.exports = mongoose.model('FixedDeposit', fixedDepositSchema);
