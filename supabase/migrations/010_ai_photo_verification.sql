-- 010: AI photo verification trigger.
--
-- On INSERT of an incident with a photo, POST the row to the verify-photo
-- Edge Function (pg_net is async — the insert is never blocked).

create extension if not exists pg_net;

create or replace function notify_verify_photo() returns trigger
language plpgsql
as $$
declare
    v_url text := 'https://iqgawigwaempfnwtqovy.supabase.co/functions/v1/verify-photo';
    -- publishable anon key (public by design — same as in src/config.ts)
    v_anon text := 'sb_publishable_mtjnCty0nl-EXsssgG0BUg_k0wZtT90';
begin
    if new.photo_url is not null then
        perform net.http_post(
            url := v_url,
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || v_anon
            ),
            body := jsonb_build_object('record', to_jsonb(new))
        );
    end if;
    return new;
end;
$$;

drop trigger if exists trigger_verify_photo on incident_reports;
create trigger trigger_verify_photo
    after insert on incident_reports
    for each row
    execute function notify_verify_photo();
