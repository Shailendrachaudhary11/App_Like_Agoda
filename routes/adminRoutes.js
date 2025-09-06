const express = require("express");
const router = express.Router();
const adminController = require("../controller/adminController");
const { registerValidation } = require("../validators/userValidator");
const validateRequest = require("../middlewares/validateRequest");
const auth = require('../middlewares/authMiddleware');
const uploadAdmin=require("../middlewares/uploadAdmin")

// register route
router.post("/register", uploadAdmin.single('profileImage'),registerValidation,validateRequest, adminController.register);

// login router
router.post('/login', adminController.login);

router.get('/getProfile',auth(["admin"]),adminController.getProfile);
router.put('/updateProfile',auth(["admin"]),uploadAdmin.single('profileImage'),adminController.updateProfile)

router.post("/approve/user", auth(["admin"]), adminController.approvalRequestUser);
router.post("/reject/user", auth(["admin"]), adminController.rejectRequestUser);

router.post("/approve/guestHouse/:id", auth(["admin"]), adminController.approveGuesthouse);
router.post("/reject/guestHouse/:id", auth(["admin"]), adminController.rejectGuesthouse);

router.get("/getGuestHouses", auth(["admin"]), adminController.getAllGuestHouses);
router.get("/getGuestHouse/:id",auth(["admin"]),adminController.getGuestHousesById)

router.get("/getUsers", auth(["admin"]), adminController.getAllUsers);
router.get("/getUser/:id", auth(["admin"]), adminController.getUserById);

// router.get("/getGuestHouseOwner",auth(["admin"]),adminController.getAllGuestHousesOwner)

module.exports = router;
