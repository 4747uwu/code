const Setting = require("../../models/setting.model");

//import model
const Host = require("../../models/host.model");

//update setting
exports.updateSetting = async (req, res) => {
  try {
    if (!req.query.settingId) {
      return res.status(200).json({ status: false, message: "SettingId mumst be requried." });
    }

    const setting = await Setting.findById(req.query.settingId);
    if (!setting) {
      return res.status(200).json({ status: false, message: "Setting does not found." });
    }

    setting.agoraAppId = req.body.agoraAppId ? req.body.agoraAppId.trim() : setting.agoraAppId;
    setting.agoraAppCertificate = req.body.agoraAppCertificate ? req.body.agoraAppCertificate.trim() : setting.agoraAppCertificate;
    setting.privacyPolicyLink = req.body.privacyPolicyLink ? req.body.privacyPolicyLink.trim() : setting.privacyPolicyLink;
    setting.termsOfUsePolicyLink = req.body.termsOfUsePolicyLink ? req.body.termsOfUsePolicyLink.trim() : setting.termsOfUsePolicyLink;
    setting.stripePublishableKey = req.body.stripePublishableKey ? req.body.stripePublishableKey.trim() : setting.stripePublishableKey;
    setting.stripeSecretKey = req.body.stripeSecretKey ? req.body.stripeSecretKey.trim() : setting.stripeSecretKey;
    setting.razorpayId = req.body.razorpayId ? req.body.razorpayId.trim() : setting.razorpayId;
    setting.razorpaySecretKey = req.body.razorpaySecretKey ? req.body.razorpaySecretKey.trim() : setting.razorpaySecretKey;
    setting.flutterwaveId = req.body.flutterwaveId ? req.body.flutterwaveId.trim() : setting.flutterwaveId;
    setting.loginBonus = req.body.loginBonus ? Number(req.body.loginBonus) : setting.loginBonus;
    setting.adminCommissionRate = req.body.adminCommissionRate ? Number(req.body.adminCommissionRate) : setting.adminCommissionRate;
    setting.minCoinsToConvert = req.body.minCoinsToConvert ? Number(req.body.minCoinsToConvert) : setting.minCoinsToConvert;
    setting.minCoinsForHostPayout = req.body.minCoinsForHostPayout ? Number(req.body.minCoinsForHostPayout) : setting.minCoinsForHostPayout;
    setting.minCoinsForAgencyPayout = req.body.minCoinsForAgencyPayout ? Number(req.body.minCoinsForAgencyPayout) : setting.minCoinsForAgencyPayout;
    setting.maxFreeChatMessages = req.body.maxFreeChatMessages ? Number(req.body.maxFreeChatMessages) : setting.maxFreeChatMessages;

    if (req.body.privateKey) {
      setting.privateKey = typeof req.body.privateKey === "string" ? JSON.parse(req.body.privateKey.trim()) : req.body.privateKey;
    }

    setting.generalRandomCallRate = req.body.generalRandomCallRate !== undefined ? Number(req.body.generalRandomCallRate) : setting.generalRandomCallRate;
    setting.femaleRandomCallRate = req.body.femaleRandomCallRate !== undefined ? Number(req.body.femaleRandomCallRate) : setting.femaleRandomCallRate;
    setting.maleRandomCallRate = req.body.maleRandomCallRate !== undefined ? Number(req.body.maleRandomCallRate) : setting.maleRandomCallRate;
    setting.videoPrivateCallRate = req.body.videoPrivateCallRate !== undefined ? Number(req.body.videoPrivateCallRate) : setting.videoPrivateCallRate;
    setting.audioPrivateCallRate = req.body.audioPrivateCallRate !== undefined ? Number(req.body.audioPrivateCallRate) : setting.audioPrivateCallRate;
    setting.chatInteractionRate = req.body.chatInteractionRate !== undefined ? Number(req.body.chatInteractionRate) : setting.chatInteractionRate;

    await setting.save();

    res.status(200).json({
      status: true,
      message: "Setting has been Updated.",
      data: setting,
    });

    await Host.updateMany(
      {},
      {
        $set: {
          randomCallRate: setting.generalRandomCallRate,
          randomCallFemaleRate: setting.femaleRandomCallRate,
          randomCallMaleRate: setting.maleRandomCallRate,
          privateCallRate: setting.videoPrivateCallRate,
          audioCallRate: setting.audioPrivateCallRate,
          chatRate: setting.chatInteractionRate,
        },
      }
    );

    updateSettingFile(setting);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//update setting switch
exports.updateSettingToggle = async (req, res) => {
  try {
    if (!req.query.settingId || !req.query.type) {
      return res.status(200).json({ status: false, message: "Oops ! Invalid details!" });
    }

    const setting = await Setting.findById(req.query.settingId);
    if (!setting) {
      return res.status(200).json({ status: false, message: "Setting does not found." });
    }

    const type = req.query.type.trim();

    if (type === "googlePlayEnabled") {
      setting.googlePlayEnabled = !setting.googlePlayEnabled;
    } else if (type === "stripeEnabled") {
      setting.stripeEnabled = !setting.stripeEnabled;
    } else if (type === "razorpayEnabled") {
      setting.razorpayEnabled = !setting.razorpayEnabled;
    } else if (type === "flutterwaveEnabled") {
      setting.flutterwaveEnabled = !setting.flutterwaveEnabled;
    } else if (type === "isDemoData") {
      setting.isDemoData = !setting.isDemoData;
    } else if (type === "isAppEnabled") {
      setting.isAppEnabled = !setting.isAppEnabled;
    } else {
      return res.status(200).json({ status: false, message: "type passed must be valid." });
    }

    await setting.save();

    res.status(200).json({ status: true, message: "Success", data: setting });

    updateSettingFile(setting);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//get setting
exports.fetchSettings = async (req, res) => {
  try {
    const setting = settingJSON ? settingJSON : null;
    if (!setting) {
      return res.status(200).json({ status: false, message: "Setting does not found." });
    }

    return res.status(200).json({ status: true, message: "Success", data: setting });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};
