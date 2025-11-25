-- Baseline schema migration
-- This migration creates all existing tables to establish a baseline for the database
-- Generated from production schema on 2025-11-24

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- COMPANIES (no dependencies)
-- ============================================================================
CREATE TABLE companies (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name text NOT NULL,
    owner_id uuid NOT NULL,
    stripe_customer_id text,
    subscription_id text,
    subscription_status text,
    subscription_plan text,
    subscription_created_at timestamp with time zone,
    subscription_canceled_at timestamp with time zone,
    billing_cycle text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    onboarding_token text,
    onboarding_token_expires_at timestamp with time zone,
    onboarding_token_used_at timestamp with time zone,
    PRIMARY KEY (id)
);

-- ============================================================================
-- PROPERTIES (depends on: companies)
-- ============================================================================
CREATE TABLE properties (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    name character varying NOT NULL,
    slug character varying NOT NULL,
    owner_id uuid,
    email character varying,
    phone character varying,
    address text,
    city character varying,
    state character varying,
    zip_code character varying,
    country character varying DEFAULT 'USA'::character varying,
    property_type character varying,
    description text,
    amenities jsonb DEFAULT '[]'::jsonb,
    check_in_time time without time zone DEFAULT '15:00:00'::time without time zone,
    check_out_time time without time zone DEFAULT '11:00:00'::time without time zone,
    timezone character varying DEFAULT 'America/New_York'::character varying,
    status character varying DEFAULT 'active'::character varying,
    settings jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    subdomain character varying,
    stripe_account_id text,
    stripe_connected_at timestamp with time zone,
    booking_page_slug text,
    onboarding_completed boolean DEFAULT false,
    onboarding_completed_at timestamp with time zone,
    stripe_customer_id text,
    subscription_id text,
    subscription_status text,
    subscription_plan text,
    subscription_created_at timestamp with time zone,
    subscription_canceled_at timestamp with time zone,
    billing_cycle text,
    site_count integer,
    monthly_booking_quota integer,
    company_id uuid,
    wizard_step_completed character varying DEFAULT 'not_started'::character varying,
    wizard_progress jsonb DEFAULT '{}'::jsonb,
    hero_image_url text,
    gallery_images jsonb DEFAULT '[]'::jsonb,
    check_in_instructions text,
    check_out_instructions text,
    cancellation_policy text,
    house_rules text,
    booking_page_description text,
    booking_page_tagline text,
    office_hours text,
    minimum_stay_nights integer DEFAULT 1,
    special_instructions text,
    directions text,
    logo_url text,
    brand_color_primary character varying,
    brand_color_secondary character varying,
    custom_domain text,
    renewal_settings jsonb DEFAULT '{"reminder_days_before": [7, 14, 21], "send_renewal_reminders": true, "auto_release_on_decline": true, "renewal_deposit_percentage": 25, "monthly_renewal_window_days": 7, "seasonal_renewal_window_days": 30}'::jsonb,
    deposit_config jsonb DEFAULT '{"deposit_type": "percentage", "require_deposit": false, "deposit_percentage": 25, "deposit_amount_cents": null, "exempt_if_paid_in_full": true, "applies_to_booking_types": ["nightly", "weekly", "monthly", "seasonal", "long_term"], "full_payment_required_days_before": null}'::jsonb,
    pricing_config jsonb DEFAULT '{"tax_name": "Tax", "tax_rate": 0.0, "pet_fee_cents": 2000, "service_fee_type": "none", "extra_guest_fee_cents": 0, "extra_guest_threshold": 2, "service_fee_percentage": 0.0, "extra_guest_fee_enabled": false, "service_fee_amount_cents": null, "default_cleaning_fee_cents": null}'::jsonb,
    booking_rules_config jsonb DEFAULT '{"blackout_dates": [], "max_stay_nights": null, "min_stay_nights": 1, "advance_notice_days": 0, "booking_window_days": 365, "allowed_checkin_days": ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"], "allowed_checkout_days": ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"], "instant_booking_enabled": true, "same_day_booking_enabled": true}'::jsonb,
    rate_discounts_config jsonb DEFAULT '{"weekly_minimum_nights": 7, "monthly_minimum_nights": 28, "weekly_discount_enabled": false, "monthly_discount_enabled": false, "weekly_discount_percentage": 0, "monthly_discount_percentage": 0}'::jsonb,
    confirmation_number_config jsonb DEFAULT '{"format": "{property_code}{separator}{year}{separator}{sequence}", "separator": "-", "year_format": "full", "property_code": "CAMP", "sequence_length": 5}'::jsonb,
    confirmation_number_sequence integer DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT properties_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id)
);

