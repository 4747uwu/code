const moment = require("moment");

const validatePlanExpiration = async (user, validity, validityType) => {
  const currentDate = moment();
  const planStartDate = moment(user.vipPlanStartDate);
  let diffTime = 0;

  switch (validityType.toLowerCase()) {
    case "day":
      diffTime = currentDate.diff(planStartDate, "days");
      break;
    case "month":
      diffTime = currentDate.diff(planStartDate, "months");
      break;
    case "year":
      diffTime = currentDate.diff(planStartDate, "years");
      break;
    default:
      return false;
  }

  if (diffTime >= validity) {
    user.isVip = false;
    user.vipPlanId = null;
    user.vipPlanStartDate = null;
    user.vipPlanEndDate = null;
    user.vipPlan.validity = 0;
    user.vipPlan.validityType = "";
    user.vipPlan.coin = 0;
    user.vipPlan.price = 0;
    await user.save();
    return true;
  }

  return false;
};

module.exports = validatePlanExpiration;
