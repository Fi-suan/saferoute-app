-- 004: created_at was NULL for app-created incidents (no column default).
-- Fix existing rows + add server default, so delivery-time measurement works.

update incident_reports
   set created_at = now()
 where created_at is null;

alter table incident_reports
  alter column created_at set default now();

-- Same protection for other app-written tables
alter table herd_locations alter column timestamp set default now();
alter table devices        alter column last_seen  set default now();
