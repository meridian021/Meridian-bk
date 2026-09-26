const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    kycApplicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "KYCApplication",
    },

    documentType: {
      type: String,
      enum: [
        "government_id",
        "proof_of_address",
        "passport_photo",
        "card_image",
        "other",
      ],
      required: true,
    },

    // Stored directly in MongoDB (not on disk) because Render's free tier
    // wipes local disk on every restart/redeploy.
    fileData: { type: Buffer, required: true },
    mimeType: { type: String, required: true },
    originalName: { type: String },
    fileSize: { type: Number },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    rejectionReason: { type: String },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Document", documentSchema);
