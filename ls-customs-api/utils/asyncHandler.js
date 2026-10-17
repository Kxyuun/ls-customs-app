// Express 4 does not catch errors from async routes by itself; this does.
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
