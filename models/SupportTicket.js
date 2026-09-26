const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: { type: String, enum: ['customer', 'admin'], required: true },
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const supportTicketSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  subject: { type: String, required: true },
  category: { type: String },
  messages: [messageSchema],

  status: {
    type: String,
    enum: ['open', 'pending', 'resolved', 'closed'],
    default: 'open'
  }
}, { timestamps: true });

module.exports = mongoose.model('SupportTicket', supportTicketSchema);
