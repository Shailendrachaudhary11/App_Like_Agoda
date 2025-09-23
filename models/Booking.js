const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  guesthouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Guesthouse', required: true },
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },

  checkIn: Date,
  checkOut: Date,
  nights: Number,

  // Amount details
  amount: { type: Number, required: true },       // base price
  discount: { type: Number, default: 0 },         // discount applied
  finalAmount: { type: Number, required: true },  // after discount
  promoCode: { type: String, default: null },     // promo code used

  status: {
    type: String,
    enum: [
      'pending',      // Customer booked
      'confirmed',    // after payment done 
      'cancelled',    // Cancelled by customer or guesthouse
    ],
    default: 'pending'
  },

  reason: { type: String }, 
  paymentStatus: { type: String, enum: ['unpaid', 'paid', 'refunded'], default: 'unpaid' },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Booking', bookingSchema);
