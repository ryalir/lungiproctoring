const express = require('express');
const mongoose = require('mongoose');
const app = express();
app.use(express.json());

// 1. Force explicit connection to the "lungi" database
mongoose.connect(process.env.MONGO_URI, {
    dbName: 'lungi'
})
.then(() => console.log('Successfully connected to the "lungi" database in MongoDB.'))
.catch(err => console.error('MongoDB connection error:', err));

// 2. Setup Device Schema with Model Tracking and Automatic Audit Timestamps
const DeviceSchema = new mongoose.Schema({
    deviceId: { type: String, required: true, unique: true },
    deviceModel: { type: String, default: "Unknown Device" }, 
    isApproved: { type: Boolean, default: false }
}, { 
    timestamps: true // Automatically generates and manages createdAt and updatedAt fields
});

const Device = mongoose.model('Device', DeviceSchema);

// Endpoint 1: App Registration (Used by the Android client to verify access)
app.post('/api/activate', async (req, res) => {
    const { deviceId, deviceModel } = req.body;
    if (!deviceId) return res.status(400).json({ error: 'Device ID required' });

    try {
        let device = await Device.findOne({ deviceId });
        
        if (!device) {
            // First time seeing this phone; register it with details as pending
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

// Endpoint 2: Fetch all general devices (Sorted by newest additions first)
app.get('/api/admin/devices', async (req, res) => {
    try {
        const devices = await Device.find().sort({ createdAt: -1 });
        
        // Map the results to return a friendly, readable date format
        const formattedDevices = devices.map(device => ({
            _id: device._id,
            deviceId: device.deviceId,
            deviceModel: device.deviceModel,
            isApproved: device.isApproved,
            // Formats to: "June 27, 2026" or your local equivalent
            dateCreated: new Date(device.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            })
        }));

        res.json(formattedDevices);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve devices' });
    }
});



// Endpoint 3: Fetch ONLY pending devices (Returns deviceId and deviceModel)
app.get('/api/admin/pending', async (req, res) => {
    try {
        // Find documents where isApproved is false
        // select() keeps only deviceId and deviceModel, explicitly hiding internal fields
        const pendingDevices = await Device.find({ isApproved: false })
                                             .select('deviceId deviceModel createdAt')
                                             .sort({ createdAt: -1 });
        res.json(pendingDevices);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve pending devices' });
    }
});


// ==========================================
// TWO DISTINCT ENDPOINTS FOR YOUR BUTTONS
// ==========================================

// Endpoint 4: LINKED TO APPROVE BUTTON
app.post('/api/admin/device/approve', async (req, res) => {
    const { deviceId } = req.body;
    if (!deviceId) return res.status(400).json({ error: 'Missing deviceId parameter' });

    try {
        const device = await Device.findOneAndUpdate({ deviceId }, { isApproved: true }, { new: true });
        if (!device) return res.status(404).json({ error: 'Device not found' });
        return res.json({ status: "SUCCESS", message: "Device successfully approved." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Endpoint 5: LINKED TO REJECT BUTTON
app.post('/api/admin/device/reject', async (req, res) => {
    const { deviceId } = req.body;
    if (!deviceId) return res.status(400).json({ error: 'Missing deviceId parameter' });

    try {
        // Drops the unapproved registration out of the system entirely
        const device = await Device.findOneAndDelete({ deviceId });
        if (!device) return res.status(404).json({ error: 'Device not found' });
        return res.json({ status: "SUCCESS", message: "Device rejected and removed." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Base Route Verification
app.get('/', (req, res) => {
    res.send('Device Activation Server is online and connected to lungi database!');
});

app.listen(process.env.PORT || 3000, () => console.log('Server running'));
