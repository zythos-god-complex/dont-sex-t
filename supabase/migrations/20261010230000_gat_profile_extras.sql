-- Ember's profile asks: an optional profile photo (its own bucket, never purged), optional age and place.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gat-pfp', 'gat-pfp', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 1048576, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

do $do$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'gat pfp upload') then
    create policy "gat pfp upload" on storage.objects for insert to anon, authenticated
      with check (bucket_id = 'gat-pfp' and public.gat_ticket_ok(bucket_id, name));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'gat pfp read') then
    create policy "gat pfp read" on storage.objects for select to anon, authenticated using (bucket_id = 'gat-pfp');
  end if;
end;
$do$;

alter table public.gat_users add column if not exists place text;
alter table public.gat_users add column if not exists show_age boolean not null default false;

do $do$
declare d text;
begin
  -- profile photos: 10 a day
  select pg_get_functiondef('public.gat_upload_ticket(text, text, text)'::regprocedure) into d;
  if position('gat-pfp' in d) = 0 then
    d := replace(d, 'elsif p_bucket = ''gat-voice''', 'elsif p_bucket = ''gat-pfp'' and p_ext in (''jpg'', ''png'', ''webp'') then v_cap := 10;
  elsif p_bucket = ''gat-voice''');
    execute d;
  end if;
  -- age (only when they choose to show it, from the passport) and place on every profile
  select pg_get_functiondef('public.gat_profile_json(gat_users)'::regprocedure) into d;
  if position('''place''' in d) = 0 then
    d := replace(d, '''vip'', u.perks,', '''vip'', u.perks, ''place'', nullif(u.place, ''''), ''show_age'', u.show_age,
    ''age'', case when u.show_age and u.birth_ym is not null then extract(year from age(current_date, u.birth_ym))::int end,');
    execute d;
  end if;
  -- admin can take a photo down
  select pg_get_functiondef('public.gat_admin(text, text, jsonb)'::regprocedure) into d;
  if position('''pfp''' in d) = 0 then
    d := replace(d, '  elsif p_op = ''notice'' then', '  elsif p_op = ''pfp'' then
    update public.gat_users set avatar = avatar - ''photo'' where id = (p_a->>''id'')::uuid returning * into t;
    if not found then raise exception ''not_found'' using errcode = ''P0001''; end if;
    return public.gat_admin_row(t);

  elsif p_op = ''notice'' then');
    execute d;
  end if;
end;
$do$;

create or replace function public.gat_set_about(p_token text, p_place text, p_show_age boolean)
 returns jsonb language plpgsql security definer
 set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  u public.gat_users := public.gat_auth(p_token);
begin
  update public.gat_users
     set place = nullif(left(btrim(regexp_replace(coalesce(p_place, ''), '[[:cntrl:]]+', ' ', 'g')), 30), ''),
         show_age = coalesce(p_show_age, false)
   where id = u.id returning * into u;
  return public.gat_me_json(u);
end;
$function$;

revoke all on function public.gat_set_about(text, text, boolean) from public;
grant execute on function public.gat_set_about(text, text, boolean) to anon, authenticated;
