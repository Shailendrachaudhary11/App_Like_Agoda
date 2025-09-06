const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    phone: String,
    password: { type: String, required: true }, // hashed
    role: { 
        type: String, 
        enum: [ 'guesthouse_admin', 'customer'], 
        default: 'customer' 
    },
    profileImage: {type:String},
    isVerified: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);
