const express = require("express");
const router = express.Router();
const adminController = require("../controller/adminController");
const { registerValidation } = require("../validators/userValidator");
const validateRequest = require("../middlewares/validateRequest");
const auth = require('../middlewares/authMiddleware');
const uploadAdmin = require("../middlewares/uploadAdmin")
const uploadRooms = require("../middlewares/uploadRooms")

// register route
router.post("/register", uploadAdmin.single('profileImage'), registerValidation, validateRequest, adminController.register);

// login router
router.post('/login', adminController.login);

// forgot password
router.put("/change-Password", auth(["admin"]), adminController.changePassword);
router.post('/forgot-password', auth(['admin']), adminController.forgotPassword);
router.post('/verify-otp', auth(['admin']), adminController.verifyOtp);
router.post("/setNew-password", auth(['admin']), adminController.setNewPassword);

// get own details
router.get('/getProfile', auth(["admin"]), adminController.getProfile);
router.put('/updateProfile', auth(["admin"]), uploadAdmin.single('profileImage'), adminController.updateProfile)

// users 
router.put("/approve/user", auth(["admin"]), adminController.approvalRequestUser);
router.delete("/reject/user", auth(["admin"]), adminController.rejectRequestUser);
router.put("/suspended/user", auth(["admin"]), adminController.suspendedRequestUser);
router.put("/activate/user", auth(["admin"]), adminController.activateRequestUser);

// guesthouses
router.put("/approve/guestHouse/:id", auth(["admin"]), adminController.approveGuesthouse);
router.delete("/reject/guestHouse/:id", auth(["admin"]), adminController.rejectGuesthouse);
router.put("/suspended/guestHouse/:id", auth(["admin"]), adminController.suspendedGuestHouse);
router.put("/activate/guestHouse/:id", auth(["admin"]), adminController.activateGuesthouse);

// guesthouses details
router.get("/getGuestHouses", auth(["admin"]), adminController.getAllGuestHouses);
router.get("/getGuestHouse/:id", auth(["admin"]), adminController.getGuestHousesById);
router.get("/guestHouse/rooms/:guesthouseId", auth(["admin"]), adminController.getRoomGuestHouseBy);


router.get("/room/:id", auth(["admin"]), adminController.getRoomById);
router.put("/room/edit/:id", auth(["admin"]), uploadRooms.array("photos", 5), adminController.editRoom);
router.delete("/room/delete/:id", auth(["admin"]), adminController.deleteRoom);



// ---------------- Users (Customers) ----------------
router.get("/customers", auth(["admin"]), adminController.getAllUsers);   // Get all users
router.get("/customer/:id", auth(["admin"]), adminController.getUserById); // Get user by ID

// ---------------- Guesthouse Owners ----------------
router.get("/guesthouse-owners", auth(["admin"]), adminController.getAllGuesthouseOwners);   // Get all guesthouse owners
router.get("/guesthouse-owner/:id", auth(["admin"]), adminController.getGuesthouseOwnerById); // Get guesthouse owner by ID

// promos
router.get("/all-promos", auth(["admin"]), adminController.getAllPromo);
router.get("/promo/:id", auth(["admin"]), adminController.getPromoById);
router.put("/updatePromo/:id", auth(["admin"]), adminController.updatePromo);
router.delete("/delete/:id", auth(["admin"]), adminController.deletePromo);


module.exports = router;
