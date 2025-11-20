require("dotenv").config(); // top of your app
const express = require('express');
const connectDB = require('./config/db');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
const guestHouseRoutes = require('./routes/guesthouseRoutes');
const customerRoutes = require("./routes/customerRoutes");
const webRoutes = require("./routes/webRoutes");
const ensureUploadDirs = require("./utils/createUploadDirs");
const path = require("path");
const cors = require("cors");

const app = express();
app.use(cors());

// serve uploads folder
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/invoices", express.static(path.join(__dirname, "public/invoices")));

// Connect to DB
connectDB();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure upload directories exist
ensureUploadDirs([
  "uploads/guestHouseImage",
  "uploads/profileImage",
  "uploads/adminImage",
  "uploads/rooms",
  "uploads/atolls",
  "uploads/promoImage"
]);

app.use('/api/adminAuth', adminRoutes);
app.use('/api', userRoutes);
app.use('/api', guestHouseRoutes);
app.use('/api', customerRoutes);
app.use('/api/web', webRoutes);

// Start server
const PORT = process.env.PORT || 5050;
app.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on all network interfaces");
});




