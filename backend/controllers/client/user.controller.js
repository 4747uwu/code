const User = require("../../models/user.model");

//fs
const fs = require("fs");

//mongoose
const mongoose = require("mongoose");

//import model
const History = require("../../models/history.model");
const Host = require("../../models/host.model");

//deletefile
const { deleteFile } = require("../../util/deletefile");

//userFunction
const userFunction = require("../../util/userFunction");

//generateHistoryUniqueId
const generateHistoryUniqueId = require("../../util/generateHistoryUniqueId");

//validatePlanExpiration
const validatePlanExpiration = require("../../util/validatePlanExpiration");

//private key
const admin = require("../../util/privateKey");

//check the user is exists or not with loginType 3 quick (identity)
exports.quickUserVerification = async (req, res) => {
  try {
    const { identity } = req.query;

    if (!identity) {
      return res.status(200).json({ status: false, message: "identity is required." });
    }

    const user = await User.findOne({ identity, loginType: 3 }).select("_id").lean();

    return res.status(200).json({
      status: true,
      message: user ? "User login successfully." : "User must sign up.",
      isLogin: !!user,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: "Internal Server Error" });
  }
};

//user login and sign up
exports.signInOrSignUpUser = async (req, res) => {
  try {
    const { identity, loginType, fcmToken, email, name, image, dob } = req.body;

    if (!identity || loginType === undefined || !fcmToken) {
      if (req.file) deleteFile(req.file);
      return res.status(200).json({ status: false, message: "Oops! Invalid details!!" });
    }

    const { uid, provider } = req.user;

    let userQuery;

    switch (loginType) {
      case 1:
        if (!email) return res.status(200).json({ status: false, message: "email is required." });
        userQuery = { email, loginType: 1 };
        break;
      case 2:
        if (!email) return res.status(200).json({ status: false, message: "email is required." });
        userQuery = { email, loginType: 2 };
        break;
      case 3:
        if (!identity && !email) {
          return res.status(200).json({ status: false, message: "Either identity or email is required." });
        }
        userQuery = {};
        break;
      default:
        if (req.file) deleteFile(req.file);
        return res.status(200).json({ status: false, message: "Invalid loginType." });
    }

    let user = null;
    if (Object.keys(userQuery).length > 0) {
      user = await User.findOne(userQuery).select("_id loginType name image fcmToken lastlogin isBlock isHost hostId");
    }

    if (user) {
      console.log("✅ User already exists, logging in...");

      if (user.isBlock) {
        return res.status(403).json({ status: false, message: "🚷 User is blocked by the admin." });
      }

      if (user.isHost && user.hostId) {
        const host = await Host.findById(user.hostId).select("isBlock fcmToken");
        if (host && host.isBlock) {
          return res.status(403).json({ status: false, message: "🚷 Host account is blocked by the admin." });
        }

        host.fcmToken = fcmToken ? fcmToken : host.fcmToken;
        await host.save();
      }

      user.name = name ? name?.trim() : user.name;
      user.dob = dob ? dob?.trim() : user.dob;
      user.image = req.file ? req.file.path : image ? image : user.image;
      user.fcmToken = fcmToken ? fcmToken : user.fcmToken;
      user.lastlogin = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
      await user.save();

      return res.status(200).json({ status: true, message: "User logged in.", user: user, signUp: false });
    } else {
      console.log("🆕 Registering new user...");

      const bonusCoins = settingJSON.loginBonus ? settingJSON.loginBonus : 5000;

      const newUser = new User();
      newUser.firebaseUid = uid;
      newUser.provider = provider;
      newUser.coin = bonusCoins;
      newUser.date = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });

      const user = await userFunction(newUser, req);

      res.status(200).json({
        status: true,
        message: "A new user has registered an account.",
        signUp: true,
        user: {
          _id: user._id,
          loginType: user.loginType,
          name: user.name,
          image: user.image,
          fcmToken: user.fcmToken,
          lastlogin: user.lastlogin,
        },
      });

      const uniqueId = await generateHistoryUniqueId();

      await Promise.all([
        History.create({
          uniqueId: uniqueId,
          userId: newUser._id,
          userCoin: bonusCoins,
          type: 1,
          date: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
        }),
      ]);

      if (user && user.fcmToken && user.fcmToken !== null) {
        const payload = {
          token: user.fcmToken,
          notification: {
            title: "🚀 Instant Bonus Activated! 🎁",
            body: "🎊 Hooray! You've unlocked a special welcome reward just for joining us. Enjoy your bonus! 💰",
          },
          data: {
            type: "LOGINBONUS",
          },
        };

        const adminPromise = await admin;
        adminPromise
          .messaging()
          .send(payload)
          .then((response) => {
            console.log("Successfully sent with response: ", response);
          })
          .catch((error) => {
            console.log("Error sending message: ", error);
          });
      }
    }
  } catch (error) {
    if (req.file) deleteFile(req.file);
    console.error("Error:", error);
    res.status(500).json({ status: false, message: "Internal Server Error" });
  }
};

