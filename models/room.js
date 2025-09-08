const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
    guesthouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Guesthouse', required: true },
    roomNumber: { type: String, required: true},
    title: { type: String, required: true },
    description: { type: String, required: true },
    photos: [{ type: String }],
    amenities: [{ type: String }],
    priceWeekly: { type: Number },
    pricePerNight: { type: Number, required: true },
    priceMonthly: { type: Number },
    capacity: { type: Number },
    availability: [
        {
            startDate: { type: Date, required: true },
            endDate: { type: Date, required: true },
            isAvailable: { type: Boolean, default: true }
        }
    ],
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Room', roomSchema);
