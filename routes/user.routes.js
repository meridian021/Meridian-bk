const express = require('express');
const router = express.Router();

const requireAuth = require('../middleware/requireAuth');
const User = require('../models/User');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');

router.get('/dashboard', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.session.user.id);
    const account = await Account.findOne({ userId: user._id });
    const recentTransactions = await Transaction.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(5);

    res.render('customer/dashboard', {
      title: 'Dashboard',
      user,
      account,
      recentTransactions
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
