const express = require("express");
const bcrypt = require("bcryptjs");
const router = express.Router();

const User = require("../models/User");
const {
  listCountries,
  getCurrencyForCountry,
} = require("../config/countryRules");
const { createAccountForUser } = require("../services/accountService");
const { sendEmail } = require("../services/emailService");
const {
  sendCode,
  verifyCode,
  getCooldownSeconds,
} = require("../services/emailCodeService");

// ---------- helpers ----------
function maskEmail(email) {
  const [name, domain] = email.split("@");
  return `${name.slice(0, 2)}${"*".repeat(Math.max(name.length - 2, 1))}@${domain}`;
}

// Makes sure the session is written to MongoDB before we redirect.
function saveSession(req, res, redirectTo) {
  req.session.save(() => res.redirect(redirectTo));
}

async function renderVerify(
  res,
  email,
  { error = null, info = null, status = 200 } = {},
) {
  const resendIn = await getCooldownSeconds(email, "verify_email");
  res.status(status).render("customer/verify-email", {
    title: "Verify your email",
    maskedEmail: maskEmail(email),
    error,
    info,
    resendIn,
  });
}

async function renderReset(
  res,
  email,
  { error = null, info = null, status = 200 } = {},
) {
  const resendIn = await getCooldownSeconds(email, "reset_password");
  res.status(status).render("customer/reset-password", {
    title: "Reset your password",
    maskedEmail: maskEmail(email),
    error,
    info,
    resendIn,
  });
}

// ---------- Register ----------
router.get("/register", (req, res) => {
  res.render("customer/register", {
    title: "Open an account",
    countries: listCountries(),
    error: null,
    formData: {},
  });
});

router.post("/register", async (req, res, next) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      password,
      country,
      dateOfBirth,
      nationality,
      address,
      city,
      state,
      postalCode,
    } = req.body;

    const requiredFields = {
      firstName,
      lastName,
      email,
      phone,
      password,
      country,
      dateOfBirth,
      nationality,
      address,
      city,
      postalCode,
    };
    for (const [key, value] of Object.entries(requiredFields)) {
      if (!value || !value.trim()) {
        return res.status(400).render("customer/register", {
          title: "Open an account",
          countries: listCountries(),
          error: `Please fill in all required fields (missing: ${key}).`,
          formData: req.body,
        });
      }
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).render("customer/register", {
        title: "Open an account",
        countries: listCountries(),
        error:
          "An account with this email already exists. If you have not verified it yet, log in to continue verification.",
        formData: req.body,
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      firstName,
      lastName,
      email: email.toLowerCase(),
      phone,
      passwordHash,
      country,
      currency: getCurrencyForCountry(country),
      dateOfBirth,
      nationality,
      address,
      city,
      state,
      postalCode,
      accountStatus: "pending",
      emailVerified: false,
    });

    await createAccountForUser(user);
    await sendCode({ email: user.email, purpose: "verify_email" });

    // Not logged in yet: they must enter the emailed code first.
    req.session.pendingVerifyEmail = user.email;
    saveSession(req, res, "/auth/verify");
  } catch (err) {
    next(err);
  }
});

// ---------- Login ----------
router.get("/login", (req, res) => {
  res.render("customer/login", {
    title: "Log in",
    error: null,
    success:
      req.query.reset === "1"
        ? "Your password has been updated. You can log in now."
        : null,
  });
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({
      email: (email || "").toLowerCase(),
      role: "customer",
    });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).render("customer/login", {
        title: "Log in",
        error: "Incorrect email or password.",
        success: null,
      });
    }

    // Unverified accounts must verify their email before getting in.
    if (!user.emailVerified) {
      try {
        await sendCode({ email: user.email, purpose: "verify_email" });
      } catch (err) {
        if (err.status !== 429) throw err; // 429 = a code was sent moments ago, fine
      }
      req.session.pendingVerifyEmail = user.email;
      return saveSession(req, res, "/auth/verify");
    }

    req.session.user = {
      id: user._id,
      firstName: user.firstName,
      role: user.role,
    };
    saveSession(req, res, "/account/dashboard");
  } catch (err) {
    next(err);
  }
});

