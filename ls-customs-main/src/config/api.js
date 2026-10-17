// Single place for every backend endpoint. Each value points at the Express
// API in ls-customs-api (npm run dev there, default port 4000).
// Set a value back to null to switch that feature to local/demo mode.
//
// Request/response shapes:
//   LOGIN                  POST {email, password} -> {token, role: 'customer'|'staff'|'admin', user}
//   OTP_SEND               POST {email} -> 204 (code emailed) or 409 if the email already has an account
//   OTP_VERIFY             POST {email, code, firstName, lastName, password} -> {role, user} (no token: user logs in next)
//   CHANGE_PASSWORD        POST (Bearer) {currentPassword, newPassword}
//   PASSWORD_RESET_REQUEST POST {email} -> 204 always
//   PASSWORD_RESET_CONFIRM POST {email, code, newPassword}
//   CHANGE_EMAIL_VERIFY    POST (Bearer) {password} -> 204 if the password is right, 401 if not
//   CHANGE_EMAIL_REQUEST   POST (Bearer) {newEmail, password} -> 204; sends a code to the NEW email
//   CHANGE_EMAIL_CONFIRM   POST (Bearer) {newEmail, code} -> {token, role, user}
//   PROFILE                PATCH (Bearer) {firstName, lastName} -> {user}
//   BOOKINGS               GET list | POST create | PATCH /:id {status}
//   NOTIFICATIONS          GET list (Bearer) | PATCH /:id {read: true}
//   STAFF_ACCOUNTS         GET list | POST create | DELETE /:id
//   AVAILABILITY           GET ?date=YYYY-MM-DD -> {status, slots:[{hour, available}]}
export var API = {
  LOGIN: 'http://localhost:4000/api/login',
  OTP_SEND: 'http://localhost:4000/api/otp/send',
  OTP_VERIFY: 'http://localhost:4000/api/otp/verify',
  CHANGE_PASSWORD: 'http://localhost:4000/api/password/change',
  PASSWORD_RESET_REQUEST: 'http://localhost:4000/api/password/reset-request',
  PASSWORD_RESET_CONFIRM: 'http://localhost:4000/api/password/reset-confirm',
  CHANGE_EMAIL_VERIFY: 'http://localhost:4000/api/email/verify-password',
  CHANGE_EMAIL_REQUEST: 'http://localhost:4000/api/email/change-request',
  CHANGE_EMAIL_CONFIRM: 'http://localhost:4000/api/email/change-confirm',
  PROFILE: 'http://localhost:4000/api/profile',
  BOOKINGS: 'http://localhost:4000/api/bookings',
  NOTIFICATIONS: 'http://localhost:4000/api/notifications',
  STAFF_ACCOUNTS: 'http://localhost:4000/api/staff',
  AVAILABILITY: 'http://localhost:4000/api/availability'
};
