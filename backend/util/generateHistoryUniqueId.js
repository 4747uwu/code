const History = require("../models/history.model");
const crypto = require('crypto'); // ✅ Add this import


async function generateHistoryUniqueId() {
  let uniqueId;
  let isUnique = false;

  while (!isUnique) {
    uniqueId = `HIS-${crypto.randomUUID().replace(/-/g, "").slice(0, 6)}`; // Short 6-char unique ID

    const existingRecord = await History.findOne({ uniqueId: uniqueId }).select("_id").lean();

    if (!existingRecord) {
      isUnique = true;
    }
  }

  return uniqueId;
}

module.exports = generateHistoryUniqueId;
