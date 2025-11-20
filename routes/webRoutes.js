const express = require("express");
const router = express.Router();
const userController = require("../controller/userController");
const customerController = require("../controller/customerController");
const { registerValidation } = require("../validators/userValidator");
const validateRequest = require("../middlewares/validateRequest");
const auth = require("../middlewares/authMiddleware")
const upload = require("../middlewares/upload");
const verifyToken = require("../middlewares/verifyTokenPassword");
const webController = require("../controller/webController");

// router.post("/atolls/guesthosue", webController.getGuestHouseByAtoll);


module.exports = router;
