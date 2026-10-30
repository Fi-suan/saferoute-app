-- 005: Bind incidents to the route they were reported on.
--
-- Before this, route filtering was purely geometric (bounding boxes),
-- which overlap heavily (e.g. A-1's box spans 43–52° lat and covers
-- most of A-17). Incidents now carry the route selected at report time;
-- legacy rows are backfilled by the same corridor boxes (A-17 first,
-- since it is the demo corridor).

alter table incident_reports
    add column if not exists route_id text;

-- Backfill: first matching corridor wins (order matches app's ROUTE_BOUNDS).
update incident_reports set route_id = 'a17'
 where route_id is null
   and latitude  between 51.0 and 52.5
   and longitude between 71.3 and 77.2;

update incident_reports set route_id = 'a1'
 where route_id is null
   and latitude  between 43.0 and 52.0
   and longitude between 71.0 and 77.5;

update incident_reports set route_id = 'a21'
 where route_id is null
   and latitude  between 50.2 and 52.0
   and longitude between 75.0 and 80.8;

update incident_reports set route_id = 'e40'
 where route_id is null
   and latitude  between 42.0 and 43.2
   and longitude between 69.3 and 71.8;

-- Anything outside all corridors (e.g. GPS abroad): closest default.
update incident_reports set route_id = 'a17' where route_id is null;
