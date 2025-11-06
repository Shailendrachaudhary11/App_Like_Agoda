// uploadMiddleware.js
const multer = require("multer");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const rootDir = path.join(__dirname, ".."); // project root

// Multer storage config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let folder = "uploads/others";

    if (file.fieldname === "adminImage") folder = "uploads/adminImage";
    else if (file.fieldname === "guestHouseImage") folder = "uploads/guestHouseImage";
    else if (file.fieldname === "photos") folder = "uploads/rooms";
    else if (file.fieldname === "profileImage") folder = "uploads/profileImage";
    else if (file.fieldname === "atollImage") folder = "uploads/atolls";
    else if (file.fieldname === "promoImage") folder = "uploads/promoImage";

    const fullPath = path.join(rootDir, folder);

    if (!fs.existsSync(fullPath)) fs.mkdirSync(fullPath, { recursive: true });

    cb(null, fullPath);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  },
});

// Allow all file types
const fileFilter = (req, file, cb) => {
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter
});

module.exports = upload;
