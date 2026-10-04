import { sql } from '../../lib/db.js';
import { cors, isAdmin } from '../../lib/http.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  const id = Number(req.query.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    if (req.method === 'GET') {
      const [row] = await sql`select * from products where id = ${id} and active = true`;
      return row ? res.status(200).json(row) : res.status(404).json({ error: 'Not found' });
    }
    if (!isAdmin(req)) return res.status(401).json({ error: 'Invalid API key' });

    if (req.method === 'PUT') {
      // Send only the fields you want to change.
      const b = req.body || {};
      const [row] = await sql`
        update products set
          name = coalesce(${b.name ?? null}, name),
          description = coalesce(${b.description ?? null}, description),
          price_cents = coalesce(${b.price_cents ?? null}, price_cents),
          image_url = coalesce(${b.image_url ?? null}, image_url),
          stock = coalesce(${b.stock ?? null}, stock),
          active = coalesce(${b.active ?? null}, active)
        where id = ${id} returning *`;
      return row ? res.status(200).json(row) : res.status(404).json({ error: 'Not found' });
    }
    if (req.method === 'DELETE') {
      await sql`delete from products where id = ${id}`;
      return res.status(204).end();
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
