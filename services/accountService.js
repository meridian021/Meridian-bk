const Account = require('../models/Account');
const { getCurrencyForCountry } = require('../config/countryRules');
const SystemSetting = require('../models/SystemSetting');

/** Generates a plausible-looking demo account number. Not a real bank routing scheme. */
function generateAccountNumber() {
  const digits = Math.floor(1000000000 + Math.random() * 8999999999);
  return `MB${digits}`;
}

async function createAccountForUser(user) {
  const settings = await SystemSetting.getSettings();
  const currency = getCurrencyForCountry(user.country);

  let accountNumber = generateAccountNumber();
  // Extremely unlikely to collide, but guard against it anyway.
  while (await Account.findOne({ accountNumber })) {
    accountNumber = generateAccountNumber();
  }

  const account = await Account.create({
    userId: user._id,
    accountNumber,
    country: user.country,
    currency,
    tier: 1,
    status: 'pending',
    availableBalance: 0,
    lockedBalance: 0,
    totalBalance: 0,
    dailyLimit: settings.tierLimits.tier1.daily,
    monthlyLimit: settings.tierLimits.tier1.monthly
  });

  return account;
}

module.exports = { generateAccountNumber, createAccountForUser };
