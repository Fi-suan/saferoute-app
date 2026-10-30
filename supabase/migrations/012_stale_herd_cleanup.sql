-- 012: Auto-deactivate stale manual-mode herds.
--
-- If the owner's app dies while in manual mode (battery, crash, force stop),
-- the herd row stays is_active=true forever and drivers see a phantom herd.
-- This cleanup deactivates manual herds with no location updates for 30 min.
-- The app calls it on every livestock refresh (fire-and-forget).

create or replace function cleanup_stale_manual_herds() returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    -- manual herds whose last location is older than 30 minutes
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
end;
$$;
