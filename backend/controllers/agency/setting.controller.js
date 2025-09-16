const Setting = require("../../models/setting.model");

//import model
const Host = require("../../models/host.model");

//update setting
exports.modifySetting = async (req, res) => {
  try {
    if (!req.query.settingId) {
      return res.status(200).json({ status: false, message: "SettingId mumst be requried." });
    }

    const setting = await Setting.findById(req.query.settingId);
    if (!setting) {
      return res.status(200).json({ status: false, message: "Setting does not found." });
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

//get setting
exports.retrieveSettings = async (req, res) => {
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
