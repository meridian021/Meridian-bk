module.exports = function requireAdmin(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/admin/login');
  }
  if (req.session.user.role !== 'admin') {
    return res.status(403).render('errors/403', { title: 'Forbidden', layout: false });
  }
  next();
};
