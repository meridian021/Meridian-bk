const Card = require("../models/Card");
const SystemSetting = require("../models/SystemSetting");
const { applyDebit } = require("./transactionService");
const { sendEmail } = require("./emailService");

async function requestCard(userId, user, shippingAddress) {
  const existing = await Card.findOne({ userId, status: { $ne: "rejected" } });
  if (existing) {
    const err = new Error("A card request already exists");
    err.status = 400;
    err.publicMessage = "You already have a card request in progress.";
    throw err;
  }

  const settings = await SystemSetting.getSettings();
  const feeAmount = settings.cardFee;

  const { transaction } = await applyDebit({
    userId,
    amount: feeAmount,
    type: "card_fee",
    description: "Debit card request fee",
  });

  const card = await Card.create({
    userId,
    shippingAddress,
    feeAmount,
    feeTransactionId: transaction._id,
    feePaid: true,
    status: "requested",
  });

  await sendEmail({
    to: user.email,
    subject: "Your debit card request has been received",
    html: `<p>Hi ${user.firstName}, we've received your debit card request. We'll notify you once it's approved.</p>`,
  });

  return card;
}

async function approveCard(cardId, user) {
  const card = await Card.findById(cardId);
  if (!card) throw new Error("Card not found");

  const expectedDelivery = new Date();
  expectedDelivery.setDate(expectedDelivery.getDate() + 10);

  card.status = "approved";
  card.expectedDeliveryDate = expectedDelivery;
  await card.save();

  await sendEmail({
    to: user.email,
    subject: "Your debit card request has been approved",
    html: `<p>Hi ${user.firstName}, your card has been approved. Expected delivery: ${expectedDelivery.toDateString()}.</p>`,
  });

  return card;
}

async function rejectCard(cardId, user, reason) {
  const card = await Card.findById(cardId);
  if (!card) throw new Error("Card not found");

  card.status = "rejected";
  card.delayReason = reason;
  await card.save();

  await sendEmail({
    to: user.email,
    subject: "Your debit card request was not approved",
    html: `<p>Hi ${user.firstName}, your card request was not approved.</p><p>Reason: ${reason || "Not specified"}</p>`,
  });

  return card;
}

async function delayCard(cardId, user, reason, newDate) {
  const card = await Card.findById(cardId);
  if (!card) throw new Error("Card not found");

  card.status = "delayed";
  card.delayReason = reason;
  card.expectedDeliveryDate = newDate;
  await card.save();

  await sendEmail({
    to: user.email,
    subject: "Your card delivery has been delayed",
    html: `<p>Hi ${user.firstName}, your card delivery has been delayed.</p><p>Reason: ${reason}</p><p>Updated delivery date: ${new Date(newDate).toDateString()}</p>`,
  });

  return card;
}

async function markShipped(cardId) {
  const card = await Card.findById(cardId);
  if (!card) throw new Error("Card not found");
  card.status = "shipped";
  await card.save();
  return card;
}

async function markDelivered(cardId, user) {
  const card = await Card.findById(cardId);
  if (!card) throw new Error("Card not found");
  card.status = "delivered";
  await card.save();

  await sendEmail({
    to: user.email,
    subject: "Your debit card has arrived",
    html: `<p>Hi ${user.firstName}, your card has been marked as delivered.</p>`,
  });

  return card;
}

module.exports = {
  requestCard,
  approveCard,
  rejectCard,
  delayCard,
  markShipped,
  markDelivered,
};
