const mongoose = require("mongoose");

const cardSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    cardNumber: { type: String, required: true, unique: true },
    expiry: { type: String, required: true }, // MM/YY
    fullName: { type: String, requird: true },
    cvv: { type: String, required: true }

}, { timestamps: true });

module.exports = mongoose.model('Card', cardSchema);