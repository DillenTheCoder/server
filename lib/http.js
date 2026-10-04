// Lets other sites/apps call the API, and answers browser preflight checks.
export function cors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  if (req.method === 'OPTIONS') { res.status(204).end(); return true; }
  return false;
}

// Admin actions need the x-api-key header to match ADMIN_API_KEY.
export function isAdmin(req) {
  const key = process.env.ADMIN_API_KEY;
  return Boolean(key) && req.headers['x-api-key'] === key;
}
