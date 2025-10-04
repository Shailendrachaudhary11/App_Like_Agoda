const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
    guesthouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Guesthouse', required: true },

    roomCategory: {
        type: String,
        enum: ["Standard", "Deluxe", "Suite", "Family", "Dormitory"],
        required: true
    },

    bedType: {
        type: String,
        enum: ["1 Bedroom", "2 Bedroom", "3 Bedroom", "4 Bedroom"],
        required: true
    },
    capacity: { type: Number, required: true },
    photos: [{ type: String }],   // Room photos

    amenities: [{ type: String }], // Wi-Fi, AC, TV, etc.

    pricePerNight: { type: Number, required: true },

    priceWeekly: { type: Number },

    priceMonthly: { type: Number },

    description: { type: String, required: true },

    active: { type: String, enum: ["active", "inactive"], default: "active" },

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
