const express = require("express");
const router = express.Router();
const adminController = require("../controller/adminController");
const { registerValidation } = require("../validators/userValidator");
const validateRequest = require("../middlewares/validateRequest");
const auth = require('../middlewares/authMiddleware');
const upload = require("../middlewares/upload");

// ------------------------------ ADMIN AUTH  ---------------------------------
router.post("/register", upload.single('adminImage'), registerValidation, validateRequest, adminController.register);
router.post('/login', adminController.login);
router.get("/viewProfile", auth(["admin"]), adminController.getProfile);
router.put("/updateProfile", auth(["admin"]), upload.single('adminImage'), adminController.updateProfile);
router.put("/changePassword", auth(["admin"]), adminController.changePassword);

// ------------------------------ GUESTHOUSE ---------------------------------
router.get("/guesthouses", auth(["admin"]), adminController.getAllGuestHouses);
router.get("/guesthouses/pendingRegistration", auth(["admin"]), adminController.getPendingRegistration);
router.post("/guesthouses/:id/update", upload.array("guestHouseImage", 5), auth(["admin"]), adminController.updateGuestHouse);
router.get("/guesthouses/owners", auth(["admin"]), adminController.getAllGuestOwner);
router.get("/guesthouses/:id", auth(["admin"]), adminController.getGuestHousesById);
router.get("/guesthouses/owners/:id", auth(["admin"]), adminController.getGuestOwnerById);

router.put("/guesthouses/:id/approve", auth(["admin"]), adminController.approveGuesthouseRegistration);
router.put("/guesthouses/:id/reject", auth(["admin"]), adminController.rejectGuesthouseRegistration);
router.put("/guesthouses/:id/active", auth(["admin"]), adminController.activeInactiveGuesthouse);

// ------------------------------ ROOM ---------------------------------
router.get("/rooms", auth(["admin"]), adminController.getAllRooms);
router.get("/rooms/:id", auth(["admin"]), adminController.getRoomById);
router.put("/rooms/:id", upload.array("photos", 5), auth(["admin"]), adminController.editRoom);
router.delete("/rooms/:id", auth(["admin"]), adminController.deleteRoom);

// ------------------------------ CUSTOMER ---------------------------------
router.get("/customers", auth(["admin"]), adminController.getAllCustomer);
router.get("/customers/:id", auth(["admin"]), adminController.getCustomerById);
router.put("/customers/:id/active", auth(["admin"]), adminController.suspendedApproveCustomer);
router.put("/customers/:id", upload.single('profileImage'), auth(["admin"]), adminController.updateCustomer);
router.delete("/customers/:id", auth(["admin"]), adminController.deleteCustomer);

// ------------------------------ BOOKING ---------------------------------
router.get("/bookings", auth(["admin"]), adminController.getAllBooking);
router.get("/bookings/past", auth(["admin"]), adminController.pastBooking);
router.get("/bookings/upcoming", auth(["admin"]), adminController.upcomingBookings);
router.get("/bookings/:id", auth(["admin"]), adminController.getBookingById);


// ------------------------------ PROMOS ---------------------------------
router.get("/promos", auth(["admin"]), adminController.getAllPromo);
router.post("/promos", auth(["admin"]), adminController.createPromo);
router.get("/promos/:id", auth(["admin"]), adminController.getPromoById);
router.put("/promos/:id", auth(["admin"]), adminController.updatePromo);
router.delete("/promos/:id", auth(["admin"]), adminController.deletePromo);

// ------------------------------ NOTIFICATIONS  ---------------------------------
router.get("/notifications", auth(["admin"]), adminController.getAllNotification);
router.put("/notifications/:notificationId/read", auth(["admin"]), adminController.readNotification);
router.delete("/notifications/:notificationId/delete", auth(["admin"]), adminController.deleteNotification);


module.exports = router;
