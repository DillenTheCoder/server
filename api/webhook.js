import crypto from 'node:crypto';
import { sql } from '../lib/db.js';

// We need the raw request text to check Yoco's signature, so turn off automatic JSON parsing.
export const config = { api: { bodyParser: false } };

async function readRaw(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

function validSignature(req, raw) {
  const id = req.headers['webhook-id'];
  const timestamp = req.headers['webhook-timestamp'];
  const header = req.headers['webhook-signature'] || '';
  if (!id || !timestamp || !process.env.YOCO_WEBHOOK_SECRET) return false;

  // Reject old requests (replay protection): 3 minute window.
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 180) return false;

  const secret = Buffer.from(process.env.YOCO_WEBHOOK_SECRET.split('_')[1], 'base64');
  const expected = crypto.createHmac('sha256', secret).update(`${id}.${timestamp}.${raw}`).digest('base64');

  // The header can hold several signatures like "v1,abc v1,def".
  return header.split(' ').some((part) => {
    const sig = part.split(',')[1] || '';
    return sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const raw = await readRaw(req);
    if (!validSignature(req, raw)) return res.status(401).json({ error: 'Bad signature' });

    const event = JSON.parse(raw);
    if (event.type === 'payment.succeeded') {
      // Yoco's event carries the checkout id in payload.metadata.checkoutId.
      const checkoutId = event.payload?.metadata?.checkoutId;
      if (checkoutId) {
        // Only flips pending -> paid once, so a repeated webhook can't take stock twice.
        const [order] = await sql`
          update orders set status = 'paid' where yoco_checkout_id = ${checkoutId} and status = 'pending' returning items`;
        if (order) {
          for (const line of order.items) {
            await sql`update products set stock = greatest(stock - ${line.qty}, 0) where id = ${line.product_id}`;
          }
        }
      }
    }
    // Always answer 200 quickly so Yoco doesn't keep retrying.
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
}