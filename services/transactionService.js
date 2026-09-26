const Account = require("../models/Account");
const Transaction = require("../models/Transaction");

function generateTransactionId() {
  return (
    "TXN-" +
    Date.now().toString(36).toUpperCase() +
    Math.random().toString(36).slice(2, 6).toUpperCase()
  );
}

async function applyCredit({
  userId,
  amount,
  type,
  description,
  reference,
  sender,
}) {
  const account = await Account.findOne({ userId });
  if (!account) throw new Error("Account not found");

  account.availableBalance += Number(amount);
  await account.save();

  const transaction = await Transaction.create({
    transactionId: generateTransactionId(),
    userId,
    type,
    amount: Number(amount),
    currency: account.currency,
    description,
    reference,
    status: "successful",
    completedAt: new Date(),
    sender: sender || "system",
  });

  return { account, transaction };
}

async function applyDebit({ userId, amount, type, description, reference }) {
  const account = await Account.findOne({ userId });
  if (!account) throw new Error("Account not found");

  if (account.availableBalance < Number(amount)) {
    const err = new Error("Insufficient available balance");
    err.status = 400;
    err.publicMessage = "Insufficient available balance for that action.";
    throw err;
  }

  account.availableBalance -= Number(amount);
  await account.save();

  const transaction = await Transaction.create({
    transactionId: generateTransactionId(),
    userId,
    type,
    amount: Number(amount),
    currency: account.currency,
    description,
    reference,
    status: "successful",
    completedAt: new Date(),
  });

  return { account, transaction };
}

// Thin wrappers for admin-initiated balance changes (Phase 4 already calls these)
async function creditAccount({ userId, amount, description, reference }) {
  return applyCredit({
    userId,
    amount,
    type: "admin_credit",
    description: description || "Account credited by admin",
    reference,
    sender: "admin",
  });
}

async function debitAccount({ userId, amount, description, reference }) {
  return applyDebit({
    userId,
    amount,
    type: "admin_debit",
    description: description || "Account debited by admin",
    reference,
  });
}

module.exports = {
  generateTransactionId,
  applyCredit,
  applyDebit,
  creditAccount,
  debitAccount,
};
