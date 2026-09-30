const SibApiV3Sdk = require("sib-api-v3-sdk");
const nodemailer = require("nodemailer");

const brevoConfigured = Boolean(process.env.BREVO_API_KEY);
const gmailConfigured = Boolean(
  process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD,
);

let transactionalEmailsApi = null;
if (brevoConfigured) {
  const client = SibApiV3Sdk.ApiClient.instance;
  client.authentications["api-key"].apiKey = process.env.BREVO_API_KEY;
  transactionalEmailsApi = new SibApiV3Sdk.TransactionalEmailsApi();
}

let gmailTransporter = null;
if (gmailConfigured) {
  gmailTransporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

function logToConsole({ to, subject, html }) {
  console.log("--- [DEV EMAIL FALLBACK] ---");
  console.log("To:", to);
  console.log("Subject:", subject);
  console.log("Body:", html);
  console.log("----------------------------");
}

async function sendViaBrevo({ to, subject, html, replyTo }) {
  const email = new SibApiV3Sdk.SendSmtpEmail();
  email.sender = {
    email: process.env.BREVO_SENDER_EMAIL,
    name: process.env.BREVO_SENDER_NAME,
  };
  email.to = [{ email: to }];
  email.subject = subject;
  email.htmlContent = html;
  if (replyTo) email.replyTo = { email: replyTo };
  return transactionalEmailsApi.sendTransacEmail(email);
}

async function sendViaGmail({ to, subject, html, replyTo }) {
  return gmailTransporter.sendMail({
    from: `"${process.env.BANK_NAME || "Meridian Bank"}" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    html,
    replyTo: replyTo || undefined,
  });
}

/**
 * Sends an email. Tries providers in order based on EMAIL_PROVIDER:
 *   "brevo" -> Brevo only (falls back to console log if it fails or isn't configured)
 *   "gmail" -> Gmail only (same fallback behavior)
 *   "auto" (default) -> Brevo first, then Gmail if Brevo fails/isn't configured, then console
 * Never throws — always falls through to a console log so the rest of the
 * app keeps working even with no email provider configured at all.
 */
async function sendEmail({ to, subject, html, replyTo }) {
  const mode = (process.env.EMAIL_PROVIDER || "auto").toLowerCase();
  const attempts = [];

  if (mode === "brevo") attempts.push("brevo");
  else if (mode === "gmail") attempts.push("gmail");
  else attempts.push("brevo", "gmail"); // auto

  for (const provider of attempts) {
    if (provider === "brevo" && brevoConfigured) {
      try {
        const result = await sendViaBrevo({ to, subject, html, replyTo });
        return { provider: "brevo", result };
      } catch (err) {
        console.error("Brevo send failed:", err.message);
      }
    }
    if (provider === "gmail" && gmailConfigured) {
      try {
        const result = await sendViaGmail({ to, subject, html, replyTo });
        return { provider: "gmail", result };
      } catch (err) {
        console.error("Gmail send failed:", err.message);
      }
    }
  }

  logToConsole({ to, subject, html });
  return { devFallback: true };
}

module.exports = { sendEmail };
