const Host = require("../../models/host.model");
const User = require("../../models/user.model");
const Agency = require("../../models/agency.model");

//private key
const admin = require("../../util/privateKey");

//mongoose
const mongoose = require("mongoose");

//fs
const fs = require("fs");

//deletefile
const { deleteFiles } = require("../../util/deletefile");

//generateUniqueId
const generateUniqueId = require("../../util/generateUniqueId");

//retrive host requests
exports.fetchHostRequest = async (req, res) => {
  try {
    if (!req.query.status) {
      return res.status(200).json({ status: false, message: "Oops ! Invalid details!" });
    }

    const start = req.query.start ? parseInt(req.query.start) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;

    let matchQuery = { isFake: false };

    if (req.query.status !== "All") {
      const statusInt = parseInt(req.query.status);
      matchQuery.status = statusInt;

      if (statusInt === 1) {
        matchQuery.agencyId = null;
      }
    }

    const [total, request] = await Promise.all([
      Host.countDocuments(matchQuery),
      Host.find(matchQuery)
        .populate("userId", "name image uniqueId")
        .populate("agencyId", "name image agencyCode")
        .sort({ createdAt: -1 })
        .skip((start - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    return res.status(200).json({
      status: true,
      message: "Retrieve host's request for admin.",
      total: total || 0,
      data: request,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//accept Or decline host request
exports.handleHostRequest = async (req, res) => {
  try {
    if (!settingJSON) {
      return res.status(200).json({ status: false, message: "Setting not found." });
    }

    const { requestId, userId, status, reason } = req.query;

    if (!requestId || !userId || !status) {
      return res.status(200).json({ status: false, message: "Invalid details provided." });
    }

    const hostObjectId = new mongoose.Types.ObjectId(requestId);
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const statusNumber = Number(status);

    const host = await Host.findOne({ _id: hostObjectId });

    if (!host) {
      return res.status(200).json({ status: false, message: "Host request not found." });
    }

    if (host.agencyId === null) {
      return res.status(200).json({
        status: false,
        message: "Please assign this host to an agency before accepting the request.",
      });
    }

    if (host.status === 2) {
      return res.status(200).json({
        status: false,
        message: "Host request has already been accepted.",
      });
    }

    if (host.status === 3) {
      return res.status(200).json({
        status: false,
        message: "Host request has already been rejected.",
      });
    }

    if (statusNumber === 2) {
      host.status = 2;
      host.randomCallRate = settingJSON.generalRandomCallRate;
      host.randomCallFemaleRate = settingJSON.femaleRandomCallRate;
      host.randomCallMaleRate = settingJSON.maleRandomCallRate;
      host.privateCallRate = settingJSON.videoPrivateCallRate;
      host.audioCallRate = settingJSON.audioPrivateCallRate;
      host.chatRate = settingJSON.chatInteractionRate;
      await host.save();

      res.status(200).json({
        status: true,
        message: "Host request accepted successfully.",
        data: host,
      });

      const user = await User.findOne({ _id: userObjectId }).select("isHost hostId");
      if (user) {
        user.isHost = true;
        user.hostId = host._id;
        await user.save();
      }

      if (host.fcmToken) {
        const payload = {
          token: host.fcmToken,
          notification: {
            title: "🎉 Host Verification Successful!",
            body: "Congratulations! Your host request has been approved. You’re now ready to go live! 🚀",
          },
        };

        try {
          const adminInstance = await admin;
          await adminInstance.messaging().send(payload);
          console.log("Notification sent successfully.");
        } catch (error) {
          console.error("Error sending notification:", error);
        }
      }
    } else if (statusNumber === 3) {
      if (!reason || reason.trim() === "") {
        return res.status(200).json({
          status: false,
          message: "Please provide a reason for rejection.",
        });
      }

      host.status = 3;
      host.reason = reason.trim();
      await host.save();

      res.status(200).json({
        status: true,
        message: "Host request rejected successfully.",
        data: host,
      });

      if (host.fcmToken) {
        const payload = {
          token: host.fcmToken,
          notification: {
            title: "❌ Host Request Declined",
            body: "Unfortunately, your host request was declined. Please check your details or contact support for assistance. 📩",
          },
        };

        try {
          const adminInstance = await admin;
          await adminInstance.messaging().send(payload);
          console.log("Notification sent successfully.");
        } catch (error) {
          console.error("Error sending notification:", error);
        }
      }
    } else {
      return res.status(200).json({ status: false, message: "Invalid status value provided." });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

//assign host under agency
exports.assignHostToAgency = async (req, res) => {
  try {
    const { requestId, agencyId, userId } = req.query;

    if (!requestId || !agencyId || !userId) {
      return res.status(200).json({
        status: false,
        message: "Required parameters missing: requestId or agencyId.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(requestId) || !mongoose.Types.ObjectId.isValid(agencyId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(200).json({
        status: false,
        message: "Invalid requestId or agencyId or userId format. Must be a valid ObjectId.",
      });
    }

    const requestObjectId = new mongoose.Types.ObjectId(requestId);
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const [hostRequest, agency, user] = await Promise.all([
      Host.findOne({ _id: requestObjectId, status: 1 }),
      Agency.findById(agencyId).select("_id name agencyCode").lean(),
      User.findById(userObjectId).select("_id").lean(),
    ]);

    if (!hostRequest) {
      return res.status(200).json({ status: false, message: "Host request not found." });
    }

    if (hostRequest.agencyId !== null) {
      return res.status(200).json({ status: false, message: "This host request is already assigned to an agency." });
    }

    if (!agency) {
      return res.status(200).json({ status: false, message: "Agency not found." });
    }

    if (!user) {
      return res.status(200).json({ status: false, message: "User not found." });
    }

    if (hostRequest.status === 2) {
      return res.status(200).json({ status: false, message: "This host request has already been accepted." });
    }

    if (hostRequest.status === 3) {
      return res.status(200).json({ status: false, message: "This host request has already been rejected." });
    }

    hostRequest.agencyId = agency._id;
    hostRequest.status = 2;
    hostRequest.randomCallRate = settingJSON.generalRandomCallRate;
    hostRequest.randomCallFemaleRate = settingJSON.femaleRandomCallRate;
    hostRequest.randomCallMaleRate = settingJSON.maleRandomCallRate;
    hostRequest.privateCallRate = settingJSON.videoPrivateCallRate;
    hostRequest.audioCallRate = settingJSON.audioPrivateCallRate;
    hostRequest.chatRate = settingJSON.chatInteractionRate;

    res.status(200).json({
      status: true,
      message: "Host successfully assigned to the agency.",
      request: { ...hostRequest.toObject(), agency },
    });

    await Promise.all([
      hostRequest.save(),
      User.updateOne(
        { _id: user._id },
        {
          $set: {
            isHost: true,
            hostId: hostRequest._id,
          },
        }
      ),
    ]);

    if (hostRequest.fcmToken) {
      const payload = {
        token: hostRequest.fcmToken,
        notification: {
          title: "🎉 Host Verification Successful!",
          body: "Congratulations! Your host request has been approved. You’re now ready to go live! 🚀",
        },
      };

      try {
        const adminInstance = await admin;
        await adminInstance.messaging().send(payload);
        console.log("Notification sent successfully.");
      } catch (error) {
        console.error("Error sending notification:", error);
      }
    }
  } catch (error) {
    console.error("Error in assignHostToAgency:", error);
    return res.status(500).json({ status: false, message: "Internal Server Error", error: error.message });
  }
};

//get agency's hosts
exports.listAgencyHosts = async (req, res) => {
  try {
    if (!req.query.agencyId) {
      return res.status(200).json({ status: false, message: "agencyId must be needed." });
    }

    const agencyId = new mongoose.Types.ObjectId(req.query.agencyId);
    const start = req.query.start ? parseInt(req.query.start) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;

    const searchString = req.query.search || "";
    const startDate = req.query.startDate || "All";
    const endDate = req.query.endDate || "All";

    let dateFilterQuery = {};
    if (startDate !== "All" && endDate !== "All") {
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);
      endDateObj.setHours(23, 59, 59, 999);

      dateFilterQuery = {
        createdAt: {
          $gte: startDateObj,
          $lte: endDateObj,
        },
      };
    }

    let searchQuery = {};
    if (searchString !== "All" && searchString !== "") {
      searchQuery = {
        $or: [{ name: { $regex: searchString, $options: "i" } }, { email: { $regex: searchString, $options: "i" } }, { uniqueId: { $regex: searchString, $options: "i" } }],
      };
    }

    const baseQuery = {
      ...dateFilterQuery,
      ...searchQuery,
      agencyId: agencyId,
      status: 2,
      isFake: false,
    };

    const [agency, hosts] = await Promise.all([
      Agency.findOne({ _id: agencyId, isBlock: false }).lean(),
      Host.aggregate([
        { $match: baseQuery },
        { $sort: { createdAt: -1 } },
        { $skip: (start - 1) * limit },
        { $limit: limit },
        {
          $lookup: {
            from: "followerfollowings",
            localField: "_id",
            foreignField: "followingId",
            as: "followers",
          },
        },
        {
          $addFields: {
            totalFollowers: { $size: "$followers" },
          },
        },
        {
          $project: {
            name: 1,
            gender: 1,
            image: 1,
            impression: 1,
            identityProofType: 1,
            uniqueId: 1,
            isOnline: 1,
            isBusy: 1,
            isLive: 1,
            countryFlagImage: 1,
            country: 1,
            totalFollowers: 1,
          },
        },
      ]),
    ]);

    if (!agency) {
      return res.status(200).json({ status: false, message: "Agency not found!" });
    }

    return res.status(200).json({
      status: true,
      message: "Agency wise hosts fetched successfully!",
      hosts,
    });
  } catch (error) {
    console.error("Error fetching agency wise hosts:", error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//create host
exports.createHost = async (req, res) => {
  try {
    const { name, bio, dob, gender, countryFlagImage, country, language, impression, email } = req.body;

    if (!name || !bio || !dob || !gender || !countryFlagImage || !country || !impression || !language || !req.files) {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({
        status: false,
        message: "Missing or invalid host details. Please check and try again.",
      });
    }

    const [uniqueId, existingHost] = await Promise.all([generateUniqueId(), Host.findOne({ email: email?.trim() }).select("_id").lean()]);

    if (existingHost) {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({
        status: false,
        message: "A host profile with this email already exists.",
      });
    }

    const newHost = new Host({
      name,
      email,
      bio,
      dob,
      gender,
      countryFlagImage,
      country,
      language,
      impression,
      image: req.files.image ? req.files.image[0].path : "",
      photoGallery: req.files.photoGallery?.map((file) => file.path) || [],
      video: req.files.video ? req.files.video[0].path : "",
      uniqueId,
      status: 2,
      isFake: true,
      date: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
    });

    await newHost.save();

    return res.status(200).json({
      status: true,
      message: "Host created successfully.",
      host: newHost,
    });
  } catch (error) {
    if (req.files) deleteFiles(req.files);
    console.error("Create Host Error:", error);
    return res.status(500).json({
      status: false,
      message: error.message || "Failed to create host profile due to server error.",
    });
  }
};

//update host
exports.updateHost = async (req, res) => {
  try {
    const { hostId, name, bio, dob, gender, countryFlagImage, country, language, impression, email } = req.body;

    if (!hostId) {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({
        status: false,
        message: "Missing or invalid host details. Please check and try again.",
      });
    }

    const [host, existingHost] = await Promise.all([Host.findOne({ _id: hostId }), email ? Host.findOne({ email: email?.trim() }).select("_id").lean() : null]);

    if (!host) {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({ status: false, message: "Host not found." });
    }

    if (existingHost) {
      if (req.files) deleteFiles(req.files);
      return res.status(200).json({
        status: false,
        message: "A host profile with this email already exists.",
      });
    }

    host.name = name || host.name;
    host.email = email || host.email;
    host.bio = bio || host.bio;
    host.dob = dob || host.dob;
    host.gender = gender || host.gender;
    host.countryFlagImage = countryFlagImage || host.countryFlagImage;
    host.country = country || host.country;
    host.countryFlagImage = countryFlagImage || host.countryFlagImage;
    host.impression = typeof impression === "string" ? impression.split(",") : Array.isArray(impression) ? impression : host.impression;
    host.language = typeof language === "string" ? language.split(",") : Array.isArray(language) ? language : host.language;

    if (req.files.image) {
      if (host.image) {
        const imagePath = host.image.includes("storage") ? "storage" + host.image.split("storage")[1] : "";
        if (imagePath && fs.existsSync(imagePath)) {
          const imageName = imagePath.split("/").pop();
          if (!["male.png", "female.png"].includes(imageName)) {
            fs.unlinkSync(imagePath);
          }
        }
      }

      host.image = req.files.image[0].path;
    }

    if (req.files.photoGallery) {
      if (host.photoGallery.length > 0) {
        for (const photo of host.photoGallery) {
          const photoGalleryPath = photo?.url?.split("storage");
          if (photoGalleryPath?.[1]) {
            const filePath = "storage" + photoGalleryPath[1];
            if (fs.existsSync(filePath)) {
              try {
                fs.unlinkSync(filePath);
              } catch (error) {
                console.error(`Error deleting file: ${filePath}`, error);
              }
            }
          }
        }
      }

      let updatedPhotoGallery = req.files.photoGallery.map((file) => ({
        url: file.path,
      }));
      host.photoGallery = updatedPhotoGallery;
    }

    if (req.files.video) {
      if (host.video) {
        const videoPath = host.video.includes("storage") ? "storage" + host.video.split("storage")[1] : "";
        if (videoPath && fs.existsSync(videoPath)) {
          const videoName = videoPath.split("/").pop();
          if (!["male.png", "female.png"].includes(videoName)) {
            fs.unlinkSync(videoPath);
          }
        }
      }

      host.video = req.files.video[0].path;
    }

    await host.save();

    return res.status(200).json({
      status: true,
      message: "Host profile updated successfully.",
      host,
    });
  } catch (error) {
    if (req.files) deleteFiles(req.files);
    console.error("Update Host Error:", error);
    return res.status(500).json({
      status: false,
      message: error.message || "Failed to Update host profile due to server error.",
    });
  }
};

//toggle host status
exports.toggleHostStatusByType = async (req, res) => {
  try {
    const { hostId, type } = req.query;

    if (!hostId || !type) {
      return res.status(200).json({ status: false, message: "Host ID and type are required!" });
    }

    if (!mongoose.Types.ObjectId.isValid(hostId)) {
      return res.status(200).json({ status: false, message: "Invalid hostId format." });
    }

    const validTypes = ["isBlock", "isBusy", "isLive"];
    if (!validTypes.includes(type)) {
      return res.status(200).json({
        status: false,
        message: `Invalid type. Valid types: ${validTypes.join(", ")}`,
      });
    }

    const host = await Host.findOne({ _id: hostId });
    if (!host) {
      return res.status(200).json({ status: false, message: "Host not found." });
    }

    host[type] = !host[type];
    await host.save();

    return res.status(200).json({
      status: true,
      message: `Host ${type} status has been ${host[type] ? "enabled" : "disabled"} successfully.`,
      data: host,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

//get host's profile
exports.fetchHostProfile = async (req, res) => {
  try {
    const { hostId } = req.query;

    if (!hostId) {
      return res.status(200).json({ status: false, message: "Host ID must be required!" });
    }

    if (!mongoose.Types.ObjectId.isValid(hostId)) {
      return res.status(200).json({ status: false, message: "Invalid hostId format." });
    }

    const [host] = await Promise.all([Host.findOne({ _id: hostId }).populate("agencyId", "name image agencyCode")]);

    if (!host) {
      return res.status(200).json({ status: false, message: "Host not found." });
    }

    return res.status(200).json({
      status: true,
      message: "Host profile retrieved successfully.",
      host: host,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//get hosts
exports.fetchHostList = async (req, res) => {
  try {
    if (!req.query.type) {
      return res.status(200).json({ status: false, message: "Host type is required!" });
    }

    const start = req.query.start ? parseInt(req.query.start) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;

    const searchString = req.query.search || "";
    const startDate = req.query.startDate || "All";
    const endDate = req.query.endDate || "All";
    const hostType = parseInt(req.query.type);

    let dateFilterQuery = {};
    if (startDate !== "All" && endDate !== "All") {
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);
      endDateObj.setHours(23, 59, 59, 999);

      dateFilterQuery = {
        createdAt: {
          $gte: startDateObj,
          $lte: endDateObj,
        },
      };
    }

    let searchQuery = {};
    if (searchString !== "All" && searchString !== "") {
      searchQuery = {
        $or: [{ name: { $regex: searchString, $options: "i" } }, { email: { $regex: searchString, $options: "i" } }, { uniqueId: { $regex: searchString, $options: "i" } }],
      };
    }

    const filter = {
      ...dateFilterQuery,
      ...searchQuery,
      status: 2,
      isFake: hostType === 1 ? false : true,
    };

    const [totalHosts, hostList] = await Promise.all([
      Host.countDocuments(filter),
      Host.aggregate([
        { $match: filter },
        {
          $lookup: {
            from: "followerfollowings",
            localField: "_id",
            foreignField: "followingId",
            as: "followers",
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "userId",
          },
        },
        { $unwind: { path: "$userId", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "agencies",
            localField: "agencyId",
            foreignField: "_id",
            as: "agencyId",
          },
        },
        { $unwind: { path: "$agencyId", preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            totalFollowers: { $size: "$followers" },
          },
        },
        {
          $project: {
            name: 1,
            gender: 1,
            bio: 1,
            age: 1,
            dob: 1,
            email: 1,
            image: 1,
            video: 1,
            impression: 1,
            identityProofType: 1,
            identityProof: 1,
            photoGallery: 1,
            uniqueId: 1,
            isBlock: 1,
            isOnline: 1,
            isBusy: 1,
            isLive: 1,
            countryFlagImage: 1,
            country: 1,
            photoGallery: 1,
            randomCallRate: 1,
            randomCallFemaleRate: 1,
            randomCallMaleRate: 1,
            privateCallRate: 1,
            audioCallRate: 1,
            chatRate: 1,
            coin: 1,
            totalGifts: 1,
            language: 1,
            totalFollowers: 1,
            createdAt: 1,
            "userId._id": 1,
            "userId.name": 1,
            "userId.image": 1,
            "userId.uniqueId": 1,
            "agencyId._id": 1,
            "agencyId.name": 1,
            "agencyId.image": 1,
            "agencyId.agencyCode": 1,
          },
        },
        { $sort: { createdAt: -1 } },
        { $skip: (start - 1) * limit },
        { $limit: limit },
      ]),
    ]);

    return res.status(200).json({
      status: true,
      message: "Hosts retrieved successfully!",
      totalHosts,
      hostList,
    });
  } catch (error) {
    console.error("Error fetching hosts:", error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//delete host
exports.deleteHost = async (req, res) => {
  try {
    const { hostId } = req.query;

    if (!hostId) {
      return res.status(200).json({
        status: false,
        message: "Missing or invalid host details. Please check and try again.",
      });
    }

    const host = await Host.findOne({ _id: hostId }).select("_id image photoGallery").lean();

    if (!host) {
      return res.status(200).json({ status: false, message: "Host not found." });
    }

    res.status(200).json({
      status: true,
      message: "Host deleted successfully.",
    });

    if (host.image) {
      const imagePath = host.image.includes("storage") ? "storage" + host.image.split("storage")[1] : "";
      if (imagePath && fs.existsSync(imagePath)) {
        const imageName = imagePath.split("/").pop();
        if (!["male.png", "female.png"].includes(imageName)) {
          try {
            fs.unlinkSync(imagePath);
          } catch (error) {
            console.error(`Error deleting profile image: ${imagePath}`, error);
          }
        }
      }
    }

    if (Array.isArray(host.photoGallery) && host.photoGallery.length > 0) {
      for (const photo of host.photoGallery) {
        const photoGalleryPath = photo?.url?.split("storage");
        if (photoGalleryPath?.[1]) {
          const filePath = "storage" + photoGalleryPath[1];
          if (fs.existsSync(filePath)) {
            try {
              fs.unlinkSync(filePath);
            } catch (error) {
              console.error(`Error deleting gallery image: ${filePath}`, error);
            }
          }
        }
      }
    }

    await Host.deleteOne({ _id: hostId });
  } catch (error) {
    console.error("Delete Host Error:", error);
    return res.status(500).json({
      status: false,
      message: error.message || "Failed to delete host due to server error.",
    });
  }
};
