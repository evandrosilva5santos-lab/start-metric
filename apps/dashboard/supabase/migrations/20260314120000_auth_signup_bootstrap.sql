-- Auth signup hardening: add phone to profiles and bootstrap org/profile on new user

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS phone TEXT;

CREATE OR REPLACE FUNCTION public.fn_initialize_user_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_org_id UUID;
  derived_name TEXT;
  derived_phone TEXT;
  derived_org_name TEXT;
BEGIN
  derived_name := COALESCE(
    NULLIF(BTRIM(NEW.raw_user_meta_data->>'name'), ''),
    NULLIF(BTRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    split_part(NEW.email, '@', 1)
  );

  derived_phone := NULLIF(BTRIM(NEW.raw_user_meta_data->>'phone'), '');
  derived_org_name := COALESCE(NULLIF(derived_name, ''), 'Minha organizacao');

  SELECT org_id
  INTO target_org_id
  FROM public.profiles
  WHERE id = NEW.id
  LIMIT 1;

  IF target_org_id IS NULL THEN
    INSERT INTO public.organizations (name, plan)
    VALUES (derived_org_name, 'free')
    RETURNING id INTO target_org_id;
  END IF;

  INSERT INTO public.profiles (id, name, phone, org_id, role)
  VALUES (NEW.id, derived_name, derived_phone, target_org_id, 'owner')
  ON CONFLICT (id) DO UPDATE
  SET
    name = COALESCE(public.profiles.name, EXCLUDED.name),
    phone = COALESCE(public.profiles.phone, EXCLUDED.phone),
    org_id = COALESCE(public.profiles.org_id, EXCLUDED.org_id),
    role = COALESCE(public.profiles.role, EXCLUDED.role);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_initialize_user_account ON auth.users;
CREATE TRIGGER trg_initialize_user_account
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.fn_initialize_user_account();
