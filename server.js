const express = require('express');
const admin = require('firebase-admin');
const cron = require('node-cron');
const { Parser } = require('json2csv');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Firebase Admin Initialization
try {
    if (process.env.FIREBASE_PRIVATE_KEY) {
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
    console.warn("Firebase Admin NOT initialized.", e);
}

const db = admin.firestore ? admin.firestore() : null;

// The Google Apps Script Webhook URL you just created
const WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbyqQelzSr0cPokVQzI5Kxu0vf-JzlByDLg8plpG5Q8zaFytGrLDaXQl285FJ1i2KHEB/exec";

// Reusable function to fetch data and trigger the Webhook
async function triggerEmailExport() {
    if (!db) {
        console.error("No DB connection");
        return "No DB connection";
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const snapshot = await db.collection("lucky_numbers").where("date", "==", todayStr).get();

    if (snapshot.empty) {
        console.log("No numbers claimed today. No email sent.");
        return "No numbers claimed today. No email sent.";
    }

    const records = [];
    snapshot.forEach(doc => records.push(doc.data()));

    const fields = ['date', 'lucky_number', 'customer_name', 'phone_number', 'invoice_number'];
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(records);

    // Send the CSV to the Google Webhook securely via Port 443
    const payload = {
        secretToken: "LEADERS_SECURE_123",
        date: todayStr,
        recipients: process.env.EMAIL_RECIPIENTS,
        csv: csv
    };

    const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const result = await response.json();
    if (result.status === "success") {
        console.log("Webhook Email sent successfully!");
        return "✅ Success! Check your email right now!";
    } else {
        throw new Error("Webhook failed: " + result.message);
    }
}

// 1. Cron Job: Run daily at 11:59 PM automatically
cron.schedule('59 23 * * *', async () => {
    console.log("Running Daily CSV Export Cron Job...");
    try {
        await triggerEmailExport();
    } catch (error) {
        console.error("Error in Cron Job:", error);
    }
});

// 2. Manual API endpoint to trigger email instantly
app.get('/send-email', async (req, res) => {
    console.log("Manual Email Triggered via Webhook!");
    try {
        const resultMessage = await triggerEmailExport();
        res.send(`<h1>${resultMessage}</h1>`);
    } catch (error) {
        console.error("Manual trigger error:", error);
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
