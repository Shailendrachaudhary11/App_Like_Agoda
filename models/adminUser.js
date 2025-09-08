const mongoose = require('mongoose');

const AdminSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    phone: String,
    password: { type: String, required: true }, // hashed
    role: { type: String, default: 'admin' },
    profileImage: { type: String },
    otp: { type: String },                // OTP field
    otpExpiry: { type: Date },            // Expiry time
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Admin', AdminSchema);
