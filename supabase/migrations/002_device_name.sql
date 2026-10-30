-- 002: account name on devices (for login-by-phone on onboarding)
alter table devices add column if not exists name varchar(120);
