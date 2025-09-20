const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  guesthouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Guesthouse', required: true },
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },

  checkIn: Date,
  checkOut: Date,
  nights: Number,
  amount: Number,

  status: {
    type: String,
    enum: [
      'pending',      // Customer booked
      'confirmed',    //  after payment done 
      'rejected',     // Guesthouse rejected
      'cancelled',    // Cancelled by customer or guesthouse
    ],
    default: 'pending'
  },

  reason: { type: String }, // rejection/cancellation reason
  paymentStatus: { type: String, enum: ['unpaid', 'paid', 'refunded'], default: 'unpaid' },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});


module.exports = mongoose.model('Booking', bookingSchema);
