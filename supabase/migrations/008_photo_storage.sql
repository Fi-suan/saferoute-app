-- 008: Photo storage for incident reports.
--
-- Before: photos stayed local-only (photo_base64 never reached the server —
-- submitIncidentReport had no photo field at all). Now photos are uploaded to
-- a public bucket and incidents reference a public URL.
--
-- Threat model: public READ is intended (community verification needs to see
-- the photo). Public INSERT is required for anon reports; path is namespaced
-- by device_id, and UPDATE/DELETE stay closed to clients.

insert into storage.buckets (id, name, public)
values ('incident-photos', 'incident-photos', true)
on conflict (id) do nothing;

drop policy if exists "Public read incident photos" on storage.objects;
create policy "Public read incident photos" on storage.objects
    for select using (bucket_id = 'incident-photos');

drop policy if exists "Public upload incident photos" on storage.objects;
create policy "Public upload incident photos" on storage.objects
    for insert with check (bucket_id = 'incident-photos');
