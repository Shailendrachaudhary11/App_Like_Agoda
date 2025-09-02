const express = require("express");
const router = express.Router();
const adminController = require("../controller/adminController");
const { registerValidation } = require("../validators/userValidator");
const validateRequest = require("../middlewares/validateRequest");

// register route
router.post("/register",registerValidation,validateRequest, adminController.register);

// login router
router.post('/login', adminController.login);

// Approval request from user [ customer or guest house owner]
router.post("/approve/user", adminController.approvalRequestUser);

// router.post("/approval/guestHouse",adminController.approvalRequestGuestHouse)


module.exports = router;
