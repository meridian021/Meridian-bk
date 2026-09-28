const express = require("express");
const router = express.Router();
const supportService = require("../services/supportService");

// Simple in-memory limit: 5 messages per hour per IP.
const hits = new Map();
function tooManyRequests(ip) {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const recent = (hits.get(ip) || []).filter((t) => now - t < windowMs);
  if (recent.length >= 5) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

function renderContact(
  req,
  res,
  { error = null, formData = {}, status = 200 } = {},
) {
  res.status(status).render("customer/contact", {
    title: "Contact us",
    categories: supportService.SUPPORT_CATEGORIES,
    error,
    formData,
    sent: req.query.sent === "1",
  });
}

router.get("/", (req, res) => {
  renderContact(req, res);
});

router.post("/", async (req, res, next) => {
  try {
    // Honeypot: real people never see or fill this field. Bots do.
    if (req.body.website) return res.redirect("/contact?sent=1");

    if (tooManyRequests(req.ip)) {
      return renderContact(req, res, {
        error:
          "You have sent several messages recently. Please try again later.",
        formData: req.body,
        status: 429,
      });
    }

    await supportService.submitMessage({
      userId: req.session.user ? req.session.user.id : undefined,
      source: "contact",
      name: req.body.name,
      email: req.body.email,
      category: req.body.category,
      subject: req.body.subject,
      message: req.body.message,
    });

    res.redirect("/contact?sent=1");
  } catch (err) {
    if (err.status === 400) {
      return renderContact(req, res, {
        error: err.publicMessage,
        formData: req.body,
        status: 400,
      });
    }
    next(err);
  }
});

module.exports = router;
