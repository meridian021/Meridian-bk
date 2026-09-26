const Account = require("../models/Account");
const CryptoDeposit = require("../models/CryptoDeposit");
const User = require("../models/User");
const SystemSetting = require("../models/SystemSetting");
const { applyCredit } = require("./transactionService");
const { sendEmail } = require("./emailService");

async function createDeposit(userId, { network, amount, txReference }) {
  const settings = await SystemSetting.getSettings();
  const depositAddressUsed = settings.cryptoAddresses[network];

  if (!depositAddressUsed) {
    const err = new Error("Invalid network");
    err.status = 400;
    err.publicMessage = "Please choose a valid network.";
    throw err;
  }

  const numericAmount = Number(amount);
  if (!numericAmount || numericAmount <= 0) {
    const err = new Error("Invalid amount");
    err.status = 400;
    err.publicMessage = "Enter a valid deposit amount.";
    throw err;
  }

  return CryptoDeposit.create({
    userId,
    network,
    depositAddressUsed,
    amount: numericAmount,
    txReference,
    status: "pending",
  });
}

async function approveDeposit(depositId) {
  const deposit = await CryptoDeposit.findById(depositId);
  if (!deposit) throw new Error("Deposit not found");
  const user = await User.findById(deposit.userId);
  const account = await Account.findOne({ userId: deposit.userId });

  const { transaction } = await applyCredit({
    userId: deposit.userId,
    amount: deposit.amount,
    type: "crypto_deposit",
    description: `Crypto deposit (${deposit.network})`,
    reference: deposit.txReference,
  });

  deposit.status = "approved";
  deposit.transactionId = transaction._id;
  deposit.currencyEquivalent = deposit.amount; // 1:1 demo conversion — no live FX/crypto pricing
  await deposit.save();

  await sendEmail({
    to: user.email,
    subject: "Your crypto deposit has been approved",
    html: `<p>Hi ${user.firstName}, your ${deposit.network} deposit has been approved and credited to your account.</p>`,
  });

  return deposit;
}

async function rejectDeposit(depositId, reason) {
  const deposit = await CryptoDeposit.findById(depositId);
  if (!deposit) throw new Error("Deposit not found");
  const user = await User.findById(deposit.userId);

  deposit.status = "rejected";
  await deposit.save();

  await sendEmail({
    to: user.email,
    subject: "Your crypto deposit was not approved",
    html: `<p>Hi ${user.firstName}, your ${deposit.network} deposit could not be verified.</p><p>Reason: ${reason || "Not specified"}</p>`,
  });

  return deposit;
}

module.exports = { createDeposit, approveDeposit, rejectDeposit };
