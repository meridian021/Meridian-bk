const mongoose = require("mongoose");

// Deliberately a singleton collection: there should only ever be one document.
// Fetch it with SystemSetting.getSettings() defined below.
const systemSettingSchema = new mongoose.Schema(
  {
    bankName: { type: String, default: "Meridian Bank" },
    supportEmail: { type: String, default: "support@meridianbank.demo" },
    emailVerificationGrandfathered: { type: Boolean, default: false },
    cardFee: { type: Number, default: 25 },
    lockedFundDailyInterestRate: { type: Number, default: 0.003 },
    earlyWithdrawalChargeRate: { type: Number, default: 0.1 },

    tierLimits: {
      tier1: {
        daily: { type: Number, default: 2000 },
        monthly: { type: Number, default: 10000 },
      },
      tier2: {
        daily: { type: Number, default: 10000 },
        monthly: { type: Number, default: 50000 },
      },
      tier3: {
        daily: { type: Number, default: 100000 },
        monthly: { type: Number, default: 1000000 },
      },
    },

    cryptoAddresses: {
      bitcoin: { type: String, default: "bc1q-demo-address-0000000000000000" },
      ethereum: {
        type: String,
        default: "0xDEMO00000000000000000000000000000000",
      },
      usdt: { type: String, default: "T-demo-usdt-address-0000000000000" },
    },
  },
  { timestamps: true },
);

systemSettingSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

module.exports = mongoose.model("SystemSetting", systemSettingSchema);
