const express = require('express');
const mongoose = require('mongoose');
const app = express();
app.use(express.json());

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

// NEW ENDPOINT A: Fetch ONLY pending devices for your admin panel
app.get('/api/admin/pending', async (req, res) => {
    try {
        // Returns only documents where isApproved is false
        const pendingDevices = await Device.find({ isApproved: false }).sort({ createdAt: -1 });
        res.json(pendingDevices);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve pending devices' });
    }
});

// UPDATED ENDPOINT B: Action Endpoint (Handles both Approve & Reject)
app.post('/api/admin/approve', async (req, res) => {
    const { deviceId, action } = req.body; // 'action' can be "APPROVE" or "REJECT"
    
    if (!deviceId || !action) {
        return res.status(400).json({ error: 'Missing deviceId or action parameter' });
    }

    try {
        if (action === "APPROVE") {
            const device = await Device.findOneAndUpdate({ deviceId }, { isApproved: true }, { new: true });
            if (!device) return res.status(404).json({ error: 'Device not found' });
            return res.json({ status: "SUCCESS", message: "Device successfully approved." });
        } 
        
        else if (action === "REJECT") {
            // Rejection deletes the token so it removes them from the pending listing entirely
            const device = await Device.findOneAndDelete({ deviceId });
            if (!device) return res.status(404).json({ error: 'Device not found' });
            return res.json({ status: "SUCCESS", message: "Device rejected and removed from list." });
        } 
        
        else {
            return res.status(400).json({ error: 'Invalid action. Use APPROVE or REJECT.' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/admin/devices', async (req, res) => {
    try {
        const devices = await Device.find().sort({ createdAt: -1 });
        res.json(devices);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve devices' });
    }
});

app.get('/', (req, res) => {
    res.send('Device Activation Server is online and connected to lungi database!');
});

app.listen(process.env.PORT || 3000, () => console.log('Server running'));
