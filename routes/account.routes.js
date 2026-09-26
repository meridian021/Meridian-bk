const express = require("express");
const router = express.Router();
const Card = require("../models/Card");
const cardService = require("../services/cardService");
const Transfer = require("../models/Transfer");
const transferService = require("../services/transferService");
const requireAuth = require("../middleware/requireAuth");
const upload = require("../middleware/upload");
const User = require("../models/User");
const Account = require("../models/Account");
const KYCApplication = require("../models/KYCApplication");
const Document = require("../models/Document");

router.get("/upgrade", requireAuth, async (req, res, next) => {
  try {
    const account = await Account.findOne({ userId: req.session.user.id });
    const pendingApplication = await KYCApplication.findOne({
      userId: req.session.user.id,
      status: "pending",
    }).sort({ createdAt: -1 });

    res.render("customer/upgrade", {
      title: "Upgrade your account",
      account,
      pendingApplication,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/upgrade/tier2", requireAuth, async (req, res, next) => {
  try {
    const account = await Account.findOne({ userId: req.session.user.id });
    if (account.tier !== 1) return res.redirect("/account/upgrade");
    res.render("customer/upgrade-tier2", {
      title: "Upgrade to Tier 2",
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

router.post(
  "/upgrade/tier2",
  requireAuth,
  upload.fields([
    { name: "governmentId", maxCount: 1 },
    { name: "proofOfAddress", maxCount: 1 },
  ]),
  async (req, res, next) => {
    try {
      const { occupation, employer, governmentIdNumber } = req.body;

      if (!req.files || !req.files.governmentId || !req.files.proofOfAddress) {
        return res.status(400).render("customer/upgrade-tier2", {
          title: "Upgrade to Tier 2",
          error:
            "Both a government ID and proof of address document are required.",
        });
      }

      const application = await KYCApplication.create({
        userId: req.session.user.id,
        tierRequested: 2,
        submittedInfo: { occupation, employer, governmentIdNumber },
        status: "pending",
      });

      const govIdFile = req.files.governmentId[0];
      const addressFile = req.files.proofOfAddress[0];

      await Document.create({
        userId: req.session.user.id,
        kycApplicationId: application._id,
        documentType: "government_id",
        fileData: govIdFile.buffer,
        mimeType: govIdFile.mimetype,
        originalName: govIdFile.originalname,
        fileSize: govIdFile.size,
      });

      await Document.create({
        userId: req.session.user.id,
        kycApplicationId: application._id,
        documentType: "proof_of_address",
        fileData: addressFile.buffer,
        mimeType: addressFile.mimetype,
        originalName: addressFile.originalname,
        fileSize: addressFile.size,
      });

      await User.findByIdAndUpdate(req.session.user.id, {
        kycStatus: "pending",
        occupation,
        employer,
      });

      res.redirect("/account/upgrade");
    } catch (err) {
      next(err);
    }
  },
);
router.get("/upgrade/tier3", requireAuth, async (req, res, next) => {
  try {
    const account = await Account.findOne({ userId: req.session.user.id });
    if (account.tier !== 2) return res.redirect("/account/upgrade");
    res.render("customer/upgrade-tier3", {
      title: "Upgrade to Tier 3",
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

router.post(
  "/upgrade/tier3",
  requireAuth,
  upload.fields([
    { name: "passportPhoto", maxCount: 1 },
    { name: "proofOfAddress", maxCount: 1 },
    { name: "cardImage", maxCount: 1 },
  ]),
  async (req, res, next) => {
    try {
      const { sourceOfFunds, expectedActivity, additionalInfo } = req.body;

      if (
        !req.files ||
        !req.files.passportPhoto ||
        !req.files.proofOfAddress ||
        !req.files.cardImage
      ) {
        return res.status(400).render("customer/upgrade-tier3", {
          title: "Upgrade to Tier 3",
          error:
            "A passport photo, proof of address, and card image are all required.",
        });
      }

      const application = await KYCApplication.create({
        userId: req.session.user.id,
        tierRequested: 3,
        submittedInfo: { sourceOfFunds, expectedActivity, additionalInfo },
        status: "pending",
      });

      const fileMap = {
        passportPhoto: "passport_photo",
        proofOfAddress: "proof_of_address",
        cardImage: "card_image",
      };

      for (const [fieldName, documentType] of Object.entries(fileMap)) {
        const file = req.files[fieldName][0];
        await Document.create({
          userId: req.session.user.id,
          kycApplicationId: application._id,
          documentType,
          fileData: file.buffer,
          mimeType: file.mimetype,
          originalName: file.originalname,
          fileSize: file.size,
        });
      }

      await User.findByIdAndUpdate(req.session.user.id, {
        kycStatus: "pending",
      });

      res.redirect("/account/upgrade");
    } catch (err) {
      next(err);
    }
  },
);
router.get("/card", requireAuth, async (req, res, next) => {
  try {
    const card = await Card.findOne({ userId: req.session.user.id }).sort({
      createdAt: -1,
    });
    const user = await User.findById(req.session.user.id);
    res.render("customer/card", {
      title: "Debit card",
      card,
      user,
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/card/request", requireAuth, async (req, res, next) => {
  try {
    const { shippingAddress } = req.body;

    if (!shippingAddress || !shippingAddress.trim()) {
      const card = await Card.findOne({ userId: req.session.user.id }).sort({
        createdAt: -1,
      });
      const user = await User.findById(req.session.user.id);
      return res.status(400).render("customer/card", {
        title: "Debit card",
        card,
        user,
        error: "Please enter a shipping address.",
      });
    }

    const user = await User.findById(req.session.user.id);
    await cardService.requestCard(req.session.user.id, user, shippingAddress);
    res.redirect("/account/card");
  } catch (err) {
    next(err);
  }
});
router.get("/transfers", requireAuth, async (req, res, next) => {
  try {
    const transfers = await Transfer.find({
      userId: req.session.user.id,
      transferType: "external",
    }).sort({ createdAt: -1 });
    res.render("customer/transfers", {
      title: "Transfers",
      transfers,
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/transfers/external", requireAuth, async (req, res, next) => {
  try {
    await transferService.createExternalTransfer(req.session.user.id, req.body);
    res.redirect("/account/transfers");
  } catch (err) {
    if (err.status === 400) {
      const transfers = await Transfer.find({
        userId: req.session.user.id,
        transferType: "external",
      }).sort({ createdAt: -1 });
      return res.status(400).render("customer/transfers", {
        title: "Transfers",
        transfers,
        error: err.publicMessage,
      });
    }
    next(err);
  }
});

router.get("/create-pin", requireAuth, async (req, res, next) => {
  try {
    res.render("customer/create-pin", { title: "Create transfer PIN" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
