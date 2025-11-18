const express = require("express");
const router = express.Router();
const adminController = require("../controller/adminController");
const { registerValidation } = require("../validators/userValidator");
const validateRequest = require("../middlewares/validateRequest");
const auth = require('../middlewares/authMiddleware');
const upload = require("../middlewares/upload");
const verifyToken = require("../middlewares/verifyTokenPassword");


router.post("/register", upload.single("adminImage"), registerValidation, validateRequest, adminController.register);
router.post("/addUser", auth(["admin"]), upload.single("adminImage"), adminController.addUser);

router.post("/login", adminController.login);
router.post("/profile-view", auth(["admin", "Supervisor", "Manager"]), adminController.getProfile);
router.post("/profile-update", auth(["admin", "Supervisor", "Manager"]), upload.single("adminImage"), adminController.updateProfile);
router.post("/change-password", auth(["admin", "Supervisor", "Manager"]), adminController.changePassword);
router.post("/forgot-password", adminController.forgotPassword);
router.post("/verify-otp", verifyToken, adminController.verifyOtp);
router.post("/reset-password", verifyToken, adminController.resetPassword);

// __________________Dashboard __________________

router.post("/dashboard", auth(["admin", "Supervisor", "Manager"]), adminController.getDashboardData);
router.post("/report", auth(["admin", "Supervisor", "Manager"]), adminController.getMonthlyReports);

//__________________MANAGE SUPERVISOR OR MANAGER_________________________

router.post("/users/list", auth(["admin"]), adminController.getAllSupervisorsMananger);
router.post("/users/update", upload.single("adminImage"), auth(["admin"]), adminController.updateUserByRole);
router.post("/users/delete", auth(["admin"]), adminController.deleteUserByRole);
router.post("/users/view", auth(["admin"]), adminController.getUserByRoleAndId);
router.post("/users/status", auth(["admin"]), adminController.activeInactiveUserByRole);


//__________________GUESTHOUSES__________________

router.post("/guesthouses/list", auth(["admin", "Supervisor", "Manager"]), adminController.getAllGuestHouses);
router.post("/guesthouses/view", auth(["admin", "Supervisor", "Manager"]), adminController.getGuestHousesById);

// router.post("/guesthouses/update", auth(["admin"]), upload.array("guestHouseImage", 5), adminController.updateGuestHouse);
// router.post("/guesthouse/pending", auth(["admin"]), adminController.getPendingRegistration);
// router.post("/guesthouses/approve", auth(["admin"]), adminController.approveGuesthouseRegistration);
// router.post("/guesthouses/reject", auth(["admin"]), adminController.rejectGuesthouseRegistration);

router.post("/guesthouses/status", auth(["admin", "Manager"]), adminController.activeInactiveGuesthouse);
router.post("/guesthouses/delete", auth(["admin", "Manager"]), adminController.deleteGuesthouse);


//__________________GUESTHOUSE OWNERS__________________

router.post("/guesthouse/owners/list", auth(["admin", "Supervisor", "Manager"]), adminController.getAllGuestOwner);
router.post("/guesthouse/owners/view", auth(["admin", "Supervisor", "Manager"]), adminController.getGuestOwnerById);

router.post("/guesthouse/owners/update", auth(["admin"]), upload.single("profileImage"), adminController.updatedGuestOwner);
router.post("/guesthouse/owners/status", auth(["admin", "Manager"]), adminController.activeInactiveOwner);
router.post("/guesthouse/owners/delete", auth(["admin", "Manager"]), adminController.deleteOwner);


//__________________ROOMS__________________

router.post("/rooms/list", auth(["admin", "Supervisor", "Manager"]), adminController.getAllRooms);
router.post("/rooms/view", auth(["admin", "Supervisor", "Manager"]), adminController.getRoomById);

router.post("/rooms/status", auth(["admin", "Manager"]), adminController.activeInactive);
router.post("/rooms/delete", auth(["admin", "Manager"]), adminController.deleteRoom);


//__________________CUSTOMERS__________________

router.post("/customers/list", auth(["admin", "Supervisor", "Manager"]), adminController.getAllCustomer);
router.post("/customers/view", auth(["admin", "Supervisor", "Manager"]), adminController.getCustomerById);

router.post("/customers/status", auth(["admin", "Manager"]), adminController.activeInactiveCustomer);
router.post("/customers/update", auth(["admin", "Manager"]), upload.single("profileImage"), adminController.updateCustomer);
router.post("/customers/delete", auth(["admin", "Manager"]), adminController.deleteCustomer);


// __________________BOOKINGS __________________

router.post("/bookings/list", auth(["admin", "Supervisor", "Manager"]), adminController.getAllBooking);
router.post("/bookings/list/past", auth(["admin", "Supervisor", "Manager"]), adminController.pastBooking);
router.post("/bookings/list/upcoming", auth(["admin", "Supervisor", "Manager"]), adminController.upcomingBookings);
router.post("/bookings/list/cancelled", auth(["admin", "Supervisor", "Manager"]), adminController.getCancelBookings);

