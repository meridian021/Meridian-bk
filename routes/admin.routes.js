const express = require("express");
const bcrypt = require("bcryptjs");
const router = express.Router();

const requireAdmin = require("../middleware/requireAdmin");
const User = require("../models/User");
const Account = require("../models/Account");
const Transaction = require("../models/Transaction");
const SystemSetting = require("../models/SystemSetting");
const {
  creditAccount,
  debitAccount,
} = require("../services/transactionService");

router.get("/login", (req, res) => {
  res.render("admin/login", {
    title: "Admin login",
    error: null,
    layout: false,
  });
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const admin = await User.findOne({
      email: email.toLowerCase(),
      role: "admin",
    });

    if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
      return res.status(401).render("admin/login", {
        title: "Admin login",
        error: "Incorrect email or password.",
        layout: false,
      });
    }

    req.session.user = {
      id: admin._id,
      firstName: admin.firstName,
      role: admin.role,
    };
    res.redirect("/admin/dashboard");
  } catch (err) {
    next(err);
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/admin/login"));
});

router.get("/dashboard", requireAdmin, async (req, res, next) => {
  try {
    const totalCustomers = await User.countDocuments({ role: "customer" });
    const pendingKyc = await User.countDocuments({ kycStatus: "pending" });
    const tierCounts = await Account.aggregate([
      { $group: { _id: "$tier", count: { $sum: 1 } } },
    ]);

    res.render("admin/dashboard", {
      title: "Admin overview",
      layout: "layouts/admin",
      totalCustomers,
      pendingKyc,
      tierCounts,
    });
  } catch (err) {
    next(err);
  }
});

// --- Customer list with search ---
router.get("/customers", requireAdmin, async (req, res, next) => {
  try {
    const { q, tier, status } = req.query;
    const userFilter = { role: "customer" };

    if (q) {
      const regex = new RegExp(q, "i");
      userFilter.$or = [
        { firstName: regex },
        { lastName: regex },
        { email: regex },
        { phone: regex },
      ];
    }
    if (status) userFilter.accountStatus = status;

    const users = await User.find(userFilter)
      .sort({ createdAt: -1 })
      .limit(100);
    const userIds = users.map((u) => u._id);

    const accountFilter = { userId: { $in: userIds } };
    if (tier) accountFilter.tier = Number(tier);
    if (q)
      accountFilter.$or = [
        ...(accountFilter.$or || []),
        { accountNumber: new RegExp(q, "i") },
      ];

    const accounts = await Account.find(accountFilter);
    const accountByUser = new Map(accounts.map((a) => [String(a.userId), a]));

    // If filtering by tier/account-number, only keep users that have a matching account
    const matchedUserIds =
      tier || (q && accounts.length)
        ? new Set(accounts.map((a) => String(a.userId)))
        : null;

    const customers = users
      .filter(
        (u) =>
          !matchedUserIds ||
          matchedUserIds.has(String(u._id)) ||
          accountByUser.has(String(u._id)),
      )
      .map((u) => ({
        user: u,
        account: accountByUser.get(String(u._id)) || null,
      }))
      .filter(
        (row) => !tier || (row.account && row.account.tier === Number(tier)),
      );

    res.render("admin/customers", {
      title: "Customers",
      layout: "layouts/admin",
      customers,
      query: req.query,
    });
  } catch (err) {
    next(err);
  }
});

// --- Single customer profile ---
router.get("/customers/:id", requireAdmin, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user)
      return res
        .status(404)
        .render("errors/404", { title: "Not found", layout: false });

    const account = await Account.findOne({ userId: user._id });
    const transactions = await Transaction.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(20);

    res.render("admin/customer-profile", {
      title: `${user.firstName} ${user.lastName}`,
      layout: "layouts/admin",
      user,
      account,
      transactions,
      message: null,
    });
  } catch (err) {
    next(err);
  }
});

// --- Credit / debit ---
router.post("/customers/:id/balance", requireAdmin, async (req, res, next) => {
  try {
    const { action, amount, description } = req.body;
    const userId = req.params.id;

    if (action === "credit") {
      await creditAccount({ userId, amount, description });
    } else {
      await debitAccount({ userId, amount, description });
    }

    res.redirect(`/admin/customers/${userId}`);
  } catch (err) {
    next(err);
  }
});

// --- Tier change ---
router.post("/customers/:id/tier", requireAdmin, async (req, res, next) => {
  try {
    const { tier } = req.body;
    const settings = await SystemSetting.getSettings();
    const limits = settings.tierLimits[`tier${tier}`];

    await Account.findOneAndUpdate(
      { userId: req.params.id },
      {
        tier: Number(tier),
        dailyLimit: limits.daily,
        monthlyLimit: limits.monthly,
      },
    );

    res.redirect(`/admin/customers/${req.params.id}`);
  } catch (err) {
    next(err);
  }
});

// --- Status change ---
router.post("/customers/:id/status", requireAdmin, async (req, res, next) => {
  try {
    const { status } = req.body;

    await User.findByIdAndUpdate(req.params.id, { accountStatus: status });
    await Account.findOneAndUpdate({ userId: req.params.id }, { status });

    res.redirect(`/admin/customers/${req.params.id}`);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
