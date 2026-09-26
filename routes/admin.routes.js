const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();

const requireAdmin = require('../middleware/requireAdmin');
const User = require('../models/User');
const Account = require('../models/Account');

router.get('/login', (req, res) => {
  res.render('admin/login', { title: 'Admin login', error: null, layout: false });
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const admin = await User.findOne({ email: email.toLowerCase(), role: 'admin' });

    if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
      return res.status(401).render('admin/login', {
        title: 'Admin login',
        error: 'Incorrect email or password.',
        layout: false
      });
    }

    req.session.user = { id: admin._id, firstName: admin.firstName, role: admin.role };
    res.redirect('/admin/dashboard');
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

router.get('/dashboard', requireAdmin, async (req, res, next) => {
  try {
    const totalCustomers = await User.countDocuments({ role: 'customer' });
    const pendingKyc = await User.countDocuments({ kycStatus: 'pending' });
    const tierCounts = await Account.aggregate([
      { $group: { _id: '$tier', count: { $sum: 1 } } }
    ]);

    res.render('admin/dashboard', {
      title: 'Admin overview',
      layout: 'layouts/admin',
      totalCustomers,
      pendingKyc,
      tierCounts
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
