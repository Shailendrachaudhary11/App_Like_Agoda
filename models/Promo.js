const mongoose = require("mongoose");

const promoSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true }, // unique promo code
    discountType: { type: String, enum: ["flat", "percentage"], required: true }, // flat = ₹500 off, percentage = 20% off
    discountValue: { type: Number, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    promoImage: {
        type: String,
        trim: true
    },
    status: { type: String, default: "active" }
}, { timestamps: true });

module.exports = mongoose.model("Promo", promoSchema);
