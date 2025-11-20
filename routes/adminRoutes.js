const express = require("express");
const router = express.Router();
const adminController = require("../controller/adminController");
const { registerValidation } = require("../validators/userValidator");
const validateRequest = require("../middlewares/validateRequest");
const auth = require('../middlewares/authMiddleware');
const upload = require("../middlewares/upload");
const verifyToken = require("../middlewares/verifyTokenPassword");


router.post("/register", upload.single("adminImage"), registerValidation, validateRequest, adminController.register);
router.post("/addUser", auth(["admin",]), upload.single("adminImage"), adminController.addUser);

router.post("/permissions", auth(["admin", "Manager", "Supervisor"]), adminController.getAllPermissions);

router.post("/login", adminController.login);
router.post("/profile-view", auth(["admin", "Manager", "Supervisor"]), adminController.getProfile);
router.post("/profile-update", auth(["admin", "Manager", "Supervisor"]), upload.single("adminImage"), adminController.updateProfile);
router.post("/change-password", auth(["admin", "Manager", "Supervisor"]), adminController.changePassword);
router.post("/forgot-password", adminController.forgotPassword);
router.post("/verify-otp", verifyToken, adminController.verifyOtp);
router.post("/reset-password", verifyToken, adminController.resetPassword);

// __________________Dashboard __________________

router.post("/dashboard", auth(["admin", "Manager", "Supervisor"]), adminController.getDashboardData);
router.post("/report", auth(["admin", "Manager", "Supervisor"]), adminController.getMonthlyReports);

//__________________MANAGE SUPERVISOR OR MANAGER_________________________

router.post("/users/list", auth(["admin", "Manager", "Supervisor"]), adminController.getAllSupervisorsMananger);
router.post("/users/update", upload.single("adminImage"), auth(["admin", "Manager", "Supervisor"]), adminController.updateUserByRole);
router.post("/users/delete", auth(["admin", "Manager", "Supervisor"]), adminController.deleteUserByRole);
router.post("/users/view", auth(["admin", "Manager", "Supervisor"]), adminController.getUserByRoleAndId);
router.post("/users/status", auth(["admin", "Manager", "Supervisor"]), adminController.activeInactiveUserByRole);


//__________________GUESTHOUSES__________________

router.post("/guesthouses/list", auth(["admin", "Manager", "Supervisor"]), adminController.getAllGuestHouses);
router.post("/guesthouses/view", auth(["admin", "Manager", "Supervisor"]), adminController.getGuestHousesById);

// router.post("/guesthouses/update",auth(["admin","Manager","Supervisor"]), upload.array("guestHouseImage", 5), adminController.updateGuestHouse);
// router.post("/guesthouse/pending",auth(["admin","Manager","Supervisor"]), adminController.getPendingRegistration);
// router.post("/guesthouses/approve",auth(["admin","Manager","Supervisor"]), adminController.approveGuesthouseRegistration);
// router.post("/guesthouses/reject",auth(["admin","Manager","Supervisor"]), adminController.rejectGuesthouseRegistration);

router.post("/guesthouses/status", auth(["admin", "Manager", "Supervisor"]), adminController.activeInactiveGuesthouse);
router.post("/guesthouses/delete", auth(["admin", "Manager", "Supervisor"]), adminController.deleteGuesthouse);


//__________________GUESTHOUSE OWNERS__________________

router.post("/guesthouse/owners/list", auth(["admin", "Manager", "Supervisor"]), adminController.getAllGuestOwner);
router.post("/guesthouse/owners/view", auth(["admin", "Manager", "Supervisor"]), adminController.getGuestOwnerById);

router.post("/guesthouse/owners/update", auth(["admin", "Manager", "Supervisor"]), upload.single("profileImage"), adminController.updatedGuestOwner);
router.post("/guesthouse/owners/status", auth(["admin", "Manager", "Supervisor"]), adminController.activeInactiveOwner);
router.post("/guesthouse/owners/delete", auth(["admin", "Manager", "Supervisor"]), adminController.deleteOwner);


