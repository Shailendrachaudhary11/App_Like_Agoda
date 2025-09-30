const mongoose = require('mongoose');

const bedroomSchema = new mongoose.Schema({
    names: {
        type: [String],
        default: []
    },
    maxPrice: { type: String, require: false }
});

const Bedroom = mongoose.model('Bedroom', bedroomSchema);

module.exports = Bedroom;
