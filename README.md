# LS Customs

An online booking system for LS Customs, an auto shop in Pasay City, PH.

**Made by**

- Carlo Luis Valino
- Syd Andrew Villanueva
- Khyle Benjamin Cases
- Yaniel Sayon Junsay

Course project for **Integrative Programming and Technologies** and **System Integration and Architecture** (BSIT).

## About the project

LS Customs does auto care, core fixes, vehicle mods, body work and car washes. The site lets customers book a visit online instead of walking in or calling. They make an account, pick a service, choose an open time slot and send the booking. The shop's staff handle everything from a dashboard, and the customer gets an email and an in-app notification every time the status of their booking changes.

## What it can do

**Customers**

- Sign up with a 6-digit code sent to their email
- Log in, reset a forgotten password, change their password or email, edit their profile
- Book by choosing a vehicle type, a service (with optional add-ons), a date and a time slot
- Closed days and full time slots can't be picked
- Choose a free consultation if they don't know what the car needs
- Download a PDF copy of their booking
- See their bookings, cancel the ones that are still pending, and get notified when the status changes

**Staff and admin**

- One login page for everyone. The account's role decides where you land.
- Dashboard with every booking, and a status you can update: Pending, In Progress, Ready for Pickup, Completed or Cancelled
- Admins can also add and remove staff accounts

## How the parts fit together

```
Browser (React + Vite)  <-- HTTP / JSON -->  Express API  <-->  MongoDB
                                                  |
                                                  +--> Gmail SMTP (OTP codes, booking emails)
```

- The frontend only talks to the backend through a REST API. All the endpoint URLs are in one file, `ls-customs-main/src/config/api.js`.
- Logging in returns a JWT. The frontend sends it with each request, and the API checks the user's role on every protected route. A customer can't read staff data even by calling the API directly.
- Passwords are hashed with bcrypt. Booking totals are calculated by the server, not taken from the browser.
- Emails (signup codes, password resets, booking status updates) go out through Gmail SMTP using Nodemailer.
- The PDF confirmation is generated in the browser with jsPDF.

## Tech used

| Part | What we used |
|---|---|
| Frontend | React 18, Vite, React Router, jsPDF |
| Backend | Node.js, Express, Mongoose, jsonwebtoken, bcryptjs, Nodemailer, express-rate-limit |
| Database | MongoDB (we used MongoDB Atlas) |

## Folders

```
ls-customs-main/   React frontend (the website)
ls-customs-api/    Node + Express backend (the API)
```

Each folder has its own README with more detail.

## How to run it

You need Node.js and a MongoDB database. Start the backend first and keep it running, then start the frontend in a second terminal.

**Backend** (runs on http://localhost:4000)

```
cd ls-customs-api
npm install
```

Make a file called `.env` in that folder. Copy `.env.example`, then fill in your own MongoDB connection string and JWT secret. For emails, either add a Gmail App Password or set `MAIL_CONSOLE=true` so the codes print in the terminal while testing.

```
npm run seed
npm run dev
```

`npm run seed` creates the first admin account and only needs to run once. The default login is `admin@lscustoms.com` / `Admin12345`. Change the password in `.env` before you seed if this will be shown or hosted anywhere.

**Frontend** (runs on http://localhost:5173)

```
cd ls-customs-main
npm install
npm run dev
```

After the first install you only need `npm run dev` in each folder.

The `.env` file holds passwords and keys. Never commit it.

## Known limitations

- Payments (GCash, Maya, Cash) are only recorded. Nothing is actually charged.
- Notifications are email and in-app only, no SMS.
- If two people book the very last free slot at the exact same moment, both could go through.
- Service names and prices are set in the code, so they can't be edited from the dashboard.