//__________________ROOMS__________________

router.post("/rooms/list", auth(["admin", "Manager", "Supervisor"]), adminController.getAllRooms);
router.post("/rooms/view", auth(["admin", "Manager", "Supervisor"]), adminController.getRoomById);

router.post("/rooms/status", auth(["admin", "Manager", "Supervisor"]), adminController.activeInactive);
router.post("/rooms/delete", auth(["admin", "Manager", "Supervisor"]), adminController.deleteRoom);


//__________________CUSTOMERS__________________

router.post("/customers/list", auth(["admin", "Manager", "Supervisor"]), adminController.getAllCustomer);
router.post("/customers/view", auth(["admin", "Manager", "Supervisor"]), adminController.getCustomerById);

router.post("/customers/status", auth(["admin", "Manager", "Supervisor"]), adminController.activeInactiveCustomer);
router.post("/customers/update", auth(["admin", "Manager", "Supervisor"]), upload.single("profileImage"), adminController.updateCustomer);
router.post("/customers/delete", auth(["admin", "Manager", "Supervisor"]), adminController.deleteCustomer);


// __________________BOOKINGS __________________

router.post("/bookings/list", auth(["admin", "Manager", "Supervisor"]), adminController.getAllBooking);
router.post("/bookings/list/past", auth(["admin", "Manager", "Supervisor"]), adminController.pastBooking);
router.post("/bookings/list/upcoming", auth(["admin", "Manager", "Supervisor"]), adminController.upcomingBookings);
router.post("/bookings/list/cancelled", auth(["admin", "Manager", "Supervisor"]), adminController.getCancelBookings);

router.post("/bookings/view", auth(["admin", "Manager", "Supervisor"]), adminController.getBookingById);
router.post("/bookings/list/pending", auth(["admin", "Manager", "Supervisor"]), adminController.pendingBooking);

router.post("/bookings/delete", auth(["admin", "Manager", "Supervisor"]), adminController.deleteBooking);


// _________________PROMOS__________________

router.post("/promos/list", auth(["admin", "Manager", "Supervisor"]), adminController.getAllPromo);
router.post("/promos/create", auth(["admin", "Manager", "Supervisor"]), upload.single("promoImage"), adminController.createPromo);
router.post("/promos/view", auth(["admin", "Manager", "Supervisor"]), adminController.getPromoById);
router.post("/promos/update", auth(["admin", "Manager", "Supervisor"]), upload.single("promoImage"), adminController.updatePromo);
router.post("/promos/delete", auth(["admin", "Manager", "Supervisor"]), adminController.deletePromo);
router.post("/promos/status", auth(["admin", "Manager", "Supervisor"]), adminController.activeInActivePromo);


//__________________ NOTIFICATIONS___________________
router.post("/notifications/list", auth(["admin", "Supervisor", "Manager"]), adminController.getAllNotification);
router.post("/notifications/read", auth(["admin", "Manager", "Supervisor"]), adminController.readNotification);
router.post("/notifications/delete", auth(["admin", "Manager", "Supervisor"]), adminController.deleteNotification);
router.post("/notifications/delete-all", auth(["admin", "Manager", "Supervisor"]), adminController.deleteAllNotification);

//___________________________ SETTINGS / CONFIG______________________

router.post("/atolls", auth(["admin", "Manager", "Supervisor"]), adminController.getAllAtolls);
router.post("/atolls/add", auth(["admin", "Manager", "Supervisor"]), upload.single("atollImage"), adminController.createAtoll);
router.post("/atolls/update", auth(["admin", "Manager", "Supervisor"]), upload.single("atollImage"), adminController.editAtoll);
router.post("/atolls/status", auth(["admin", "Manager", "Supervisor"]), adminController.activeInActiveAtoll);
router.post("/atolls/delete", auth(["admin", "Manager", "Supervisor"]), adminController.deleteAtoll);

