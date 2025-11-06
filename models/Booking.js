const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  guesthouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Guesthouse', required: true },
  room: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: true
    }
  ],

  checkIn: Date,
  checkOut: Date,
  nights: Number,

  // Amount details
  amount: { type: Number, required: true },
  guest: { type: Number },

  cleaningFee: { type: Number, required: true },
  taxAmount: { type: Number, required: true },
  discount: { type: Number, default: 0 },

  finalAmount: { type: Number, required: true },

  promoCode: { type: String },

  status: {
    type: String,
    enum: [
      'confirmed',    // after payment done 
      'cancelled',    // Cancelled by customer or guesthouse
      'completed',
    ],
    default: 'pending'
  },

  reason: { type: String },

}, { timestamps: true });

module.exports = mongoose.model('Booking', bookingSchema);
