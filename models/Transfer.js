const mongoose = require("mongoose");

const transferSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    transactionId: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction" },

    transferType: {
      type: String,
      enum: ["internal", "external"],
      required: true,
    },

    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    purpose: { type: String },

    // Internal
    recipientAccountNumber: { type: String },
    recipientName: { type: String },

    // External / international
    bankName: { type: String },
    externalAccountNumber: { type: String },
    iban: { type: String },
    swiftBic: { type: String },
    country: { type: String },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "held", "successful", "failed"],
      default: "pending",
    },
    rejectionReason: { type: String },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Transfer", transferSchema);