router.post("/atolls/islands", auth(["admin", "Manager", "Supervisor"]), adminController.getAllIslands);
router.post("/atolls/islands/add", auth(["admin", "Manager", "Supervisor"]), adminController.createIslands);
router.post("/atolls/islands/status", auth(["admin", "Manager", "Supervisor"]), adminController.activeInActiveIsland);
router.post("/atolls/islands/update", auth(["admin", "Manager", "Supervisor"]), adminController.editIsland);
router.post("/atolls/islands/delete", auth(["admin", "Manager", "Supervisor"]), adminController.deleteIsland);

router.post("/facilities/list", auth(["admin", "Manager", "Supervisor"]), adminController.getAllfacilities);
router.post("/facilities/add", auth(["admin", "Manager", "Supervisor"]), adminController.createFacility);
router.post("/facilities/update", auth(["admin", "Manager", "Supervisor"]), adminController.updateFacility);
router.post("/facilities/status", auth(["admin", "Manager", "Supervisor"]), adminController.activeInactiveFacility);
router.post("/facilities/delete", auth(["admin", "Manager", "Supervisor"]), adminController.deleteFacility);


router.post("/roomCategory/list", auth(["admin", "Manager", "Supervisor"]), adminController.getAllRoomCategories);
router.post("/roomCategory/add", auth(["admin", "Manager", "Supervisor"]), adminController.createRoomCategory);
router.post("/roomCategory/edit", auth(["admin", "Manager", "Supervisor"]), adminController.updateRoomCategory);
router.post("/roomCategory/status", auth(["admin", "Manager", "Supervisor"]), adminController.changeRoomCategoryStatus);
router.post("/roomCategory/delete", auth(["admin", "Manager", "Supervisor"]), adminController.deleteRoomCategory);

router.post('/bedType/add', auth(["admin", "Manager", "Supervisor"]), adminController.addBedType);
router.post('/bedType/list', auth(["admin", "Manager", "Supervisor"]), adminController.getAllBedTypes);
router.post('/bedType/edit', auth(["admin", "Manager", "Supervisor"]), adminController.editBedType);
router.post('/bedType/status', auth(["admin", "Manager", "Supervisor"]), adminController.changeStatusBedType);
router.post('/bedType/delete', auth(["admin", "Manager", "Supervisor"]), adminController.deleteBedType);

// _____________ MANAGE PAYMENT

router.post("/payments", auth(["admin", "Manager", "Supervisor"]), adminController.getAllPayments);
router.post("/payments/delete", auth(["admin", "Manager", "Supervisor"]), adminController.deletePayment);
router.post("/payments/details", auth(["admin", "Manager", "Supervisor"]), adminController.getPaymentDetails);

//________________ MANAGE PAYOUTS

router.post("/payOuts", auth(["admin", "Manager", "Supervisor"]), adminController.getPayouts);
router.post("/payOuts/status", auth(["admin", "Manager", "Supervisor"]), adminController.changeStatusPayout);

//_______________ MANAGE REPORT

router.post("/reports", auth(["admin", "Manager", "Supervisor"]), adminController.getReports);
router.post("/reports/delete", auth(["admin", "Manager", "Supervisor"]), adminController.deleteReport);
router.post("/reports/status", auth(["admin", "Manager", "Supervisor"]), adminController.changeStatusReport);
router.post("/reports/view", auth(["admin", "Manager", "Supervisor"]), adminController.viewReport);

//____________________F and Q
router.post("/faq/add", auth(["admin"]), adminController.createFAQ);
router.post("/faq/list", auth(["admin"]), adminController.getAllFAQs);
router.post("/faq/status", auth(["admin"]), adminController.activeInActiveFandQ);
router.post("/faq/delete", auth(["admin"]), adminController.deleteFAQ);
router.post("/faq/update", auth(["admin"]), adminController.updateFAQ );


module.exports = router;
