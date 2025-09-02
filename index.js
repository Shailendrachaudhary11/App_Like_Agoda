const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
const guestHouseRoutes=require('./routes/guesthouseRoutes')

dotenv.config();
const app = express();

// connect DB
connectDB();

// middleware
app.use(express.json());

// routes for customer or guestHouse Owner
app.use('/api/userAuth', userRoutes);

// route for admin Registration
app.use('/api/adminAuth', adminRoutes);

// routes for work with guestHouese
app.use('/api/guestHouse',guestHouseRoutes)


// start server
const PORT = process.env.PORT || 5050;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
