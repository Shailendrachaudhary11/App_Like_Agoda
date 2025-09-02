const Guesthouse = require('../models/Guesthouse');

exports.addGuesthouse = async (req, res) => {
    try {
        const { name, address, city, state, location, contactNumber, description, images } = req.body;
        const guestHouse = await Guesthouse.findOne({ name });
        if (guestHouse) {
            return res.status(400).json({
                success: false,
                message: "guest name must be different"
            })
        }
        const guesthouse = new Guesthouse({
            owner: req.user._id,
            name,
            address,
            city,
            state,
            location,
            contactNumber,
            description,
            images
        });

        await guesthouse.save();
        res.status(201).json({ message: "Guesthouse added successfully. Wait for approval...", guesthouse });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.getMyGuesthouses = async (req, res) => {
    try {
        const guesthouses = await Guesthouse.find({
            owner: req.user._id,
            status: "approved" // ✅ only approved guesthouses
        });
        if (guesthouses.length == 0) {
            res.status(200).json({
                success: true,
                data: "There is no guest house or no approved guest House."
            });
        }
        res.status(200).json({
            success: true,
            data: guesthouses
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

