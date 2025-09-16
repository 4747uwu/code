const Agency = require("../../models/agency.model");

//Cryptr
const Cryptr = require("cryptr");
const cryptr = new Cryptr("myTotallySecretKey");

//mongoose
const mongoose = require("mongoose");

//agency login
exports.loginAgency = async (req, res) => {
  try {
    const { email, password } = req.query;

    if (!email || !password) {
      return res.status(200).json({ status: false, message: "Oops! Invalid details!" });
    }

    const agency = await Agency.findOne({ email: email.trim() }).select("_id password isBlock").lean();

    if (!agency) {
      return res.status(200).json({ status: false, message: "Oops! Agency not found with that email." });
    }

    if (agency.isBlock) {
      return res.status(200).json({ status: false, message: "Agency is currently inactive." });
    }

    if (cryptr.decrypt(agency.password.trim()) !== password.trim()) {
      return res.status(200).json({ status: false, message: "Oops! Password doesn't match!" });
    }

    return res.status(200).json({
      status: true,
      message: "Agency has successfully logged in.",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};

//update agency
exports.modifyAgency = async (req, res) => {
  try {
    if (!req.agency || !req.agency._id) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    const { name, email, commissionType, commission, password, mobileNumber, description, countryFlagImage, country } = req.body;

    const agencyObjectId = new mongoose.Types.ObjectId(req.agency._id);

    const [existingAgency, agency] = await Promise.all([email ? Agency.findOne({ email: email.trim() }) : null, Agency.findById(agencyObjectId)]);

    if (email && existingAgency) {
      return res.status(200).json({ status: false, message: "Email already exists!" });
    }

    if (!agency) {
      return res.status(200).json({ status: false, message: "Agency not found." });
    }

    agency.name = name || agency.name;
    agency.email = email?.trim() || agency.email;
    agency.password = cryptr?.encrypt(password) || agency.password;
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

//get agency profile
exports.getAgencyProfile = async (req, res) => {
  try {
    if (!req.agency || !req.agency._id) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    const agencyObjectId = new mongoose.Types.ObjectId(req.agency._id);

    const agency = await Agency.findById(agencyObjectId).lean();

    if (!agency) {
      return res.status(200).json({ status: false, message: "Agency not found." });
    }

    if (agency.isBlock) {
      return res.status(200).json({ status: false, message: "Agency is currently inactive." });
    }

    agency.password = cryptr.decrypt(agency.password);

    return res.status(200).json({
      status: true,
      message: "Agency profile retrieved successfully!",
      data: agency,
    });
  } catch (error) {
    console.error("Error fetching agency profile:", error);
    return res.status(500).json({ status: false, message: "Internal server error." });
  }
};
