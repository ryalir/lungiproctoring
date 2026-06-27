const express = require('express');
const mongoose = require('mongoose');
const app = express();
app.use(express.json());

mongoose.connect(process.env.MONGO_URI);

// Added deviceModel and enabled automatic timestamps
const DeviceSchema = new mongoose.Schema({
    deviceId: { type: String, required: true, unique: true },
    deviceModel: { type: String, default: "Unknown Device" }, 
    isApproved: { type: Boolean, default: false }
}, { 
    timestamps: true // Automatically injects and updates 'createdAt' and 'updatedAt'
});

const Device = mongoose.model('Device', DeviceSchema);

// Updated Endpoint: Now parses and saves deviceModel
app.post('/api/activate', async (req, res) => {
    const { deviceId, deviceModel } = req.body;
    if (!deviceId) return res.status(400).json({ error: 'Device ID required' });

    try {
        let device = await Device.findOne({ deviceId });
        
        if (!device) {
            // Register new device with its hardware model details
            device = new Device({ deviceId, deviceModel });
            await device.save();
            return res.json({ status: "PENDING", message: "Device registered. Awaiting manual approval." });
        }

        if (device.isApproved) {
            return res.json({ status: "APPROVED", message: "Access granted." });
        } else {
            return res.json({ status: "PENDING", message: "Device is still awaiting approval." });
        }
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Admin approval route remains unchanged
app.post('/api/admin/approve', async (req, res) => {
    const { deviceId, approve } = req.body;
    try {
        const device = await Device.findOneAndUpdate({ deviceId }, { isApproved: approve }, { new: true });
        if (!device) return res.status(404).json({ error: 'Device not found' });
        res.json({ message: `Device approval status updated to: ${approve}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(process.env.PORT || 3000, () => console.log('Server running'));
