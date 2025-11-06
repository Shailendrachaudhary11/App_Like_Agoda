const mongoose = require('mongoose');

const atollSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    atollImage: {
        type: String,
        required: true,
        trim: true
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    },
}, { timestamps: true });



module.exports = mongoose.model('Atoll', atollSchema);

