-- 007: Harden device access (RPC-only) + confirmation rate limit.
--
-- Before: `devices` had a blanket "public all devices" policy — anyone could
-- read every account row (names, phones, password hashes) and modify anyone's
-- device. Login compared password hashes client-side (hash readable by anyone).
--
-- After: all device access goes through SECURITY DEFINER RPCs; the table has
-- no public policies. Password verification happens server-side.
-- Also fixes: notifications.ts fcm-refresh used to null out phone/name
-- (PostgREST upsert overwrites all provided columns); now coalesce semantics.

-- ── 1. Device RPCs ─────────────────────────────────────────────────────────

create or replace function register_device(
    p_device_id text,
    p_role text default 'DRIVER',
    p_name text default null,
    p_password_hash text default null,
    p_fcm_token text default null,
    p_phone_number text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into devices (device_id, role, fcm_token, phone_number, name, password_hash, is_active, last_seen)
    values (
        p_device_id,
        (case when upper(coalesce(p_role, 'DRIVER')) = 'OWNER' then 'OWNER' else 'DRIVER' end)::role,
        p_fcm_token,
        p_phone_number,
        p_name,
        p_password_hash,
        true,
        now()
    )
    on conflict (device_id) do update set
        -- full re-registration: explicit fields win, nulls keep old values
        role         = (case when upper(coalesce(p_role, 'DRIVER')) = 'OWNER' then 'OWNER' else 'DRIVER' end)::role,
        fcm_token    = coalesce(excluded.fcm_token, devices.fcm_token),
        phone_number = coalesce(excluded.phone_number, devices.phone_number),
        name         = coalesce(excluded.name, devices.name),
        password_hash = coalesce(excluded.password_hash, devices.password_hash),
        is_active    = true,
        last_seen    = now();
end;
$$;

create or replace function update_fcm_token(
    p_device_id text,
    p_fcm_token text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    update devices
       set fcm_token = p_fcm_token,
           last_seen = now(),
           is_active = true
     where device_id = p_device_id;
    -- not-found is fine: device registers properly later
end;
$$;

create or replace function touch_device_location(
    p_device_id text,
    p_latitude double precision,
    p_longitude double precision
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into devices (device_id, is_active, last_seen, latitude, longitude)
    values (p_device_id, true, now(), p_latitude, p_longitude)
    on conflict (device_id) do update set
        latitude  = excluded.latitude,
        longitude = excluded.longitude,
        last_seen = now(),
        is_active = true;
end;
$$;

-- Server-side login: hash comparison happens here, hashes are never exposed.
create or replace function login_device(
    p_phone text,
    p_password_hash text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_row devices%rowtype;
begin
    select * into v_row
      from devices
     where phone_number = p_phone
     order by last_seen desc nulls last
     limit 1;

    if v_row.id is null and length(p_phone) >= 10 then
        -- fallback: match by last 10 digits (covers 8… vs +7… entry)
        select * into v_row
          from devices
         where phone_number like '%' || right(p_phone, 10)
         order by last_seen desc nulls last
         limit 1;
    end if;

    if v_row.id is null then
        return jsonb_build_object('ok', false, 'reason', 'not_found');
    end if;

    -- Accounts without a hash are legacy/demo: still allowed in
    if v_row.password_hash is not null then
        if p_password_hash is null or v_row.password_hash <> p_password_hash then
            return jsonb_build_object('ok', false, 'reason', 'bad_password');
        end if;
    end if;

    update devices set last_seen = now() where id = v_row.id;

    return jsonb_build_object(
        'ok', true,
        'name', coalesce(v_row.name, ''),
        'phone', coalesce(v_row.phone_number, p_phone),
        'role', v_row.role::text
    );
end;
$$;

-- ── 2. Close the devices table ─────────────────────────────────────────────

drop policy if exists "public all devices" on devices;

-- ── 3. Confirmation timestamps + rate limit ────────────────────────────────

alter table incident_confirmations
    alter column created_at set default now();

update incident_confirmations set created_at = now() where created_at is null;

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
    -- Rate limit: no device may flood confirmations
    if (
        select count(*) from incident_confirmations
        where device_id = p_device_id
          and created_at > now() - interval '5 minutes'
    ) >= 10 then
        return jsonb_build_object('status', 'rate_limited');
    end if;

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
