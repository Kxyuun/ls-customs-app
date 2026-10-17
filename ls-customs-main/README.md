# LS Customs - Frontend (React + Vite)

Customer booking site and staff/admin dashboard for LS Customs, an auto shop in Pasay City.
This is the **client** of a full-stack MERN application. It talks to the Express API in the
`ls-customs-api` project (MongoDB Atlas + Mongoose + Nodemailer).

## Run it

1. Start the API first (see the API README: `npm install`, create your own `.env` file from the template there, `npm run seed`, `npm run dev`).
   It runs on `http://localhost:4000`.
2. In this folder:

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). The API allows this origin by default (`FRONTEND_ORIGIN`).

Production build: `npm run build`, then `npm run preview`.

## What it does

- Customer registration with an emailed one-time code (OTP), login, forgot password, change password, change email, edit profile.
- One login page for customers, staff and administrators. The server returns the role and the app sends each role to the right page.
- Four-step booking: vehicle, one or more service types (each with its own optional additional services, shown for the service clicked last), date and time slot (live availability from the API), confirm and pay method.
- Signup tells the user if the email already has an account (pop-up: log in, or retype). Change Email is a button in the Profile box: password, then new email, then emailed code.
- The staff dashboard refreshes itself every few seconds, so new bookings appear without a reload.
- Booking confirmation with a reference code and a downloadable PDF summary (jsPDF).
- My Account: bookings, cancel a pending booking, in-app notifications (refreshed about every 15 seconds).
- Staff dashboard: all bookings with status control (valid next steps only). Admins also add and remove staff accounts.
- Responsive layout for desktop and mobile.

## Where the API address lives

Every endpoint URL is in `src/config/api.js` (all point to `http://localhost:4000`). Change the address there if the API runs somewhere else.
Setting an entry to `null` switches that one feature to a local browser-only demo mode, which is only useful for development without the API.

## Tech

React 18, React Router 6, Vite 5, jsPDF. Components are plain `.js` files containing JSX (`vite.config.js` tells esbuild to parse JSX in `.js` files).

## Project structure

```
src/
  main.js, App.js          entry point and route table
  config/api.js            every API endpoint URL
  pages/                   Home, Login, Signup, ForgotPassword, Book, Account, Dashboard, StaffLogin, NotFound
  components/              Header, Footer, route guards, dialogs, form fields, booking widgets
  data/                    services and prices, business hours and info, booking content
  utils/                   API client, auth/session, validation, stores, dates, pricing
  assets/                  photos used by the pages
  style.css                stylesheet (dark theme, yellow accents)
```

## Routes

| Route | Page |
|---|---|
| `/` | Home (services, schedule, contact) |
| `/login` | Login for customers, staff and admins |
| `/signup` | Customer registration with email OTP |
| `/forgot-password` | Password reset with an emailed code |
| `/book` | Booking flow (customers) |
| `/account` | My Account (customers) |
| `/dashboard` | Staff and admin dashboard |
| `/staff-login` | Local demo setup only; forwards to `/login` when the API is configured |

## Security notes

- The browser never decides roles, prices or booking rules. The API checks the role on every request, calculates the total itself, and enforces the status workflow.
- Passwords are hashed by the API (bcrypt). Sessions use signed JWTs that expire after 7 days.
- Only a password **reset** ends older sessions; a normal password change does not.

## Before launch

- The shop owner should confirm the phone, email, address and prices in `src/data/businessInfo.js` and `src/data/serviceData.js`.
- Remove the local-demo-only parts (the `/staff-login` setup screen and demo account stores in `src/utils/auth.js`) once the API is the only mode.
