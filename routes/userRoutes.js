const express = require("express");
const router = express.Router();
const userController = require("../controller/userController");
const { registerValidation } = require("../validators/userValidator");
const validateRequest = require("../middlewares/validateRequest");

// register route
router.post("/register", registerValidation, validateRequest, userController.register);

// login router
router.post('/login', userController.login);

module.exports = router;
