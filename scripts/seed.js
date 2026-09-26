require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const SystemSetting = require('../models/SystemSetting');

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected for seeding...');

  const adminEmail = (process.env.SEED_ADMIN_EMAIL || 'admin@meridianbank.demo').toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!';

  const existingAdmin = await User.findOne({ email: adminEmail });
  if (existingAdmin) {
    console.log(`Admin already exists: ${adminEmail}`);
  } else {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await User.create({
      firstName: 'Meridian',
      lastName: 'Admin',
      email: adminEmail,
      passwordHash,
      role: 'admin',
      country: 'US',
      currency: 'USD',
      accountStatus: 'active',
      emailVerified: true
    });
    console.log(`Created dev admin: ${adminEmail} / ${adminPassword}`);
    console.log('Change SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD in your .env before re-running for a real deployment.');
  }

  await SystemSetting.getSettings(); // ensures the singleton settings doc exists
  console.log('System settings initialized.');

  await mongoose.disconnect();
  console.log('Done.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
