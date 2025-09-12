const Notification = require("../models/notification");

exports.createNotification = async (userId, type, message, data = {}) => {
  try {
    const notification = new Notification({
      user: userId,
      type,
      message,
      data
    });
    await notification.save();
  } catch (err) {
    console.error("[NOTIFICATION ERROR]", err.message);
  }
};
