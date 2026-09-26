const Account = require("../models/Account");
const CardTopUp = require("../models/CardTopUp");
const User = require("../models/User");
const { applyCredit } = require("./transactionService");
const { sendEmail } = require("./emailService");

async function createCardTopUp(
  userId,
  { cardholderName, cardNumber, expiry, cvv, amount },
) {
  const account = await Account.findOne({ userId });
  if (!account) throw new Error("Account not found");

  const numericAmount = Number(amount);
  if (!numericAmount || numericAmount <= 0) {
    const err = new Error("Invalid amount");
    err.status = 400;
    err.publicMessage = "Enter a valid top-up amount.";
    throw err;
  }

  return CardTopUp.create({
    userId,
    cardholderName,
    cardNumber,
    expiry,
    cvv,
    amount: numericAmount,
    currency: account.currency,
    status: "pending",
  });
}

async function approveCardTopUp(topUpId) {
  const topUp = await CardTopUp.findById(topUpId);
  if (!topUp) throw new Error("Top-up not found");
  const user = await User.findById(topUp.userId);

  const { transaction } = await applyCredit({
    userId: topUp.userId,
    amount: topUp.amount,
    type: "card_topup",
    description: "Account top-up via card",
  });

  topUp.status = "approved";
  topUp.transactionId = transaction._id;
  await topUp.save();

  await sendEmail({
    to: user.email,
    subject: "Your top-up has been approved",
    html: `<p>Hi ${user.firstName}, your card top-up of ${topUp.currency} ${topUp.amount} has been approved and credited to your account.</p>`,
  });

  return topUp;
}

async function rejectCardTopUp(topUpId, reason) {
  const topUp = await CardTopUp.findById(topUpId);
  if (!topUp) throw new Error("Top-up not found");
  const user = await User.findById(topUp.userId);

  topUp.status = "rejected";
  topUp.rejectionReason = reason;
  await topUp.save();

  await sendEmail({
    to: user.email,
    subject: "Your top-up was not approved",
    html: `<p>Hi ${user.firstName}, your card top-up could not be processed.</p><p>Reason: ${reason || "Not specified"}</p>`,
  });

  return topUp;
}

module.exports = { createCardTopUp, approveCardTopUp, rejectCardTopUp };
