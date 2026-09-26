const mongoose = require('mongoose');

const kycApplicationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tierRequested: { type: Number, enum: [2, 3], required: true },

  // Freeform answers collected for this tier, shaped by config/countryRules.js
  submittedInfo: { type: mongoose.Schema.Types.Mixed },

  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'more_info_required'],
    default: 'pending'
  },
  reviewNote: { type: String },
  reviewedAt: { type: Date },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('KYCApplication', kycApplicationSchema);
