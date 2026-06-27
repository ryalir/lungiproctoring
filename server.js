const express = require('express');
const mongoose = require('mongoose');
const app = express();
app.use(express.json());

// 1. Force connection to 'lungi' database programmatically
mongoose.connect(process.env.MONGO_URI, {
    dbName: 'lungi'
})
.then(() => console.log('Successfully connected to the "lungi" database in MongoDB.'))
.catch(err => console.error('MongoDB connection error:', err));

const DeviceSchema = new mongoose.Schema({
    deviceId: { type: String, required: true, unique: true },
    deviceModel: { type: String, default: "Unknown Device" }, 
    isApproved: { type: Boolean, default: false }
}, { 
    timestamps: true 
});

const Device = mongoose.model('Device', DeviceSchema);

// Endpoint 1: App checks or registers device
app.post('/api/activate', async (req, res) => {
    const { deviceId, deviceModel } = req.body;
    if (!deviceId) return res.status(400).json({ error: 'Device ID required' });

    try {
        let device = await Device.findOne({ deviceId });
        
        if (!device) {
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

// Endpoint 2: Your private endpoint to manually approve a device
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

// Endpoint 3: Fetch all registered devices sorted by newest first
app.get('/api/admin/devices', async (req, res) => {
    try {
        const devices = await Device.find().sort({ createdAt: -1 });
        res.json(devices);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve devices from database' });
    }
});

// Friendly root URL message
app.get('/', (req, res) => {
    res.send('Device Activation Server is online and connected to lungi database!');
});

app.listen(process.env.PORT || 3000, () => console.log('Server running'));