-- ============================================================================
-- SITES (depends on: properties)
-- ============================================================================
CREATE TABLE sites (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    property_id uuid,
    site_number character varying NOT NULL,
    site_name character varying,
    site_type character varying,
    max_occupancy integer DEFAULT 4,
    max_vehicles integer DEFAULT 1,
    size_sqft integer,
    hookups jsonb DEFAULT '[]'::jsonb,
    amenities jsonb DEFAULT '[]'::jsonb,
    status character varying DEFAULT 'available'::character varying,
    description text,
    images jsonb DEFAULT '[]'::jsonb,
    location_map jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    base_price bigint NOT NULL,
    weekend_price bigint,
    weekend_price_cents integer,
    seasonal_pricing jsonb DEFAULT '[]'::jsonb,
    site_amenities jsonb DEFAULT '[]'::jsonb,
    accessibility_features jsonb DEFAULT '[]'::jsonb,
    site_images jsonb DEFAULT '[]'::jsonb,
    availability_rules jsonb DEFAULT '{}'::jsonb,
    imported_at timestamp with time zone,
    imported_by uuid,
    allow_pets boolean NOT NULL DEFAULT false,
    pet_fee integer,
    ada_accessible boolean NOT NULL DEFAULT false,
    deposit_override jsonb,
    booking_rules_override jsonb,
    pricing_override jsonb,
    weekly_rate_cents integer,
    monthly_rate_cents integer,
    PRIMARY KEY (id),
    CONSTRAINT sites_property_id_fkey FOREIGN KEY (property_id) REFERENCES properties(id)
);

-- ============================================================================
-- GUESTS (depends on: properties)
-- ============================================================================
CREATE TABLE guests (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    property_id uuid,
    user_id uuid,
    first_name character varying NOT NULL,
    last_name character varying NOT NULL,
    email character varying NOT NULL,
    phone character varying,
    address text,
    city character varying,
    state character varying,
    zip_code character varying,
    country character varying,
    emergency_contact_name character varying,
    emergency_contact_phone character varying,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    stripe_customer_id text,
    PRIMARY KEY (id),
    CONSTRAINT guests_property_id_fkey FOREIGN KEY (property_id) REFERENCES properties(id)
);

-- ============================================================================
-- RESERVATIONS (depends on: properties, sites, guests)
-- ============================================================================
CREATE TABLE reservations (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    property_id uuid,
    site_id uuid,
    guest_id uuid,
    confirmation_number character varying NOT NULL,
    check_in_date date NOT NULL,
    check_out_date date NOT NULL,
    num_adults integer DEFAULT 1,
    num_children integer DEFAULT 0,
    num_pets integer DEFAULT 0,
    num_vehicles integer DEFAULT 1,
    vehicle_info jsonb DEFAULT '[]'::jsonb,
    status character varying DEFAULT 'pending'::character varying,
    payment_status character varying DEFAULT 'unpaid'::character varying,
    special_requests text,
    notes text,
    source character varying DEFAULT 'direct'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    cancelled_at timestamp with time zone,
    total_amount bigint NOT NULL,
    paid_amount bigint NOT NULL,
    checked_in_at timestamp with time zone,
    checked_in_by uuid,
    balance_paid_at_checkin integer DEFAULT 0,
    check_in_notes text,
    checked_out_at timestamp with time zone,
    checked_out_by uuid,
    damage_inspection_data jsonb,
    check_out_notes text,
    reserved_until timestamp with time zone,
    booking_type character varying DEFAULT 'nightly'::character varying,
    booking_period jsonb,
    parent_reservation_id uuid,
    is_extension_of uuid,
    original_check_in date,
    original_check_out date,
    times_extended integer DEFAULT 0,
    times_modified integer DEFAULT 0,
    renewal_status character varying DEFAULT 'n/a'::character varying,
    renewal_offered_at timestamp with time zone,
    renewal_deadline timestamp with time zone,
    renewal_notes text,
    equipment_type character varying,
    equipment_length integer,
    PRIMARY KEY (id),
    CONSTRAINT reservations_property_id_fkey FOREIGN KEY (property_id) REFERENCES properties(id),
    CONSTRAINT reservations_site_id_fkey FOREIGN KEY (site_id) REFERENCES sites(id),
    CONSTRAINT reservations_guest_id_fkey FOREIGN KEY (guest_id) REFERENCES guests(id),
    CONSTRAINT reservations_parent_reservation_id_fkey FOREIGN KEY (parent_reservation_id) REFERENCES reservations(id),
    CONSTRAINT reservations_is_extension_of_fkey FOREIGN KEY (is_extension_of) REFERENCES reservations(id)
);