//update profile of the user
exports.modifyUserProfile = async (req, res) => {
  try {
    console.log("🔧 [MODIFY USER] Starting user profile modification...");
    console.log("🔧 [MODIFY USER] Request body:", req.body);
    console.log("🔧 [MODIFY USER] Request file:", req.file ? {
      fieldname: req.file.fieldname,
      originalname: req.file.originalname,
      filename: req.file.filename,
      path: req.file.path,
      size: req.file.size
    } : "No file uploaded");

    if (!req.user || !req.user.userId) {
      console.log("❌ [MODIFY USER] Unauthorized access - no user ID");
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    const userId = new mongoose.Types.ObjectId(req.user.userId);
    console.log("🔧 [MODIFY USER] User ID:", userId);

    const user = await User.findById(userId).select("name email image selfIntro gender bio dob age countryFlagImage country");
    
    if (!user) {
      console.log("❌ [MODIFY USER] User not found in database");
      if (req.file) deleteFile(req.file);
      return res.status(404).json({ status: false, message: "User not found." });
    }

    console.log("🔧 [MODIFY USER] Current user data:", {
      _id: user._id,
      name: user.name,
      image: user.image,
      gender: user.gender
    });

    // ✅ Update fields (same as admin approach)
    const updateFields = {
      name: req.body?.name || user.name,
      selfIntro: req.body?.selfIntro || user.selfIntro,
      gender: req.body?.gender ? req.body.gender.toLowerCase().trim() : user.gender,
      bio: req.body?.bio || user.bio,
      dob: req.body?.dob ? req.body.dob.trim() : user.dob,
      age: req.body?.age || user.age,
      countryFlagImage: req.body?.countryFlagImage || user.countryFlagImage,
      country: req.body?.country ? req.body.country.toLowerCase().trim() : user.country,
    };

    // ✅ Handle image upload (EXACTLY like admin)
    if (req.file) {
      console.log("📁 [MODIFY USER] Processing file upload...");
      console.log("📁 [MODIFY USER] New file path:", req.file.path);
      
      // Delete old image if exists (SAME AS ADMIN)
      if (user.image) {
        console.log("🗑️ [MODIFY USER] Current image path:", user.image);
        const imagePath = user.image.includes("storage") ? "storage" + user.image.split("storage")[1] : "";
        if (imagePath && fs.existsSync(imagePath)) {
          const imageName = imagePath.split("/").pop();
          if (!["male.png", "female.png"].includes(imageName)) {
            try {
              fs.unlinkSync(imagePath);
              console.log("✅ [MODIFY USER] Old image deleted successfully");
            } catch (deleteError) {
              console.error("❌ [MODIFY USER] Error deleting old image:", deleteError);
            }
          } else {
            console.log("🔒 [MODIFY USER] Skipping deletion of default image:", imageName);
          }
        } else {
          console.log("⚠️ [MODIFY USER] Old image file doesn't exist:", imagePath);
        }
      }
      
      // Set new image path (EXACTLY like admin)
      updateFields.image = req.file.path;
      console.log("📁 [MODIFY USER] Updated image path:", updateFields.image);
    }

    console.log("🔧 [MODIFY USER] Update fields:", updateFields);

    // ✅ Update user (SAME AS ADMIN)
    const updatedUser = await User.findByIdAndUpdate(
      userId, 
      updateFields, 
      { new: true, select: "name email image selfIntro gender bio dob age countryFlagImage country" }
    ).lean();

    if (!updatedUser) {
      console.log("❌ [MODIFY USER] Failed to update user");
      if (req.file) deleteFile(req.file);
      return res.status(500).json({ status: false, message: "Failed to update user profile" });
    }

    console.log("✅ [MODIFY USER] User updated successfully:", updatedUser);

    // ✅ Send response (SAME AS ADMIN FORMAT)
    return res.status(200).json({
      status: true,
      message: "The user's profile has been modified.",
      data: updatedUser, // Using 'data' like admin, not 'user'
    });

  } catch (error) {
    console.error("❌ [MODIFY USER] Error in modifyUserProfile:", error);
    if (req.file) {
      console.log("🗑️ [MODIFY USER] Deleting uploaded file due to error");
      deleteFile(req.file);
    }
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//get user profile
exports.retrieveUserProfile = async (req, res) => {
  try {
    console.log("🔍 [GET USER] Retrieving user profile...");
    
    if (!req.user || !req.user.userId) {
      console.log("❌ [GET USER] Unauthorized access - no user ID");
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    const userId = new mongoose.Types.ObjectId(req.user.userId);
    console.log("🔍 [GET USER] User ID:", userId);
    
    const user = await User.findById(userId).select("name email image selfIntro gender bio dob age countryFlagImage country coin spentCoins rechargedCoins isOnline isVip vipPlanId vipPlanStartDate vipPlanEndDate").lean();

    if (!user) {
      console.log("❌ [GET USER] User not found");
      return res.status(404).json({ status: false, message: "User not found." });
    }

    console.log("✅ [GET USER] User found:", {
      _id: user._id,
      name: user.name,
      image: user.image,
      email: user.email
    });

    // ✅ Send response (SAME AS ADMIN FORMAT)
    res.status(200).json({ 
      status: true, 
      message: "The user has retrieved their profile.", 
      data: user // Using 'data' key for consistency
    });

    // Handle VIP plan validation in background
    if (user.isVip && user.vipPlanId !== null && user.vipPlanStartDate !== null && user.vipPlanEndDate !== null) {
      const validity = user.vipPlan?.validity;
      const validityType = user.vipPlan?.validityType;
      if (validity && validityType) {
        validatePlanExpiration(user, validity, validityType);
      }
    }

  } catch (error) {
    console.error("❌ [GET USER] Error:", error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};
