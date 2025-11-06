const mongoose = require('mongoose');

const AdminSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        minlength: [3, 'Name must be at least 3 characters long'],
        maxlength: [50, 'Name cannot exceed 50 characters'],
        match: [/^[A-Za-z\s]+$/, 'Name should contain only alphabets'] // Only letters allowed
    },

    email: {
        type: String,
        unique: true,
        required: [true, 'Email is required'],
        match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
    },

    phone: {
        type: String,
        match: [/^\d{10}$/, 'Phone number must be 10 digits'] // optional validation
    },

    password: {
        type: String,
        required: [true, 'Password is required']
    },

    role: {
        type: String,
        default: 'admin'
    },

    adminImage: {
        type: String
    },

    otp: {
        type: String
    },

    otpExpiry: {
        type: Date
    },

    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Admin', AdminSchema);
