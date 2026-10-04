create table if not exists products (
  id serial primary key,
  name text not null,
  description text not null default '',
  price_cents integer not null,
  image_url text not null default '',
  stock integer not null default 0,
  active boolean not null default true
);

create table if not exists orders (
  id serial primary key,
  customer_name text not null,
  email text not null,
  items jsonb not null,
  total_cents integer not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);
