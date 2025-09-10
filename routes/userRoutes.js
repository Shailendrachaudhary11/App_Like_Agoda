const express = require("express");
const router = express.Router();
const userController = require("../controller/userController");
const { registerValidation } = require("../validators/userValidator");
const validateRequest = require("../middlewares/validateRequest");
const uploadUser = require("../middlewares/uploadUser");
const auth = require("../middlewares/authMiddleware")

// register route
router.post("/register", uploadUser.single('profileImage'), registerValidation, validateRequest, userController.register);

// login router
router.post('/login', userController.login);

router.get("/viewProfile", auth(["guesthouse_admin", "customer"]), userController.getMyProfile);
router.put("/updateProfile", auth(["guesthouse_admin", "customer"]), uploadUser.single('profileImage'), userController.updateProfile);
router.post("/change-password", auth(["guesthouse_admin","customer"]), userController.changePassword);
router.post('/forgot-password', auth(["guesthouse_admin", "customer"]),userController.forgotPassword);
router.post('/verify-otp',  auth(["guesthouse_admin", "customer"]), userController.verifyOtp);
router.post("/setNew-password", auth(["guesthouse_admin", "customer"]), userController.resetPassword);


module.exports = router;
