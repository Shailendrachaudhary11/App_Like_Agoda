const mongoose = require('mongoose');
require('dotenv').config();  // to load .env file

const connectDB = async () => {
    try {
        const mongoURI = process.env.MONGO_URI;
        await mongoose.connect(mongoURI, {
        });
        console.log('MongoDB connected....');
    } catch (error) {
        console.error('MongoDB connection failed:', error.message);
        process.exit(1); // stop server if DB not connected
    }
};

module.exports = connectDB;
