-- 011: Background push trigger.
--
-- On INSERT of an incident, POST the row to the push-nearby Edge Function
-- so devices within 2 km get a background notification (EAS builds only).

create or replace function notify_push_nearby() returns trigger
language plpgsql
as $$
declare
    -- publishable anon key (public by design — same as in src/config.ts)
    v_anon text := 'sb_publishable_mtjnCty0nl-EXsssgG0BUg_k0wZtT90';
    v_url text := 'https://iqgawigwaempfnwtqovy.supabase.co/functions/v1/push-nearby';
begin
    perform net.http_post(
        url := v_url,
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_anon
        ),
        body := jsonb_build_object('record', to_jsonb(new))
    );
    return new;
end;
$$;

drop trigger if exists trigger_push_nearby on incident_reports;
create trigger trigger_push_nearby
    after insert on incident_reports
    for each row
    execute function notify_push_nearby();
