const Account = require("../models/Account");
const Transaction = require("../models/Transaction");

function generateTransactionId() {
  return (
    "TXN-" +
    Date.now().toString(36).toUpperCase() +
    Math.random().toString(36).slice(2, 6).toUpperCase()
  );
}

async function creditAccount({ userId, amount, description, reference }) {
  const account = await Account.findOne({ userId });
  if (!account) throw new Error("Account not found");

  account.availableBalance += Number(amount);
  await account.save(); // pre-save hook on Account recalculates totalBalance

  const transaction = await Transaction.create({
    transactionId: generateTransactionId(),
    userId,
    type: "admin_credit",
    amount: Number(amount),
    currency: account.currency,
    description: description || "Account credited by admin",
    reference,
    status: "successful",
    completedAt: new Date(),
    sender: "admin",
  });

  return { account, transaction };
}

async function debitAccount({ userId, amount, description, reference }) {
  const account = await Account.findOne({ userId });
  if (!account) throw new Error("Account not found");

  if (account.availableBalance < Number(amount)) {
    const err = new Error("Insufficient available balance");
    err.status = 400;
    err.publicMessage = "Insufficient available balance for that debit.";
    throw err;
  }

  account.availableBalance -= Number(amount);
  await account.save();

  const transaction = await Transaction.create({
    transactionId: generateTransactionId(),
    userId,
    type: "admin_debit",
    amount: Number(amount),
    currency: account.currency,
    description: description || "Account debited by admin",
    reference,
    status: "successful",
    completedAt: new Date(),
    sender: "admin",
  });

  return { account, transaction };
}

module.exports = { generateTransactionId, creditAccount, debitAccount };