router.post("/bookings/view", auth(["admin", "Supervisor", "Manager"]), adminController.getBookingById);
router.post("/bookings/list/pending", auth(["admin", "Supervisor", "Manager"]), adminController.pendingBooking);

router.post("/bookings/delete", auth(["admin", "Manager"]), adminController.deleteBooking);


// _________________PROMOS__________________

router.post("/promos/list", auth(["admin", "Supervisor", "Manager"]), adminController.getAllPromo);
router.post("/promos/create", auth(["admin", "Manager"]), upload.single("promoImage"), adminController.createPromo);
router.post("/promos/view", auth(["admin", "Supervisor", "Manager"]), adminController.getPromoById);
router.post("/promos/update", auth(["admin", "Manager"]), upload.single("promoImage"), adminController.updatePromo);
router.post("/promos/delete", auth(["admin", "Manager"]), adminController.deletePromo);
router.post("/promos/status", auth(["admin", "Manager"]), adminController.activeInActivePromo);


// ===== NOTIFICATIONS =====
// router.post("/notifications/list", auth(["admin", "Supervisor","Manager"]), adminController.getAllNotification);
// router.post("/notifications/read", auth(["admin"]), adminController.readNotification);
// router.post("/notifications/delete", auth(["admin"]), adminController.deleteNotification);
// router.post("/notifications/delete-all", auth(["admin"]), adminController.deleteAllNotification);

// ===== SETTINGS / CONFIG =====

router.post("/atolls", auth(["admin", "Supervisor", "Manager"]), adminController.getAllAtolls);
router.post("/atolls/add", auth(["admin", "Manager"]), upload.single("atollImage"), adminController.createAtoll);
router.post("/atolls/update", auth(["admin", "Manager"]), upload.single("atollImage"), adminController.editAtoll);
router.post("/atolls/status", auth(["admin", "Manager"]), adminController.activeInActiveAtoll);
router.post("/atolls/delete", auth(["admin", "Manager"]), adminController.deleteAtoll);

router.post("/atolls/islands", auth(["admin", "Supervisor", "Manager"]), adminController.getAllIslands);
router.post("/atolls/islands/add", auth(["admin", "Manager"]), adminController.createIslands);
router.post("/atolls/islands/status", auth(["admin", "Manager"]), adminController.activeInActiveIsland);
router.post("/atolls/islands/update", auth(["admin", "Manager"]), adminController.editIsland);
router.post("/atolls/islands/delete", auth(["admin", "Manager"]), adminController.deleteIsland);

router.post("/facilities/list", auth(["admin", "Supervisor"]), adminController.getAllfacilities);
router.post("/facilities/add", auth(["admin", "Manager"]), adminController.createFacility);
router.post("/facilities/update", auth(["admin", "Manager"]), adminController.updateFacility);
router.post("/facilities/status", auth(["admin", "Manager"]), adminController.activeInactiveFacility);
router.post("/facilities/delete", auth(["admin", "Manager"]), adminController.deleteFacility);


router.post("/roomCategory/list", auth(["admin", "Supervisor", "Manager"]), adminController.getAllRoomCategories);
router.post("/roomCategory/add", auth(["admin", "Manager"]), adminController.createRoomCategory);
router.post("/roomCategory/edit", auth(["admin", "Manager"]), adminController.updateRoomCategory);
router.post("/roomCategory/status", auth(["admin", "Manager"]), adminController.changeRoomCategoryStatus);
router.post("/roomCategory/delete", auth(["admin", "Manager"]), adminController.deleteRoomCategory);

router.post('/bedType/add', auth(["admin", "Manager"]), adminController.addBedType);
router.post('/bedType/list', auth(["admin", "Supervisor", "Manager"]), adminController.getAllBedTypes);
router.post('/bedType/edit', auth(["admin", "Manager"]), adminController.editBedType);
router.post('/bedType/status', auth(["admin", "Manager"]), adminController.changeStatusBedType);
router.post('/bedType/delete', auth(["admin", "Manager"]), adminController.deleteBedType);

// _____________ MANAGE PAYMENT

router.post("/payments", auth(["admin", "Supervisor", "Manager"]), adminController.getAllPayments);
router.post("/payments/delete", auth(["admin"]), adminController.deletePayment);
router.post("/payments/details", auth(["admin", "Supervisor", "Manager"]), adminController.getPaymentDetails);

//________________ MANAGE PAYOUTS

router.post("/payOuts", auth(["admin", "Supervisor", "Manager"]), adminController.getPayouts);
router.post("/payOuts/status", auth(["admin"]), adminController.changeStatusPayout);

//_______________ MANAGE REPORT

router.post("/reports", auth(["admin", "Supervisor", "Manager"]), adminController.getReports);
router.post("/reports/delete", auth(["admin"]), adminController.deleteReport);
router.post("/reports/status", auth(["admin"]), adminController.changeStatusReport);
router.post("/reports/view", auth(["admin", "Supervisor", "Manager"]), adminController.viewReport);


module.exports = router;
