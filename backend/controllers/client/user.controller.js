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

    // ✅ DON'T SEND RESPONSE YET - Do the work first
    const [user] = await Promise.all([User.findOne({ _id: userId })]);

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

    let oldImagePath = null;

    if (req?.file) {
      console.log("📁 [MODIFY USER] Processing file upload...");
      console.log("📁 [MODIFY USER] New file path:", req.file.path);
      
      // Handle old image deletion
      if (user.image) {
        console.log("🗑️ [MODIFY USER] Current image path:", user.image);
        const image = user.image.split("storage");
        if (image && image[1]) {
          oldImagePath = "storage" + image[1];
          console.log("🗑️ [MODIFY USER] Old image path to delete:", oldImagePath);
          
          if (fs.existsSync(oldImagePath)) {
            const imageName = oldImagePath.split("/").pop();
            console.log("🗑️ [MODIFY USER] Old image filename:", imageName);
            
            if (imageName !== "male.png" && imageName !== "female.png") {
              try {
                fs.unlinkSync(oldImagePath);
                console.log("✅ [MODIFY USER] Old image deleted successfully");
              } catch (deleteError) {
                console.error("❌ [MODIFY USER] Error deleting old image:", deleteError);
              }
            } else {
              console.log("🔒 [MODIFY USER] Skipping deletion of default image:", imageName);
            }
          } else {
            console.log("⚠️ [MODIFY USER] Old image file doesn't exist:", oldImagePath);
          }
        }
      }

      user.image = req.file.path;
      console.log("📁 [MODIFY USER] Updated user image path:", user.image);
    }

    // Update other fields
    const oldValues = {
      name: user.name,
      selfIntro: user.selfIntro,
      gender: user.gender,
      bio: user.bio,
      dob: user.dob,
      age: user.age,
      countryFlagImage: user.countryFlagImage,
      country: user.country
    };

    user.name = req.body.name ? req.body.name : user.name;
    user.selfIntro = req.body.selfIntro ? req.body.selfIntro : user.selfIntro;
    user.gender = req.body.gender ? req.body.gender?.toLowerCase()?.trim() : user.gender;
    user.bio = req.body.bio ? req.body.bio : user.bio;
    user.dob = req.body.dob ? req.body.dob.trim() : user.dob;
    user.age = req.body.age ? req.body.age : user.age;
    user.countryFlagImage = req.body.countryFlagImage ? req.body.countryFlagImage : user.countryFlagImage;
    user.country = req.body.country ? req.body.country.toLowerCase()?.trim() : user.country;

    console.log("🔧 [MODIFY USER] Field changes:", {
      oldValues,
      newValues: {
        name: user.name,
        selfIntro: user.selfIntro,
        gender: user.gender,
        bio: user.bio,
        dob: user.dob,
        age: user.age,
        countryFlagImage: user.countryFlagImage,
        country: user.country,
        image: user.image
      }
    });

    // Save to database
    console.log("💾 [MODIFY USER] Saving user to database...");
    await user.save();
    console.log("✅ [MODIFY USER] User saved successfully");

    // ✅ NOW send the response with updated data
    const responseData = {
      status: true,
      message: "The user's profile has been modified.",
      user: {
        _id: user._id,
        name: user.name,
        image: user.image,
        gender: user.gender,
        bio: user.bio,
        dob: user.dob,
        age: user.age,
        countryFlagImage: user.countryFlagImage,
        country: user.country,
        selfIntro: user.selfIntro
      }
    };

    console.log("📤 [MODIFY USER] Sending response:", responseData);
    res.status(200).json(responseData);

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
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    const userId = new mongoose.Types.ObjectId(req.user.userId);
    const user = await User.findOne({ _id: userId }).lean();

    res.status(200).json({ status: true, message: "The user has retrieved their profile.", user: user });

    if (user.isVip && user.vipPlanId !== null && user.vipPlanStartDate !== null && user.vipPlanEndDate !== null) {
      const validity = user.vipPlan.validity;
      const validityType = user.vipPlan.validityType;
      validatePlanExpiration(user, validity, validityType);
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};
