-- Кэш URL картинок товаров по (brand, article).
-- Заполняется лениво при первом запросе картинки через lib/product-images.ts.
-- image_url = NULL означает «уже искали, картинки нет» — negative cache,
-- чтобы не дёргать ShATE-M API повторно для отсутствующих позиций.

create table if not exists public.product_images (
  id            bigserial primary key,
  brand         text not null,
  article       text not null,
  image_url     text,
  source        text not null default 'shate-m',
  created_at    timestamptz not null default now()
);

create unique index if not exists product_images_brand_article_idx
  on public.product_images (brand, article);

alter table public.product_images enable row level security;

-- Чтение картинок — всем (картинки публичны).
create policy "product_images_read_all"
  on public.product_images
  for select
  using (true);

-- Запись — только service_role (используется в lib/product-images.ts на сервере).
-- anon/authenticated роли писать сюда не должны.
create policy "product_images_write_service"
  on public.product_images
  for insert
  to service_role
  with check (true);

create policy "product_images_update_service"
  on public.product_images
  for update
  to service_role
  using (true)
  with check (true);
