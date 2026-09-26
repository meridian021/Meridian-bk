module.exports = function errorHandler(err, req, res, next) {
  console.error(err); // full technical detail stays server-side only

  const status = err.status || 500;
  res.status(status).render('errors/generic', {
    title: 'Something went wrong',
    layout: false,
    message: status === 500
      ? 'Something went wrong. Please try again.'
      : (err.publicMessage || 'We could not complete that request.')
  });
};
