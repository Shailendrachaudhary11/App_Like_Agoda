// models/Notification.js
const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // Guesthouse Admin / Customer
  type: { type: String, enum: ["booking", "payment", "general"], required: true },
  message: { type: String, required: true },
  data: { type: Object }, // extra info like bookingId, amount etc.
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Notification", notificationSchema);
