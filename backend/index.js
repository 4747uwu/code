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

//Firebase Admin SDK - Fixed initialization with hardcoded config
const admin = require("firebase-admin");

// Initialize Firebase Admin with hardcoded service account
if (!admin.apps.length) {
  try {
    const serviceAccount = {
      type: "service_account",
      project_id: "datingapp-146b1",
      private_key_id: "d64a0beb9ab9b816ee0cea02e70c715929f57864",
      private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDSFnEchobDrhSP\n2DteSlS2YvtQYidXldr6DjRewPm95gBrrDNbTQ8qWKMNNO16NN/F6T9SH/1+dAVy\nOSgSmQBO4hkN/j0dT6bWwTO4kabo52NjQRAZLgBA9xZIATij7f3XjPCJeJJwTWMJ\nSAfQ9Fzll0dlxm3rG4xf3macLhGpLd+A/z6rvx55HZJanfUWykFeBKbVg9Y5/JiE\ngRu+TwvkurXNRdJW+vquXKDNHN4jtOJRYNhfXQ0JlQQQ/1oFBhmQt29KkOxLSwhR\nTyKvlHBbAOAqfpIaTtGrQaYIC2SwcisxFob9iRQBtTRVSwV9BHhH12mJHm2LaoEV\nNsR2G4RnAgMBAAECggEAPsIgeQaA1Iy4rL3KAmFPDArmiz0/Bm2INCGxKEsab814\n+7E9yDztVleTIbtZY6PO4ybJ2SUgSzmqdNQ5MdEN5AKrvF/h7tMgAlBFvJGaHEIf\nEQPbJMJ2pfGJ8OmYe3P5W/5IzrA7gpvDhX7Egvm0lItL803DATRCC1N7MJWchf5Z\nEYB0jtzt2zBnR/ZI8XTeLoTyOHJBUKl2ucwRrEiP3buj2G6Nrbv/lRJOf0i9NQTn\nitDzFnD3q9wJmjLZThWoxjMMUCH8MPwVtwf2KREqdQ/A5IafbZIfpSGaNX7OAJ8w\nqhmHaeXxVqZZsmVxQkdHP0VjWGGYAiUEAU6MARFYoQKBgQDqDrOgk5KmtpHcAE47\nXWrRf7/5LOLjviWVMb5QyTvXmdOYtmD8ZLd3TIKpeDQwgmvprNXSayvVbkZt3uk5\n+dmgaqSltcQpuEvL8mPFTBXxOPgBKPivDfjYff6ehiT82xQV0U12hcBtW3p51rme\nOIcuWAovCl6JeEJpdZ5/tCAhBwKBgQDlyHlYKJdRQWNswUQsgrx4+91adL4VjHt3\nvNMvK0KGdAi0mKaUDSpvda0sL0QPxuC1BB+4jpvaOZk+97BH5qBI5jYc2toUm73M\nuxxv+eSJZRLhrtQkaev5fL/Apw5TzuRrH9O2+aBLa/jpSNRRqac5VfbrqVihG7pP\nDKMIZXaJoQKBgFp+wq7UQABbWHviVl0XmmRT62qxEyyQ6UENEZN0qsGKhUhnQ4py\neokSuPZDNpKG6qhXnfiUXUdRMsPqSuySkLU4Zl53r9ednRjGqBKxf05cA2+XYsd0\nNIGn/VlXblehcNuaqEOqJSNjGjCfd/cXzhR6D73uWWz3ZV4XDug7QazjAoGBAOKH\nheE8exjXDs6rpar/5BCdtLY1eyPBUANWOxg4XKgyglaQW0B/zkL9zxBNNJsdJHAw\nNZl7tfgoaoSiKL5phcD4e4Zs1ywT8cSA/mMCB6TP6RJmiauwZLubmWqzBrPmtldJ\nlC3B4J4aPtS1QOOVDk+/COOBGugRbtX5jkx7wqWhAoGBAITYn5mE5IEWV7M36LpW\nTytu7lQs2Su14FexUCexYTvzt3qagrIMHQpDNx/sjf3zZXiisXz4Yr4Qb1y3pdRe\nuq1gBHeOjVJgvEMI7CL950bVn1VIKIZz6FemAo7QXV5w1r1ezyWG68ADNlqlFDN0\nxLliEL96RSckR4VXjSnrWgpf\n-----END PRIVATE KEY-----\n",
      client_email: "firebase-adminsdk-fbsvc@datingapp-146b1.iam.gserviceaccount.com",
      client_id: "107122755392112652115",
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40datingapp-146b1.iam.gserviceaccount.com",
      universe_domain: "googleapis.com"
    };

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: "datingapp-146b1",
      databaseURL: "https://datingapp-146b1-default-rtdb.firebaseio.com",
      storageBucket: "datingapp-146b1.firebasestorage.app"
    });

    console.log("✅ Firebase Admin SDK initialized successfully");
  } catch (error) {
    console.error("❌ Firebase Admin SDK initialization failed:", error.message);
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
  projectId: "datingapp-146b1",
  privateKey: "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDSFnEchobDrhSP\n2DteSlS2YvtQYidXldr6DjRewPm95gBrrDNbTQ8qWKMNNO16NN/F6T9SH/1+dAVy\nOSgSmQBO4hkN/j0dT6bWwTO4kabo52NjQRAZLgBA9xZIATij7f3XjPCJeJJwTWMJ\nSAfQ9Fzll0dlxm3rG4xf3macLhGpLd+A/z6rvx55HZJanfUWykFeBKbVg9Y5/JiE\ngRu+TwvkurXNRdJW+vquXKDNHN4jtOJRYNhfXQ0JlQQQ/1oFBhmQt29KkOxLSwhR\nTyKvlHBbAOAqfpIaTtGrQaYIC2SwcisxFob9iRQBtTRVSwV9BHhH12mJHm2LaoEV\nNsR2G4RnAgMBAAECggEAPsIgeQaA1Iy4rL3KAmFPDArmiz0/Bm2INCGxKEsab814\n+7E9yDztVleTIbtZY6PO4ybJ2SUgSzmqdNQ5MdEN5AKrvF/h7tMgAlBFvJGaHEIf\nEQPbJMJ2pfGJ8OmYe3P5W/5IzrA7gpvDhX7Egvm0lItL803DATRCC1N7MJWchf5Z\nEYB0jtzt2zBnR/ZI8XTeLoTyOHJBUKl2ucwRrEiP3buj2G6Nrbv/lRJOf0i9NQTn\nitDzFnD3q9wJmjLZThWoxjMMUCH8MPwVtwf2KREqdQ/A5IafbZIfpSGaNX7OAJ8w\nqhmHaeXxVqZZsmVxQkdHP0VjWGGYAiUEAU6MARFYoQKBgQDqDrOgk5KmtpHcAE47\nXWrRf7/5LOLjviWVMb5QyTvXmdOYtmD8ZLd3TIKpeDQwgmvprNXSayvVbkZt3uk5\n+dmgaqSltcQpuEvL8mPFTBXxOPgBKPivDfjYff6ehiT82xQV0U12hcBtW3p51rme\nOIcuWAovCl6JeEJpdZ5/tCAhBwKBgQDlyHlYKJdRQWNswUQsgrx4+91adL4VjHt3\nvNMvK0KGdAi0mKaUDSpvda0sL0QPxuC1BB+4jpvaOZk+97BH5qBI5jYc2toUm73M\nuxxv+eSJZRLhrtQkaev5fL/Apw5TzuRrH9O2+aBLa/jpSNRRqac5VfbrqVihG7pP\nDKMIZXaJoQKBgFp+wq7UQABbWHviVl0XmmRT62qxEyyQ6UENEZN0qsGKhUhnQ4py\neokSuPZDNpKG6qhXnfiUXUdRMsPqSuySkLU4Zl53r9ednRjGqBKxf05cA2+XYsd0\nNIGn/VlXblehcNuaqEOqJSNjGjCfd/cXzhR6D73uWWz3ZV4XDug7QazjAoGBAOKH\nheE8exjXDs6rpar/5BCdtLY1eyPBUANWOxg4XKgyglaQW0B/zkL9zxBNNJsdJHAw\nNZl7tfgoaoSiKL5phcD4e4Zs1ywT8cSA/mMCB6TP6RJmiauwZLubmWqzBrPmtldJ\nlC3B4J4aPtS1QOOVDk+/COOBGugRbtX5jkx7wqWhAoGBAITYn5mE5IEWV7M36LpW\nTytu7lQs2Su14FexUCexYTvzt3qagrIMHQpDNx/sjf3zZXiisXz4Yr4Qb1y3pdRe\nuq1gBHeOjVJgvEMI7CL950bVn1VIKIZz6FemAo7QXV5w1r1ezyWG68ADNlqlFDN0\nxLliEL96RSckR4VXjSnrWgpf\n-----END PRIVATE KEY-----\n",
  clientEmail: "firebase-adminsdk-fbsvc@datingapp-146b1.iam.gserviceaccount.com",
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

app.get("/api/health", (req, res) => {
  res.status(200).json({ 
    status: "OK", 
    message: "Figgy Backend is running",
    timestamp: new Date().toISOString(),
    port: process.env.PORT || 5000
  });
});

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