// ---------- Logout ----------
router.post("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

// ---------- Email verification ----------
router.get("/verify", async (req, res, next) => {
  try {
    const email = req.session.pendingVerifyEmail;
    if (!email) return res.redirect("/auth/login");
    await renderVerify(res, email);
  } catch (err) {
    next(err);
  }
});

router.post("/verify", async (req, res, next) => {
  try {
    const email = req.session.pendingVerifyEmail;
    if (!email) return res.redirect("/auth/login");

    try {
      await verifyCode(email, "verify_email", req.body.code);
    } catch (err) {
      if (err.status === 400)
        return renderVerify(res, email, {
          error: err.publicMessage,
          status: 400,
        });
      throw err;
    }

    const user = await User.findOneAndUpdate(
      { email },
      { emailVerified: true },
      { new: true },
    );

    delete req.session.pendingVerifyEmail;
    req.session.user = {
      id: user._id,
      firstName: user.firstName,
      role: user.role,
    };

    await sendEmail({
      to: user.email,
      subject: `Welcome to ${process.env.BANK_NAME}`,
      html: `<p>Hi ${user.firstName}, your ${process.env.BANK_NAME} account has been created.</p>`,
    });

    saveSession(req, res, "/account/dashboard");
  } catch (err) {
    next(err);
  }
});

router.post("/verify/resend", async (req, res, next) => {
  try {
    const email = req.session.pendingVerifyEmail;
    if (!email) return res.redirect("/auth/login");

    try {
      await sendCode({ email, purpose: "verify_email" });
    } catch (err) {
      if (err.status === 429)
        return renderVerify(res, email, {
          error: err.publicMessage,
          status: 429,
        });
      throw err;
    }

    renderVerify(res, email, {
      info: "A new code is on its way. Check your inbox, and your spam folder too.",
    });
  } catch (err) {
    next(err);
  }
});

// ---------- Forgot / reset password ----------
router.get("/forgot", (req, res) => {
  res.render("customer/forgot-password", {
    title: "Forgot password",
    error: null,
  });
});

router.post("/forgot", async (req, res, next) => {
  try {
    const email = (req.body.email || "").trim().toLowerCase();
    if (!email) {
      return res.status(400).render("customer/forgot-password", {
        title: "Forgot password",
        error: "Please enter your email address.",
      });
    }

    const user = await User.findOne({ email });
    if (user) {
      try {
        await sendCode({ email, purpose: "reset_password" });
      } catch (err) {
        if (err.status !== 429) throw err;
      }
    }

    // Same response whether or not the email exists, so this form can't be
    // used to find out who has an account.
    req.session.pendingResetEmail = email;
    saveSession(req, res, "/auth/reset");
  } catch (err) {
    next(err);
  }
});

router.get("/reset", async (req, res, next) => {
  try {
    const email = req.session.pendingResetEmail;
    if (!email) return res.redirect("/auth/forgot");
    await renderReset(res, email);
  } catch (err) {
    next(err);
  }
});

router.post("/reset", async (req, res, next) => {
  try {
    const email = req.session.pendingResetEmail;
    if (!email) return res.redirect("/auth/forgot");

    const { code, password, confirmPassword } = req.body;

    // Check the password first so a typo doesn't use up one of the 5 code attempts.
    if (!password || password.length < 8) {
      return renderReset(res, email, {
        error: "Your new password must be at least 8 characters.",
        status: 400,
      });
    }
    if (password !== confirmPassword) {
      return renderReset(res, email, {
        error: "Passwords do not match.",
        status: 400,
      });
    }

    try {
      await verifyCode(email, "reset_password", code);
    } catch (err) {
      if (err.status === 400)
        return renderReset(res, email, {
          error: err.publicMessage,
          status: 400,
        });
      throw err;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    // Entering the emailed code also proves they own the email.
    await User.findOneAndUpdate(
      { email },
      { passwordHash, emailVerified: true },
    );

    delete req.session.pendingResetEmail;
    saveSession(req, res, "/auth/login?reset=1");
  } catch (err) {
    next(err);
  }
});

router.post("/reset/resend", async (req, res, next) => {
  try {
    const email = req.session.pendingResetEmail;
    if (!email) return res.redirect("/auth/forgot");

    const user = await User.findOne({ email });
    if (user) {
      try {
        await sendCode({ email, purpose: "reset_password" });
      } catch (err) {
        if (err.status === 429)
          return renderReset(res, email, {
            error: err.publicMessage,
            status: 429,
          });
        throw err;
      }
    }

    renderReset(res, email, {
      info: "A new code is on its way. Check your inbox, and your spam folder too.",
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
