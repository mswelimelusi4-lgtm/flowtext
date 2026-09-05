ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS surname text,
  ADD COLUMN IF NOT EXISTS birthday date,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS gender_custom text;

CREATE OR REPLACE FUNCTION public.enforce_minimum_age()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.birthday IS NOT NULL AND NEW.birthday > (current_date - interval '13 years') THEN
    RAISE EXCEPTION 'Members must be at least 13 years old';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_min_age ON public.profiles;
CREATE TRIGGER profiles_min_age BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_minimum_age();

CREATE OR REPLACE FUNCTION public.enforce_minimum_age_private()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.birthday IS NOT NULL AND NEW.birthday > (current_date - interval '13 years') THEN
    RAISE EXCEPTION 'Members must be at least 13 years old';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profile_private_min_age ON public.profile_private;
CREATE TRIGGER profile_private_min_age BEFORE INSERT OR UPDATE ON public.profile_private
FOR EACH ROW EXECUTE FUNCTION public.enforce_minimum_age_private();

CREATE UNIQUE INDEX IF NOT EXISTS profile_private_phone_unique
  ON public.profile_private (regexp_replace(phone, '[^0-9]', '', 'g'))
  WHERE phone IS NOT NULL AND phone <> '';

REVOKE EXECUTE ON FUNCTION public.enforce_minimum_age() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_minimum_age_private() FROM anon, authenticated;