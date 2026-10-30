-- 003: account passwords (demo-grade SHA-256 hash stored client-side)
alter table devices add column if not exists password_hash text;
