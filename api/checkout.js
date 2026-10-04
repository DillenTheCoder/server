import { sql } from '../lib/db.js';
import { cors } from '../lib/http.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { order_id } = req.body || {};
    const [order] = await sql`select id, total_cents, status from orders where id = ${Number(order_id)}`;
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status !== 'pending') return res.status(400).json({ error: 'Order is not payable' });

    // Build links back to this same site, whatever domain it is on.
    const site = `https://${req.headers.host}`;

    // Ask Yoco for a hosted payment page. The secret key stays on the server.
    const yoco = await fetch('https://payments.yoco.com/api/checkouts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.YOCO_SECRET_KEY}`,
      },
      body: JSON.stringify({
        amount: order.total_cents, // Yoco also uses cents
        currency: 'ZAR',
        successUrl: `${site}/success.html`,
        cancelUrl: `${site}/?cancelled=1`,
        metadata: { orderId: String(order.id) }, // lets the webhook find this order later
      }),
    });

    const data = await yoco.json();
    if (!yoco.ok || !data.redirectUrl) {
      console.error('Yoco error', data);
      return res.status(502).json({ error: 'Payment provider error' });
    }
    // Remember Yoco's checkout id: the webhook identifies payments by it.
    await sql`update orders set yoco_checkout_id = ${data.id} where id = ${order.id}`;
    return res.status(200).json({ redirectUrl: data.redirectUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}