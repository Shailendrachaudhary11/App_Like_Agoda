const fs = require("fs");
const path = require("path");

function ensureUploadDirs(dirs) {
  dirs.forEach((dir) => {
    const uploadDir = path.join(__dirname, "..", dir); // root ke andar folder
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      console.log(`📂 ${dir} folder created at startup`);
    }
  });
}

module.exports = ensureUploadDirs;
