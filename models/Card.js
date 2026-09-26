const mongoose = require("mongoose");

const cardSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    shippingAddress: { type: String, required: true },
    feeAmount: { type: Number },
    feeTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
    },
    feePaid: { type: Boolean, default: false },

    status: {
      type: String,
      enum: [
        "requested",
        "approved",
        "rejected",
        "delayed",
        "shipped",
        "delivered",
      ],
      default: "requested",
    },
    delayReason: { type: String },
    expectedDeliveryDate: { type: Date },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Card", cardSchema);
