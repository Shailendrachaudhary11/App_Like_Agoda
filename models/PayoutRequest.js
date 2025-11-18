const mongoose = require("mongoose");

const payoutRequestSchema = new mongoose.Schema({

    guesthouse: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Guesthouse",
        required: [true, "Guesthouse ID is required"]
    },

    payoutId: {
        type: String,
        required: true,
        unique: true
    },

    amount: {
        type: Number,
        required: [true, "Payout amount is required"],
        min: [1000, "Minimum payout amount is MVR 1000"]
    },

    bankName: {
        type: String,
        required: [true, "Bank name is required"],
        trim: true,
        minlength: [3, "Bank name must be at least 3 characters"]
    },

    accountNumber: {
        type: String,
        required: [true, "Account number is required"],
        trim: true,
        minlength: [6, "Account number must be at least 6 digits"],
        maxlength: [25, "Account number must not exceed 25 digits"],
        match: [/^[0-9]+$/, "Account number must contain only digits"]
    },

    branchCode: {
        type: String,
        required: [true, "Branch code is required"],
        trim: true,
        minlength: [2, "Branch code must be at least 2 characters"],
        maxlength: [20, "Branch code must not exceed 20 characters"]
    },

    swiftCode: {
        type: String,
        required: [true, "SWIFT code is required"],
        trim: true,
        uppercase: true,
        minlength: [8, "SWIFT code must be at least 8 characters"],
        maxlength: [11, "SWIFT code must not exceed 11 characters"],
        match: [/^[A-Za-z0-9]+$/, "SWIFT code must contain only alphabets & numbers"]
    },

    status: {
        type: String,
        enum: ["Pending", "Approved", "Rejected"],
        default: "Pending"
    },

    adminRemark: {
        type: String,
        trim: true,
        maxlength: [200, "Admin remark cannot exceed 200 characters"]
    },

    //  Only ONE date field — for approved OR rejected
    actionDate: {
        type: Date
    },

}, { timestamps: true });


// ⭐ Speed optimization for admin dashboard
payoutRequestSchema.index({ status: 1, createdAt: -1 });
payoutRequestSchema.index({ guesthouse: 1 });

module.exports = mongoose.model("PayoutRequest", payoutRequestSchema);
