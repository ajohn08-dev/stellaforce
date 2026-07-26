-- Bug fix: handle_new_user() only inserted (id, email), leaving role null.
-- chk_profiles_side_consistency requires role IS NOT NULL for side='stellaforce'
-- (the default), so the trigger's own insert violated the constraint it must
-- satisfy — meaning NO new Stellaforce-side profile could ever be created,
-- via SQL or the documented Supabase dashboard flow. Default new profiles to
-- the least-privileged role ('recruiter'); an admin elevates via SQL
-- afterward exactly as CLAUDE.md's Auth section already describes.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'recruiter');
  return new;
end;
$function$;
