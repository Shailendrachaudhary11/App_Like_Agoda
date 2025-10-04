const express = require("express");
const router = express.Router();
const adminController = require("../controller/adminController");
const { registerValidation } = require("../validators/userValidator");
const validateRequest = require("../middlewares/validateRequest");
const auth = require('../middlewares/authMiddleware');
const upload = require("../middlewares/upload");


router.post("/register", upload.single('adminImage'), registerValidation, validateRequest, adminController.register);
router.post('/login', adminController.login);
router.post("/viewProfile", auth(["admin"]), adminController.getProfile);
router.put("/updateProfile", auth(["admin"]), upload.single('adminImage'), adminController.updateProfile);
router.put("/changePassword", auth(["admin"]), adminController.changePassword);


router.post("/guesthouses", auth(["admin"]), adminController.getAllGuestHouses);
router.post("/guesthouses/pendingRegistration", auth(["admin"]), adminController.getPendingRegistration);
router.post("/guesthouses/:id/update", upload.array("guestHouseImage", 5), auth(["admin"]), adminController.updateGuestHouse);
router.post("/guesthouses/owners", auth(["admin"]), adminController.getAllGuestOwner);
router.post("/guesthouses/:id", auth(["admin"]), adminController.getGuestHousesById);
router.post("/guesthouses/owners/:id", auth(["admin"]), adminController.getGuestOwnerById);

router.put("/guesthouses/:id/approve", auth(["admin"]), adminController.approveGuesthouseRegistration);
router.put("/guesthouses/:id/reject", auth(["admin"]), adminController.rejectGuesthouseRegistration);
router.put("/guesthouses/:id/active", auth(["admin"]), adminController.activeInactiveGuesthouse);


router.post("/rooms", auth(["admin"]), adminController.getAllRooms);
router.post("/rooms/:id", auth(["admin"]), adminController.getRoomById);
router.put("/rooms/:id", upload.array("photos", 10), auth(["admin"]), adminController.editRoom);
router.delete("/rooms/:id", auth(["admin"]), adminController.deleteRoom);


router.post("/customers", auth(["admin"]), adminController.getAllCustomer);
router.post("/customers/:id", auth(["admin"]), adminController.getCustomerById);
router.put("/customers/:id/active", auth(["admin"]), adminController.suspendedApproveCustomer);
router.put("/customers/:id", upload.single('profileImage'), auth(["admin"]), adminController.updateCustomer);
router.delete("/customers/:id", auth(["admin"]), adminController.deleteCustomer);


router.post("/bookings", auth(["admin"]), adminController.getAllBooking);
router.post("/bookings/past", auth(["admin"]), adminController.pastBooking);
router.post("/bookings/upcoming", auth(["admin"]), adminController.upcomingBookings);
router.post("/bookings/cancel", auth(["admin"]), adminController.getCancelBookings);
router.post("/bookings/:id", auth(["admin"]), adminController.getBookingById);


router.post("/promos", auth(["admin"]), adminController.getAllPromo);
router.post("/promos", auth(["admin"]), adminController.createPromo);
router.post("/promos/:id", auth(["admin"]), adminController.getPromoById);
router.put("/promos/:id", auth(["admin"]), adminController.updatePromo);
router.delete("/promos/:id", auth(["admin"]), adminController.deletePromo);


router.post("/notifications", auth(["admin"]), adminController.getAllNotification);
router.put("/notifications/:notificationId/read", auth(["admin"]), adminController.readNotification);
router.delete("/notifications/:notificationId/delete", auth(["admin"]), adminController.deleteNotification);


router.post("/addBedroomNames", auth(["admin"]), adminController.addBedroomNames);
router.post("/setMaxPrice", auth(["admin"]), adminController.setMaxPrice);
router.post("/customer/facilities/add", auth(["admin"]), adminController.createFacility);
router.post("/atolls/add", auth(["admin"]), adminController.createAtoll);
router.post("/islands/add", auth(["admin"]), adminController.createIslands);

module.exports = router;
