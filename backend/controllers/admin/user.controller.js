const User = require("../../models/user.model");

//get users
exports.retrieveUserList = async (req, res) => {
  try {
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

    let filter = {
      ...dateFilterQuery,
      ...searchQuery,
    };

    const [totalActiveUsers, totalVIPUsers, totalMaleUsers, totalFemaleUsers, totalUsers, users] = await Promise.all([
      User.countDocuments({ isBlock: false, ...dateFilterQuery }),
      User.countDocuments({ isVip: true, ...dateFilterQuery }),
      User.countDocuments({ gender: "male", ...dateFilterQuery }),
      User.countDocuments({ gender: "female", ...dateFilterQuery }),
      User.countDocuments(filter),
      User.aggregate([
        { $match: filter },
        { $sort: { createdAt: -1 } },
        { $skip: (start - 1) * limit },
        { $limit: limit },
        {
          $lookup: {
            from: "followerfollowings",
            localField: "_id",
            foreignField: "followerId", // user follows these hosts
            as: "followings",
          },
        },
        {
          $project: {
            _id: 1,
            uniqueId: 1,
            name: 1,
            email: 1,
            image: 1,
            countryFlagImage: 1,
            country: 1,
            gender: 1,
            coin: 1,
            rechargedCoins: 1,
            isHost: 1,
            isVip: 1,
            isBlock: 1,
            isOnline: 1,
            loginType: 1,
            createdAt: 1,
            totalFollowings: { $size: "$followings" },
          },
        },
      ]),
    ]);

    return res.status(200).json({
      status: true,
      message: "Retrieved real users!",
      totalActiveUsers,
      totalVIPUsers,
      totalMaleUsers,
      totalFemaleUsers,
      total: totalUsers,
      data: users,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//toggle user's block status
exports.modifyUserBlockStatus = async (req, res, next) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(200).json({ status: false, message: "User ID is required." });
    }

    const user = await User.findById(userId).select("uniqueId name image countryFlagImage country gender coin rechargedCoins isHost isVip isBlock isFake loginType createdAt");
    if (!user) {
      return res.status(200).json({ status: false, message: "User not found." });
    }

    user.isBlock = !user.isBlock;
    await user.save();

    return res.status(200).json({
      status: true,
      message: `User has been ${user.isBlock ? "blocked" : "unblocked"} successfully.`,
      data: user,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: "An error occurred while updating user block status." });
  }
};

//get user's profile
exports.fetchUserProfile = async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(200).json({ status: false, message: "User ID is required." });
    }

    const [user] = await Promise.all([
      User.findOne({ _id: userId }).select("name selfIntro gender bio age image email countryFlagImage country loginType uniqueId coin spentCoins rechargedCoins isOnline").lean(),
    ]);

    if (!user) {
      return res.status(200).json({ status: false, message: "User not found." });
    }

    return res.status(200).json({ status: true, message: "The user has retrieved their profile.", user: user });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};
