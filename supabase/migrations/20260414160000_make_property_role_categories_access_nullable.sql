-- Allow null access payloads for role categories.
alter table public.property_role_categories
  alter column access drop not null;
