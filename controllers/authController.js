const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

exports.register = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    let userByEmail = await User.findOne({ email });
    if (userByEmail) return res.status(400).json({ message: 'Email is already registered' });

    let userByUsername = await User.findOne({ username });
    if (userByUsername) return res.status(400).json({ message: 'Username is already taken' });

    let user = new User({ username, email, password });
    await user.save();

    const payload = { user: { id: user.id, username: user.username } };
    jwt.sign(payload, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '7d' }, (err, token) => {
      if (err) throw err;
      res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Username or email already exists' });
    }
    console.error('Registration Error:', err);
    res.status(500).json({ message: 'Server error during registration' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // --- HARDCODED ADMIN BYPASS ---
    if ((email === 'admin' || email === 'admin@test.com') && password === 'mayank123') {
      const payload = { user: { id: 'admin-dummy-id', username: 'admin' } };
      return jwt.sign(payload, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '7d' }, (err, token) => {
        if (err) throw err;
        res.json({ token, user: { id: 'admin-dummy-id', username: 'admin', email: 'admin@test.com' } });
      });
    }
    // ------------------------------

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid Credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid Credentials' });

    const payload = { user: { id: user.id, username: user.username } };
    jwt.sign(payload, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '7d' }, (err, token) => {
      if (err) throw err;
      res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};
