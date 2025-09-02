const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
    guesthouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Guesthouse', required: true },
    title: String,
    description: String,
    images: [String],
    amenities: [String],
    pricePerNight: { type: Number, required: true },
    priceWeekly: Number,
    priceMonthly: Number,
    capacity: Number,
    availability: [{ date: Date, available: Boolean }], // or use a calendar service
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Room', roomSchema);
