const SibApiV3Sdk = require("sib-api-v3-sdk");

const brevoConfigured = Boolean(process.env.BREVO_API_KEY);

let transactionalEmailsApi = null;
if (brevoConfigured) {
  const client = SibApiV3Sdk.ApiClient.instance;
  client.authentications["api-key"].apiKey = process.env.BREVO_API_KEY;
  transactionalEmailsApi = new SibApiV3Sdk.TransactionalEmailsApi();
}

/**
 * Sends an email via Brevo. If BREVO_API_KEY is not set (e.g. local dev
 * without credentials), it logs the email to the console instead of
 * throwing — so the rest of the app never breaks because email isn't
 * configured yet.
 */
async function sendEmail({ to, subject, html, replyTo }) {
  if (!brevoConfigured) {
    console.log("--- [DEV EMAIL FALLBACK] ---");
    console.log("To:", to);
    console.log("Subject:", subject);
    console.log("Body:", html);
    console.log("----------------------------");
    return { devFallback: true };
  }

  const email = new SibApiV3Sdk.SendSmtpEmail();
  email.sender = {
    email: process.env.BREVO_SENDER_EMAIL,
    name: process.env.BREVO_SENDER_NAME,
  };
  email.to = [{ email: to }];
  email.subject = subject;
  email.htmlContent = html;
  if (replyTo) email.replyTo = { email: replyTo };

  try {
    return await transactionalEmailsApi.sendTransacEmail(email);
  } catch (err) {
    console.error(
      "Brevo send failed, falling back to console log:",
      err.message,
    );
    console.log("To:", to, "| Subject:", subject, "| Body:", html);
    return { devFallback: true, error: err.message };
  }
}

module.exports = { sendEmail };
