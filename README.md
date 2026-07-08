# Leaders Lucky Number Campaign - Standalone Cloud App

This is a complete standalone web application built with Node.js and Firebase. It requires absolutely no connection to your WordPress website.

## Features
- **Real-Time Sync**: When someone clicks a number on iPad A, it instantly locks on iPad B (powered by Firebase Firestore).
- **Daily Automated Exports**: A background cron job runs every night at 11:59 PM, generates a CSV of all claims, and emails it to your team.
- **Admin Reset**: A hidden admin panel allows you to instantly clear the board if needed.
- **Auto-Reset**: You don't actually need to clear the board daily. The system strictly separates data by the current date. When the clock strikes midnight, the board is naturally completely empty and new numbers are written under tomorrow's date!

## How to Set This Up

### Step 1: Create a Free Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/) and create a new project.
2. Click **Firestore Database** in the left menu and click **Create Database**. Start in **Test Mode** (or update the rules to allow read/write).
3. Go to **Project Overview -> Project Settings -> General**. Scroll down to "Your apps", click the Web icon (`</>`), register an app, and copy the `firebaseConfig` object.
4. Open `public/script.js` in this folder and paste your `firebaseConfig` variables at the very top of the file!

### Step 2: Get Firebase Admin Credentials (for the backend)
1. In your Firebase Project Settings, click the **Service Accounts** tab.
2. Click **Generate new private key**. This will download a JSON file.
3. Keep this file safe. You will need the `project_id`, `client_email`, and `private_key` from it for Step 4.

### Step 3: Get a Gmail App Password
Because standard Gmail login blocks automated systems, you need an "App Password":
1. Go to your Google Account Security Settings.
2. Enable 2-Step Verification if you haven't.
3. Search for "App Passwords" in the search bar.
4. Create a new App Password (name it "Node App"). It will give you a 16-character code.

### Step 4: Deploy to the Cloud (Render.com)
The easiest way to host this for free is [Render.com](https://render.com).
1. Push this folder to a GitHub repository.
2. Go to Render.com -> New -> Web Service -> Connect your GitHub repo.
3. Set the Environment to **Node**.
4. Set the Start Command to `npm start`.
5. Go to the "Environment Variables" section in Render and add everything from the `.env.example` file:
   - `GMAIL_USER` = your gmail address
   - `GMAIL_APP_PASSWORD` = your 16-character app password (NO spaces)
   - `EMAIL_RECIPIENTS` = the emails you want the CSV sent to
   - `FIREBASE_PROJECT_ID` = from your Firebase JSON key
   - `FIREBASE_CLIENT_EMAIL` = from your Firebase JSON key
   - `FIREBASE_PRIVATE_KEY` = from your Firebase JSON key

Click Deploy! 

## How to Reset the Board Manually
At the very bottom of the page, there is a tiny, almost invisible "Admin" text link.
Click it, enter the password `123456`, and click "Reset All Numbers". This will instantly clear all claimed numbers for today across all devices.
