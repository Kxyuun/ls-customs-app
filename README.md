# LS Customs

Auto shop booking website for LS Customs, Pasay City. Course project (BSIT).

## Folders

- ls-customs-main: React + Vite frontend (the website)
- ls-customs-api: Node + Express + MongoDB backend (the API)

## How to run it

You need two terminals. Start the backend first.

Backend (http://localhost:4000)

    cd ls-customs-api
    npm install
    (create a .env file, the settings are listed in ls-customs-api/README.md)
    npm run seed      (first time only, creates the admin account)
    npm run dev

Frontend (http://localhost:5173)

    cd ls-customs-main
    npm install
    npm run dev

Never commit the .env file. It holds passwords and keys.
