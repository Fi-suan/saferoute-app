-- SafeRoute / Sapa Zhol — Supabase backend migration
-- Turns the cloud Postgres (previously used by FastAPI) into the app's
-- only backend: RLS, realtime publication, RPCs, views, demo alert seed.
-- Idempotent: safe to re-run.

-- ── 1. Row Level Security ────────────────────────────────────────────────────
alter table devices enable row level security;
alter table herd_locations enable row level security;
alter table incident_confirmations enable row level security;
alter table alerts enable row level security;

drop policy if exists "public read herd_locations" on herd_locations;
create policy "public read herd_locations" on herd_locations for select using (true);
drop policy if exists "public insert herd_locations" on herd_locations;
create policy "public insert herd_locations" on herd_locations for insert with check (true);

drop policy if exists "public read incident_confirmations" on incident_confirmations;
create policy "public read incident_confirmations" on incident_confirmations for select using (true);

drop policy if exists "public read alerts" on alerts;
create policy "public read alerts" on alerts for select using (true);

-- Devices: register / update own location / upsert by device_id (demo: anon)
drop policy if exists "public all devices" on devices;
create policy "public all devices" on devices for all using (true) with check (true);

-- Herds: owners create herds in manual mode and deactivate them
drop policy if exists "public insert herds" on herds;
create policy "public insert herds" on herds for insert with check (true);
drop policy if exists "public update herds" on herds;
create policy "public update herds" on herds for update using (true) with check (true);

-- ── 2. Realtime publication ─────────────────────────────────────────────────
alter publication supabase_realtime add table herds;
alter publication supabase_realtime add table herd_locations;
alter publication supabase_realtime add table alerts;
alter publication supabase_realtime add table devices;
alter publication supabase_realtime add table incident_confirmations;

-- ── 3. View: latest location per herd (fixes N+1 for getHerds) ───────────────
create or replace view herd_latest_locations as
select distinct on (herd_id)
    herd_id, latitude, longitude, speed_kmh, heading_degrees, timestamp, source
from herd_locations
order by herd_id, timestamp desc;

-- ── 4. RPC: atomic incident confirmation + auto-resolve ─────────────────────
create or replace function confirm_incident(
    p_incident_id integer,
    p_device_id text,
    p_is_resolved boolean default true
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_count integer;
    v_active boolean := true;
begin
    begin
        insert into incident_confirmations (incident_id, device_id, is_resolved)
        values (p_incident_id, p_device_id, p_is_resolved);
    exception when unique_violation then
        return jsonb_build_object('status', 'already_confirmed');
    end;

    update incident_reports
       set confirmations_count = confirmations_count + 1
     where id = p_incident_id
    returning confirmations_count into v_count;

    if p_is_resolved and v_count >= 3 then
        update incident_reports
           set is_active = false, resolved_at = now()
         where id = p_incident_id;
        v_active := false;
    end if;

    return jsonb_build_object('status', 'ok', 'confirmations', v_count, 'is_active', v_active);
end;
$$;

-- ── 5. RPC: GDPR delete all user data ───────────────────────────────────────
create or replace function delete_user_data(p_device_id text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_reports integer;
    v_confirmations integer;
    v_devices integer;
begin
    delete from incident_confirmations where device_id = p_device_id;
    get diagnostics v_confirmations = row_count;
    delete from incident_reports where reporter_device_id = p_device_id;
    get diagnostics v_reports = row_count;
    delete from devices where device_id = p_device_id;
    get diagnostics v_devices = row_count;
    return jsonb_build_object(
        'status', 'ok',
        'deleted', jsonb_build_object(
            'reports', v_reports,
            'confirmations', v_confirmations,
            'devices', v_devices
        )
    );
end;
$$;

-- ── 6. Seed demo alerts (AlertsScreen was empty) ─────────────────────────────
insert into alerts (herd_id, geozone_id, level, message_ru, message_kk,
                    distance_to_road_km, estimated_arrival_minutes,
                    is_active, notified_count, created_at)
select h.id,
       g.id,
       lvl,
       'Внимание: ' || h.name || ' обнаружена рядом с трассой «'
           || split_part(g.name, ' ', 2) || '». Снизьте скорость!',
       'Назар аударыңыз: ' || h.name || ' «' || split_part(g.name, ' ', 2)
           || '» тас жолының жанында байқалды. Жылдамдықты азайтыңыз!',
       dist, eta, true, 12, now() - (i || ' minutes')::interval
from (values
    (1, 6, 'HIGH'::alertlevel, 1.8, 7, 5),
    (2, 6, 'CRITICAL'::alertlevel, 0.9, 4, 12),
    (3, 8, 'MEDIUM'::alertlevel, 3.4, 15, 21),
    (4, 5, 'LOW'::alertlevel, 4.6, 22, 34)
) as seed(h, gz, lvl, dist, eta, i)
join herds h on h.id = seed.h
join geozones g on g.id = seed.gz
where not exists (select 1 from alerts a where a.herd_id = seed.h);
