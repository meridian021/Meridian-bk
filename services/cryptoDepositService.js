const Account = require("../models/Account");
const CryptoDeposit = require("../models/CryptoDeposit");
const User = require("../models/User");
const SystemSetting = require("../models/SystemSetting");
const { applyCredit } = require("./transactionService");
const { sendEmail } = require("./emailService");
const fixedDepositService = require("./fixedDepositService");
const lockedFundsService = require("./lockedFundsService");

async function createDeposit(
  userId,
  { network, amount, txReference, purpose, feeForModel, feeForId },
) {
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
    err.publicMessage = "Enter a valid amount.";
    throw err;
  }

  return CryptoDeposit.create({
    userId,
    network,
    depositAddressUsed,
    amount: numericAmount,
    txReference,
    purpose:
      purpose === "early_withdrawal_fee" ? "early_withdrawal_fee" : "topup",
    feeForModel: feeForModel || undefined,
    feeForId: feeForId || undefined,
    status: "pending",
  });
}

async function approveDeposit(depositId) {
  const deposit = await CryptoDeposit.findById(depositId);
  if (!deposit) throw new Error("Deposit not found");
  const user = await User.findById(deposit.userId);

  if (deposit.purpose === "early_withdrawal_fee") {
    // This crypto payment is a fee paid TO the bank — it does not credit
    // the customer's balance. It just unlocks the related early withdrawal.
    if (deposit.feeForModel === "FixedDeposit") {
      await fixedDepositService.completeEarlyWithdrawal(deposit.feeForId);
    } else if (deposit.feeForModel === "LockedFund") {
      await lockedFundsService.completeEarlyWithdrawal(deposit.feeForId);
    }

    deposit.status = "approved";
    await deposit.save();

    await sendEmail({
      to: user.email,
      subject: "Early withdrawal fee confirmed",
      html: `<p>Hi ${user.firstName}, we've confirmed your early withdrawal fee payment and released your funds.</p>`,
    });

    return deposit;
  }

  // Normal top-up path
  const { transaction } = await applyCredit({
    userId: deposit.userId,
    amount: deposit.amount,
    type: "crypto_deposit",
    description: `Crypto deposit (${deposit.network})`,
    reference: deposit.txReference,
  });

  deposit.status = "approved";
  deposit.transactionId = transaction._id;
  deposit.currencyEquivalent = deposit.amount;
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
    subject:
      deposit.purpose === "early_withdrawal_fee"
        ? "Fee payment not confirmed"
        : "Your crypto deposit was not approved",
    html: `<p>Hi ${user.firstName}, this could not be verified.</p><p>Reason: ${reason || "Not specified"}</p>`,
  });

  return deposit;
}

module.exports = { createDeposit, approveDeposit, rejectDeposit };
