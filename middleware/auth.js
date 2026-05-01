// Dummy auth middleware for direct access (no login required)
const auth = (req, res, next) => {
  // Inject a default guest user so all backend operations work
  req.user = { id: 'guest-user-123', username: 'Guest' };
  next();
};

module.exports = auth;
