const mongoose = require('mongoose');

const guesthouseSchema = new mongoose.Schema({
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: String,
    address: String,
    city: String,
    state: String,
    // location: { type: { type: String, default: 'Point' }, coordinates: [Number] }, // [lng, lat]
    contactNumber: String,
    description: String,
    // images: [String],
    status: { type: String, enum: ['pending', 'approved', 'suspended'], default: 'pending' },
    createdAt: { type: Date, default: Date.now }
});
guesthouseSchema.index({ location: '2dsphere' });
module.exports = mongoose.model('Guesthouse', guesthouseSchema);
