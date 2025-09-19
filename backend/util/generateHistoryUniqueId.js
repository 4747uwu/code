const History = require("../models/history.model");
const crypto = require('crypto');

async function generateHistoryUniqueId() {
  try {
    let uniqueId;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10; // Prevent infinite loops

    while (!isUnique && attempts < maxAttempts) {
      attempts++;
      
      // Generate a more robust unique ID
      uniqueId = `HIS-${crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;

      const existingRecord = await History.findOne({ uniqueId: uniqueId }).select("_id").lean();

      if (!existingRecord) {
        isUnique = true;
      }
    }

    if (!isUnique) {
      // Fallback if we can't generate unique ID
      uniqueId = `HIS-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    }

    return uniqueId;
  } catch (error) {
    console.error("❌ Error generating history unique ID:", error);
    // Fallback method
    return `HIS-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  }
}

module.exports = generateHistoryUniqueId;
