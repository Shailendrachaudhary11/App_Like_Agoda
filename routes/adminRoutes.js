const express = require("express");
const router = express.Router();
const adminController = require("../controller/adminController");
const { registerValidation } = require("../validators/userValidator");
const validateRequest = require("../middlewares/validateRequest");
const auth = require('../middlewares/authMiddleware');
const upload = require("../middlewares/upload");
const verifyToken = require("../middlewares/verifyTokenPassword")


// ===== AUTH =====
router.post("/register", upload.single("adminImage"), registerValidation, validateRequest, adminController.register);
router.post("/login", adminController.login);
router.post("/profile-view", auth(["admin"]), adminController.getProfile);
router.post("/profile-update", auth(["admin"]), upload.single("adminImage"), adminController.updateProfile);
router.post("/change-password", auth(["admin"]), adminController.changePassword);
router.post("/forgot-password", adminController.forgotPassword);
router.post("/verify-otp", verifyToken, adminController.verifyOtp);
router.post("/reset-password", verifyToken, adminController.resetPassword);


// ===== GUESTHOUSES =====
router.post("/guesthouses/list", auth(["admin"]), adminController.getAllGuestHouses);
router.post("/guesthouses/view", auth(["admin"]), adminController.getGuestHousesById);
router.post("/guesthouses/:id/update", auth(["admin"]), upload.array("guestHouseImage", 5), adminController.updateGuestHouse);
router.post("/guesthouses/approve", auth(["admin"]), adminController.approveGuesthouseRegistration);
router.post("/guesthouses/reject", auth(["admin"]), adminController.rejectGuesthouseRegistration);
router.post("/guesthouses/status", auth(["admin"]), adminController.activeInactiveGuesthouse);


// ===== GUESTHOUSE OWNERS =====
router.post("/guesthouse-owners/list", auth(["admin"]), adminController.getAllGuestOwner);
router.post("/guesthouse-owners/view", auth(["admin"]), adminController.getGuestOwnerById);


// ===== ROOMS =====
router.post("/rooms/list", auth(["admin"]), adminController.getAllRooms);
router.post("/rooms/view", auth(["admin"]), adminController.getRoomById);
router.post("/rooms/:id/update", auth(["admin"]), upload.array("photos", 10), adminController.editRoom);
router.post("/rooms/delete", auth(["admin"]), adminController.deleteRoom);


// ===== CUSTOMERS =====
router.post("/customers/list", auth(["admin"]), adminController.getAllCustomer);
router.post("/customers/view", auth(["admin"]), adminController.getCustomerById);
router.post("/customers/status", auth(["admin"]), adminController.suspendedApproveCustomer);
router.post("/customers/:id/update", auth(["admin"]), upload.single("profileImage"), adminController.updateCustomer);
router.post("/customers/delete", auth(["admin"]), adminController.deleteCustomer);


// ===== BOOKINGS =====
router.post("/bookings/list", auth(["admin"]), adminController.getAllBooking);
router.post("/bookings/list/past", auth(["admin"]), adminController.pastBooking);
router.post("/bookings/list/upcoming", auth(["admin"]), adminController.upcomingBookings);
router.post("/bookings/list/cancelled", auth(["admin"]), adminController.getCancelBookings);
router.post("/bookings/view", auth(["admin"]), adminController.getBookingById);
router.post("/bookings/list/pending", auth(["admin"]), adminController.pendingBooking);


// ===== PROMOS =====
router.post("/promos/list", auth(["admin"]), adminController.getAllPromo);
router.post("/promos/create", auth(["admin"]), adminController.createPromo);
router.post("/promos/view", auth(["admin"]), adminController.getPromoById);
router.post("/promos/update", auth(["admin"]), adminController.updatePromo);
router.post("/promos/delete", auth(["admin"]), adminController.deletePromo);


// ===== NOTIFICATIONS =====
router.post("/notifications/list", auth(["admin"]), adminController.getAllNotification);
router.post("/notifications/read", auth(["admin"]), adminController.readNotification);
router.post("/notifications/delete", auth(["admin"]), adminController.deleteNotification);


// ===== SETTINGS / CONFIG =====
router.post("/bedroom-names/add", auth(["admin"]), adminController.addBedroomNames);
router.post("/max-price/set", auth(["admin"]), adminController.setMaxPrice);
router.post("/facilities/add", auth(["admin"]), adminController.createFacility);
router.post("/atolls/add", auth(["admin"]), adminController.createAtoll);
router.post("/islands/add", auth(["admin"]), adminController.createIslands);


module.exports = router;
