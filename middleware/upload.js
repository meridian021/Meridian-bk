const multer = require("multer");

const allowedMimeTypes = ["image/jpeg", "image/png", "application/pdf"];

function fileFilter(req, file, cb) {
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPG, PNG, or PDF files are allowed"));
  }
}

const upload = multer({
  storage: multer.memoryStorage(), // keeps the file in memory just long enough to save it to MongoDB
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

module.exports = upload;
