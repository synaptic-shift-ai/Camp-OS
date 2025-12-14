export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      companies: {
        Row: {
          billing_cycle: string | null
          created_at: string | null
          id: string
          name: string
          onboarding_token: string | null
          onboarding_token_expires_at: string | null
          onboarding_token_used_at: string | null
          owner_id: string
          stripe_customer_id: string | null
          subscription_canceled_at: string | null
          subscription_created_at: string | null
          subscription_id: string | null
          subscription_plan: string | null
          subscription_status: string | null
          updated_at: string | null
        }
        Insert: {
          billing_cycle?: string | null
          created_at?: string | null
          id?: string
          name: string
          onboarding_token?: string | null
          onboarding_token_expires_at?: string | null
          onboarding_token_used_at?: string | null
          owner_id: string
          stripe_customer_id?: string | null
          subscription_canceled_at?: string | null
          subscription_created_at?: string | null
          subscription_id?: string | null
          subscription_plan?: string | null
          subscription_status?: string | null
          updated_at?: string | null
        }
        Update: {
          billing_cycle?: string | null
          created_at?: string | null
          id?: string
          name?: string
          onboarding_token?: string | null
          onboarding_token_expires_at?: string | null
          onboarding_token_used_at?: string | null
          owner_id?: string
          stripe_customer_id?: string | null
          subscription_canceled_at?: string | null
          subscription_created_at?: string | null
          subscription_id?: string | null
          subscription_plan?: string | null
          subscription_status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      guests: {
        Row: {
          address: string | null
          city: string | null
          country: string | null
          created_at: string | null
          email: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          first_name: string
          id: string
          last_name: string
          notes: string | null
          phone: string | null
          property_id: string | null
          state: string | null
          stripe_customer_id: string | null
          updated_at: string | null
          user_id: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          email: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name: string
          id?: string
          last_name: string
          notes?: string | null
          phone?: string | null
          property_id?: string | null
          state?: string | null
          stripe_customer_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          email?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name?: string
          id?: string
          last_name?: string
          notes?: string | null
          phone?: string | null
          property_id?: string | null
          state?: string | null
          stripe_customer_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guests_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_installments: {
        Row: {
          amount_cents: number
          created_at: string | null
          description: string
          due_date: string
          id: string
          installment_number: number
          notes: string | null
          payment_id: string | null
          reminder_sent_at: string[] | null
          reservation_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string | null
          description: string
          due_date: string
          id?: string
          installment_number: number
          notes?: string | null
          payment_id?: string | null
          reminder_sent_at?: string[] | null
          reservation_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string | null
          description?: string
          due_date?: string
          id?: string
          installment_number?: number
          notes?: string | null
          payment_id?: string | null
          reminder_sent_at?: string[] | null
          reservation_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_installments_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_installments_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          notes: string | null
          payment_method: string | null
          payment_status: string | null
          processed_at: string | null
          property_id: string | null
          reservation_id: string | null
          stripe_payment_id: string | null
          transaction_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          payment_status?: string | null
          processed_at?: string | null
          property_id?: string | null
          reservation_id?: string | null
          stripe_payment_id?: string | null
          transaction_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          payment_status?: string | null
          processed_at?: string | null
          property_id?: string | null
          reservation_id?: string | null
          stripe_payment_id?: string | null
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          address: string | null
          amenities: Json | null
          billing_cycle: string | null
          booking_page_description: string | null
          booking_page_slug: string | null
          booking_page_tagline: string | null
          booking_rules_config: Json | null
          brand_color_primary: string | null
          brand_color_secondary: string | null
          cancellation_policy: string | null
          check_in_instructions: string | null
          check_in_time: string | null
          check_out_instructions: string | null
          check_out_time: string | null
          city: string | null
          company_id: string | null
          confirmation_number_config: Json | null
          confirmation_number_sequence: number | null
          country: string | null
          created_at: string | null
          custom_domain: string | null
          deposit_config: Json | null
          description: string | null
          directions: string | null
          email: string | null
          gallery_images: Json | null
          hero_image_url: string | null
          house_rules: string | null
          id: string
          logo_url: string | null
          minimum_stay_nights: number | null
          monthly_booking_quota: number | null
          name: string
          office_hours: string | null
          onboarding_completed: boolean | null
          onboarding_completed_at: string | null
          owner_id: string | null
          phone: string | null
          pricing_config: Json | null
          property_type: string | null
          rate_discounts_config: Json | null
          renewal_settings: Json | null
          settings: Json | null
          site_count: number | null
          slug: string
          special_instructions: string | null
          state: string | null
          status: string | null
          stripe_account_id: string | null
          stripe_connected_at: string | null
          stripe_customer_id: string | null
          subdomain: string | null
          subscription_canceled_at: string | null
          subscription_created_at: string | null
          subscription_id: string | null
          subscription_plan: string | null
          subscription_status: string | null
          timezone: string | null
          updated_at: string | null
          wizard_progress: Json | null
          wizard_step_completed: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          amenities?: Json | null
          billing_cycle?: string | null
          booking_page_description?: string | null
          booking_page_slug?: string | null
          booking_page_tagline?: string | null
          booking_rules_config?: Json | null
          brand_color_primary?: string | null
          brand_color_secondary?: string | null
          cancellation_policy?: string | null
          check_in_instructions?: string | null
          check_in_time?: string | null
          check_out_instructions?: string | null
          check_out_time?: string | null
          city?: string | null
          company_id?: string | null
          confirmation_number_config?: Json | null
          confirmation_number_sequence?: number | null
          country?: string | null
          created_at?: string | null
          custom_domain?: string | null
          deposit_config?: Json | null
          description?: string | null
          directions?: string | null
          email?: string | null
          gallery_images?: Json | null
          hero_image_url?: string | null
          house_rules?: string | null
          id?: string
          logo_url?: string | null
          minimum_stay_nights?: number | null
          monthly_booking_quota?: number | null
          name: string
          office_hours?: string | null
          onboarding_completed?: boolean | null
          onboarding_completed_at?: string | null
          owner_id?: string | null
          phone?: string | null
          pricing_config?: Json | null
          property_type?: string | null
          rate_discounts_config?: Json | null
          renewal_settings?: Json | null
          settings?: Json | null
          site_count?: number | null
          slug: string
          special_instructions?: string | null
          state?: string | null
          status?: string | null
          stripe_account_id?: string | null
          stripe_connected_at?: string | null
          stripe_customer_id?: string | null
          subdomain?: string | null
          subscription_canceled_at?: string | null
          subscription_created_at?: string | null
          subscription_id?: string | null
          subscription_plan?: string | null
          subscription_status?: string | null
          timezone?: string | null
          updated_at?: string | null
          wizard_progress?: Json | null
          wizard_step_completed?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          amenities?: Json | null
          billing_cycle?: string | null
          booking_page_description?: string | null
          booking_page_slug?: string | null
          booking_page_tagline?: string | null
          booking_rules_config?: Json | null
          brand_color_primary?: string | null
          brand_color_secondary?: string | null
          cancellation_policy?: string | null
          check_in_instructions?: string | null
          check_in_time?: string | null
          check_out_instructions?: string | null
          check_out_time?: string | null
          city?: string | null
          company_id?: string | null
          confirmation_number_config?: Json | null
          confirmation_number_sequence?: number | null
          country?: string | null
          created_at?: string | null
          custom_domain?: string | null
          deposit_config?: Json | null
          description?: string | null
          directions?: string | null
          email?: string | null
          gallery_images?: Json | null
          hero_image_url?: string | null
          house_rules?: string | null
          id?: string
          logo_url?: string | null
          minimum_stay_nights?: number | null
          monthly_booking_quota?: number | null
          name?: string
          office_hours?: string | null
          onboarding_completed?: boolean | null
          onboarding_completed_at?: string | null
          owner_id?: string | null
          phone?: string | null
          pricing_config?: Json | null
          property_type?: string | null
          rate_discounts_config?: Json | null
          renewal_settings?: Json | null
          settings?: Json | null
          site_count?: number | null
          slug?: string
          special_instructions?: string | null
          state?: string | null
          status?: string | null
          stripe_account_id?: string | null
          stripe_connected_at?: string | null
          stripe_customer_id?: string | null
          subdomain?: string | null
          subscription_canceled_at?: string | null
          subscription_created_at?: string | null
          subscription_id?: string | null
          subscription_plan?: string | null
          subscription_status?: string | null
          timezone?: string | null
          updated_at?: string | null
          wizard_progress?: Json | null
          wizard_step_completed?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      property_staff: {
        Row: {
          created_at: string | null
          id: string
          permissions: Json | null
          property_id: string | null
          role: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          permissions?: Json | null
          property_id?: string | null
          role?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          permissions?: Json | null
          property_id?: string | null
          role?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_staff_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      reservation_actions: {
        Row: {
          action_details: Json
          action_type: string
          created_at: string | null
          id: string
          new_state: Json | null
          notes: string | null
          payment_id: string | null
          performed_at: string
          performed_by: string | null
          previous_state: Json | null
          price_change_cents: number | null
          reservation_id: string
        }
        Insert: {
          action_details?: Json
          action_type: string
          created_at?: string | null
          id?: string
          new_state?: Json | null
          notes?: string | null
          payment_id?: string | null
          performed_at?: string
          performed_by?: string | null
          previous_state?: Json | null
          price_change_cents?: number | null
          reservation_id: string
        }
        Update: {
          action_details?: Json
          action_type?: string
          created_at?: string | null
          id?: string
          new_state?: Json | null
          notes?: string | null
          payment_id?: string | null
          performed_at?: string
          performed_by?: string | null
          previous_state?: Json | null
          price_change_cents?: number | null
          reservation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservation_actions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_actions_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          balance_paid_at_checkin: number | null
          booking_period: Json | null
          booking_type: string | null
          cancelled_at: string | null
          check_in_date: string
          check_in_notes: string | null
          check_out_date: string
          check_out_notes: string | null
          checked_in_at: string | null
          checked_in_by: string | null
          checked_out_at: string | null
          checked_out_by: string | null
          confirmation_number: string
          created_at: string | null
          damage_inspection_data: Json | null
          equipment_length: number | null
          equipment_type: string | null
          guest_id: string | null
          id: string
          is_extension_of: string | null
          notes: string | null
          num_adults: number | null
          num_children: number | null
          num_pets: number | null
          num_vehicles: number | null
          original_check_in: string | null
          original_check_out: string | null
          paid_amount: number
          parent_reservation_id: string | null
          payment_status: string | null
          property_id: string | null
          renewal_deadline: string | null
          renewal_notes: string | null
          renewal_offered_at: string | null
          renewal_status: string | null
          reserved_until: string | null
          site_id: string | null
          source: string | null
          special_requests: string | null
          status: string | null
          times_extended: number | null
          times_modified: number | null
          total_amount: number
          updated_at: string | null
          vehicle_info: Json | null
        }
        Insert: {
          balance_paid_at_checkin?: number | null
          booking_period?: Json | null
          booking_type?: string | null
          cancelled_at?: string | null
          check_in_date: string
          check_in_notes?: string | null
          check_out_date: string
          check_out_notes?: string | null
          checked_in_at?: string | null
          checked_in_by?: string | null
          checked_out_at?: string | null
          checked_out_by?: string | null
          confirmation_number: string
          created_at?: string | null
          damage_inspection_data?: Json | null
          equipment_length?: number | null
          equipment_type?: string | null
          guest_id?: string | null
          id?: string
          is_extension_of?: string | null
          notes?: string | null
          num_adults?: number | null
          num_children?: number | null
          num_pets?: number | null
          num_vehicles?: number | null
          original_check_in?: string | null
          original_check_out?: string | null
          paid_amount: number
          parent_reservation_id?: string | null
          payment_status?: string | null
          property_id?: string | null
          renewal_deadline?: string | null
          renewal_notes?: string | null
          renewal_offered_at?: string | null
          renewal_status?: string | null
          reserved_until?: string | null
          site_id?: string | null
          source?: string | null
          special_requests?: string | null
          status?: string | null
          times_extended?: number | null
          times_modified?: number | null
          total_amount: number
          updated_at?: string | null
          vehicle_info?: Json | null
        }
        Update: {
          balance_paid_at_checkin?: number | null
          booking_period?: Json | null
          booking_type?: string | null
          cancelled_at?: string | null
          check_in_date?: string
          check_in_notes?: string | null
          check_out_date?: string
          check_out_notes?: string | null
          checked_in_at?: string | null
          checked_in_by?: string | null
          checked_out_at?: string | null
          checked_out_by?: string | null
          confirmation_number?: string
          created_at?: string | null
          damage_inspection_data?: Json | null
          equipment_length?: number | null
          equipment_type?: string | null
          guest_id?: string | null
          id?: string
          is_extension_of?: string | null
          notes?: string | null
          num_adults?: number | null
          num_children?: number | null
          num_pets?: number | null
          num_vehicles?: number | null
          original_check_in?: string | null
          original_check_out?: string | null
          paid_amount?: number
          parent_reservation_id?: string | null
          payment_status?: string | null
          property_id?: string | null
          renewal_deadline?: string | null
          renewal_notes?: string | null
          renewal_offered_at?: string | null
          renewal_status?: string | null
          reserved_until?: string | null
          site_id?: string | null
          source?: string | null
          special_requests?: string | null
          status?: string | null
          times_extended?: number | null
          times_modified?: number | null
          total_amount?: number
          updated_at?: string | null
          vehicle_info?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "reservations_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_is_extension_of_fkey"
            columns: ["is_extension_of"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_parent_reservation_id_fkey"
            columns: ["parent_reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      seasonal_pricing_templates: {
        Row: {
          applies_to_weekends: boolean | null
          created_at: string | null
          created_by: string | null
          description: string | null
          end_date: string
          id: string
          name: string
          price_cents: number
          property_id: string
          recurring_annually: boolean | null
          start_date: string
          updated_at: string | null
        }
        Insert: {
          applies_to_weekends?: boolean | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date: string
          id?: string
          name: string
          price_cents: number
          property_id: string
          recurring_annually?: boolean | null
          start_date: string
          updated_at?: string | null
        }
        Update: {
          applies_to_weekends?: boolean | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date?: string
          id?: string
          name?: string
          price_cents?: number
          property_id?: string
          recurring_annually?: boolean | null
          start_date?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seasonal_pricing_templates_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      site_seasonal_template_applications: {
        Row: {
          applied_at: string | null
          applied_by: string | null
          id: string
          price_override_cents: number | null
          site_id: string
          template_id: string
        }
        Insert: {
          applied_at?: string | null
          applied_by?: string | null
          id?: string
          price_override_cents?: number | null
          site_id: string
          template_id: string
        }
        Update: {
          applied_at?: string | null
          applied_by?: string | null
          id?: string
          price_override_cents?: number | null
          site_id?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_seasonal_template_applications_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_seasonal_template_applications_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "seasonal_pricing_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          accessibility_features: Json | null
          ada_accessible: boolean
          allow_pets: boolean
          amenities: Json | null
          availability_rules: Json | null
          base_price: number
          booking_rules_override: Json | null
          created_at: string | null
          deposit_override: Json | null
          description: string | null
          hookups: Json | null
          id: string
          images: Json | null
          imported_at: string | null
          imported_by: string | null
          location_map: Json | null
          max_occupancy: number | null
          max_vehicles: number | null
          monthly_rate_cents: number | null
          pet_fee: number | null
          pricing_override: Json | null
          property_id: string | null
          seasonal_pricing: Json | null
          site_amenities: Json | null
          site_images: Json | null
          site_name: string | null
          site_number: string
          site_type: string | null
          size_sqft: number | null
          status: string | null
          updated_at: string | null
          weekend_price: number | null
          weekend_price_cents: number | null
          weekly_rate_cents: number | null
        }
        Insert: {
          accessibility_features?: Json | null
          ada_accessible?: boolean
          allow_pets?: boolean
          amenities?: Json | null
          availability_rules?: Json | null
          base_price: number
          booking_rules_override?: Json | null
          created_at?: string | null
          deposit_override?: Json | null
          description?: string | null
          hookups?: Json | null
          id?: string
          images?: Json | null
          imported_at?: string | null
          imported_by?: string | null
          location_map?: Json | null
          max_occupancy?: number | null
          max_vehicles?: number | null
          monthly_rate_cents?: number | null
          pet_fee?: number | null
          pricing_override?: Json | null
          property_id?: string | null
          seasonal_pricing?: Json | null
          site_amenities?: Json | null
          site_images?: Json | null
          site_name?: string | null
          site_number: string
          site_type?: string | null
          size_sqft?: number | null
          status?: string | null
          updated_at?: string | null
          weekend_price?: number | null
          weekend_price_cents?: number | null
          weekly_rate_cents?: number | null
        }
        Update: {
          accessibility_features?: Json | null
          ada_accessible?: boolean
          allow_pets?: boolean
          amenities?: Json | null
          availability_rules?: Json | null
          base_price?: number
          booking_rules_override?: Json | null
          created_at?: string | null
          deposit_override?: Json | null
          description?: string | null
          hookups?: Json | null
          id?: string
          images?: Json | null
          imported_at?: string | null
          imported_by?: string | null
          location_map?: Json | null
          max_occupancy?: number | null
          max_vehicles?: number | null
          monthly_rate_cents?: number | null
          pet_fee?: number | null
          pricing_override?: Json | null
          property_id?: string | null
          seasonal_pricing?: Json | null
          site_amenities?: Json | null
          site_images?: Json | null
          site_name?: string | null
          site_number?: string
          site_type?: string | null
          size_sqft?: number | null
          status?: string | null
          updated_at?: string | null
          weekend_price?: number | null
          weekend_price_cents?: number | null
          weekly_rate_cents?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sites_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_events: {
        Row: {
          company_id: string | null
          created_at: string | null
          event_data: Json | null
          event_type: string
          id: string
          property_id: string | null
          stripe_event_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          property_id?: string | null
          stripe_event_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          property_id?: string | null
          stripe_event_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_events_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_confirmation_number: {
        Args: { property_id_param: string }
        Returns: string
      }
      get_accessible_property_ids: { Args: never; Returns: string[] }
      get_effective_booking_rules: {
        Args: { site_id_param: string }
        Returns: Json
      }
      get_effective_deposit_config: {
        Args: { site_id_param: string }
        Returns: Json
      }
      is_eligible_for_renewal: {
        Args: { reservation_id: string }
        Returns: boolean
      }
      is_property_owner: { Args: { prop_id: string }; Returns: boolean }
      is_property_staff: { Args: { prop_id: string }; Returns: boolean }
      process_stripe_webhook: {
        Args: { p_event_id: string; p_event_type: string; p_payload: Json }
        Returns: boolean
      }
      record_payment: {
        Args: {
          p_amount: number
          p_booking_id: string
          p_payment_method: string
          p_stripe_payment_intent_id?: string
        }
        Returns: string
      }
      search_reservations: {
        Args: {
          limit_param?: number
          offset_param?: number
          property_id_param: string
          search_term: string
        }
        Returns: {
          base_price: number
          check_in_date: string
          check_out_date: string
          confirmation_number: string
          created_at: string
          guest_email: string
          guest_first_name: string
          guest_id: string
          guest_last_name: string
          guest_phone: string
          id: string
          num_adults: number
          num_children: number
          num_pets: number
          paid_amount: number
          payment_status: string
          site_id: string
          site_name: string
          site_number: string
          status: string
          total_amount: number
        }[]
      }
      validate_confirmation_number_config: {
        Args: { config: Json }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
