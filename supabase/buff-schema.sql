-- supabase/buff-schema.sql — Bảng cho dịch vụ buff tương tác (USDT/BEP20).
-- Project: cong-ty-agent (tjsxqwnvjwmqlcyvlcim).
--
-- CÁCH ÁP DỤNG (main agent làm tay, không có quyền tự động):
--   Supabase Dashboard -> SQL Editor -> dán toàn bộ file này -> Run.
--   Chạy 1 lần duy nhất. Chạy lại cũng an toàn (IF NOT EXISTS / OR REPLACE).
--
-- BƯỚC BẮT BUỘC SAU KHI CHẠY (kẻo nạp tiền không cộng được):
--   1. Tạo một chuỗi bí mật ngẫu nhiên, vd. chạy:  openssl rand -hex 32
--   2. Chèn vào bảng buff_settings (chạy trong SQL Editor):
--        insert into public.buff_settings(key, value)
--        values ('rpc_secret', '<CHUỖI_VỪA_TẠO>')
--        on conflict (key) do update set value = excluded.value;
--   3. Đặt CÙNG chuỗi đó làm biến môi trường Railway cho service
--      live-game-platform: BUFF_RPC_SECRET=<CHUỖI_VỪA_TẠO>
--      (Railway Dashboard -> project unique-empathy -> service
--      live-game-platform -> Variables -> New Variable).
--   Lý do: backend ký mỗi lần cộng tiền nạp bằng HMAC-SHA256 với bí mật này;
--   hàm credit_wallet trong SQL kiểm tra lại chữ ký nên khách không thể tự
--   gọi RPC để cộng tiền khống. Không có bí mật chung thì nạp tiền bị lỗi
--   TOPUP_NOT_CONFIGURED (an toàn, chỉ là chưa chạy được).
--
-- THIẾT KẾ AN TOÀN (vì backend KHÔNG có service_role key):
--   - wallets: khách chỉ được SELECT ví của mình; KHÔNG được UPDATE/INSERT
--     trực tiếp. Ví được tạo tự động khi đăng ký (trigger trên auth.users).
--   - Trừ tiền: chỉ qua hàm SECURITY DEFINER deduct_wallet (tự kiểm tra số
--     dư, khóa hàng, ghi transaction) — khách gọi trực tiếp cũng chỉ trừ
--     được ví của chính mình.
--   - Cộng tiền nạp: chỉ qua credit_wallet + chữ ký HMAC (xem trên).
--   - Hoàn tiền: chỉ qua refund_wallet (ghi transaction ref 'refund:<id>').
--   - buff_orders: khách INSERT/SELECT/UPDATE được hàng của chính mình
--     (backend dùng JWT của khách để ghi đơn + đồng bộ trạng thái).
--   - transactions: khách chỉ SELECT của mình; ghi do các hàm RPC đảm nhiệm.
-- Nếu sau này Railway có SUPABASE_SERVICE_KEY thì backend chuyển sang chế độ
-- đặc quyền (ghi trực tiếp, vượt RLS) và các hàm RPC trên chỉ còn là dự phòng.

create extension if not exists pgcrypto;

-- ================= BẢNG =================
create table if not exists public.wallets (
  user_id uuid primary key references auth.users (id) on delete cascade,
  balance_usdt numeric(18, 4) not null default 0 check (balance_usdt >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.buff_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  service_id integer not null,
  server text not null default '',
  link text not null,
  quantity integer not null check (quantity > 0),
  cost_usdt numeric(18, 4) not null check (cost_usdt >= 0),
  status text not null default 'created',
  provider_order_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists buff_orders_user_created_idx
  on public.buff_orders (user_id, created_at desc);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('topup', 'deduct', 'refund')),
  amount_usdt numeric(18, 4) not null,
  ref text not null unique,
  created_at timestamptz not null default now()
);
create index if not exists transactions_user_created_idx
  on public.transactions (user_id, created_at desc);

-- Bảng chỉ hàm SECURITY DEFINER đọc (không có policy nào cho client).
create table if not exists public.buff_settings (
  key text primary key,
  value text not null
);

-- ================= RLS =================
alter table public.wallets enable row level security;
alter table public.buff_orders enable row level security;
alter table public.transactions enable row level security;
alter table public.buff_settings enable row level security;

drop policy if exists "wallets_select_own" on public.wallets;
create policy "wallets_select_own" on public.wallets
  for select to authenticated using (auth.uid() = user_id);
-- Cố tình KHÔNG có policy insert/update/delete cho wallets:
-- số dư chỉ đổi qua các hàm RPC bên dưới.

drop policy if exists "buff_orders_select_own" on public.buff_orders;
create policy "buff_orders_select_own" on public.buff_orders
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "buff_orders_insert_own" on public.buff_orders;
create policy "buff_orders_insert_own" on public.buff_orders
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "buff_orders_update_own" on public.buff_orders;
create policy "buff_orders_update_own" on public.buff_orders
  for update to authenticated using (auth.uid() = user_id);

