//import model
const Setting = require("../models/setting.model");

//settingJson
const settingJson = require("../setting");

async function initializeSettings() {
  try {
    const setting = await Setting.findOne().sort({ createdAt: -1 });
    if (setting) {
      global.settingJSON = setting;
      console.log("✅ Settings Initialized");
    } else {
      global.settingJSON = settingJson;
    }
  } catch (error) {
    console.error("❌ Failed to initialize settings:", error);
  }
}

module.exports = initializeSettings;
