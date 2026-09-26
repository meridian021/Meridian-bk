const mongoose = require('mongoose');

const cardSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  cardNumberMasked: { type: String },   // e.g. •••• 4821, generated on approval
  expiryDate: { type: String },
  cvvHash: { type: String },

  feeAmount: { type: Number },
  feeTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
  feePaid: { type: Boolean, default: false },

  status: {
    type: String,
    enum: ['requested', 'approved', 'rejected', 'delayed', 'shipped', 'delivered', 'activated'],
    default: 'requested'
  },
  delayReason: { type: String },
  expectedDeliveryDate: { type: Date },

  pinHash: { type: String },
  pinCreatedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Card', cardSchema);