-- ============================================================================
-- PAYMENTS (depends on: properties, reservations)
-- ============================================================================
CREATE TABLE payments (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    property_id uuid,
    reservation_id uuid,
    payment_method character varying,
    payment_status character varying DEFAULT 'pending'::character varying,
    stripe_payment_id character varying,
    transaction_id character varying,
    notes text,
    processed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    amount bigint NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT payments_property_id_fkey FOREIGN KEY (property_id) REFERENCES properties(id),
    CONSTRAINT payments_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES reservations(id)
);

-- ============================================================================
-- PROPERTY_STAFF (depends on: properties)
-- ============================================================================
CREATE TABLE property_staff (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    property_id uuid,
    user_id uuid,
    role character varying DEFAULT 'staff'::character varying,
    permissions jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id),
    CONSTRAINT property_staff_property_id_fkey FOREIGN KEY (property_id) REFERENCES properties(id)
);

-- ============================================================================
-- SUBSCRIPTION_EVENTS (depends on: properties, companies)
-- ============================================================================
CREATE TABLE subscription_events (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    property_id uuid,
    event_type text NOT NULL,
    stripe_event_id text,
    event_data jsonb,
    created_at timestamp with time zone DEFAULT now(),
    company_id uuid,
    PRIMARY KEY (id),
    CONSTRAINT subscription_events_property_id_fkey FOREIGN KEY (property_id) REFERENCES properties(id),
    CONSTRAINT subscription_events_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id)
);

-- ============================================================================
-- RESERVATION_ACTIONS (depends on: reservations, payments)
-- ============================================================================
CREATE TABLE reservation_actions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    reservation_id uuid NOT NULL,
    action_type character varying NOT NULL,
    action_details jsonb NOT NULL DEFAULT '{}'::jsonb,
    performed_by uuid,
    performed_at timestamp with time zone NOT NULL DEFAULT now(),
    price_change_cents integer DEFAULT 0,
    payment_id uuid,
    previous_state jsonb,
    new_state jsonb,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id),
    CONSTRAINT reservation_actions_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES reservations(id),
    CONSTRAINT reservation_actions_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES payments(id)
);

-- ============================================================================
-- PAYMENT_INSTALLMENTS (depends on: reservations, payments)
-- ============================================================================
CREATE TABLE payment_installments (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    reservation_id uuid NOT NULL,
    installment_number integer NOT NULL,
    description character varying NOT NULL,
    amount_cents integer NOT NULL,
    due_date date NOT NULL,
    status character varying NOT NULL DEFAULT 'pending'::character varying,
    payment_id uuid,
    notes text,
    reminder_sent_at timestamp with time zone[],
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id),
    CONSTRAINT payment_installments_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES reservations(id),
    CONSTRAINT payment_installments_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES payments(id)
);

-- ============================================================================
-- SEASONAL_PRICING_TEMPLATES (depends on: properties)
-- ============================================================================
CREATE TABLE seasonal_pricing_templates (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    property_id uuid NOT NULL,
    name character varying NOT NULL,
    description text,
    start_date date NOT NULL,
    end_date date NOT NULL,
    price_cents integer NOT NULL,
    applies_to_weekends boolean DEFAULT false,
    recurring_annually boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    PRIMARY KEY (id),
    CONSTRAINT seasonal_pricing_templates_property_id_fkey FOREIGN KEY (property_id) REFERENCES properties(id)
);

-- ============================================================================
-- SITE_SEASONAL_TEMPLATE_APPLICATIONS (depends on: sites, seasonal_pricing_templates)
-- ============================================================================
CREATE TABLE site_seasonal_template_applications (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    site_id uuid NOT NULL,
    template_id uuid NOT NULL,
    price_override_cents integer,
    applied_at timestamp with time zone DEFAULT now(),
    applied_by uuid,
    PRIMARY KEY (id),
    CONSTRAINT site_seasonal_template_applications_site_id_fkey FOREIGN KEY (site_id) REFERENCES sites(id),
    CONSTRAINT site_seasonal_template_applications_template_id_fkey FOREIGN KEY (template_id) REFERENCES seasonal_pricing_templates(id)
);
