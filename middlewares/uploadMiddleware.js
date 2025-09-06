// upload.js
const multer = require("multer");
const path = require("path");

const rootDir = path.join(__dirname, ".."); 
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(rootDir, "uploads/guestHouse"));
    },
    filename: function (req, file, cb) {
        cb(
            null,
            Date.now() +
            "-" +
            Math.round(Math.random() * 1e9) +
            path.extname(file.originalname)
        );
    },
});

// ✅ Allow all file types
const fileFilter = (req, file, cb) => {
    cb(null, true);
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 50 * 1024 * 1024 },
});

module.exports = upload;
