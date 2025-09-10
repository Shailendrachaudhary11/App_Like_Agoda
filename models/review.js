const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  guesthouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Guesthouse' },
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
  rating: { type: Number, min: 1, max: 5 },
  comment: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Review', reviewSchema);  
