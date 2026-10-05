import { sql } from '../../lib/db.js';
import { cors, isAdmin } from '../../lib/http.js';

const STATUSES = ['pending', 'paid', 'fulfilled', 'cancelled'];

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (!isAdmin(req)) return res.status(401).json({ error: 'Invalid API key' });
  const id = Number(req.query.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

  try {
    if (req.method === 'PUT') {
      const { status } = req.body || {};
      if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });
      const [prev] = await sql`select status, items from orders where id = ${id}`;
      if (!prev) return res.status(404).json({ error: 'Not found' });
      const [row] = await sql`update orders set status = ${status} where id = ${id} returning *`;
      // Marking a pending order paid by hand also takes the stock, like the webhook does.
      if (status === 'paid' && prev.status === 'pending') {
        for (const line of prev.items) {
          await sql`update products set stock = greatest(stock - ${line.qty}, 0) where id = ${line.product_id}`;
        }
      }
      return res.status(200).json(row);
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}