const IdentityProof = require("../../models/identityProof.model");

//create a new identity proof type
exports.createIdentityProof = async (req, res) => {
  try {
    if (!req.query.title) {
      return res.status(200).json({ status: false, message: "Invalid input: Title is required." });
    }

    const title = req.query.title.trim();
    const identityProof = new IdentityProof({ title });
    await identityProof.save();

    return res.status(200).json({
      status: true,
      message: "Identity proof type added successfully.",
      data: identityProof,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, error: error.message || "Internal server error." });
  }
};

//update an existing identity proof type
exports.updateIdentityProof = async (req, res) => {
  try {
    if (!req.query.identityProofId) {
      return res.status(200).json({ status: false, message: "identityProofId is required." });
    }

    const identityProof = await IdentityProof.findById(req.query.identityProofId);
    if (!identityProof) {
      return res.status(200).json({ status: false, message: "Identity proof type not found." });
    }

    identityProof.title = req.query.title ? req.query.title.trim() : identityProof.title;
    await identityProof.save();

    return res.status(200).json({
      status: true,
      message: "Identity proof type updated successfully.",
      data: identityProof,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, error: error.message || "Internal server error." });
  }
};

//retrieve all identity proof types
exports.getIdentityProofs = async (req, res) => {
  try {
    const identityProofs = await IdentityProof.find().select("_id title createdAt").lean();
    return res.status(200).json({
      status: true,
      message: "Identity proof types retrieved successfully.",
      data: identityProofs,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, error: error.message || "Internal server error." });
  }
};

//delete an identity proof type
exports.deleteIdentityProof = async (req, res) => {
  try {
    if (!req.query.identityProofId) {
      return res.status(200).json({ status: false, message: "identityProofId is required." });
    }

    const identityProof = await IdentityProof.findById(req.query.identityProofId);
    if (!identityProof) {
      return res.status(200).json({ status: false, message: "Identity proof type not found." });
    }

    await identityProof.deleteOne();

    return res.status(200).json({
      status: true,
      message: "Identity proof type deleted successfully.",
      data: identityProof,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, error: error.message || "Internal server error." });
  }
};
