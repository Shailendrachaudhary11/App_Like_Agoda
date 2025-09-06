const Promo = require("../models/Promo");

//  Admin create promo
exports.addPromoCode = async (req, res) => {
    try {
        const { code, discountType, discountValue, startDate, endDate, maxUsage } = req.body;

        const existing = await Promo.findOne({ code });
        if (existing) {
            return res.status(400).json({ success: false, message: "Promo code already exists" });
        }

        const promo = new Promo({
            code,
            discountType,
            discountValue,
            startDate,
            endDate,
            maxUsage
        });

        await promo.save();

        res.status(201).json({ success: true, message: "Promo code created successfully", data: promo });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

// Admin update promo code
exports.updatePromo = async (req, res) => {
    try {
        const { id } = req.params;
        const { discountType, discountValue, startDate, endDate , maxUsage, isActive} = req.body;

        const promo = await Promo.findById(id);

        if (!promo) {
            return res.status(404).json({
                success: false,
                message: "Promo code not found."
            });
        }

        if (discountType !== undefined) promo.discountType = discountType;
        if (discountValue !== undefined) promo.discountValue = discountValue;
        if (startDate !== undefined) promo.startDate = startDate;
        if (endDate !== undefined) promo.endDate = endDate;
        if (maxUsage !== undefined) promo.maxUsage = maxUsage;
        if (isActive !== undefined) promo.isActive = isActive;

        await promo.save();

        return res.status(200).json({
            success: true,
            message: "Promo code updated successfully.",
            data: promo
        });

    } catch (err) {
        console.error(" Error updating promo code:", err);
        return res.status(500).json({
            success: false,
            message: "Server error while updating promo code."
        });
    }
};

// Admin delete promo code
exports.deletepromo = async (req, res) => {
    try {
        const { id } = req.params;
        const promo = await Promo.findById(id);
        if (!promo) {
            return res.status(404).json({
                success: false,
                message: "Promo code not found."
            });
        }

        await promo.deleteOne();
        return res.status(200).json({
            success: true,
            message: "Promo code delete successfully.",
            data: promo
        });
    } catch (err) {
        console.error(" Error updating promo code:", err);
        return res.status(500).json({
            success: false,
            message: "Server error while deleting promo code."
        });
    }
}

// Admin Get All Promo
exports.getAllPromo = async (req,res) =>{
    try{
        const promos = await Promo.find();

        res.status(200).json({
            success: true,
            message:"Successfully fetch all promos.",
            data: promos
        })
    } catch(err){
        console.err(err);
        res.status(500).json({
            success: false,
            message: "Error while fetching all promos"
        })
    }
}


//  Customer get active promos
exports.getActivePromos = async (req, res) => {
    try {
        const today = new Date();
        const promos = await Promo.find({
            startDate: { $lte: today },
            endDate: { $gte: today },
            isActive: true
        });

        res.status(200).json({
            success: true,
            NoOfPromos: promos.length,
            data: promos
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};
