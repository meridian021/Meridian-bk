const mongoose = require("mongoose");

// One-time: accounts that existed before email verification count as verified,
// so nobody already registered gets locked out. The flag stops this from ever
// running again, so new signups still have to enter their emailed code.
async function grandfatherExistingUsers() {
  const User = require("../models/User");
  const SystemSetting = require("../models/SystemSetting");

  const settings = await SystemSetting.getSettings();
  if (!settings.emailVerificationGrandfathered) {
    await User.updateMany(
      { emailVerified: { $ne: true } },
      { emailVerified: true },
    );
    settings.emailVerificationGrandfathered = true;
    await settings.save();
    console.log("Existing accounts marked as email-verified (one-time).");
  }
}

async function connectDB() {
  if (!process.env.MONGODB_URI) {
    console.error(
      "MONGODB_URI is not set. Add it to your .env file (or Render environment variables).",
    );
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  }

  try {
    await grandfatherExistingUsers();
  } catch (err) {
    // Not fatal, but existing users would be asked to verify if this fails.
    console.error("Could not mark existing accounts as verified:", err.message);
  }
}

module.exports = connectDB;
