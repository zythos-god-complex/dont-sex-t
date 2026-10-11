-- the admin can let a user make voice calls (to friends who can call too). additive only.
alter table public.gat_users add column if not exists can_call boolean not null default false;

do $$
declare d text;
begin
  d := pg_get_functiondef('public.gat_profile_json'::regproc);
  if position('can_call' in d) = 0 then
    d := replace(d, '''admin'', u.is_admin' || chr(10) || '  ) end;', '''admin'', u.is_admin, ''can_call'', u.can_call' || chr(10) || '  ) end;');
    execute d;
  end if;
  d := pg_get_functiondef('public.gat_admin'::regproc);
  if position('''calls''' in d) = 0 then
    d := replace(d, '  elsif p_op = ''photos'' then', '  elsif p_op = ''calls'' then
    update public.gat_users set can_call = coalesce((p_a->>''on'')::boolean, false) where id = (p_a->>''id'')::uuid returning * into t;
    if not found then raise exception ''not_found'' using errcode = ''P0001''; end if;
    return public.gat_admin_row(t);

  elsif p_op = ''photos'' then');
    execute d;
  end if;
end $$;
