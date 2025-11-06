const mongoose = require('mongoose');

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^(\+?\d{1,3}[- ]?)?\d{10}$/;

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        minlength: [3, 'Name must be at least 3 characters long'],
        maxlength: [50, 'Name cannot exceed 50 characters'],
    },
    email: {
        type: String,
        unique: true,
        required: [true, 'Email is required'],
        lowercase: true,
        trim: true,
        match: [emailRegex, 'Please enter a valid email address'],
    },

    phone: {
        type: String,
        unique: true,
        required: [true, 'Phone number is required'],
        match: [phoneRegex, 'Please enter a valid phone number'],
    },

    address: {
        type: String,
        trim: true,
        maxlength: [200, 'Address cannot exceed 200 characters'],
    },

    password: { type: String, required: true }, // hashed
    role: {
        type: String,
        enum: ['guesthouse', 'customer'],
        default: 'customer'
    },
    profileImage: { type: String },
    status: { type: String, enum: ['inactive', 'active'], default: 'inactive' },
    otp: { type: String },                // OTP field  
    otpExpiry: { type: Date },
    lastNotificationCheck: {
        type: Date,
        default: null
    },

}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
