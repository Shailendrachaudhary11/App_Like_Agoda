const express = require('express');
const router = express.Router();
const guesthouseController = require('../controller/guesthouseController');
const auth = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware')
const uploadRooms = require('../middlewares/uploadRooms');
const uploadUser = require("../middlewares/uploadUser");


router.get("/viewProfile", auth(["guesthouse_admin"]), guesthouseController.getMyProfile);
router.put("/updateProfile", auth(["guesthouse_admin"]), uploadUser.single('profileImage'), guesthouseController.updateProfile);
router.post("/change-password", auth(["guesthouse_admin"]), guesthouseController.changePassword);
router.post('/forgot-password', auth(["guesthouse_admin"]),guesthouseController.forgotPassword);
router.post("/reset-password", auth(["guesthouse_admin"]), guesthouseController.resetPassword);

// Only "guesthouse_admin" can add guesthouses
// GUESTHOUSE
router.post("/add", auth(["guesthouse_admin"]), upload.array("images", 5), guesthouseController.addGuesthouse);
router.get("/my-guesthouses", auth(["guesthouse_admin"]), guesthouseController.getMyGuesthouses);
router.put("/update/:id", auth(["guesthouse_admin"]), upload.array("images", 5), guesthouseController.updateGuesthouse);
router.delete("/delete/:id", auth(["guesthouse_admin"]), guesthouseController.deleteGuesthouse);
router.get("/:guestId", auth(["guesthouse_admin"]), guesthouseController.getGuestHouseById); // <-- Last

// ROOMS
router.post("/add/room", auth(["guesthouse_admin"]), uploadRooms.array("photos", 5), guesthouseController.addRoom);
router.get("/my-rooms/:guestHouseId", auth(["guesthouse_admin"]), guesthouseController.getAllRooms);
router.put("/update/room/:guesthouseId/:roomId", auth(["guesthouse_admin"]), uploadRooms.array("photos", 5), guesthouseController.updateRoom);
router.delete("/delete/room/:guesthouseId/:roomId", auth(["guesthouse_admin"]), guesthouseController.deleteRoom);

// PROMO CODES
router.post("/add-promo", auth(["guesthouse_admin"]), guesthouseController.addPromo);
router.get("/my-promos", auth(["guesthouse_admin"]), guesthouseController.getOwnerPromos);
router.put("/updatePromo/:promoId", auth(["guesthouse_admin"]), guesthouseController.updatePromo);
router.delete("/deletePromo/:promoId", auth(["guesthouse_admin"]), guesthouseController.deletePromo);



module.exports = router;
