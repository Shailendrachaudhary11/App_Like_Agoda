const mongoose = require('mongoose');

const islandSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    atoll: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Atoll', // reference to Atoll model
        required: true
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    }
}, { timestamps: true });

module.exports = mongoose.model('Island', islandSchema);
