const express = require('express');
const mongoose = require('mongoose');
const app = express();
app.use(express.json());

// Connect to MongoDB using your Render Environment Variable
mongoose.connect(process.env.MONGO_URI);

const DeviceSchema = new mongoose.Schema({
    deviceId: { type: String, required: true, unique: true },
    isApproved: { type: Boolean, default: false }
});
const Device = mongoose.model('Device', DeviceSchema);

// Endpoint 1: App checks or registers device
app.post('/api/activate', async (req, res) => {
    const { deviceId } = req.body;
    if (!deviceId) return res.status(400).json({ error: 'Device ID required' });

    try {
        let device = await Device.findOne({ deviceId });
        
        if (!device) {
            // Register new device, defaults to unapproved (false)
            device = new Device({ deviceId });
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

// Endpoint 2: Your private endpoint to manually approve a device
// Secure this with an API key header in production
app.post('/api/admin/approve', async (req, res) => {
    const { deviceId, approve } = req.body; // approve is boolean
    try {
        const device = await Device.findOneAndUpdate({ deviceId }, { isApproved: approve }, { new: true });
        if (!device) return res.status(404).json({ error: 'Device not found' });
        res.json({ message: `Device approval status updated to: ${approve}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(process.env.PORT || 3000, () => console.log('Server running'));
