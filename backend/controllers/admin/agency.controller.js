const Agency = require("../../models/agency.model");

//generateAgencyCode
const generateAgencyCode = require("../../util/generateAgencyCode");

//Cryptr
const Cryptr = require("cryptr");
const cryptr = new Cryptr("myTotallySecretKey");

//fs
const fs = require("fs");

//create agency
exports.createAgency = async (req, res) => {
  try {
    const { name, email, commissionType, commission, password, countryCode, mobileNumber, description, countryFlagImage, country, uid } = req.body;

    if (!name || !email || !commissionType || !commission || !password || !countryCode || !mobileNumber || !req.file || !description || !countryFlagImage || !country || !uid) {
      return res.status(200).json({ status: false, message: "All fields are required!" });
    }

    const [existingAgency, agencyCode] = await Promise.all([Agency.findOne({ email: email.trim(), uid: uid.trim() }), generateAgencyCode()]);

    if (existingAgency) {
      return res.status(200).json({ status: false, message: "Email already exists!" });
    }

    const newAgency = new Agency({
      uid,
      agencyCode,
      name,
      email,
      commissionType,
      commission,
      password: cryptr.encrypt(password),
      countryCode,
      mobileNumber,
      image: req.file.path,
      description,
      countryFlagImage,
      country,
    });

    await newAgency.save();

    newAgency.password = cryptr.decrypt(newAgency.password);

    return res.status(200).json({
      status: true,
      message: "Agency created successfully!",
      data: newAgency,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: "Internal server error." });
  }
};

//update agency
exports.updateAgency = async (req, res) => {
  try {
    const { agencyId } = req.query;
    const { name, email, commissionType, commission, password, countryCode, mobileNumber, description, countryFlagImage, country, uid } = req.body;

    if (!agencyId) {
      return res.status(200).json({ status: false, message: "Agency ID is required." });
    }

    const [existingAgency, agency] = await Promise.all([email ? Agency.findOne({ email: email.trim(), uid: uid.trim() }) : null, Agency.findById(agencyId)]);

    if (email && existingAgency) {
      return res.status(200).json({ status: false, message: "Email already exists!" });
    }

    if (!agency) {
      return res.status(200).json({ status: false, message: "Agency not found." });
    }

    agency.uid = uid || agency.uid;
    agency.name = name || agency.name;
    agency.email = email?.trim() || agency.email;
    agency.password = password ? cryptr?.encrypt(password) : agency.password;
    agency.countryCode = countryCode || agency.countryCode;
    agency.mobileNumber = mobileNumber || agency.mobileNumber;
    agency.commissionType = commissionType || agency.commissionType;
    agency.commission = commission || agency.commission;
    agency.description = description || agency.description;
    agency.countryFlagImage = countryFlagImage || agency.countryFlagImage;
    agency.country = country || agency.country;

    if (req.file) {
      if (agency.image) {
        const imagePath = agency.image.includes("storage") ? "storage" + agency.image.split("storage")[1] : "";
        if (imagePath && fs.existsSync(imagePath)) {
          const imageName = imagePath.split("/").pop();
          if (!["male.png", "female.png"].includes(imageName)) {
            fs.unlinkSync(imagePath);
          }
        }
      }
      agency.image = req.file.path;
    }

    await agency.save();

    agency.password = cryptr.decrypt(agency.password);

    return res.status(200).json({
      status: true,
      message: "Agency updated successfully!",
      data: agency,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: "Internal server error." });
  }
};

//toggle agency block status
exports.toggleAgencyBlockStatus = async (req, res, next) => {
  try {
    const { agencyId } = req.query;

    if (!agencyId) {
      return res.status(200).json({ status: false, message: "Agency ID is required." });
    }

    const agency = await Agency.findById(agencyId);
    if (!agency) {
      return res.status(200).json({ status: false, message: "Agency not found." });
    }

    agency.isBlock = !agency.isBlock;
    await agency.save();

    return res.status(200).json({
      status: true,
      message: `Agency has been ${agency.isBlock ? "blocked" : "unblocked"} successfully.`,
      data: agency,
    });
  } catch (error) {
    console.error("Error updating agency block status:", error);
    return res.status(500).json({
      status: false,
      message: "An error occurred while updating the agency's block status.",
    });
  }
};

//get agencies
exports.getAgencies = async (req, res) => {
  try {
    const start = req.query.start ? parseInt(req.query.start) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;
    const searchString = req.query.search || "";
    const startDate = req.query.startDate || "All";
    const endDate = req.query.endDate || "All";

    let matchQuery = {};

    if (startDate !== "All" && endDate !== "All") {
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);
      endDateObj.setHours(23, 59, 59, 999);

      matchQuery.createdAt = { $gte: startDateObj, $lte: endDateObj };
    }

    if (searchString !== "All" && searchString !== "") {
      matchQuery.$or = [{ name: { $regex: searchString, $options: "i" } }, { email: { $regex: searchString, $options: "i" } }, { agencyCode: { $regex: searchString, $options: "i" } }];
    }

    const [total, agencies] = await Promise.all([
      Agency.countDocuments(matchQuery),
      Agency.aggregate([
        { $match: matchQuery },
        {
          $lookup: {
            from: "hosts",
            let: { agencyId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [{ $eq: ["$agencyId", "$$agencyId"] }, { $eq: ["$status", 2] }, { $eq: ["$isFake", false] }],
                  },
                },
              },
            ],
            as: "hosts",
          },
        },
        {
          $addFields: {
            totalHosts: { $size: "$hosts" },
          },
        },
        { $unset: "hosts" },
        {
          $project: {
            _id: 1,
            totalHosts: 1,
            name: 1,
            email: 1,
            description: 1,
            password: 1,
            commissionType: 1,
            commission: 1,
            agencyCode: 1,
            countryCode: 1,
            mobileNumber: 1,
            image: 1,
            countryFlagImage: 1,
            country: 1,
            hostCoins: 1,
            totalEarnings: 1,
            netAvailableEarnings: 1,
            isBlock: 1,
            createdAt: 1,
          },
        },
        { $sort: { createdAt: -1 } },
        { $skip: (start - 1) * limit },
        { $limit: limit },
      ]),
    ]);

    for (let i = 0; i < agencies.length; i++) {
      try {
        if (agencies[i].password && agencies[i].password.trim() !== "") {
          agencies[i].password = cryptr.decrypt(agencies[i].password);
        }
      } catch (err) {
        agencies[i].password = "Decryption Failed";
      }
    }

    return res.status(200).json({
      status: true,
      message: "Agencies retrieved successfully!",
      total: total,
      data: agencies,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: "Internal server error." });
  }
};

//delete agency
exports.deleteAgency = async (req, res) => {
  try {
    const { agencyId } = req.query;

    if (!agencyId) {
      return res.status(200).json({ status: false, message: "Agency ID is required." });
    }

    const agency = await Agency.findById(agencyId);
    if (!agency) {
      return res.status(200).json({ status: false, message: "Agency not found." });
    }

    await agency.deleteOne();

    return res.status(200).json({
      status: true,
      message: "Agency deleted successfully!",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: "Internal server error." });
  }
};

//get agency list ( when assign host under agency )
exports.getActiveAgenciesList = async (req, res) => {
  try {
    const agencies = await Agency.find({ isBlock: false }).select("_id name agencyCode").lean();

    return res.status(200).json({
      status: true,
      message: "Active agencies retrieved successfully.",
      data: agencies,
    });
  } catch (error) {
    console.error("Error in getActiveAgenciesList:", error);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};
