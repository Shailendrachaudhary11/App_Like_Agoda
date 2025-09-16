const express = require("express");
const router = express.Router();
const userController = require("../controller/userController");
const { registerValidation } = require("../validators/userValidator");
const validateRequest = require("../middlewares/validateRequest");
const auth = require("../middlewares/authMiddleware")
const upload = require("../middlewares/upload");

// register route
router.post("/register", upload.single('profileImage'), registerValidation, validateRequest, userController.register);

// login
router.post('/login', userController.login);

// profile
router.get("/viewProfile", auth(["guesthouse", "customer"]), userController.getMyProfile);
router.put("/updateProfile", auth(["guesthouse", "customer"]), upload.single('profileImage'), userController.updateProfile);
router.post("/change-password", auth(["guesthouse","customer"]), userController.changePassword);
router.post('/forgot-password',userController.forgotPassword);
router.post('/verify-otp', userController.verifyOtp);
router.post("/setNew-password", userController.resetPassword);

module.exports = router;
