const Setting = require("../../models/setting.model");
const Host = require("../../models/host.model");

//get setting
exports.retrieveSettings = async (req, res) => {
  try {
    // Get the actual setting from database instead of settingJSON
    const setting = await Setting.findOne().sort({ createdAt: -1 }); // Get the latest setting
    
    if (!setting) {
      // Create a default setting if none exists
      const defaultSetting = new Setting({
        generalRandomCallRate: 10,
        femaleRandomCallRate: 10,
        maleRandomCallRate: 10,
        videoPrivateCallRate: 20,
        audioPrivateCallRate: 15,
        chatInteractionRate: 5,
      });
      
      const newSetting = await defaultSetting.save();
      return res.status(200).json({ 
        status: true, 
        message: "Default setting created", 
        data: newSetting 
      });
    }

    return res.status(200).json({ 
      status: true, 
      message: "Success", 
      data: setting 
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ 
      status: false, 
      error: error.message || "Internal Server Error" 
    });
  }
};

//update setting
exports.modifySetting = async (req, res) => {
  try {
    if (!req.query.settingId) {
      return res.status(400).json({ 
        status: false, 
        message: "SettingId must be required." 
      });
    }

    const setting = await Setting.findById(req.query.settingId);
    if (!setting) {
      return res.status(404).json({ 
        status: false, 
        message: "Setting does not found." 
      });
    }

    // Update only the fields that are provided
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

    // Update all hosts with new rates
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

    // Update setting file if you have this function
    if (typeof updateSettingFile === 'function') {
      updateSettingFile(setting);
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({ 
      status: false, 
      error: error.message || "Internal Server Error" 
    });
  }
};