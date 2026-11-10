-- ============================================================
-- SRKSH — WhatsApp Notifications, Captain Contacts & API Migration
-- Adds captain phone number to teams, WhatsApp group link to site_settings,
-- creates public.whatsapp_recipients for broadcast distribution,
-- and creates public.whatsapp_api_settings for automated API delivery.
-- Run this in Supabase SQL Editor.
-- ============================================================

-- 1. Captain phone number on teams
alter table public.teams
  add column if not exists captain_phone text;

-- 2. Official WhatsApp group and optional default sender phone on site_settings
alter table public.site_settings
  add column if not exists whatsapp_group_url text,
  add column if not exists whatsapp_sender_phone text;

-- 3. Dedicated table for WhatsApp broadcast notification recipients (admins, wardens, coordinators)
create table if not exists public.whatsapp_recipients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  role text default 'Coordinator',
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.whatsapp_recipients enable row level security;

-- Read policy: authenticated admins or fallback
drop policy if exists "admin read whatsapp_recipients" on public.whatsapp_recipients;
create policy "admin read whatsapp_recipients" on public.whatsapp_recipients
  for select using (true);

drop policy if exists "admin write whatsapp_recipients" on public.whatsapp_recipients;
create policy "admin write whatsapp_recipients" on public.whatsapp_recipients
  for all using (public.is_admin()) with check (public.is_admin());

-- Grants
grant select on public.whatsapp_recipients to anon, authenticated;
grant all on public.whatsapp_recipients to authenticated;

-- 4. WhatsApp API Settings (Meta Cloud API, UltraMsg, or Webhook)
create table if not exists public.whatsapp_api_settings (
  id int primary key default 1 check (id = 1),
  provider text not null default 'none',
  phone_number_id text,
  access_token text,
  webhook_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.whatsapp_api_settings enable row level security;

-- Only authenticated admins can read/write API credentials (never exposed to public anon)
drop policy if exists "admin read whatsapp_api_settings" on public.whatsapp_api_settings;
create policy "admin read whatsapp_api_settings" on public.whatsapp_api_settings
  for select using (public.is_admin());

drop policy if exists "admin write whatsapp_api_settings" on public.whatsapp_api_settings;
create policy "admin write whatsapp_api_settings" on public.whatsapp_api_settings
  for all using (public.is_admin()) with check (public.is_admin());

grant all on public.whatsapp_api_settings to authenticated;
