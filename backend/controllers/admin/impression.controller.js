const Impression = require("../../models/impression.model");

//create Impression
exports.createImpression = async (req, res) => {
  try {
    if (!req.query.name) {
      return res.status(200).json({ status: false, message: "Invalid input! Name is required." });
    }

    const name = req.query.name.trim();
    const impression = await new Impression({ name }).save();

    return res.status(200).json({
      status: true,
      message: "Impression created successfully!",
      data: impression,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message || "Internal server error." });
  }
};

//update Impression
exports.updateImpression = async (req, res) => {
  try {
    if (!req.query.impressionId) {
      return res.status(200).json({ status: false, message: "Impression ID is required." });
    }

    const impression = await Impression.findById(req.query.impressionId);
    if (!impression) {
      return res.status(200).json({ status: false, message: "Impression not found." });
    }

    impression.name = req.query.name ? req.query.name.trim() : impression.name;
    await impression.save();

    return res.status(200).json({
      status: true,
      message: "Impression updated successfully!",
      data: impression,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message || "Internal server error." });
  }
};

//get all Impressions
exports.getImpressions = async (req, res) => {
  try {
    const start = req.query.start ? parseInt(req.query.start) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;

    const [total, impressions] = await Promise.all([
      Impression.countDocuments(),
      Impression.find()
        .skip((start - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    return res.status(200).json({
      status: true,
      message: "Impressions retrieved successfully!",
      total: total,
      data: impressions,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message || "Internal server error." });
  }
};

//get all Impressions ( drop - down )
exports.fetchAdImpressionMetrics = async (req, res) => {
  try {
    const [impressions] = await Promise.all([Impression.find().lean()]);

    return res.status(200).json({
      status: true,
      message: "Impressions retrieved successfully!",
      data: impressions,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message || "Internal server error." });
  }
};

//delete Impression
exports.deleteImpression = async (req, res) => {
  try {
    if (!req.query.impressionId) {
      return res.status(200).json({ status: false, message: "Impression ID is required." });
    }

    const impression = await Impression.findById(req.query.impressionId);
    if (!impression) {
      return res.status(200).json({ status: false, message: "Impression not found." });
    }

    await impression.deleteOne();

    return res.status(200).json({
      status: true,
      message: "Impression deleted successfully!",
      data: impression,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message || "Internal server error." });
  }
};
