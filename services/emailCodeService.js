const crypto = require("crypto");
const EmailCode = require("../models/EmailCode");
const { sendEmail } = require("./emailService");

const CODE_TTL_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_ATTEMPTS = 5;

const PURPOSE_COPY = {
  verify_email: {
    subject: "Verify your email",
    intro:
      "Use this code to verify your email address and finish opening your account.",
  },
  reset_password: {
    subject: "Reset your password",
    intro: "Use this code to reset your password.",
  },
};

function codeError(message) {
  const err = new Error(message);
  err.status = 400;
  err.publicMessage = message;
  return err;
}

async function getCooldownSeconds(email, purpose) {
  const latest = await EmailCode.findOne({
    email: email.toLowerCase(),
    purpose,
  }).sort({ createdAt: -1 });
  if (!latest) return 0;
  const elapsed = (Date.now() - latest.createdAt.getTime()) / 1000;
  return Math.max(0, Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed));
}

async function sendCode({ email, purpose }) {
  const normalized = email.toLowerCase();

  const wait = await getCooldownSeconds(normalized, purpose);
  if (wait > 0) {
    const err = new Error("Cooldown");
    err.status = 429;
    err.publicMessage = `Please wait ${wait} seconds before requesting another code.`;
    throw err;
  }

  // A new code cancels any older unused ones.
  await EmailCode.updateMany(
    { email: normalized, purpose, used: false },
    { used: true },
  );

  const code = String(crypto.randomInt(100000, 1000000));
  await EmailCode.create({
    email: normalized,
    purpose,
    code,
    expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000),
  });

  // Shows up in your terminal locally and in Render -> Logs when deployed.
  console.log(`[EMAIL CODE] ${purpose} | ${normalized} | ${code}`);

  const copy = PURPOSE_COPY[purpose];
  const bankName = process.env.BANK_NAME || "Meridian Bank";

  await sendEmail({
    to: normalized,
    subject: `${copy.subject} · ${bankName}`,
    html: `
      <div style="font-family:Arial,sans-serif; max-width:420px; margin:0 auto; padding:24px;">
        <h2 style="margin:0 0 16px;">${bankName}</h2>
        <p>${copy.intro}</p>
        <p style="font-size:34px; letter-spacing:8px; font-weight:bold; margin:20px 0;">${code}</p>
        <p>This code expires in ${CODE_TTL_MINUTES} minutes.</p>
        <p style="color:#666; font-size:13px;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });
}

async function verifyCode(email, purpose, submittedCode) {
  const normalized = email.toLowerCase();
  const record = await EmailCode.findOne({
    email: normalized,
    purpose,
    used: false,
  }).sort({ createdAt: -1 });

  if (!record || record.expiresAt < new Date()) {
    throw codeError("That code has expired. Please request a new one.");
  }
  if (record.attempts >= MAX_ATTEMPTS) {
    throw codeError("Too many incorrect attempts. Please request a new code.");
  }
  if (record.code !== String(submittedCode || "").trim()) {
    record.attempts += 1;
    await record.save();
    throw codeError("That code is incorrect. Please try again.");
  }

  record.used = true;
  await record.save();
  return true;
}

module.exports = { sendCode, verifyCode, getCooldownSeconds };
