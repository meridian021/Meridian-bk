const mongoose = require("mongoose");

// Demo note: codes are stored in plain text on purpose, so you can read them
// from the admin "Email Codes" page. Old codes delete themselves after 7 days.
const emailCodeSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  purpose: {
    type: String,
    enum: ["verify_email", "reset_password"],
    required: true,
  },
  code: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  attempts: { type: Number, default: 0 },
  used: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 7 },
});

module.exports = mongoose.model("EmailCode", emailCodeSchema);
