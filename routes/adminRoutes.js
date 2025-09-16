const express = require("express");
const router = express.Router();
const adminController = require("../controller/adminController");
const { registerValidation } = require("../validators/userValidator");
const validateRequest = require("../middlewares/validateRequest");
const auth = require('../middlewares/authMiddleware');
const upload = require("../middlewares/upload");

// register route
router.post("/register", upload.single('adminImage'), registerValidation, validateRequest, adminController.register);

// login
router.post('/login', adminController.login);

// Guesthouse Management
router.get("/guesthouses", auth(["admin"]), adminController.getAllGuestHouses);
router.get("/guesthouses/:id", auth(["admin"]), adminController.getGuestHousesById);
router.put("/guesthouses/:id/approve", auth(["admin"]), adminController.approveGuesthouse);
router.delete("/guesthouses/:id/reject", auth(["admin"]), adminController.rejectGuesthouse);
router.put("/guesthouses/:id", upload.array("guestHouseImage", 5), auth(["admin"]), adminController.updateGuestHouse);
router.put("/guesthouses/:id/suspend", auth(["admin"]), adminController.suspendedGuestHouse);
router.put("/guesthouses/:id/active", auth(["admin"]), adminController.activateGuesthouse);

// Room Management
router.get("/rooms", auth(["admin"]), adminController.getAllRooms);
router.get("/rooms/:id", auth(["admin"]), adminController.getRoomById);
router.put("/rooms/:id", upload.array("photos", 5), auth(["admin"]), adminController.editRoom);
router.delete("/rooms/:id", auth(["admin"]), adminController.deleteRoom);

// Customer Management
router.get("/customers", auth(["admin"]), adminController.getAllCustomer);
router.get("/customers/:id", auth(["admin"]), adminController.getCustomerById);
router.put("/customers/:id/approve", auth(["admin"]), adminController.approvalCustomer);
router.delete("/customers/:id/reject", auth(["admin"]), adminController.rejectCustomer);
router.put("/customers/:id/suspend", auth(["admin"]), adminController.suspendedCustomer);
router.put("/customers/:id/activate", auth(["admin"]), adminController.activateCustomer);

// Booking Management
router.get("/bookings", auth(["admin"]), adminController.getAllBooking);
router.get("/bookings/:id", auth(["admin"]), adminController.getBookingById );

// promos
router.get("/promos", auth(["admin"]), adminController.getAllPromo);
router.post("/promos", auth(["admin"]), adminController.createPromo);
router.get("/promos/:id", auth(["admin"]), adminController.getPromoById);
router.put("/promos/:id", auth(["admin"]), adminController.updatePromo);
router.delete("/promos/:id", auth(["admin"]), adminController.deletePromo);

module.exports = router;
