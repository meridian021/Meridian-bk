const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    transactionId: { type: String, required: true, unique: true },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    type: {
      type: String,
      enum: [
        "internal_transfer",
        "external_transfer",
        "crypto_deposit",
        "card_fee",
        "card_topup",
        "admin_credit",
        "admin_debit",
        "fixed_deposit",
        "locked_fund",
        "locked_fund_unlock",
        "early_withdrawal_fee",
      ],
      required: true,
    },

    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    description: { type: String },
    reference: { type: String },

    status: {
      type: String,
      enum: ["pending", "successful", "failed", "reversed"],
      default: "pending",
    },

    approvedAt: { type: Date },
    completedAt: { type: Date },

    recipient: { type: String },
    sender: { type: String },
    method: { type: String },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Transaction", transactionSchema);
