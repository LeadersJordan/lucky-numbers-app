const express = require('express');
const admin = require('firebase-admin');
const cron = require('node-cron');
const nodemailer = require('nodemailer');
const { Parser } = require('json2csv');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Firebase Admin Initialization
// Ensure you download your Firebase Service Account JSON key
// and set GOOGLE_APPLICATION_CREDENTIALS in your environment / .env file
try {
    if (process.env.FIREBASE_PRIVATE_KEY) {
        // Direct config if using env vars (easier for Render)
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            })
        });
    } else {
        admin.initializeApp({
            credential: admin.credential.applicationDefault()
        });
    }
    console.log("Firebase Admin initialized.");
} catch (e) {
    console.warn("Firebase Admin NOT initialized. Please set credentials.", e);
}

const db = admin.firestore ? admin.firestore() : null;

// Nodemailer Setup
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER, // e.g. "mycompany@gmail.com"
        pass: process.env.GMAIL_APP_PASSWORD // 16-character App Password
    }
});

// Cron Job: Run daily at 11:59 PM
cron.schedule('59 23 * * *', async () => {
    console.log("Running Daily CSV Export Cron Job...");
    if (!db) {
        console.error("No Firebase DB connection. Skipping cron.");
        return;
    }

    try {
        const todayStr = new Date().toISOString().split('T')[0];
        
        // Fetch today's records
        const snapshot = await db.collection("lucky_numbers")
            .where("date", "==", todayStr)
            .get();

        if (snapshot.empty) {
            console.log("No numbers claimed today. Skipping email.");
            return;
        }

        const records = [];
        snapshot.forEach(doc => records.push(doc.data()));

        // Convert to CSV
        const fields = ['date', 'lucky_number', 'customer_name', 'phone_number', 'invoice_number'];
        const json2csvParser = new Parser({ fields });
        const csv = json2csvParser.parse(records);

        // Prepare Email
        const mailOptions = {
            from: `"Lucky Numbers System" <${process.env.GMAIL_USER}>`,
            to: process.env.EMAIL_RECIPIENTS, // "user1@domain.com, user2@domain.com"
            subject: `Lucky Numbers Daily Export - ${todayStr}`,
            text: `Attached is the daily export of all claimed lucky numbers for ${todayStr}.`,
            attachments: [
                {
                    filename: `lucky_numbers_${todayStr}.csv`,
                    content: csv
                }
            ]
        };

        // Send Email
        await transporter.sendMail(mailOptions);
        console.log("Daily CSV Email sent successfully!");

        // Optional: We do NOT need to delete the data, because the frontend strictly queries by `date == todayStr`.
        // Tomorrow is a new date string, so the grid will naturally be completely empty and reset!
        
    } catch (error) {
        console.error("Error in Cron Job:", error);
    }
});
// Manual API endpoint to trigger email right now
app.get('/send-email', async (req, res) => {
    if (!db) return res.status(500).send("No DB connection");
    try {
        const todayStr = new Date().toISOString().split('T')[0];
        const snapshot = await db.collection("lucky_numbers").where("date", "==", todayStr).get();
        
        if (snapshot.empty) return res.send("No numbers claimed today. No email sent.");
        
        const records = [];
        snapshot.forEach(doc => records.push(doc.data()));
        
        const fields = ['date', 'lucky_number', 'customer_name', 'phone_number', 'invoice_number'];
        const json2csvParser = new Parser({ fields });
        const csv = json2csvParser.parse(records);
        
        const mailOptions = {
            from: `"Lucky Numbers System" <${process.env.GMAIL_USER}>`,
            to: process.env.EMAIL_RECIPIENTS,
            subject: `Lucky Numbers Export - ${todayStr} (MANUAL)`,
            text: `Attached is the manual export of all claimed lucky numbers for ${todayStr}.`,
            attachments: [{ filename: `lucky_numbers_${todayStr}.csv`, content: csv }]
        };
        
        await transporter.sendMail(mailOptions);
        res.send("<h1>✅ Success! Check your email right now!</h1>");
    } catch (error) {
        res.status(500).send("Error sending email: " + error.message);
    }
});
// API test endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date() });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Standalone Cloud App running on port ${PORT}`);
});
