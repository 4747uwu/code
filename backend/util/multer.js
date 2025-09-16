const multer = require("multer");
const fs = require("fs");
const path = require("path");

const ensureDirExists = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

module.exports = multer.diskStorage({
  filename: (req, file, callback) => {
    const filename = Date.now() + Math.floor(Math.random() * 100) + path.extname(file.originalname);
    callback(null, filename);
  },

  destination: (req, file, callback) => {
    let uploadFolder = "storage";

    ensureDirExists(uploadFolder);
    callback(null, uploadFolder);
  },
});
