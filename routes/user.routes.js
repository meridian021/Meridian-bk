const express = require("express");
const router = express.Router();

const requireAuth = require("../middleware/requireAuth");
const User = require("../models/User");
const Account = require("../models/Account");
const Transaction = require("../models/Transaction");

router.get("/dashboard", requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.session.user.id);
    const account = await Account.findOne({ userId: user._id });
    const recentTransactions = await Transaction.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(5);

    res.render("customer/dashboard", {
      title: "Dashboard",
      user,
      account,
      recentTransactions,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/transactions", requireAuth, async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const perPage = 20;

    const totalCount = await Transaction.countDocuments({
      userId: req.session.user.id,
    });
    const transactions = await Transaction.find({ userId: req.session.user.id })
      .sort({ createdAt: -1 })
      .skip((page - 1) * perPage)
      .limit(perPage);

    res.render("customer/transactions", {
      title: "Transactions",
      transactions,
      currentPage: page,
      totalPages: Math.ceil(totalCount / perPage) || 1,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/profile", requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.session.user.id);
    res.render("customer/profile", { title: "Profile", user, success: false });
  } catch (err) {
    next(err);
  }
});

router.post("/profile", requireAuth, async (req, res, next) => {
  try {
    const { phone, occupation, employer, address, city, state, postalCode } =
      req.body;

    const user = await User.findByIdAndUpdate(
      req.session.user.id,
      { phone, occupation, employer, address, city, state, postalCode },
      { new: true, runValidators: true },
    );

    res.render("customer/profile", { title: "Profile", user, success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
