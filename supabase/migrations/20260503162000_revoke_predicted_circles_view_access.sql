revoke all on table public.predicted_circles from anon;
revoke all on table public.predicted_circles from authenticated;

grant all on table public.predicted_circles to service_role;
