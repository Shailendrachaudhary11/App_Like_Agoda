const express = require("express");
const router = express.Router();
const userController = require("../controller/userController");
const { registerValidation } = require("../validators/userValidator");
const validateRequest = require("../middlewares/validateRequest");
const auth = require("../middlewares/authMiddleware")
const upload = require("../middlewares/upload");
const verifyToken = require("../middlewares/verifyTokenPassword")

// register route
router.post("/userAuth/register", upload.single('profileImage'), registerValidation, validateRequest, userController.register);

// login
router.post('/userAuth/login', userController.login);

// profile
router.post("/userAuth/profile", auth(["guesthouse", "customer"]), userController.getMyProfile);
router.post("/userAuth/update-profile", auth(["guesthouse", "customer"]), upload.single('profileImage'), userController.updateProfile);
router.post("/userAuth/change-password", auth(["guesthouse", "customer"]), userController.changePassword);
router.post('/userAuth/forgot-password', userController.forgotPassword);
router.post('/userAuth/verify-otp', verifyToken, userController.verifyOtp);
router.post("/userAuth/reset-password", verifyToken, userController.resetPassword);

module.exports = router;
