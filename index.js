const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const cors = require('cors');
const { ObjectId } = require('mongodb');
require('dotenv').config();
const authenticateToken = require('./middleware/auth');


// User and Meal models
const User = require('./models/User'); // Ensure this file exists with the correct schema
const Meal = require('./models/Meals'); // Create this schema for meals


const app = express();
// Increase payload size limit to handle large image uploads
app.use(express.json({ limit: '10mb' }));  // Adjust the limit as needed
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cors());
app.use(express.static('public'));


// เชื่อมต่อ MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB!'))
    .catch(err => console.error('MongoDB connection error:', err));


// Route สำหรับ API
app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        const newUser = new User({ username, password: hashedPassword });
        await newUser.save();
        res.status(201).json({ message: 'User registered successfully' });
    } catch (err) {
        res.status(400).json({ error: 'User already exists' });
    }
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username });

    if (!user) return res.status(404).json({ error: 'User not found' });

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(401).json({ error: 'Invalid password' });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
});

// **API Route to Get All Meals**
app.get('/api/meals', authenticateToken, async (req, res) => {
    try {
        const meals = await Meal.find({ userId: req.user.id });
        res.json(meals);
    } catch (error) {
        console.error('Error fetching meals:', error);
        res.status(500).send('Error fetching meals');
    }
});

// **API Route to Add a New Meal**
app.post('/api/meals', authenticateToken, async (req, res) => {
    const { name, image, probability } = req.body;
    if (!name || !image || !probability) {
        return res.status(400).send('Invalid meal data');
    }

    try {
        const newMeal = new Meal({
            name,
            image,
            probability,
            userId: req.user.id
        });
        await newMeal.save();
        res.status(201).send('Meal added successfully');
    } catch (error) {
        console.error('Error adding meal:', error);
        res.status(500).send('Error adding meal');
    }
});

// **Delete Meal history
app.delete('/api/history/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        console.log("Deleting history item with ID:", id); // Log the ID for debugging

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid history item ID' });
        }

        const result = await mongoose.connection.collection('history').deleteOne({
            _id: new mongoose.Types.ObjectId(id)
        });

        if (result.deletedCount === 1) {
            res.status(200).send('History item deleted successfully');
        } else {
            res.status(404).send('History item not found');
        }
    } catch (error) {
        console.error('Error deleting history item:', error);
        res.status(500).send('Error deleting history item');
    }
});
// **Delete Meal by ID**
app.delete('/api/meals/:id', authenticateToken, async (req, res) => {
    try {
        const mealId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(mealId)) {
            return res.status(400).send('Invalid meal ID');
        }

        const result = await Meal.findByIdAndDelete(mealId);

        if (result) {
            res.status(200).send('Meal deleted successfully');
        } else {
            res.status(404).send('Meal not found');
        }
    } catch (error) {
        console.error('Error deleting meal:', error);
        res.status(500).send('Error deleting meal');
    }
});

// **API Route to Get name**
app.get('/api/username', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];  // ดึง Token จาก Header
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);  // ตรวจสอบ Token
        const user = await User.findById(decoded.id);  // ค้นหาผู้ใช้ในฐานข้อมูล

        if (user) {
            res.json({ username: user.username });
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    } catch (error) {
        console.error('Error verifying token:', error);
        res.status(401).json({ error: 'Invalid token' });
    }
});


function getUserFromToken(req) {
    const token = req.headers.authorization?.split(' ')[1]; // ดึง token จาก header

    if (!token) {
        throw new Error('No token provided');
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET); // ตรวจสอบและถอดรหัส token
        return User.findById(decoded.id); // ค้นหาผู้ใช้จากฐานข้อมูลตาม id ใน token
    } catch (error) {
        throw new Error('Invalid token');
    }
}

module.exports = getUserFromToken;

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000; // กำหนดเวลา 7 วัน (ในหน่วยมิลลิวินาที)

// ฟังก์ชันลบรายการประวัติที่เก่ากว่า 1 นาที
async function deleteOldHistory() {
    const currentTime = new Date().getTime(); // เวลาปัจจุบันในหน่วยมิลลิวินาที
    const cutoffTime = new Date(currentTime - SEVEN_DAYS); // เวลา 7 วันก่อนหน้า

    try {
        await mongoose.connection.collection('history').deleteMany({
            timestamp: { $lt: cutoffTime.toISOString() }
        });
        // console.log('ลบรายการเก่าที่เก็บไว้นานเกิน 7 วันแล้ว');
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการลบรายการเก่า:', error);
    }
}

// *Add Meal History Entry*
app.post('/api/history', authenticateToken, async (req, res) => {
    try {
        const historyItem = { ...req.body, userId: req.user.id, timestamp: new Date().toISOString() };
        await mongoose.connection.collection('history').insertOne(historyItem);

        // เรียกฟังก์ชันลบรายการเก่าทันทีหลังเพิ่มรายการใหม่
        await deleteOldHistory();

        res.status(201).send('บันทึกประวัติสำเร็จและลบรายการเก่าที่หมดเวลาแล้ว');
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการบันทึกประวัติ:', error);
        res.status(500).send('เกิดข้อผิดพลาดในการบันทึกประวัติ');
    }
});

// *Get Meal History*
app.get('/api/history', authenticateToken, async (req, res) => {
    try {
        await deleteOldHistory(); // ลบรายการที่เก่ากว่า 1 นาที

        const history = await mongoose.connection.collection('history')
            .find({ userId: req.user.id })
            .toArray();

        res.json(history);
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการโหลดประวัติ:', error);
        res.status(500).send('เกิดข้อผิดพลาดในการโหลดประวัติ');
    }
});

// กำหนด Route สำหรับหน้าเว็บ (กรณีเข้าถึงจาก /)
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// **Serve other static pages**
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});


// Start the server
app.listen(3000, () => {
    console.log('Server is running on port 3000, http://localhost:3000/');
    console.log('MongoDB URI:', process.env.MONGODB_URI);
});