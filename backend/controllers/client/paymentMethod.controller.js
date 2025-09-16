const PaymentMethod = require("../../models/paymentMethod.model");

//get payment methods
exports.getActivePaymentMethods = async (req, res) => {
  try {
    const paymentMethods = await PaymentMethod.find({ isActive: true }).sort({ createdAt: -1 }).lean();

    return res.status(200).json({
      status: true,
      message: "Active payment methods retrieved successfully.",
      data: paymentMethods,
    });
  } catch (error) {
    console.error("Error fetching active payment methods:", error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};
