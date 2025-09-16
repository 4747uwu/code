const admin = require("firebase-admin");

const privateKey = settingJSON?.privateKey;

if (!privateKey) {
  console.error("❌ Firebase private key not found in global setting.");
  process.exit(1); // Exit process to prevent running without credentials
}

const initFirebase = async () => {
  try {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(privateKey),
      });
      console.log("✅ Firebase Admin SDK initialized successfully");
    }
    return admin;
  } catch (error) {
    console.error("Failed to initialize Firebase Admin SDK:", error);
    throw error;
  }
};

module.exports = initFirebase();
