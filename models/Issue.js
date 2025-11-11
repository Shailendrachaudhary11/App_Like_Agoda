const mongoose = require("mongoose");

const issueSchema = new mongoose.Schema(
    {
        // Type of issue (dropdown se choose hota hai)
        issueType: {
            type: String,
            required: true,
        },

        ticketId: {
            type: String,
            required: true
        },

        // Issue description
        description: {
            type: String,
            required: true,
            trim: true,
        },

        // Uploaded photo (optional)
        issueImage: {
            type: String,
        },

        // Track issue status
        status: {
            type: String,
            enum: ["Pending", "In Progress", "Resolved", "Rejected"],
            default: "Pending",
        },

        customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        guesthouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Guesthouse', required: true },


    },
    { timestamps: true }
);

module.exports = mongoose.model("Issue", issueSchema);
