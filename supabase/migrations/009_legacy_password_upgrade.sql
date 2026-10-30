-- 009: Legacy accounts upgrade their password at first login.
--
-- Accounts created before password hashes existed (pre-003) currently let
-- ANYONE who knows the phone number log in. Instead of a separate "set a
-- password" flow, the password typed at the FIRST login after this migration
-- becomes the account password. The client always sends the hash of the
-- entered password as p_new_password_hash; the RPC ignores it for accounts
-- that already have a password.
-- Also returns has_password so the client can inform the user.
--
-- NOTE: re-applying 007 with a changed signature created overloads
-- (login_device(text, text) and login_device(text, text[])) which made
-- PostgREST fail with "could not choose the best candidate" when the
-- client omits optional args. Drop them; only the 3-arg version stays.

drop function if exists login_device(text, text);
drop function if exists login_device(text, text[]);

create or replace function login_device(
    p_phone text,
    p_password_hashes text[] default null,
    p_new_password_hash text default null
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

    if v_row.password_hash is not null then
        if p_password_hashes is null or not (v_row.password_hash = any(p_password_hashes)) then
            return jsonb_build_object('ok', false, 'reason', 'bad_password');
        end if;
    elsif p_new_password_hash is not null then
        -- legacy account: the password typed now becomes the account password
        update devices set password_hash = p_new_password_hash where id = v_row.id;
    end if;

    update devices set last_seen = now() where id = v_row.id;

    return jsonb_build_object(
        'ok', true,
        'name', coalesce(v_row.name, ''),
        'phone', coalesce(v_row.phone_number, p_phone),
        'role', v_row.role::text,
        'has_password', coalesce(v_row.password_hash, p_new_password_hash) is not null
    );
end;
$$;
