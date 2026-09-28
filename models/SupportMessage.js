const mongoose = require("mongoose");

const supportMessageSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // empty for public Contact Us visitors
    source: { type: String, enum: ["support", "contact"], required: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    category: { type: String },
    subject: { type: String, required: true },
    message: { type: String, required: true },
    emailSent: { type: Boolean, default: false },
  },
  { timestamps: true },
);

module.exports = mongoose.model("SupportMessage", supportMessageSchema);
