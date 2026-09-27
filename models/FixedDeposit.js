const mongoose = require("mongoose");

const fixedDepositSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    principal: { type: Number, required: true },
    currency: { type: String, required: true },
    durationDays: { type: Number, required: true },
    dailyInterestRate: { type: Number, default: 0.003 }, // 0.3% illustrative daily rate

    maturityDate: { type: Date, required: true },
    accruedInterest: { type: Number, default: 0 },
    lastInterestDate: { type: Date, default: Date.now },

    status: {
      type: String,
      enum: [
        "active",
        "matured",
        "held",
        "early_withdrawal_pending",
        "early_withdrawal_completed",
        "cancelled",
      ],
      default: "active",
    },
    holdReason: { type: String },

    earlyWithdrawalFeeRate: { type: Number, default: 0.1 },
    earlyWithdrawalFeeAmount: { type: Number },
    feeCryptoDepositId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CryptoDeposit",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("FixedDeposit", fixedDepositSchema);
