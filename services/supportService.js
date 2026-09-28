const SupportMessage = require("../models/SupportMessage");
const Account = require("../models/Account");
const { sendEmail } = require("./emailService");

const SUPPORT_CATEGORIES = [
  "Account",
  "Transfers",
  "Cards",
  "Deposits & top-ups",
  "Verification (KYC)",
  "Other",
];

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function validationError(message) {
  const err = new Error(message);
  err.status = 400;
  err.publicMessage = message;
  return err;
}

async function submitMessage({
  userId,
  source,
  name,
  email,
  category,
  subject,
  message,
}) {
  const clean = {
    name: (name || "").trim(),
    email: (email || "").trim().toLowerCase(),
    subject: (subject || "").trim(),
    message: (message || "").trim(),
  };

  if (!clean.name || !clean.email || !clean.subject || !clean.message) {
    throw validationError("Please fill in all fields.");
  }
  if (!/^\S+@\S+\.\S+$/.test(clean.email))
    throw validationError("Please enter a valid email address.");
  if (clean.name.length > 100) throw validationError("Name is too long.");
  if (clean.subject.length > 150)
    throw validationError("Subject is too long (max 150 characters).");
  if (clean.message.length > 5000)
    throw validationError("Message is too long (max 5,000 characters).");

  // Saved first, so the message is never lost even if email fails.
  const saved = await SupportMessage.create({
    userId: userId || undefined,
    source,
    name: clean.name,
    email: clean.email,
    category: SUPPORT_CATEGORIES.includes(category) ? category : "Other",
    subject: clean.subject,
    message: clean.message,
  });

  const supportEmail = process.env.SUPPORT_EMAIL;
  if (supportEmail) {
    const account = userId ? await Account.findOne({ userId }) : null;
    const label = source === "support" ? "Support" : "Contact";

    // Reply-To is the customer, so hitting "Reply" in your inbox answers them directly.
    const result = await sendEmail({
      to: supportEmail,
      replyTo: clean.email,
      subject: `[${label}] ${clean.subject}`,
      html: `
        <p><strong>${label} message</strong> · ${escapeHtml(saved.category)}</p>
        <p><strong>From:</strong> ${escapeHtml(clean.name)} &lt;${escapeHtml(clean.email)}&gt;</p>
        ${account ? `<p><strong>Account number:</strong> ${escapeHtml(account.accountNumber)}</p>` : ""}
        <p><strong>Subject:</strong> ${escapeHtml(clean.subject)}</p>
        <hr>
        <p style="white-space:pre-wrap;">${escapeHtml(clean.message)}</p>
        <hr>
        <p style="color:#666; font-size:12px;">Reply to this email to respond directly to the customer.</p>
      `,
    });

    saved.emailSent = !(result && result.devFallback);
    await saved.save();
  }

  return saved;
}

module.exports = { submitMessage, SUPPORT_CATEGORIES };
