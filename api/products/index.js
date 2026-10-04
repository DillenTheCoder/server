import { sql } from '../../lib/db.js';
import { cors, isAdmin } from '../../lib/http.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  try {
    if (req.method === 'GET') {
      const rows = await sql`
        select id, name, description, price_cents, image_url, stock
        from products where active = true order by id desc`;
      return res.status(200).json(rows);
    }
    if (req.method === 'POST') {
      if (!isAdmin(req)) return res.status(401).json({ error: 'Invalid API key' });
      const { name, description = '', price_cents, image_url = '', stock = 0 } = req.body || {};
      if (!name || !Number.isInteger(price_cents)) {
        return res.status(400).json({ error: 'name and price_cents (whole number of cents) are required' });
      }
      const [row] = await sql`
        insert into products (name, description, price_cents, image_url, stock)
        values (${name}, ${description}, ${price_cents}, ${image_url}, ${stock})
        returning *`;
      return res.status(201).json(row);
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
