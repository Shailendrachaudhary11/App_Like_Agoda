const express = require('express');
const router = express.Router();
const guesthouseController = require('../controller/guesthouseController');
const auth = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware')
const uploadRooms = require('../middlewares/uploadRooms');

// Only "guesthouse_admin" can add guesthouses
router.post("/add", auth(["guesthouse_admin"]), upload.array("images", 5), guesthouseController.addGuesthouse);

// Guesthouse admin can see his own hotels
router.get("/my-guesthouses", auth(["guesthouse_admin"]), guesthouseController.getMyGuesthouses);

//Guesthouse admin get your guesthouse by id
router.get("/:guestId", auth(["guesthouse_admin"]), guesthouseController.getGuestHouseById); 

// routes/guesthouseRoutes.js
router.put("/update/:id", auth(["guesthouse_admin"]), upload.array("images", 5), guesthouseController.updateGuesthouse);

//routes/delete guestHouse
router.delete("/delete/:id", auth(["guesthouse_admin"]), guesthouseController.deleteGuesthouse);


////////////////////////////====================ROOMS ===========================////////////////////////



// add rooms
router.post("/add/room", auth(["guesthouse_admin"]), uploadRooms.array("photos", 5), guesthouseController.addRoom);

// GET ALL ROOMS BY GUEST HOUSE ID BY GUEST HOUSE OWNER
router.get("/my-rooms/:guestHouseId",auth(["guesthouse_admin"]),guesthouseController.getAllRooms);

//update room details
router.put("/update/room/:guesthouseId/:roomId",auth(["guesthouse_admin"]), uploadRooms.array("photos", 5),guesthouseController.updateRoom);

// delete room 
router.delete("/delete/room/:guesthouseId/:roomId", auth(["guesthouse_admin"]),  guesthouseController.deleteRoom);


// ////////////////////////////====================  CUSTOMER  ===========================////////////////////////

// // guesthouse near by me
// router.get("/nearby",auth(["customer"]),guesthouseController.searchNearbyRooms);


module.exports = router;
