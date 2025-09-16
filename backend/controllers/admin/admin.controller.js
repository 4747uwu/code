const Admin = require("../../models/admin.model");
const jwt = require("jsonwebtoken");

//fs
const fs = require("fs");

//nodemailer
const nodemailer = require("nodemailer");

//Cryptr
const Cryptr = require("cryptr");
const cryptr = new Cryptr("myTotallySecretKey");

//deletefile
const { deleteFile } = require("../../util/deletefile");

//firebase admin
const admin = require("firebase-admin");

//admin signup
exports.signUp = async (req, res) => {
  try {
    const { email, password, code } = req.body;

    if (!email || !password || !code) {
      return res.status(200).json({ status: false, message: "All fields are required!" });
    }

    // Check if admin already exists in database
    const existingAdmin = await Admin.findOne({ email: email.trim() }).lean();
    if (existingAdmin) {
      return res.status(200).json({ status: false, message: "Admin with this email already exists!" });
    }

    // Validate purchase code
    if (code !== "secretKey") {
      return res.status(200).json({ status: false, message: "Invalid purchase code!" });
    }

    try {
      // Create user in Firebase Authentication
      const firebaseUser = await admin.auth().createUser({
        email: email.trim(),
        password: password,
        displayName: email.split('@')[0],
        emailVerified: true
      });

      console.log("✅ Firebase user created:", firebaseUser.uid);

      // Create admin in database with Firebase UID
      const newAdmin = new Admin({
        email: email.trim(),
        password: cryptr.encrypt(password),
        name: email.split('@')[0],
        uid: firebaseUser.uid, // Store Firebase UID
        flag: true
      });

      const savedAdmin = await newAdmin.save();

      return res.status(200).json({
        status: true,
        message: "Admin registered successfully in both Firebase and database!",
        data: {
          _id: savedAdmin._id,
          email: savedAdmin.email,
          name: savedAdmin.name,
          uid: savedAdmin.uid
        }
      });

    } catch (firebaseError) {
      console.error("❌ Firebase user creation failed:", firebaseError);
      return res.status(200).json({ 
        status: false, 
        message: "Failed to create admin in Firebase: " + firebaseError.message 
      });
    }

  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};

//admin login
exports.validateAdminLogin = async (req, res) => {
  try {
    console.log("🔹 Admin login attempt:", req.body);
    
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(200).json({ status: false, message: "Oops! Invalid details!" });
    }

    const adminUser = await Admin.findOne({ email: email.trim() }).select("_id password flag name email uid").lean();

    if (!adminUser) {
      return res.status(200).json({ status: false, message: "Oops! Admin not found with that email." });
    }

    if (cryptr.decrypt(adminUser.password) !== password) {
      return res.status(200).json({ status: false, message: "Oops! Password doesn't match!" });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        _id: adminUser._id,
        email: adminUser.email,
        name: adminUser.name,
        flag: adminUser.flag,
        uid: adminUser.uid
      },
      process.env.JWT_SECRET || "JWT_SECRET",
      { expiresIn: "30d" }
    );

    console.log("✅ Admin login successful");

    return res.status(200).json({
      status: true,
      message: "Admin has successfully logged in.",
      data: adminUser,
      token: token
    });
  } catch (error) {
    console.error("❌ Admin login error:", error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};

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
      if (admin.image) {
        const imagePath = admin.image.includes("storage") ? "storage" + admin.image.split("storage")[1] : "";
        if (imagePath && fs.existsSync(imagePath)) {
          const imageName = imagePath.split("/").pop();
          if (!["male.png", "female.png"].includes(imageName)) {
            fs.unlinkSync(imagePath);
          }
        }
      }
      updateFields.image = req.file.path;
    }

    const [updatedAdmin] = await Promise.all([Admin.findByIdAndUpdate(req.admin._id, updateFields, { new: true, select: "name email image password" }).lean()]);

    updatedAdmin.password = cryptr.decrypt(updatedAdmin.password);

    return res.status(200).json({
      status: true,
      message: "Admin profile has been updated.",
      data: updatedAdmin,
    });
  } catch (error) {
    if (req.file) deleteFile(req.file);
    console.log(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//get admin profile
exports.retrieveAdminProfile = async (req, res) => {
  try {
    const adminId = req.admin._id;

    const [admin] = await Promise.all([Admin.findById(adminId).select("_id name email password image flag").lean()]);

    if (!admin) {
      return res.status(200).json({ status: false, message: "Admin not found." });
    }

    admin.password = cryptr.decrypt(admin.password);

    return res.status(200).json({
      status: true,
      message: "Admin profile retrieved successfully!",
      data: admin,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//update password
exports.modifyPassword = async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin._id);
    if (!admin) {
      return res.status(200).json({ status: false, message: "admin does not found." });
    }

    if (!req.body.oldPass || !req.body.newPass || !req.body.confirmPass) {
      return res.status(200).json({ status: false, message: "Oops! Invalid details!" });
    }

    if (cryptr.decrypt(admin.password) !== req.body.oldPass) {
      return res.status(200).json({
        status: false,
        message: "Oops! Password doesn't match!",
      });
    }

    if (req.body.newPass !== req.body.confirmPass) {
      return res.status(200).json({
        status: false,
        message: "Oops ! New Password and Confirm Password don't match!",
      });
    }

    const hash = cryptr.encrypt(req.body.newPass);
    admin.password = hash;

    const [savedAdmin, data] = await Promise.all([admin.save(), Admin.findById(admin._id)]);

    data.password = cryptr.decrypt(savedAdmin.password);

    return res.status(200).json({
      status: true,
      message: "Password has been changed by the admin.",
      data: data,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//set Password
exports.performPasswordReset = async (req, res) => {
  try {
    const admin = await Admin.findById(req?.admin._id);
    if (!admin) {
      return res.status(200).json({ status: false, message: "Admin does not found." });
    }

    const { newPassword, confirmPassword } = req.body;

    if (!newPassword || !confirmPassword) {
      return res.status(200).json({ status: false, message: "Oops ! Invalid details!" });
    }

    if (newPassword !== confirmPassword) {
      return res.status(200).json({
        status: false,
        message: "Oops! New Password and Confirm Password don't match!",
      });
    }

    admin.password = cryptr.encrypt(newPassword);
    await admin.save();

    admin.password = cryptr.decrypt(admin?.password);

    return res.status(200).json({
      status: true,
      message: "Password has been updated Successfully.",
      data: admin,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};
