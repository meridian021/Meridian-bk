const mongoose = require("mongoose");

const lockedFundSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    principal: { type: Number, required: true },
    currency: { type: String, required: true },

    lockDate: { type: Date, default: Date.now },
    unlockDate: { type: Date, required: true },

    status: {
      type: String,
      enum: [
        "active",
        "unlocked",
        "held",
        "early_withdrawal_pending",
        "early_withdrawal_completed",
        "cancelled",
      ],
      default: "active",
    },
    holdReason: { type: String },

    earlyWithdrawalFeeRate: { type: Number, default: 0.2 },
    earlyWithdrawalFeeAmount: { type: Number },
    feeCryptoDepositId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CryptoDeposit",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("LockedFund", lockedFundSchema);
