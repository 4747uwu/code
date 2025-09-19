const User = require("../models/user.model");
const Host = require("../models/host.model");
const crypto = require('crypto');


const generateUniqueId = async () => {
  try {
    let uniqueId = "";
    let idExists = true;
    let attempts = 0;
    const maxAttempts = 10; // Prevent infinite loops

    while (idExists && attempts < maxAttempts) {
      attempts++;
      
      // Generate a more secure 8-digit unique ID
      uniqueId = crypto.randomInt(10000000, 99999999).toString();

      // Check if this ID already exists in User or Host collections
      const [user, host] = await Promise.all([
        User.findOne({ uniqueId }).select("_id").lean(),
        Host.findOne({ uniqueId }).select("_id").lean()
      ]);

      const existingDoc = user || host;

      if (!existingDoc) {
        idExists = false;
      }
    }

    if (idExists) {
      // Fallback if we can't generate unique ID
      uniqueId = `${Date.now().toString().slice(-8)}`;
    }

    return uniqueId;
  } catch (error) {
    console.error("❌ Error generating unique ID:", error);
    // Fallback method
    return Date.now().toString().slice(-8);
  }
};

module.exports = generateUniqueId;
