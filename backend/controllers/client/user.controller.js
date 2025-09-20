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
    
    const user = await User.findById(userId).lean();

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

    // ✅ CRITICAL FIX: Convert relative image path to full URL
    let imageUrl = user.image || "";
    if (imageUrl && !imageUrl.startsWith('http') && !imageUrl.startsWith('https://')) {
      // Construct full URL like admin panel does
      const baseUrl = `${req.protocol}://${req.get('host')}/`;
      imageUrl = baseUrl + imageUrl;
    }

    console.log("🖼️ [GET USER] Image URL processed:", {
      originalPath: user.image,
      fullImageUrl: imageUrl
    });

    // ✅ Consistent response format matching Flutter FetchLoginUserProfileModel
    const responseData = {
      status: true,
      message: "User profile retrieved successfully.",
      user: {
        _id: user._id,
        name: user.name || "",
        selfIntro: user.selfIntro || "",
        gender: user.gender || "",
        bio: user.bio || "",
        age: user.age || 18,
        image: imageUrl, // ✅ Now sending full URL instead of relative path
        email: user.email || "",
        countryFlagImage: user.countryFlagImage || "",
        country: user.country || "",
        ipAddress: user.ipAddress || "",
        identity: user.identity || "",
        fcmToken: user.fcmToken || "",
        uniqueId: user.uniqueId || "",
        firebaseUid: user.firebaseUid || "",
        provider: user.provider || "",
        coin: user.coin || 0,
        spentCoins: user.spentCoins || 0,
        rechargedCoins: user.rechargedCoins || 0,
        earnedCoins: user.earnedCoins || 0,
        totalGifts: user.totalGifts || 0,
        redeemedCoins: user.redeemedCoins || 0,
        redeemedAmount: user.redeemedAmount || 0,
        isVip: user.isVip || false,
        isBlock: user.isBlock || false,
        isFake: user.isFake || false,
        isOnline: user.isOnline || false,
        isBusy: user.isBusy || false,
        callId: user.callId || "",
        isHost: user.isHost || false,
        hostId: user.hostId || null,
        lastlogin: user.lastlogin || "",
        date: user.date || "",
        loginType: user.loginType || 3
      }
    };

    res.status(200).json(responseData);

    // Handle VIP plan validation in background
    if (user.isVip && user.vipPlanId && user.vipPlanStartDate && user.vipPlanEndDate) {
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

    const user = await User.findById(userId);
    
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

    // ✅ Handle image upload first
    if (req.file) {
      console.log("📁 [MODIFY USER] Processing file upload...");
      console.log("📁 [MODIFY USER] New file path:", req.file.path);
      
      // Delete old image if exists
      if (user.image && user.image.includes('storage/')) {
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
          }
        }
      }
      
      user.image = req.file.path;
      console.log("📁 [MODIFY USER] Updated image path:", user.image);
    }

    // ✅ Update other fields
    user.name = req.body?.name || user.name;
    user.selfIntro = req.body?.selfIntro || user.selfIntro;
    user.gender = req.body?.gender ? req.body.gender.toLowerCase().trim() : user.gender;
    user.bio = req.body?.bio || user.bio;
    user.dob = req.body?.dob ? req.body.dob.trim() : user.dob;
    user.age = req.body?.age || user.age;
    user.countryFlagImage = req.body?.countryFlagImage || user.countryFlagImage;
    user.country = req.body?.country ? req.body.country.toLowerCase().trim() : user.country;

    console.log("🔧 [MODIFY USER] About to save user with updates...");

    // ✅ Save the user
    await user.save();
    console.log("✅ [MODIFY USER] User saved successfully");

    // ✅ CRITICAL FIX: Convert relative image path to full URL for response
    let imageUrl = user.image || "";
    if (imageUrl && !imageUrl.startsWith('http') && !imageUrl.startsWith('https://')) {
      const baseUrl = `${req.protocol}://${req.get('host')}/`;
      imageUrl = baseUrl + imageUrl;
    }

    console.log("🖼️ [MODIFY USER] Image URL for response:", {
      originalPath: user.image,
      fullImageUrl: imageUrl
    });

    // ✅ Format response to match Flutter expectations
    const responseData = {
      status: true,
      message: "The user's profile has been modified.",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email || "",
        image: imageUrl, // ✅ Now sending full URL instead of relative path
        selfIntro: user.selfIntro || "",
        gender: user.gender || "",
        bio: user.bio || "",
        dob: user.dob || "",
        age: user.age || 18,
        countryFlagImage: user.countryFlagImage || "",
        country: user.country || "",
        coin: user.coin || 0,
        spentCoins: user.spentCoins || 0,
        rechargedCoins: user.rechargedCoins || 0,
        isOnline: user.isOnline || false,
        isVip: user.isVip || false,
        vipPlanId: user.vipPlanId || null,
        vipPlanStartDate: user.vipPlanStartDate || null,
        vipPlanEndDate: user.vipPlanEndDate || null
      }
    };

    console.log("📤 [MODIFY USER] Sending response:", {
      status: responseData.status,
      message: responseData.message,
      userData: {
        _id: responseData.user._id,
        name: responseData.user.name,
        image: responseData.user.image, // This should now be a full URL
        updatedFields: Object.keys(req.body)
      }
    });

    return res.status(200).json(responseData);

  } catch (error) {
    console.error("❌ [MODIFY USER] Error in modifyUserProfile:", error);
    if (req.file) {
      console.log("🗑️ [MODIFY USER] Deleting uploaded file due to error");
      deleteFile(req.file);
    }
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};
