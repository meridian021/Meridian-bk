const FixedDeposit = require("../models/FixedDeposit");
const Account = require("../models/Account");
const Transaction = require("../models/Transaction");
const { applyCredit, generateTransactionId } = require("./transactionService");

async function createFixedDeposit(userId, { amount, durationDays }) {
  const account = await Account.findOne({ userId });
  const principal = Number(amount);

  if (!principal || principal <= 0 || principal > account.availableBalance) {
    const err = new Error("Invalid amount");
    err.status = 400;
    err.publicMessage = "Enter an amount you have available.";
    throw err;
  }

  account.availableBalance -= principal;
  account.lockedBalance += principal;
  await account.save();

  const maturityDate = new Date();
  maturityDate.setDate(maturityDate.getDate() + Number(durationDays));

  return FixedDeposit.create({
    userId,
    principal,
    currency: account.currency,
    durationDays: Number(durationDays),
    maturityDate,
    status: "active",
  });
}

// Called whenever a fixed deposit is fetched — accrues weekly interest and
// pays out at maturity, unless it's held or already resolved.
async function syncFixedDeposit(fd) {
  if (fd.status !== "active") return fd;

  const now = new Date();

  // Weekly interest accrual, logged as its own transaction (not moved to balance)
  const daysSinceLastInterest = Math.floor(
    (now - fd.lastInterestDate) / (1000 * 60 * 60 * 24),
  );
  if (daysSinceLastInterest >= 7) {
    const weeksElapsed = Math.floor(daysSinceLastInterest / 7);
    const daysToAccrue = weeksElapsed * 7;
    const interestAmount = fd.principal * fd.dailyInterestRate * daysToAccrue;

    fd.accruedInterest += interestAmount;
    fd.lastInterestDate = new Date(
      fd.lastInterestDate.getTime() + daysToAccrue * 24 * 60 * 60 * 1000,
    );

    await Transaction.create({
      transactionId: generateTransactionId(),
      userId: fd.userId,
      type: "fixed_deposit_interest",
      amount: interestAmount,
      currency: fd.currency,
      description: `Interest added to fixed deposit (${weeksElapsed} week${weeksElapsed > 1 ? "s" : ""})`,
      status: "successful",
      completedAt: now,
    });
  }

  // Maturity payout
  if (now >= fd.maturityDate) {
    const payout = fd.principal + fd.accruedInterest;
    const account = await Account.findOne({ userId: fd.userId });
    account.lockedBalance -= fd.principal;
    account.availableBalance += payout;
    await account.save();

    await Transaction.create({
      transactionId: generateTransactionId(),
      userId: fd.userId,
      type: "fixed_deposit_maturity",
      amount: payout,
      currency: fd.currency,
      description: "Fixed deposit matured — principal and interest credited",
      status: "successful",
      completedAt: now,
    });

    fd.status = "matured";
  }

  await fd.save();
  return fd;
}

async function extendMaturity(fixedDepositId, userId, newDate) {
  const fd = await FixedDeposit.findOne({ _id: fixedDepositId, userId });
  if (!fd) throw new Error("Not found");
  if (fd.status !== "active") {
    const err = new Error("Cannot extend");
    err.status = 400;
    err.publicMessage = "Only an active fixed deposit can be extended.";
    throw err;
  }
  if (new Date(newDate) <= fd.maturityDate) {
    const err = new Error("Date must be forward");
    err.status = 400;
    err.publicMessage = "The new date must be after the current maturity date.";
    throw err;
  }
  fd.maturityDate = new Date(newDate);
  await fd.save();
  return fd;
}

async function requestEarlyWithdrawal(fixedDepositId, userId) {
  const fd = await FixedDeposit.findOne({ _id: fixedDepositId, userId });
  if (!fd || fd.status !== "active") {
    const err = new Error("Not eligible");
    err.status = 400;
    err.publicMessage =
      "This deposit is not eligible for early withdrawal right now.";
    throw err;
  }
  fd.status = "early_withdrawal_pending";
  fd.earlyWithdrawalFeeAmount = fd.principal * fd.earlyWithdrawalFeeRate;
  await fd.save();
  return fd;
}

// Called by cryptoDepositService once the fee crypto payment is approved
async function completeEarlyWithdrawal(fixedDepositId) {
  const fd = await FixedDeposit.findById(fixedDepositId);
  const account = await Account.findOne({ userId: fd.userId });
  const payout = fd.principal + fd.accruedInterest;

  account.lockedBalance -= fd.principal;
  account.availableBalance += payout;
  await account.save();

  await Transaction.create({
    transactionId: generateTransactionId(),
    userId: fd.userId,
    type: "fixed_deposit_early_withdrawal",
    amount: payout,
    currency: fd.currency,
    description:
      "Fixed deposit early withdrawal — fee confirmed, funds released",
    status: "successful",
    completedAt: new Date(),
  });

  fd.status = "early_withdrawal_completed";
  await fd.save();
}

async function holdFixedDeposit(fixedDepositId, reason) {
  const fd = await FixedDeposit.findById(fixedDepositId);
  fd.status = "held";
  fd.holdReason = reason;
  await fd.save();
  return fd;
}

module.exports = {
  createFixedDeposit,
  syncFixedDeposit,
  extendMaturity,
  requestEarlyWithdrawal,
  completeEarlyWithdrawal,
  holdFixedDeposit,
};
