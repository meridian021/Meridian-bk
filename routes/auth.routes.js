const express = require("express");
const bcrypt = require("bcryptjs");
const router = express.Router();

const User = require("../models/User");
const Account = require("../models/Account");
const { listCountries } = require("../config/countryRules");
const { createAccountForUser } = require("../services/accountService");
const { sendEmail } = require("../services/emailService");

// --- Register (Phase 1: single-step placeholder; becomes multi-step in Phase 2) ---
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
        error: "An account with this email already exists.",
        formData: req.body,
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const { getCurrencyForCountry } = require("../config/countryRules");

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
    });

    await createAccountForUser(user);

    await sendEmail({
      to: user.email,
      subject: `Welcome to ${process.env.BANK_NAME}`,
      html: `<p>Hi ${user.firstName}, your ${process.env.BANK_NAME} account has been created.</p>`,
    });

    req.session.user = {
      id: user._id,
      firstName: user.firstName,
      role: user.role,
    };
    res.redirect("/account/dashboard");
  } catch (err) {
    next(err);
  }
});
// --- Login ---
router.get("/login", (req, res) => {
  res.render("customer/login", { title: "Log in", error: null });
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({
      email: email.toLowerCase(),
      role: "customer",
    });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).render("customer/login", {
        title: "Log in",
        error: "Incorrect email or password.",
      });
    }

    req.session.user = {
      id: user._id,
      firstName: user.firstName,
      role: user.role,
    };
    res.redirect("/account/dashboard");
  } catch (err) {
    next(err);
  }
});

// --- Logout ---
router.post("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

module.exports = router;
