import { sql } from '../lib/db.js';
import { cors, isAdmin } from '../lib/http.js';


export default async function handler(req, res) {
  if (cors(req, res)) return;
  try {
    if (req.method === 'GET') {
      if (!isAdmin(req)) return res.status(401).json({ error: 'Invalid API key' });
      const rows = await sql`select * from orders order by id desc`;
      return res.status(200).json(rows);
    }
    if (req.method === 'POST') {
      const { customer_name, email, items } = req.body || {};
      if (!customer_name || !email || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'customer_name, email and items are required' });
      }
      // Prices come from the database, never from the browser.
      const ids = items.map(i => Number(i.product_id));
      const products = await sql`
        select id, name, price_cents from products where id = any(${ids}) and active = true`;
      let total = 0;
      const lines = [];
      for (const i of items) {
        const p = products.find(p => p.id === Number(i.product_id));
        const qty = Number(i.qty);
        if (!p || !Number.isInteger(qty) || qty < 1) {
          return res.status(400).json({ error: 'Invalid item in order' });
        }
        total += p.price_cents * qty;
        lines.push({ product_id: p.id, name: p.name, price_cents: p.price_cents, qty });
      }
      const [order] = await sql`
        insert into orders (customer_name, email, items, total_cents)
        values (${customer_name}, ${email}, ${JSON.stringify(lines)}::jsonb, ${total})
        returning *`;
      return res.status(201).json(order);
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
