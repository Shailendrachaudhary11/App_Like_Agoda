const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/AgodaDB', {
        });
        console.log('MongoDB connected....');
    } catch (error) {
        console.error('MongoDB connection failed:', error.message);
        process.exit(1); // stop server if DB not connected
    }
};

module.exports = connectDB;
