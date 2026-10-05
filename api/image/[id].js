import { sql } from '../../lib/db.js';
import { cors, isAdmin } from '../../lib/http.js';

const MAX_BASE64 = 900000; // about 650 KB of image: plenty, since the admin app shrinks photos first

export default async function handler(req, res) {
  if (cors(req, res)) return;
  const id = Number(req.query.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

  try {
    // Public: the shop page loads <img src="/api/image/5"> from here.
    if (req.method === 'GET') {
      const [row] = await sql`select image_data from products where id = ${id}`;
      if (!row || !row.image_data) return res.status(404).end();
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.status(200).send(Buffer.from(row.image_data, 'base64'));
    }

    if (!isAdmin(req)) return res.status(401).json({ error: 'Invalid API key' });

    // Admin: upload or replace. Body is {image: "<base64 JPEG>"}.
    if (req.method === 'PUT') {
      const { image } = req.body || {};
      if (typeof image !== 'string' || image.length > MAX_BASE64 || !/^[A-Za-z0-9+/=]+$/.test(image)) {
        return res.status(400).json({ error: 'Image is missing or too large' });
      }
      if (!image.startsWith('/9j/')) return res.status(400).json({ error: 'Image must be a JPEG' }); // JPEG files start with these bytes
      // The ?v= number changes on every upload so browsers fetch the new picture.
      const url = `/api/image/${id}?v=${Date.now()}`;
      const [row] = await sql`
        update products set image_data = ${image}, image_url = ${url} where id = ${id}
        returning id, image_url`;
      return row ? res.status(200).json(row) : res.status(404).json({ error: 'Not found' });
    }

    // Admin: remove the photo.
    if (req.method === 'DELETE') {
      const [row] = await sql`
        update products set image_data = null, image_url = '' where id = ${id} returning id`;
      return row ? res.status(200).json({ removed: id }) : res.status(404).json({ error: 'Not found' });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}