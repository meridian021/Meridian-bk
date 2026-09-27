const LockedFund = require("../models/LockedFund");
const Account = require("../models/Account");
const Transaction = require("../models/Transaction");
const { generateTransactionId } = require("./transactionService");

async function createLockedFund(userId, { amount, unlockDate }) {
  const account = await Account.findOne({ userId });
  const principal = Number(amount);

  if (!principal || principal <= 0 || principal > account.availableBalance) {
    const err = new Error("Invalid amount");
    err.status = 400;
    err.publicMessage = "Enter an amount you have available.";
    throw err;
  }
  if (new Date(unlockDate) <= new Date()) {
    const err = new Error("Invalid date");
    err.status = 400;
    err.publicMessage = "Unlock date must be in the future.";
    throw err;
  }

  account.availableBalance -= principal;
  account.lockedBalance += principal;
  await account.save();

  return LockedFund.create({
    userId,
    principal,
    currency: account.currency,
    unlockDate: new Date(unlockDate),
    status: "active",
  });
}

// No interest to accrue — just checks whether it's time to unlock.
async function syncLockedFund(lf) {
  if (lf.status !== "active") return lf;

  if (new Date() >= lf.unlockDate) {
    const account = await Account.findOne({ userId: lf.userId });
    account.lockedBalance -= lf.principal;
    account.availableBalance += lf.principal;
    await account.save();

    await Transaction.create({
      transactionId: generateTransactionId(),
      userId: lf.userId,
      type: "locked_fund_unlock",
      amount: lf.principal,
      currency: lf.currency,
      description: "Locked funds unlocked and credited",
      status: "successful",
      completedAt: new Date(),
    });

    lf.status = "unlocked";
    await lf.save();
  }

  return lf;
}

async function extendUnlockDate(lockedFundId, userId, newDate) {
  const lf = await LockedFund.findOne({ _id: lockedFundId, userId });
  if (!lf) throw new Error("Not found");
  if (lf.status !== "active") {
    const err = new Error("Cannot extend");
    err.status = 400;
    err.publicMessage = "Only an active locked fund can be extended.";
    throw err;
  }
  if (new Date(newDate) <= lf.unlockDate) {
    const err = new Error("Date must be forward");
    err.status = 400;
    err.publicMessage = "The new date must be after the current unlock date.";
    throw err;
  }
  lf.unlockDate = new Date(newDate);
  await lf.save();
  return lf;
}

async function requestEarlyWithdrawal(lockedFundId, userId) {
  const lf = await LockedFund.findOne({ _id: lockedFundId, userId });
  if (!lf || lf.status !== "active") {
    const err = new Error("Not eligible");
    err.status = 400;
    err.publicMessage =
      "This locked fund is not eligible for early withdrawal right now.";
    throw err;
  }
  lf.status = "early_withdrawal_pending";
  lf.earlyWithdrawalFeeAmount = lf.principal * lf.earlyWithdrawalFeeRate;
  await lf.save();
  return lf;
}

async function completeEarlyWithdrawal(lockedFundId) {
  const lf = await LockedFund.findById(lockedFundId);
  const account = await Account.findOne({ userId: lf.userId });

  account.lockedBalance -= lf.principal;
  account.availableBalance += lf.principal;
  await account.save();

  await Transaction.create({
    transactionId: generateTransactionId(),
    userId: lf.userId,
    type: "locked_fund_early_withdrawal",
    amount: lf.principal,
    currency: lf.currency,
    description: "Locked fund early withdrawal — fee confirmed, funds released",
    status: "successful",
    completedAt: new Date(),
  });

  lf.status = "early_withdrawal_completed";
  await lf.save();
}

async function holdLockedFund(lockedFundId, reason) {
  const lf = await LockedFund.findById(lockedFundId);
  lf.status = "held";
  lf.holdReason = reason;
  await lf.save();
  return lf;
}

module.exports = {
  createLockedFund,
  syncLockedFund,
  extendUnlockDate,
  requestEarlyWithdrawal,
  completeEarlyWithdrawal,
  holdLockedFund,
};
