# Shop starter

## Setup
1. Make a free Postgres database at neon.tech. Open its SQL editor, paste `schema.sql`, run it.
2. Copy the connection string.
3. Push this folder to GitHub and import it in Vercel.
4. In Vercel > Settings > Environment Variables add:
   - `DATABASE_URL` = your Neon connection string
   - `ADMIN_API_KEY` = a long random string only you know
5. Deploy.

## API
Public:
- `GET /api/products`
- `GET /api/products/:id`
- `POST /api/orders` {customer_name, email, items:[{product_id, qty}]}

Needs header `x-api-key: <ADMIN_API_KEY>`:
- `POST /api/products` {name, price_cents, description, image_url, stock}
- `PUT /api/products/:id` (send only changed fields)
- `DELETE /api/products/:id`
- `GET /api/orders`

Prices are whole cents: R149.99 = 14999.

## Try it
curl -X POST https://YOUR-SITE.vercel.app/api/products \
  -H "Content-Type: application/json" -H "x-api-key: YOUR_KEY" \
  -d '{"name":"Test item","price_cents":14999,"stock":10}'
