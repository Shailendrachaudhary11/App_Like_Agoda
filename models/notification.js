const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    sender: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // किसने भेजा
      role: {
        type: String,
        enum: ["customer", "guesthouse", "master_admin"],
        required: true,
      },
    },
    receiver: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // किसको भेजा
      role: {
        type: String,
        enum: ["customer", "guesthouse", "master_admin"],
        required: true,
      },
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: ["booking", "payment", "system", "alert", "general"],
      default: "general",
    },
    isRead: { type: Boolean, default: false },
    metadata: { type: Object }, // extra info (bookingId, guesthouseId, etc.)
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", notificationSchema);
