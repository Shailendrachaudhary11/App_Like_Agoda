const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    sender: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      role: {
        type: String,
        enum: ["customer", "guesthouse", "admin"],
        required: true,
      },
    },
    receiver: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      role: {
        type: String,
        enum: ["customer", "guesthouse", "admin"],
        required: true,
      },
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    // type: {
    //   type: String,
    //   enum: ["booking", "payment", "system", "alert", "general"],
    //   default: "general",
    // },
    isRead: { type: Boolean, default: false },
   
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", notificationSchema);
