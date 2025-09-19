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
        userQuery = { identity, loginType: 3 };
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
        if (req.file) deleteFile(req.file);
        return res.status(200).json({ status: false, message: "Your account has been blocked by the admin." });
      }

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

      // ✅ Generate unique ID with error handling
      let uniqueId;
      try {
        uniqueId = await generateHistoryUniqueId();
      } catch (error) {
        console.error("❌ Error generating unique ID:", error);
        uniqueId = `HIST_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
      }

      // ✅ Send response first, then handle background operations
      const responseData = {
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
      };

      res.status(200).json(responseData);

      // ✅ Handle background operations after response is sent
      try {
        await Promise.all([
          History.create({
            uniqueId: uniqueId,
            userId: user._id,
            userCoin: bonusCoins,
            type: 1,
            date: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
          }),
        ]);

        // Send push notification if FCM token exists
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
              console.log("Successfully sent welcome notification: ", response);
            })
            .catch((error) => {
              console.log("Error sending welcome notification: ", error);
            });
        }
      } catch (backgroundError) {
        console.error("❌ Background operation failed:", backgroundError);
        // Don't throw error since response is already sent
      }
    }
  } catch (error) {
    console.error("❌ SignInOrSignUp Error:", error);
    if (req.file) deleteFile(req.file);
    
    // ✅ Check if response was already sent
    if (!res.headersSent) {
      return res.status(500).json({ status: false, message: "Internal Server Error" });
    }
  }
};

//update profile of the user
exports.modifyUserProfile = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    res.status(200).json({ status: true, message: "The user's profile has been modified." });

    const userId = new mongoose.Types.ObjectId(req.user.userId);

    const [user] = await Promise.all([User.findOne({ _id: userId })]);

    if (req?.file) {
      const image = user?.image?.split("storage");
      if (image) {
        const imagePath = "storage" + image[1];
        if (fs.existsSync(imagePath)) {
          const imageName = imagePath?.split("/")?.pop();
          if (imageName !== "male.png" && imageName !== "female.png") {
            fs.unlinkSync(imagePath);
          }
        }
      }

      user.image = req?.file?.path;
    }

    user.name = req.body.name ? req.body.name : user.name;
    user.selfIntro = req.body.selfIntro ? req.body.selfIntro : user.selfIntro;
    user.gender = req.body.gender ? req.body.gender?.toLowerCase()?.trim() : user.gender;
    user.bio = req.body.bio ? req.body.bio : user.bio;
    user.dob = req.body.dob ? req.body.dob.trim() : user.dob;
    user.age = req.body.age ? req.body.age : user.age;
    user.countryFlagImage = req.body.countryFlagImage ? req.body.countryFlagImage : user.countryFlagImage;
    user.country = req.body.country ? req.body.country.toLowerCase()?.trim() : user.country;
    await user.save();
  } catch (error) {
    if (req.file) deleteFile(req.file);
    console.log(error);
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
