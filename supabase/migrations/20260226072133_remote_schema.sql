drop extension if exists "pg_net";

alter table "public"."payments" drop constraint "payments_amount_cents_check";

alter table "public"."reservations" drop constraint "reservations_paid_amount_cents_check";

alter table "public"."reservations" drop constraint "reservations_total_amount_cents_check";

alter table "public"."sites" drop constraint "chk_weekend_price_positive";

alter table "public"."sites" drop constraint "sites_base_price_cents_check";

alter table "public"."sites" drop constraint "sites_weekend_price_cents_check";

alter table "public"."payments" alter column "amount" set default 0;

alter table "public"."reservations" drop column "paid_amount_cents";

alter table "public"."reservations" drop column "total_amount_cents";

alter table "public"."reservations" alter column "paid_amount" set default 0;

alter table "public"."reservations" alter column "paid_amount" set data type integer using "paid_amount"::integer;

alter table "public"."reservations" alter column "total_amount" set data type integer using "total_amount"::integer;

alter table "public"."sites" drop column "weekend_price_cents";

alter table "public"."sites" add column "default_reservation_type" text;

alter table "public"."sites" add constraint "chk_weekend_price_non_negative" CHECK (((weekend_price >= 0) OR (weekend_price IS NULL))) not valid;

alter table "public"."sites" validate constraint "chk_weekend_price_non_negative";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.cleanup_old_api_audit_logs(days_to_keep integer DEFAULT 90)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.api_audit_log
    WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RETURN deleted_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.migrate_legacy_discounts_to_user_defined(p_property_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_discounts_config JSONB;
  v_new_discounts JSONB := '[]'::jsonb;
  v_discount JSONB;
BEGIN
  -- Get current rate discounts config
  SELECT rate_discounts_config INTO v_discounts_config
  FROM properties
  WHERE id = p_property_id;

  IF v_discounts_config IS NULL THEN
    RETURN NULL;
  END IF;

  -- Migrate weekly discount
  IF (v_discounts_config->>'weekly_discount_enabled')::boolean = true
     AND (v_discounts_config->>'weekly_discount_percentage')::numeric > 0 THEN
    v_discount := jsonb_build_object(
      'id', gen_random_uuid(),
      'title', 'Weekly Stay Discount',
      'description', format('%s%% off for stays of %s+ nights',
        v_discounts_config->>'weekly_discount_percentage',
        COALESCE(v_discounts_config->>'weekly_minimum_nights', '7')
      ),
      'discount_type', 'percentage_of_subtotal',
      'value_percentage', (v_discounts_config->>'weekly_discount_percentage')::numeric,
      'trigger_type', 'min_nights',
      'trigger_conditions', jsonb_build_object(
        'min_nights', COALESCE((v_discounts_config->>'weekly_minimum_nights')::int, 7)
      ),
      'display_order', 0,
      'enabled', true,
      'created_at', now()
    );
    v_new_discounts := v_new_discounts || v_discount;
  END IF;

  -- Migrate monthly discount
  IF (v_discounts_config->>'monthly_discount_enabled')::boolean = true
     AND (v_discounts_config->>'monthly_discount_percentage')::numeric > 0 THEN
    v_discount := jsonb_build_object(
      'id', gen_random_uuid(),
      'title', 'Monthly Stay Discount',
      'description', format('%s%% off for stays of %s+ nights',
        v_discounts_config->>'monthly_discount_percentage',
        COALESCE(v_discounts_config->>'monthly_minimum_nights', '28')
      ),
      'discount_type', 'percentage_of_subtotal',
      'value_percentage', (v_discounts_config->>'monthly_discount_percentage')::numeric,
      'trigger_type', 'min_nights',
      'trigger_conditions', jsonb_build_object(
        'min_nights', COALESCE((v_discounts_config->>'monthly_minimum_nights')::int, 28)
      ),
      'display_order', 1,
      'enabled', true,
      'created_at', now()
    );
    v_new_discounts := v_new_discounts || v_discount;
  END IF;

  -- Update the property with migrated discounts
  UPDATE properties
  SET rate_discounts_config = rate_discounts_config || jsonb_build_object('user_defined_discounts', v_new_discounts)
  WHERE id = p_property_id;

  RETURN v_new_discounts;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.migrate_legacy_fees_to_user_defined(p_property_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_pricing_config JSONB;
  v_new_fees JSONB := '[]'::jsonb;
  v_fee JSONB;
BEGIN
  -- Get current pricing config
  SELECT pricing_config INTO v_pricing_config
  FROM properties
  WHERE id = p_property_id;

  IF v_pricing_config IS NULL THEN
    RETURN NULL;
  END IF;

  -- Migrate cleaning fee
  IF (v_pricing_config->>'default_cleaning_fee_cents')::int > 0 THEN
    v_fee := jsonb_build_object(
      'id', gen_random_uuid(),
      'title', 'Cleaning Fee',
      'fee_type', 'flat_amount',
      'value_cents', (v_pricing_config->>'default_cleaning_fee_cents')::int,
      'is_taxable', true,
      'display_order', 0,
      'enabled', true,
      'created_at', now()
    );
    v_new_fees := v_new_fees || v_fee;
  END IF;

  -- Migrate pet fee
  IF (v_pricing_config->>'pet_fee_cents')::int > 0 THEN
    v_fee := jsonb_build_object(
      'id', gen_random_uuid(),
      'title', 'Pet Fee',
      'fee_type', 'flat_amount',
      'value_cents', (v_pricing_config->>'pet_fee_cents')::int,
      'is_taxable', true,
      'display_order', 1,
      'enabled', true,
      'created_at', now()
    );
    v_new_fees := v_new_fees || v_fee;
  END IF;

  -- Migrate extra guest fee
  IF (v_pricing_config->>'extra_guest_fee_enabled')::boolean = true
     AND (v_pricing_config->>'extra_guest_fee_cents')::int > 0 THEN
    v_fee := jsonb_build_object(
      'id', gen_random_uuid(),
      'title', 'Extra Guest Fee',
      'description', format('Per extra guest beyond %s guests, per night', COALESCE(v_pricing_config->>'extra_guest_threshold', '2')),
      'fee_type', 'per_guest_per_night',
      'value_cents', (v_pricing_config->>'extra_guest_fee_cents')::int,
      'is_taxable', true,
      'display_order', 2,
      'enabled', true,
      'created_at', now()
    );
    v_new_fees := v_new_fees || v_fee;
  END IF;

  -- Migrate service fee
  IF v_pricing_config->>'service_fee_type' IS NOT NULL
     AND v_pricing_config->>'service_fee_type' != 'none' THEN

    IF v_pricing_config->>'service_fee_type' = 'percentage' THEN
      v_fee := jsonb_build_object(
        'id', gen_random_uuid(),
        'title', 'Service Fee',
        'fee_type', 'percentage_of_subtotal',
        'value_percentage', (v_pricing_config->>'service_fee_percentage')::numeric,
        'is_taxable', true,
        'display_order', 3,
        'enabled', true,
        'created_at', now()
      );
    ELSIF v_pricing_config->>'service_fee_type' = 'flat' THEN
      v_fee := jsonb_build_object(
        'id', gen_random_uuid(),
        'title', 'Service Fee',
        'fee_type', 'flat_amount',
        'value_cents', (v_pricing_config->>'service_fee_amount_cents')::int,
        'is_taxable', true,
        'display_order', 3,
        'enabled', true,
        'created_at', now()
      );
    ELSIF v_pricing_config->>'service_fee_type' = 'per_night' THEN
      v_fee := jsonb_build_object(
        'id', gen_random_uuid(),
        'title', 'Service Fee',
        'fee_type', 'per_night',
        'value_cents', (v_pricing_config->>'service_fee_amount_cents')::int,
        'is_taxable', true,
        'display_order', 3,
        'enabled', true,
        'created_at', now()
      );
    END IF;

    IF v_fee IS NOT NULL THEN
      v_new_fees := v_new_fees || v_fee;
    END IF;
  END IF;

  -- Update the property with migrated fees
  UPDATE properties
  SET pricing_config = pricing_config || jsonb_build_object('user_defined_fees', v_new_fees)
  WHERE id = p_property_id;

  RETURN v_new_fees;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_guest_vehicles_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_module_licenses_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_seasonal_periods_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $function$
;


