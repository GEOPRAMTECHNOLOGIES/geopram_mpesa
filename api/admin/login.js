/**
 * api/admin/login.js
 * POST /api/admin/login
 */
const { signAdminToken, verifyAdminCredentials } = require('../../lib/auth');

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed.' });

  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  if (!verifyAdminCredentials(username, password)) {
    return res.status(401).json({ message: 'Invalid admin credentials.' });
  }

  const token = signAdminToken(username);
  return res.status(200).json({ token });
};
