-- 013: Cleanup stale herds of ANY source, not just manual.
--
-- Problem (found in mega-testing): demo simulator herds from February
-- (last location 8 months old) stayed is_active=true forever — the 012
-- cleanup only covered owner_name='manual'. A herd whose latest location
-- is stale is a phantom: drivers see animals that are long gone.
--
-- TTL: manual herds 30 min (owner's app died), any other source 2 h
-- (GPS collar can be offline longer than a phone, but not for a day).

create or replace function cleanup_stale_manual_herds() returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    -- manual herds: no location updates for 30 minutes
    update herds set is_active = false
    where is_active and owner_name = 'manual'
      and id in (
        select herd_id from herd_latest_locations
        where source = 'manual' and "timestamp" < now() - interval '30 minutes'
      );

    -- manual herds that never got a location and are older than 30 minutes
    update herds set is_active = false
    where is_active and owner_name = 'manual'
      and created_at < now() - interval '30 minutes'
      and not exists (
        select 1 from herd_locations hl where hl.herd_id = herds.id
      );

    -- any other source (simulator, gps, …): latest location older than 2 hours
    update herds set is_active = false
    where is_active and owner_name <> 'manual'
      and id in (
        select herd_id from herd_latest_locations
        where "timestamp" < now() - interval '2 hours'
      );

    -- other-source herds that never received a location and are older than 2 hours
    update herds set is_active = false
    where is_active and owner_name <> 'manual'
      and created_at < now() - interval '2 hours'
      and not exists (
        select 1 from herd_locations hl where hl.herd_id = herds.id
      );
end;
$$;
