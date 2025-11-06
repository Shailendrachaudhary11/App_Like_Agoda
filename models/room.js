const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
    guesthouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Guesthouse', required: true },

    roomCategory: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'RoomCategory', // Reference to RoomCategory model
        required: true,
    },

    bedType: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BedType', // Reference to BedType model
        required: true,
    },

    capacity: { type: Number, required: true },
    photos: [{ type: String }],   // Room photos

    facilities: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Facility', //  Reference to Facility model
        },
    ],
    pricePerNight: { type: Number, required: true },
    priceWeekly: { type: Number },
    priceMonthly: { type: Number },
    description: { type: String, required: true },
    active: { type: String, enum: ["active", "inactive"], default: "active" },
    availability: [
        {
            date: { type: Date, required: true },
            isAvailable: { type: Boolean, default: true }
        }
    ],

}, { timestamps: true });

module.exports = mongoose.model('Room', roomSchema);
