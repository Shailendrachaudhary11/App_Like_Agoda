### 🍽️ APP LIKE AGODA 
<!-- //  Search for nearby guesthouses based on coordinates and distance
exports.searchNearbyRooms = async (req, res) => {
    try {
        const { lng, lat, distance } = req.query;

        // Validate query parameters
        if (!lng || !lat || !distance) {
            return res.status(400).json({
                success: false,
                message: "Please provide lng, lat, and distance"
            });
        }

        // Find guesthouses near the provided location
        const guestHouses = await Guesthouse.find({
            location: {
                $near: {
                    $geometry: { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] },
                    $maxDistance: parseInt(distance)
                }
            }
        });

        return res.status(200).json({
            success: true,
            totalGuestHouses: guestHouses.length,
            data: guestHouses
        });
    } catch (err) {
        console.error("Error searching nearby rooms:", err);
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
}; -->

<!-- // GET ALL GUESTHOUSES 
exports.getAllGuestHouses = async (req, res) => {
    try {
        const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;

        // .lean() use करने से plain JS objects मिलते हैं, no _doc
        const guesthouses = await Guesthouse.find().lean();

        // सिर्फ images को update करना
        guesthouses.forEach(gh => {
            if (gh.guestHouseImage && gh.guestHouseImage.length > 0) {
                gh.guestHouseImage = gh.guestHouseImage.map(img => `${BASE_URL}/uploads/guesthouseImage/${img}`);
            } else {
                gh.guestHouseImage = [];
            }
        });

        res.status(200).json({
            success: true,
            message: "Successfully fetched all guesthouses.",
            data: guesthouses
        });
    } catch (error) {
        console.error("Error fetching guesthouses:", error.message);
        res.status(500).json({
            success: false,
            message: "Error fetching all guesthouses."
        });
    }
};


// get getGuestHouseById
exports.getGuestHouseById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(404).json({
                success: false,
                message: "No guestHouse Id provided."
            });
        }

        const guesthouse = await Guesthouse.findOne({ _id: id, status: "active" });

        if (!guesthouse) {
            return res.status(404).json({
                success: false,
                message: "Guesthouse not found or inactive."
            });
        }

        const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
        // Images URL fix
        if (guesthouse.guestHouseImage && guesthouse.guestHouseImage.length > 0) {
            guesthouse.guestHouseImage = guesthouse.guestHouseImage.map(
                img => `${BASE_URL}/uploads/guesthouseImage/${img}`
            );
        } else {
            guesthouse.guestHouseImage = [];
        }

        return res.status(200).json({
            success: true,
            message: "Successfully fetched guesthouse.",
            data: guesthouse
        });

    } catch (error) {
        console.error("[GUESTHOUSE] Error fetching guesthouse:", error.message);
        return res.status(500).json({
            success: false,
            message: "Error fetching guesthouse.",
            error: error.message
        });
    }
};


//  Search for nearby guesthouses based on coordinates and distance
exports.searchNearbyRooms = async (req, res) => {
    try {
        const { lng, lat, distance } = req.query;

        // Validate query parameters
        if (!lng || !lat || !distance) {
            return res.status(400).json({
                success: false,
                message: "Please provide lng, lat, and distance"
            });
        }

        // Find guesthouses near the provided location
        const guestHouses = await Guesthouse.find({
            location: {
                $near: {
                    $geometry: { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] },
                    $maxDistance: parseInt(distance)
                }
            }
        });

        return res.status(200).json({
            success: true,
            totalGuestHouses: guestHouses.length,
            data: guestHouses
        });
    } catch (err) {
        console.error("Error searching nearby rooms:", err);
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
}; -->
