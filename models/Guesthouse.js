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
    guestHouseImage: { type: [String] }, // guestHouse Image
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    stars: { type: Number, min: 0, max: 5, default: 0 },
    // bedroom: { type: Number, enum: [1, 2, 3], required: true },
    price: { type: Number, required: true },
    facilities: {
        type: [String],
        default: []
    },
    atolls: String,
    islands: String,
    createdAt: { type: Date, default: Date.now },
});

guesthouseSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Guesthouse', guesthouseSchema);


// mobappssolutions124@gmail.com
// 124Mobapps