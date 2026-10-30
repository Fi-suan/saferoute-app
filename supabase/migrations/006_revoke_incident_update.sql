-- 006: Remove public UPDATE on incident_reports.
--
-- The 3-confirmation mechanism is enforced by the confirm_incident RPC
-- (SECURITY DEFINER). A public UPDATE policy let any anonymous client
-- resolve/reactivate/edit any incident directly, bypassing community
-- confirmation entirely. The app never updates incident_rows via
-- PostgREST (only insert/select + RPC), so the policy is pure attack
-- surface.

drop policy if exists "Allow public update incident_reports" on incident_reports;
