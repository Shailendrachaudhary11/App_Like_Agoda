const mongoose = require("mongoose");

const promoSchema = new mongoose.Schema({
    guesthouse: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Guesthouse",
        required: true
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User", // Guesthouse owner
        required: true
    },
    code: { type: String, required: true, unique: true }, // unique promo code
    discountType: { type: String, enum: ["flat", "percentage"], required: true }, // flat = ₹500 off, percentage = 20% off
    discountValue: { type: Number, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    maxUsage: { type: Number, default: null }, // null = unlimited
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model("Promo", promoSchema);
