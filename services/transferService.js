const Account = require("../models/Account");
const Transfer = require("../models/Transfer");
const Transaction = require("../models/Transaction");
const User = require("../models/User");
const { generateTransactionId, applyDebit } = require("./transactionService");
const { sendEmail } = require("./emailService");

async function createExternalTransfer(userId, data) {
  const account = await Account.findOne({ userId });
  if (!account) throw new Error("Account not found");

  const amount = Number(data.amount);
  if (!amount || amount <= 0) {
    const err = new Error("Invalid amount");
    err.status = 400;
    err.publicMessage = "Enter a valid transfer amount.";
    throw err;
  }
  if (amount > account.availableBalance) {
    const err = new Error("Insufficient funds");
    err.status = 400;
    err.publicMessage = "Insufficient available balance for this transfer.";
    throw err;
  }

  // No balance change yet — funds are only deducted once an admin approves.
  const transaction = await Transaction.create({
    transactionId: generateTransactionId(),
    userId,
    type: "external_transfer",
    amount,
    currency: account.currency,
    description: data.purpose || "International transfer",
    recipient: data.recipientName,
    method: "external_transfer",
    status: "pending",
  });

  const transfer = await Transfer.create({
    userId,
    transactionId: transaction._id,
    transferType: "external",
    amount,
    currency: account.currency,
    purpose: data.purpose,
    bankName: data.bankName,
    externalAccountNumber: data.externalAccountNumber,
    iban: data.iban,
    swiftBic: data.swiftBic,
    country: data.country,
    recipientName: data.recipientName,
    status: "pending",
  });

  return { transfer, transaction };
}

async function approveTransfer(transferId) {
  const transfer = await Transfer.findById(transferId);
  if (!transfer) throw new Error("Transfer not found");
  const user = await User.findById(transfer.userId);

  try {
    // Re-checks balance at approval time in case it changed since submission.
    const { transaction: debitTx } = await applyDebit({
      userId: transfer.userId,
      amount: transfer.amount,
      type: "external_transfer",
      description: `International transfer to ${transfer.recipientName}`,
    });

    await Transaction.findByIdAndUpdate(transfer.transactionId, {
      status: "successful",
      completedAt: new Date(),
      approvedAt: new Date(),
    });

    transfer.status = "successful";
    transfer.transactionId = debitTx._id;
    await transfer.save();

    await sendEmail({
      to: user.email,
      subject: "Your transfer has been approved",
      html: `<p>Hi ${user.firstName}, your transfer of ${transfer.currency} ${transfer.amount} to ${transfer.recipientName} has been approved.</p>`,
    });
  } catch (err) {
    // Balance no longer sufficient — fail gracefully instead of crashing the request.
    transfer.status = "rejected";
    transfer.rejectionReason =
      "Insufficient available balance at time of approval";
    await transfer.save();
    await Transaction.findByIdAndUpdate(transfer.transactionId, {
      status: "failed",
    });
  }

  return transfer;
}

async function rejectTransfer(transferId, reason) {
  const transfer = await Transfer.findById(transferId);
  if (!transfer) throw new Error("Transfer not found");
  const user = await User.findById(transfer.userId);

  transfer.status = "rejected";
  transfer.rejectionReason = reason;
  await transfer.save();
  await Transaction.findByIdAndUpdate(transfer.transactionId, {
    status: "failed",
  });

  await sendEmail({
    to: user.email,
    subject: "Your transfer was not approved",
    html: `<p>Hi ${user.firstName}, your transfer to ${transfer.recipientName} was not approved.</p><p>Reason: ${reason || "Not specified"}</p>`,
  });

  return transfer;
}

async function holdTransfer(transferId, reason) {
  const transfer = await Transfer.findById(transferId);
  if (!transfer) throw new Error("Transfer not found");
  const user = await User.findById(transfer.userId);

  transfer.status = "held";
  transfer.rejectionReason = reason;
  await transfer.save();
  // Transaction stays 'pending' — a hold isn't a final outcome.

  await sendEmail({
    to: user.email,
    subject: "Your transfer is on hold",
    html: `<p>Hi ${user.firstName}, your transfer to ${transfer.recipientName} is currently on hold.</p><p>Reason: ${reason || "Additional review required"}</p>`,
  });

  return transfer;
}

module.exports = {
  createExternalTransfer,
  approveTransfer,
  rejectTransfer,
  holdTransfer,
};
