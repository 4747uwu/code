const admin = require("firebase-admin");
const Admin = require("../models/admin.model");

const validateAdminFirebaseToken = async (req, res, next) => {
  console.log("🔹 [AUTH] Validating Admin Firebase token...");

  const authHeader = req.headers["authorization"];
  const adminUid = req.headers["x-admin-uid"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.warn("⚠️ [AUTH] Missing or invalid authorization header.");
    return res.status(401).json({ status: false, message: "Authorization token required" });
  }

  if (!adminUid) {
    console.warn("⚠️ [AUTH] Missing Admin UID.");
    return res.status(401).json({ status: false, message: "Admin UID required for authentication." });
  }

  const token = authHeader.split("Bearer ")[1];

  try {
    // Verify Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(token);
    console.log("✅ [AUTH] Firebase token verified for UID:", decodedToken.uid);

    // Check if Firebase UID matches the provided UID
    if (decodedToken.uid !== adminUid) {
      console.warn("⚠️ [AUTH] UID mismatch in token and header");
      return res.status(401).json({ status: false, message: "UID mismatch" });
    }

    // Find admin in database by Firebase UID or email
    let adminUser = await Admin.findOne({ 
      $or: [
        { uid: decodedToken.uid },
        { email: decodedToken.email }
      ]
    }).select("_id email name flag uid").lean();

    if (!adminUser) {
      console.warn("⚠️ [AUTH] Admin not found in database for UID:", decodedToken.uid);
      return res.status(401).json({ status: false, message: "Admin not found" });
    }

    // Update Firebase UID in database if not set
    if (!adminUser.uid && decodedToken.uid) {
      await Admin.findByIdAndUpdate(adminUser._id, { uid: decodedToken.uid });
      adminUser.uid = decodedToken.uid;
      console.log("✅ [AUTH] Updated admin Firebase UID in database");
    }

    if (!adminUser.flag) {
      console.warn("⚠️ [AUTH] Admin account is disabled");
      return res.status(401).json({ status: false, message: "Admin account is disabled" });
    }

    // Attach admin info to request
    req.admin = adminUser;
    req.adminId = adminUser._id;
    req.firebaseUid = decodedToken.uid;
    
    console.log("✅ [AUTH] Admin authenticated successfully:", adminUser.email);
    next();

  } catch (error) {
    console.error("❌ [AUTH ERROR] Token verification failed:", error.message);
    return res.status(401).json({ status: false, message: "Invalid or expired token" });
  }
};

module.exports = validateAdminFirebaseToken;
