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

//update admin profile
exports.modifyAdminProfile = async (req, res) => {
  try {
    const adminId = req.admin._id;

    const admin = await Admin.findById(adminId).select("name email image password").lean();
    if (!admin) {
      if (req.file) deleteFile(req.file);
      return res.status(200).json({ status: false, message: "Admin not found!" });
    }

    const updateFields = {
      name: req.body?.name || admin.name,
      email: req.body?.email ? req.body.email.trim() : admin.email,
    };

    if (req.file) {
      console.log("📁 New file uploaded:", req.file);

      // Delete old image if exists
      if (admin.image) {
        const oldImagePath = path.join(__dirname, "../", admin.image);
        console.log("🗑️ Attempting to delete old image:", oldImagePath);

        if (fs.existsSync(oldImagePath)) {
          const imageName = path.basename(oldImagePath);
          if (!["male.png", "female.png"].includes(imageName)) {
            try {
              fs.unlinkSync(oldImagePath);
              console.log("✅ Old image deleted successfully");
            } catch (deleteError) {
              console.error("❌ Error deleting old image:", deleteError);
            }
          }
        }
      }

      // Set new image path (relative to backend root)
      updateFields.image = req.file.path.replace(__dirname + "/../", "");
      console.log("📸 New image path:", updateFields.image);
    }

    const updatedAdmin = await Admin.findByIdAndUpdate(
      req.admin._id,
      updateFields,
      { new: true, select: "name email image password" }
    ).lean();

    if (!updatedAdmin) {
      if (req.file) deleteFile(req.file);
      return res.status(200).json({ status: false, message: "Failed to update admin profile" });
    }

    updatedAdmin.password = cryptr.decrypt(updatedAdmin.password);

    console.log("✅ Admin profile updated successfully:", updatedAdmin);

    return res.status(200).json({
      status: true,
      message: "Admin profile has been updated.",
      data: updatedAdmin,
    });
  } catch (error) {
    if (req.file) deleteFile(req.file);
    console.error("❌ Error updating admin profile:", error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};
