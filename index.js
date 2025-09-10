require("dotenv").config(); // top of your app
const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
const guestHouseRoutes = require('./routes/guesthouseRoutes');
const ensureUploadDirs = require("./utils/createUploadDirs");
const customerRoutes = require("./routes/customerRoutes")



const app = express();

console.log("SMTP_HOST:", process.env.SMTP_HOST);
console.log("SMTP_PORT:", process.env.SMTP_PORT);
console.log("SMTP_SECURE:", process.env.SMTP_SECURE);



// connect DB
connectDB();

// middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


ensureUploadDirs([
  "uploads/guestHouse",
  "uploads/users",
  "uploads/admin",
  "uploads/rooms"
]);

// route for admin Registration
app.use('/api/adminAuth', adminRoutes);

// registration and login for guest house owner and customer
app.use('/api/userAuth', userRoutes);

// routes for work with guestHouse
app.use('/api/guestHouse', guestHouseRoutes);

// customer 
app.use('/api/customer', customerRoutes)

// start server
const PORT = process.env.PORT || 5050;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
