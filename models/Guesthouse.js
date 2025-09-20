const mongoose = require('mongoose');

const guesthouseSchema = new mongoose.Schema({
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: String,
    city: String,
    state: String,
    location: {
        type: { type: String, default: 'Point' },
        coordinates: [Number] // [lng, lat]
    }, 
    contactNumber: String,
    description: String,
    guestHouseImage: { type: [String] }, // guestHouse Image
    status: { type: String, enum: ['active','inactive'], default: 'active' },
    createdAt: { type: Date, default: Date.now }
});
guesthouseSchema.index({ location: '2dsphere' });
module.exports = mongoose.model('Guesthouse', guesthouseSchema);