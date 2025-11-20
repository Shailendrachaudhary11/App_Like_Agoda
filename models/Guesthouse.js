const mongoose = require('mongoose');

const guesthouseSchema = new mongoose.Schema({
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: String,
    address: String,
    location: {
        type: { type: String, default: 'Point' },
        coordinates: [Number] // [lng, lat]
    },
    contactNumber: String,
    description: String,
    guestHouseImage: { type: [String] },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    isFavourite: {
        type: Number,
        enum: [0, 1],   // Only 0 or 1 allowed
        default: 0
    },

    price: { type: Number, required: true },

    cleaningFee: {
        type: Number,
        default: 200,
        set: v => typeof v === 'string' ? parseFloat(v) : v
    },
    taxPercent: {
        type: Number,
        default: 12,
        set: v => typeof v === 'string' ? parseFloat(v) : v
    },

    atolls: { type: mongoose.Schema.Types.ObjectId, ref: 'Atoll' },
    islands: { type: mongoose.Schema.Types.ObjectId, ref: 'Island' },
    facilities: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Facility' }],

}, { timestamps: true });

guesthouseSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Guesthouse', guesthouseSchema);

