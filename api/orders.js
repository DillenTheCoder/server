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
      const b = req.body || {};
      const clean = (v, max = 120) => String(v ?? '').trim().slice(0, max);
      const f = {
        first_name: clean(b.first_name, 60), last_name: clean(b.last_name, 60),
        email: clean(b.email), phone: clean(b.phone, 20),
        address_line: clean(b.address_line, 200), suburb: clean(b.suburb, 80),
        city: clean(b.city, 80), province: clean(b.province, 40),
        postal_code: clean(b.postal_code, 10), delivery_notes: clean(b.delivery_notes, 300),
      };
      const required = ['first_name', 'last_name', 'email', 'phone', 'address_line', 'city', 'province', 'postal_code'];
      if (required.some((k) => !f[k])) return res.status(400).json({ error: 'Please fill in all required details' });
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) return res.status(400).json({ error: 'Email address looks wrong' });
      if (f.phone.replace(/\D/g, '').length < 9) return res.status(400).json({ error: 'Phone number looks wrong' });
      if (b.consent !== true) return res.status(400).json({ error: 'Please agree to us using your details for this order' });
      const items = b.items;
      if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Cart is empty' });

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
        insert into orders (customer_name, first_name, last_name, email, phone, address_line, suburb, city,
                            province, postal_code, delivery_notes, consent_at, items, total_cents)
        values (${f.first_name + ' ' + f.last_name}, ${f.first_name}, ${f.last_name}, ${f.email}, ${f.phone},
                ${f.address_line}, ${f.suburb}, ${f.city}, ${f.province}, ${f.postal_code}, ${f.delivery_notes},
                now(), ${JSON.stringify(lines)}::jsonb, ${total})
        returning id, total_cents, status`;
      return res.status(201).json(order);
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}