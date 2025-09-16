const Notification = require("../models/notification");

const createNotification = async (userId, type, message, data = {}) => {
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

module.exports = createNotification; // default export
