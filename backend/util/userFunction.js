const generateUniqueId = require("../util/generateUniqueId");

// User function
const userFunction = async (user, data_) => {
  const data = data_.body;
  const file = data_.file;

  user.image = file ? file.path : data.image ? data.image : user.image;
  user.name = data?.name?.trim() || user.name;
  user.gender = data?.gender?.toLowerCase()?.trim() || user.gender;
  user.age = data?.age || user.age;
  user.dob = data?.dob?.trim() || user.dob;
  user.email = data?.email?.trim() || user.email;
  user.selfIntro = data?.selfIntro?.trim() || user.selfIntro;
  user.countryFlagImage = data?.countryFlagImage || user.countryFlagImage;
  user.country = data?.country?.toLowerCase()?.trim() || user.country;
  user.ipAddress = data?.ipAddress || user.ipAddress;
  user.loginType = data?.loginType || user.loginType;
  user.identity = data?.identity || user.identity;
  user.fcmToken = data?.fcmToken || user.fcmToken;

  if (!user.uniqueId) {
    [user.uniqueId] = await Promise.all([generateUniqueId()]);
  }

  await user.save();
  return user;
};

module.exports = userFunction;
