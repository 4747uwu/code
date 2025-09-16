//express
const express = require("express");
const app = express();

//cors
const cors = require("cors");
app.use(cors());
app.use(express.json());

//logging middleware
const logger = require("morgan");
app.use(logger("dev"));

//path
const path = require("path");

//fs
const fs = require("fs");

//dotenv
require("dotenv").config({ path: ".env" });

//Firebase Admin SDK - Fixed initialization
const admin = require("firebase-admin");

// Initialize Firebase Admin with proper service account
if (!admin.apps.length) {
  try {
    const serviceAccount = {
      type: process.env.FIREBASE_TYPE || "service_account",
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : null,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: process.env.FIREBASE_AUTH_URI || "https://accounts.google.com/o/oauth2/auth",
      token_uri: process.env.FIREBASE_TOKEN_URI || "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL || "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
      universe_domain: "googleapis.com"
    };

    // Validate required fields
    if (!serviceAccount.project_id || !serviceAccount.private_key || !serviceAccount.client_email) {
      throw new Error("Missing required Firebase service account credentials in environment variables");
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID,
      databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com`,
      storageBucket: `${process.env.FIREBASE_PROJECT_ID}.firebasestorage.app`
    });

    console.log("✅ Firebase Admin SDK initialized successfully");
  } catch (error) {
    console.error("❌ Firebase Admin SDK initialization failed:", error.message);
    console.error("Please check your Firebase environment variables in .env file");
    process.exit(1);
  }
}

//socket io
const http = require("http");
const server = http.createServer(app);
global.io = require("socket.io")(server);

//connection.js
const db = require("./util/connection");

//Declare global variable for settings
global.settingJSON = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : null,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  secretKey: process.env.secretKey || "secretKey"
};

//Declare the function as a global variable to update the setting.js file
global.updateSettingFile = (settingData) => {
  try {
    // Update the global settings
    global.settingJSON = { ...global.settingJSON, ...settingData };
    
    // Write to setting.js file
    const settingContent = `module.exports = ${JSON.stringify(global.settingJSON, null, 2)};`;
    fs.writeFileSync(path.join(__dirname, 'setting.js'), settingContent);
    
    console.log("✅ Settings updated successfully");
  } catch (error) {
    console.error("❌ Error updating settings:", error);
  }
};

//API
const route = require("./routes/route");
app.use("/api", route);

// Socket.io connection handling
require("./socket");

// Static files
app.use(express.static(path.join(__dirname, "storage")));

// Default route
app.get("/", (req, res) => {
  res.send("Hello World !");
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Hello World ! listening on ${PORT}`);
});
