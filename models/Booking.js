const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  guesthouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Guesthouse', required: true },
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  checkIn: Date,
  checkOut: Date,
  nights: Number,
  amount: Number,
  status: { type: String, enum: ['pending','confirmed','cancelled','refunded'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Booking', bookingSchema);
