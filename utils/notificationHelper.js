const Notification = require("../models/notification");

const createNotification = async (sender, receiver, title, message, type="general", metadata = {}) => {
  try {
    const notification = new Notification({
      sender,
      receiver,
      title,
      message,
      type,
      metadata
    });
    await notification.save();
    return notification;
  } catch (err) {
    console.error("[NOTIFICATION ERROR]", err.message);
  }
};

module.exports = createNotification;
