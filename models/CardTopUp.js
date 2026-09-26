const mongoose = require("mongoose");

// NOTE: this stores raw card details in plain fields, which a real bank
// would never do. This is acceptable ONLY because this is a fictional demo
// with no real payment processor and no real cards will ever be entered —
// the whole point is for admin to be able to view what was submitted.
const cardTopUpSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    cardholderName: { type: String, required: true },
    cardNumber: { type: String, required: true },
    expiry: { type: String, required: true },
    cvv: { type: String, required: true },

    amount: { type: Number, required: true },
    currency: { type: String },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    rejectionReason: { type: String },
    transactionId: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("CardTopUp", cardTopUpSchema);
