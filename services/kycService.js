const User = require("../models/User");
const Account = require("../models/Account");
const KYCApplication = require("../models/KYCApplication");
const SystemSetting = require("../models/SystemSetting");
const { sendEmail } = require("./emailService");

async function approveKyc(applicationId, reviewerId) {
  const application = await KYCApplication.findById(applicationId);
  if (!application) throw new Error("Application not found");

  const user = await User.findById(application.userId);
  const settings = await SystemSetting.getSettings();
  const limits = settings.tierLimits[`tier${application.tierRequested}`];

  application.status = "approved";
  application.reviewedAt = new Date();
  application.reviewedBy = reviewerId;
  await application.save();

  user.kycStatus = "approved";
  await user.save();

  await Account.findOneAndUpdate(
    { userId: user._id },
    {
      tier: application.tierRequested,
      dailyLimit: limits.daily,
      monthlyLimit: limits.monthly,
    },
  );

  await sendEmail({
    to: user.email,
    subject: "Your account has been upgraded",
    html: `<p>Hi ${user.firstName}, your account has been upgraded to Tier ${application.tierRequested}.</p>`,
  });

  return application;
}

async function rejectKyc(applicationId, reviewerId, reason) {
  const application = await KYCApplication.findById(applicationId);
  if (!application) throw new Error("Application not found");

  const user = await User.findById(application.userId);

  application.status = "rejected";
  application.reviewNote = reason;
  application.reviewedAt = new Date();
  application.reviewedBy = reviewerId;
  await application.save();

  user.kycStatus = "rejected";
  await user.save();

  await sendEmail({
    to: user.email,
    subject: "Update on your verification application",
    html: `<p>Hi ${user.firstName}, your verification application was not approved.</p><p>Reason: ${reason || "Not specified"}</p>`,
  });

  return application;
}

async function requestMoreInfo(applicationId, reviewerId, note) {
  const application = await KYCApplication.findById(applicationId);
  if (!application) throw new Error("Application not found");

  const user = await User.findById(application.userId);

  application.status = "more_info_required";
  application.reviewNote = note;
  application.reviewedAt = new Date();
  application.reviewedBy = reviewerId;
  await application.save();

  user.kycStatus = "more_info_required";
  await user.save();

  await sendEmail({
    to: user.email,
    subject: "More information needed for your verification",
    html: `<p>Hi ${user.firstName}, we need a bit more information to continue reviewing your application.</p><p>${note || "Please check your account for details."}</p>`,
  });

  return application;
}

module.exports = { approveKyc, rejectKyc, requestMoreInfo };
