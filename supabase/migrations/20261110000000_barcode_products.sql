-- Barcode products cache and shopping list item barcode reference (SCAN-02).
-- barcode_products caches product metadata resolved from Open Food Facts.
-- shopping_list_item.barcode enables offline barcode matching and checkout check-off.

create table public.barcode_products (
  barcode text primary key check (btrim(barcode) <> ''),
  product_name text,
  brands text,
  quantity text,
  image_url text,
  raw_payload jsonb,
  created_at timestamptz not null default now()
);

alter table public.shopping_list_item
  add column if not exists barcode text;

create index if not exists shopping_list_item_barcode_idx
  on public.shopping_list_item (barcode)
  where barcode is not null;

alter table public.barcode_products enable row level security;

create policy authenticated_read on public.barcode_products
  for select to authenticated using (true);

create policy authenticated_insert on public.barcode_products
  for insert to authenticated with check (true);

