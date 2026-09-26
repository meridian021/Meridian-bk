const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, trim: true },
  passwordHash: { type: String, required: true },

  role: { type: String, enum: ['customer', 'admin'], default: 'customer' },

  country: { type: String, required: true },      // ISO country code, e.g. "US"
  currency: { type: String, required: true },      // derived from country at registration

  dateOfBirth: { type: Date },
  gender: { type: String },
  nationality: { type: String },

  address: { type: String },
  city: { type: String },
  state: { type: String },
  postalCode: { type: String },

  occupation: { type: String },
  employer: { type: String },

  profileImage: { type: String },

  emailVerified: { type: Boolean, default: false },
  emailVerificationCode: { type: String },
  emailVerificationExpires: { type: Date },

  passwordResetToken: { type: String },
  passwordResetExpires: { type: Date },

  kycStatus: {
    type: String,
    enum: ['not_started', 'pending', 'approved', 'rejected', 'more_info_required'],
    default: 'not_started'
  },

  accountStatus: {
    type: String,
    enum: ['pending', 'active', 'suspended', 'frozen', 'closed'],
    default: 'pending'
  }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
