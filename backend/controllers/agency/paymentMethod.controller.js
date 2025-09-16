const PaymentMethod = require("../../models/paymentMethod.model");

//Get All Payment Methods
exports.fetchPaymentMethods = async (req, res, next) => {
  try {
    const methods = await PaymentMethod.find().sort({ createdAt: -1 }).lean();

    return res.status(200).json({
      status: true,
      message: "Retrieved payment methods.",
      data: methods,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};
