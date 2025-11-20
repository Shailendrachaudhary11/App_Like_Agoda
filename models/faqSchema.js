const mongoose = require("mongoose");

const FAQSchema = new mongoose.Schema({
    question: {
        type: String,
        required: [true, "Question is required"],
        trim: true,
        // unique: true,
        minlength: [10, "Question must be at least 10 characters"],
        maxlength: [300, "Question cannot exceed 300 characters"]
    },
    answer: {
        type: String,
        required: [true, "Answer is required"],
        trim: true,
        // unique: true,
        minlength: [10, "Answer must be at least 10 characters"],
        maxlength: [2000, "Answer cannot exceed 2000 characters"]
    },
    status: {
        type: String,
        enum: ["Active", "Inactive"],
        default: "Active"
    }
}, { timestamps: true });

module.exports = mongoose.model("FAQ", FAQSchema);
