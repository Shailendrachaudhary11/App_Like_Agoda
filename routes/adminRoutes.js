const express = require("express");
const router = express.Router();
const adminController = require("../controller/adminController");
const { registerValidation } = require("../validators/userValidator");
const validateRequest = require("../middlewares/validateRequest");
const auth = require('../middlewares/authMiddleware');
const uploadAdmin=require("../middlewares/uploadAdmin")
const uploadRooms = require("../middlewares/uploadRooms")

// register route
router.post("/register", uploadAdmin.single('profileImage'),registerValidation,validateRequest, adminController.register);

// login router
router.post('/login', adminController.login);

router.get('/getProfile',auth(["admin"]),adminController.getProfile);
router.put('/updateProfile',auth(["admin"]),uploadAdmin.single('profileImage'),adminController.updateProfile)


router.put("/approve/user", auth(["admin"]), adminController.approvalRequestUser);
router.delete("/reject/user", auth(["admin"]), adminController.rejectRequestUser);
router.put("/suspended/user", auth(["admin"]), adminController.suspendedRequestUser);
router.put("/activate/user", auth(["admin"]), adminController.activateRequestUser);


router.put("/approve/guestHouse/:id", auth(["admin"]), adminController.approveGuesthouse);
router.delete("/reject/guestHouse/:id", auth(["admin"]), adminController.rejectGuesthouse);
router.put("/suspended/guestHouse/:id", auth(["admin"]), adminController.suspendedGuestHouse);
router.put("/activate/guestHouse/:id", auth(["admin"]), adminController.activateGuesthouse);


router.get("/rooms", auth(["admin"]),adminController.getAllRooms);
router.get("/room/:id", auth(["admin"]),adminController.getRoomById);
router.put("/room/edit/:id", auth(["admin"]),uploadRooms.array("photos", 5),adminController.editRoom);
router.delete("/room/delete/:id", auth(["admin"]),adminController.deleteRoom);


router.get("/getGuestHouses", auth(["admin"]), adminController.getAllGuestHouses);
router.get("/getGuestHouse/:id",auth(["admin"]),adminController.getGuestHousesById)


router.get("/getUsers", auth(["admin"]), adminController.getAllUsers);
router.get("/getUser/:id", auth(["admin"]), adminController.getUserById);


module.exports = router;
