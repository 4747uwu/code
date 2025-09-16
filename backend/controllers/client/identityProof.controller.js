const IdentityProof = require("../../models/identityProof.model");

//retrieve all identity proof types
exports.fetchIdentityDocuments = async (req, res) => {
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
