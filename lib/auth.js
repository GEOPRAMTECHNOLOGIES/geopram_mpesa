/**
 * lib/auth.js
 * JWT-based admin authentication for Vercel serverless functions.
 */
const jwt = require('jsonwebtoken');

const JWT_SECRET      = () => process.env.JWT_SECRET      || 'change_me_to_a_long_secret';
const ADMIN_USERNAME  = () => process.env.ADMIN_USERNAME  || 'admin';
const ADMIN_PASSWORD  = () => process.env.ADMIN_PASSWORD  || 'password';

function signAdminToken(username) {
  return jwt.sign({ username }, JWT_SECRET(), { expiresIn: '8h' });
}

function verifyAdminCredentials(username, password) {
  return username === ADMIN_USERNAME() && password === ADMIN_PASSWORD();
}

/**
 * Extracts and verifies the Bearer token from request headers.
 * Returns the decoded payload, or throws on failure.
 */
function verifyAdminToken(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    const err = new Error('Authorization header missing or malformed.');
    err.status = 401;
    throw err;
  }
  try {
    return jwt.verify(header.replace('Bearer ', '').trim(), JWT_SECRET());
  } catch {
    const err = new Error('Invalid or expired token.');
    err.status = 401;
    throw err;
  }
}

module.exports = { signAdminToken, verifyAdminCredentials, verifyAdminToken };