drop policy if exists "transactions_select_own" on public.transactions;
create policy "transactions_select_own" on public.transactions
  for select to authenticated using (auth.uid() = user_id);
-- Cố tình KHÔNG có policy insert cho transactions: chỉ hàm RPC ghi.

-- ================= VÍ TỰ TẠO KHI ĐĂNG KÝ =================
create or replace function public.handle_new_user_wallet()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.wallets (user_id, balance_usdt)
  values (new.id, 0)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_wallet on auth.users;
create trigger on_auth_user_created_wallet
  after insert on auth.users
  for each row execute function public.handle_new_user_wallet();

-- ================= HÀM RPC (SECURITY DEFINER) =================
-- Trừ tiền mua đơn. Trả số dư mới. Hết tiền -> RAISE 'insufficient balance'.
create or replace function public.deduct_wallet(p_amount numeric, p_ref text)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_bal numeric(18, 4);
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'bad amount'; end if;

  insert into public.wallets (user_id, balance_usdt)
  values (v_uid, 0) on conflict (user_id) do nothing;

  select balance_usdt into v_bal from public.wallets
  where user_id = v_uid for update;

  if v_bal is null then raise exception 'wallet not found'; end if;
  if v_bal < p_amount then raise exception 'insufficient balance'; end if;

  update public.wallets
  set balance_usdt = balance_usdt - p_amount, updated_at = now()
  where user_id = v_uid
  returning balance_usdt into v_bal;

  insert into public.transactions (user_id, type, amount_usdt, ref)
  values (v_uid, 'deduct', -p_amount, p_ref);

  return v_bal;
end;
$$;

-- Cộng tiền nạp đã xác minh trên BSC.
-- p_amount_raw: số đơn vị nhỏ nhất của USDT (18 decimals), dạng chuỗi số nguyên.
-- p_sig: hex HMAC-SHA256 của (p_tx_hash || ':' || p_amount_raw) với bí mật
-- trong buff_settings (key 'rpc_secret'). Sai chữ ký -> từ chối.
create or replace function public.credit_wallet(p_tx_hash text, p_amount_raw text, p_sig text)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_secret text;
  v_expected text;
  v_amount numeric(18, 4);
  v_ref text := 'topup:' || p_tx_hash;
  v_bal numeric(18, 4);
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_tx_hash is null or p_tx_hash !~ '^0x[0-9a-fA-F]{64}$' then
    raise exception 'bad tx hash';
  end if;
  if p_amount_raw is null or p_amount_raw !~ '^[0-9]+$' then
    raise exception 'bad amount';
  end if;

  select value into v_secret from public.buff_settings where key = 'rpc_secret';
  if v_secret is null or v_secret = '' then
    raise exception 'topup not configured';
  end if;

  v_expected := encode(
    hmac(p_tx_hash || ':' || p_amount_raw, v_secret, 'sha256'), 'hex');
  if v_expected <> lower(p_sig) then raise exception 'bad signature'; end if;

  v_amount := (p_amount_raw::numeric / 1000000000000000000.0);
  if v_amount <= 0 then raise exception 'bad amount'; end if;

  insert into public.wallets (user_id, balance_usdt)
  values (v_uid, 0) on conflict (user_id) do nothing;

  -- Ghi transaction TRƯỚC: ref unique chặn nạp trùng 1 giao dịch 2 lần.
  insert into public.transactions (user_id, type, amount_usdt, ref)
  values (v_uid, 'topup', v_amount, v_ref);

  update public.wallets
  set balance_usdt = balance_usdt + v_amount, updated_at = now()
  where user_id = v_uid
  returning balance_usdt into v_bal;

  return v_bal;
exception
  when unique_violation then
    raise exception 'tx already credited';
end;
$$;

-- Hoàn tiền khi panel đặt đơn lỗi sau khi đã trừ (ref 'refund:<order-uuid>').
create or replace function public.refund_wallet(p_amount numeric, p_ref text)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_bal numeric(18, 4);
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'bad amount'; end if;

  insert into public.wallets (user_id, balance_usdt)
  values (v_uid, 0) on conflict (user_id) do nothing;

  insert into public.transactions (user_id, type, amount_usdt, ref)
  values (v_uid, 'refund', p_amount, p_ref);

  update public.wallets
  set balance_usdt = balance_usdt + p_amount, updated_at = now()
  where user_id = v_uid
  returning balance_usdt into v_bal;

  return v_bal;
exception
  when unique_violation then
    -- Hoàn trùng: trả số dư hiện tại, không cộng lần 2.
    select balance_usdt into v_bal from public.wallets where user_id = v_uid;
    return v_bal;
end;
$$;

-- Cho phép authenticated gọi 3 hàm RPC (bản thân hàm tự kiểm tra quyền).
grant execute on function public.deduct_wallet(numeric, text) to authenticated;
grant execute on function public.credit_wallet(text, text, text) to authenticated;
grant execute on function public.refund_wallet(numeric, text) to authenticated;
