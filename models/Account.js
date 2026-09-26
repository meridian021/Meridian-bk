const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },

  accountNumber: { type: String, required: true, unique: true },
  country: { type: String, required: true },
  currency: { type: String, required: true },

  tier: { type: Number, enum: [1, 2, 3], default: 1 },

  status: {
    type: String,
    enum: ['pending', 'active', 'suspended', 'frozen', 'closed'],
    default: 'pending'
  },

  // The backend is the sole source of truth for these three fields.
  // Never trust a balance value coming from a request body.
  availableBalance: { type: Number, default: 0 },
  lockedBalance: { type: Number, default: 0 },
  totalBalance: { type: Number, default: 0 },

  dailyLimit: { type: Number, default: 2000 },
  monthlyLimit: { type: Number, default: 20000 }
}, { timestamps: true });

// Keep totalBalance consistent whenever available/locked change via .save()
accountSchema.pre('save', function (next) {
  this.totalBalance = this.availableBalance + this.lockedBalance;
  next();
});

module.exports = mongoose.model('Account', accountSchema);
