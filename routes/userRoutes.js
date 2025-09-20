const express = require("express");
const router = express.Router();
const userController = require("../controller/userController");
const { registerValidation } = require("../validators/userValidator");
const validateRequest = require("../middlewares/validateRequest");
const auth = require("../middlewares/authMiddleware")
const upload = require("../middlewares/upload");
const verifyToken = require("../middlewares/verifyTokenPassword")

// register route
router.post("/register", upload.single('profileImage'), registerValidation, validateRequest, userController.register);

// login
router.post('/login', userController.login);

// profile
router.get("/profile", auth(["guesthouse", "customer"]), userController.getMyProfile);
router.put("/profile", auth(["guesthouse", "customer"]), upload.single('profileImage'), userController.updateProfile);
router.post("/change-password", auth(["guesthouse","customer"]), userController.changePassword);
router.post('/forgot-password',userController.forgotPassword);
router.post('/verify-otp', verifyToken,  userController.verifyOtp);
router.post("/reset-password",verifyToken, userController.resetPassword);

module.exports = router;
