const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    phone: {type: String, unique: true, required: true },
    address: {type: String},
    password: { type: String, required: true }, // hashed
    role: {
        type: String,
        enum: ['guesthouse', 'customer'],
        default: 'customer'
    },
    profileImage: { type: String },
    status: { type: String, enum: ['pending', 'approved', 'suspended','reject'], default: 'pending' },
    otp: { type: String },                // OTP field  
    otpExpiry: { type: Date },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);
