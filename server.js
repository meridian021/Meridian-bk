require('dotenv').config();

const express = require('express');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');
const MongoStore = require('connect-mongo');

const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const accountRoutes = require('./routes/account.routes');
const adminRoutes = require('./routes/admin.routes');

const app = express();

// --- Database ---
connectDB();

// --- View engine ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/main');

// --- Core middleware ---
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Sessions (stored in MongoDB so they survive restarts/deploys on Render) ---
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  }
}));

// --- Locals available to every view ---
app.use((req, res, next) => {
  res.locals.bankName = process.env.BANK_NAME || 'Meridian Bank';
  res.locals.currentUser = req.session.user || null;
  next();
});

// --- Routes ---
app.get('/', (req, res) => {
  res.render('customer/landing', { title: 'Welcome' });
});

app.use('/auth', authRoutes);
app.use('/account', userRoutes);
app.use('/account', accountRoutes);
app.use('/admin', adminRoutes);

// --- 404 ---
app.use((req, res) => {
  res.status(404).render('errors/404', { title: 'Not found', layout: false });
});

// --- Centralized error handler ---
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`${process.env.BANK_NAME || 'Meridian Bank'} server running on port ${PORT}`);
});
