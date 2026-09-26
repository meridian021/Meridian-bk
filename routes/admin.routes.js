const CardTopUp = require("../models/CardTopUp");
const cardTopUpService = require("../services/cardTopUpService");
const CryptoDeposit = require("../models/CryptoDeposit");
const cryptoDepositService = require("../services/cryptoDepositService");
const Transfer = require("../models/Transfer");
const transferService = require("../services/transferService");
const KYCApplication = require("../models/KYCApplication");
const Document = require("../models/Document");
const { approveKyc, rejectKyc } = require("../services/kycService");
const express = require("express");
const bcrypt = require("bcryptjs");
const router = express.Router();
const Card = require("../models/Card");
const cardService = require("../services/cardService");
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
// --- KYC review ---
router.get("/kyc", requireAdmin, async (req, res, next) => {
  try {
    const applications = await KYCApplication.find({ status: "pending" })
      .populate("userId", "firstName lastName email")
      .sort({ createdAt: -1 });

    res.render("admin/kyc-list", {
      title: "KYC review",
      layout: "layouts/admin",
      applications,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/kyc/:id", requireAdmin, async (req, res, next) => {
  try {
    const application = await KYCApplication.findById(req.params.id).populate(
      "userId",
    );
    if (!application)
      return res
        .status(404)
        .render("errors/404", { title: "Not found", layout: false });

    const documents = await Document.find({
      kycApplicationId: application._id,
    });

    res.render("admin/kyc-detail", {
      title: "Review application",
      layout: "layouts/admin",
      application,
      documents,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/kyc/:id/approve", requireAdmin, async (req, res, next) => {
  try {
    await approveKyc(req.params.id, req.session.user.id);
    res.redirect("/admin/kyc");
  } catch (err) {
    next(err);
  }
});

router.post("/kyc/:id/reject", requireAdmin, async (req, res, next) => {
  try {
    await rejectKyc(req.params.id, req.session.user.id, req.body.reason);
    res.redirect("/admin/kyc");
  } catch (err) {
    next(err);
  }
});

// --- Serve a document's raw bytes for preview/download (admin only) ---
router.get("/documents/:id", requireAdmin, async (req, res, next) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).send("Not found");
    res.set("Content-Type", doc.mimeType);
    res.send(doc.fileData);
  } catch (err) {
    next(err);
  }
});
router.get("/cards", requireAdmin, async (req, res, next) => {
  try {
    const cards = await Card.find()
      .populate("userId", "firstName lastName email")
      .sort({ createdAt: -1 });
    res.render("admin/cards", {
      title: "Cards",
      layout: "layouts/admin",
      cards,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/cards/:id", requireAdmin, async (req, res, next) => {
  try {
    const card = await Card.findById(req.params.id).populate("userId");
    if (!card)
      return res
        .status(404)
        .render("errors/404", { title: "Not found", layout: false });
    res.render("admin/card-detail", {
      title: "Card request",
      layout: "layouts/admin",
      card,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/cards/:id/approve", requireAdmin, async (req, res, next) => {
  try {
    const card = await Card.findById(req.params.id).populate("userId");
    await cardService.approveCard(req.params.id, card.userId);
    res.redirect(`/admin/cards/${req.params.id}`);
  } catch (err) {
    next(err);
  }
});

router.post("/cards/:id/reject", requireAdmin, async (req, res, next) => {
  try {
    const card = await Card.findById(req.params.id).populate("userId");
    await cardService.rejectCard(req.params.id, card.userId, req.body.reason);
    res.redirect(`/admin/cards/${req.params.id}`);
  } catch (err) {
    next(err);
  }
});

router.post("/cards/:id/delay", requireAdmin, async (req, res, next) => {
  try {
    const card = await Card.findById(req.params.id).populate("userId");
    await cardService.delayCard(
      req.params.id,
      card.userId,
      req.body.reason,
      req.body.newDate,
    );
    res.redirect(`/admin/cards/${req.params.id}`);
  } catch (err) {
    next(err);
  }
});

router.post("/cards/:id/ship", requireAdmin, async (req, res, next) => {
  try {
    await cardService.markShipped(req.params.id);
    res.redirect(`/admin/cards/${req.params.id}`);
  } catch (err) {
    next(err);
  }
});

router.post("/cards/:id/deliver", requireAdmin, async (req, res, next) => {
  try {
    const card = await Card.findById(req.params.id).populate("userId");
    await cardService.markDelivered(req.params.id, card.userId);
    res.redirect(`/admin/cards/${req.params.id}`);
  } catch (err) {
    next(err);
  }
});
router.get("/transfers", requireAdmin, async (req, res, next) => {
  try {
    const transfers = await Transfer.find({ transferType: "external" })
      .populate("userId", "firstName lastName email")
      .sort({ createdAt: -1 });
    res.render("admin/transfers", {
      title: "Transfers",
      layout: "layouts/admin",
      transfers,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/transfers/:id", requireAdmin, async (req, res, next) => {
  try {
    const transfer = await Transfer.findById(req.params.id).populate("userId");
    if (!transfer)
      return res
        .status(404)
        .render("errors/404", { title: "Not found", layout: false });
    res.render("admin/transfer-detail", {
      title: "Transfer",
      layout: "layouts/admin",
      transfer,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/transfers/:id/approve", requireAdmin, async (req, res, next) => {
  try {
    await transferService.approveTransfer(req.params.id);
    res.redirect(`/admin/transfers/${req.params.id}`);
  } catch (err) {
    next(err);
  }
});

router.post("/transfers/:id/reject", requireAdmin, async (req, res, next) => {
  try {
    await transferService.rejectTransfer(req.params.id, req.body.reason);
    res.redirect(`/admin/transfers/${req.params.id}`);
  } catch (err) {
    next(err);
  }
});

router.post("/transfers/:id/hold", requireAdmin, async (req, res, next) => {
  try {
    await transferService.holdTransfer(req.params.id, req.body.reason);
    res.redirect(`/admin/transfers/${req.params.id}`);
  } catch (err) {
    next(err);
  }
});
router.get("/crypto", requireAdmin, async (req, res, next) => {
  try {
    const deposits = await CryptoDeposit.find()
      .populate("userId", "firstName lastName email")
      .sort({ createdAt: -1 });
    res.render("admin/crypto", {
      title: "Crypto deposits",
      layout: "layouts/admin",
      deposits,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/crypto/:id/approve", requireAdmin, async (req, res, next) => {
  try {
    await cryptoDepositService.approveDeposit(req.params.id);
    res.redirect("/admin/crypto");
  } catch (err) {
    next(err);
  }
});

router.post("/crypto/:id/reject", requireAdmin, async (req, res, next) => {
  try {
    await cryptoDepositService.rejectDeposit(req.params.id, req.body.reason);
    res.redirect("/admin/crypto");
  } catch (err) {
    next(err);
  }
});

// --- Settings (crypto addresses + card fee, minimal for now) ---
router.get("/settings", requireAdmin, async (req, res, next) => {
  try {
    const settings = await SystemSetting.getSettings();
    res.render("admin/settings", {
      title: "Settings",
      layout: "layouts/admin",
      settings,
      saved: false,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/settings", requireAdmin, async (req, res, next) => {
  try {
    const { bitcoin, ethereum, usdt, cardFee } = req.body;
    const settings = await SystemSetting.getSettings();

    settings.cryptoAddresses.bitcoin = bitcoin;
    settings.cryptoAddresses.ethereum = ethereum;
    settings.cryptoAddresses.usdt = usdt;
    settings.cardFee = Number(cardFee);
    await settings.save();

    res.render("admin/settings", {
      title: "Settings",
      layout: "layouts/admin",
      settings,
      saved: true,
    });
  } catch (err) {
    next(err);
  }
});
router.get("/card-topups", requireAdmin, async (req, res, next) => {
  try {
    const topUps = await CardTopUp.find()
      .populate("userId", "firstName lastName email")
      .sort({ createdAt: -1 });
    res.render("admin/card-topups", {
      title: "Card top-ups",
      layout: "layouts/admin",
      topUps,
    });
  } catch (err) {
    next(err);
  }
});

router.post(
  "/card-topups/:id/approve",
  requireAdmin,
  async (req, res, next) => {
    try {
      await cardTopUpService.approveCardTopUp(req.params.id);
      res.redirect("/admin/card-topups");
    } catch (err) {
      next(err);
    }
  },
);

router.post("/card-topups/:id/reject", requireAdmin, async (req, res, next) => {
  try {
    await cardTopUpService.rejectCardTopUp(req.params.id, req.body.reason);
    res.redirect("/admin/card-topups");
  } catch (err) {
    next(err);
  }
});

module.exports = router;
