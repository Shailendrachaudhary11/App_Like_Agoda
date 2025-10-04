const mongoose = require('mongoose');

const bedroomSchema = new mongoose.Schema({
    name: { type: String, required: true }
});

const Bedroom = mongoose.model('Bedroom', bedroomSchema);

module.exports = Bedroom;
