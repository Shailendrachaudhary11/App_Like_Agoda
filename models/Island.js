const mongoose = require('mongoose');

const islandSchema = new mongoose.Schema({
    name: { type: String, required: true },
    atoll: { type: mongoose.Schema.Types.ObjectId, ref: 'Atoll' },
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Island', islandSchema);
