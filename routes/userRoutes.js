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


module.exports = router;
