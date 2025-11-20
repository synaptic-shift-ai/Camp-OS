/**
 * Supabase Database Types
 *
 * Complete type definitions based on database migrations.
 * Generated manually from migration files until Supabase project is linked.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      reservations: {
        Row: {
          id: string
          property_id: string
          site_id: string
          guest_id: string
          check_in_date: string
          check_out_date: string
          num_adults: number
          num_children: number
          num_pets: number
          num_vehicles: number
          total_amount_cents: number
          paid_amount_cents: number
          balance_paid_at_check_in_cents: number
          refund_amount_cents: number
          status: 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'completed' | 'cancelled' | 'no_show'
          payment_status: 'pending' | 'partial' | 'paid' | 'refunded'
          confirmation_number: string
          special_requests: string | null
          checked_in_at: string | null
          checked_in_by: string | null
          check_in_notes: string | null
          checked_out_at: string | null
          checked_out_by: string | null
          has_damages: boolean
          check_out_notes: string | null
          cancelled_at: string | null
          cancellation_reason: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['reservations']['Row']>
        Update: Partial<Database['public']['Tables']['reservations']['Row']>
      }

      guests: {
        Row: {
          id: string
          property_id: string
          user_id: string | null
          first_name: string
          last_name: string
          email: string
          phone: string | null
          address: Json | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          stripe_customer_id: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['guests']['Row']>
        Update: Partial<Database['public']['Tables']['guests']['Row']>
      }

      properties: {
        Row: {
          id: string
          company_id: string
          name: string
          slug: string
          property_type: string | null
          description: string | null
          address: Json | null
          phone: string | null
          email: string | null
          website: string | null
          check_in_time: string | null
          check_out_time: string | null
          stripe_account_id: string | null
          stripe_connected_at: string | null
          onboarding_completed: boolean
          onboarding_step: string | null
          status: string
          property_code: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['properties']['Row']>
        Update: Partial<Database['public']['Tables']['properties']['Row']>
      }

      sites: {
        Row: {
          id: string
          property_id: string
          site_number: string
          site_name: string | null
          site_type: 'tent' | 'rv' | 'cabin' | 'glamping' | 'yurt' | 'other'
          description: string | null
          max_occupancy: number
          nightly_rate_cents: number
          base_price: number | null
          weekend_price_cents: number | null
          seasonal_pricing: Json | null
          size_sqft: number | null
          hookups: Json | null
          amenities: Json | null
          site_amenities: Json | null
          accessibility_features: Json | null
          site_images: Json | null
          availability_rules: Json | null
          allow_pets: boolean
          pet_fee: number | null
          ada_accessible: boolean
          status: string
          import_id: string | null
          import_batch_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['sites']['Row']>
        Update: Partial<Database['public']['Tables']['sites']['Row']>
      }

      companies: {
        Row: {
          id: string
          owner_id: string
          name: string
          email: string | null
          phone: string | null
          website: string | null
          subscription_status: string | null
          subscription_tier: string | null
          trial_ends_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['companies']['Row']>
        Update: Partial<Database['public']['Tables']['companies']['Row']>
      }

      payments: {
        Row: {
          id: string
          reservation_id: string
          amount_cents: number
          payment_method: string
          stripe_payment_intent_id: string | null
          status: string
          processed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['payments']['Row']>
        Update: Partial<Database['public']['Tables']['payments']['Row']>
      }

      financial_transactions: {
        Row: {
          id: string
          property_id: string
          reservation_id: string | null
          invoice_id: string | null
          type: 'payment' | 'refund' | 'deposit' | 'deposit_release' | 'deposit_deduction' | 'expense' | 'platform_fee' | 'payout'
          amount_cents: number
          currency: string
          payment_method: string
          stripe_payment_intent_id: string | null
          stripe_refund_id: string | null
          status: 'pending' | 'completed' | 'failed' | 'cancelled'
          processed_at: string | null
          failure_reason: string | null
          notes: string | null
          reconciled_at: string | null
          reconciled_by: string | null
          created_at: string
          created_by: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['financial_transactions']['Row']>
        Update: Partial<Database['public']['Tables']['financial_transactions']['Row']>
      }

      financial_invoices: {
        Row: {
          id: string
          property_id: string
          reservation_id: string
          invoice_number: string
          subtotal_cents: number
          tax_cents: number
          total_cents: number
          paid_cents: number
          line_items: Json
          is_installment: boolean
          installment_number: number | null
          installment_total: number | null
          due_date: string
          status: 'draft' | 'issued' | 'paid' | 'overdue' | 'cancelled'
          tax_rate: number
          issued_at: string | null
          paid_at: string | null
          cancelled_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['financial_invoices']['Row']>
        Update: Partial<Database['public']['Tables']['financial_invoices']['Row']>
      }

      financial_payment_plans: {
        Row: {
          id: string
          property_id: string
          reservation_id: string
          total_amount_cents: number
          number_of_installments: number
          installment_interval_days: number
          start_date: string
          invoice_ids: Json
          status: 'active' | 'completed' | 'cancelled' | 'defaulted'
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['financial_payment_plans']['Row']>
        Update: Partial<Database['public']['Tables']['financial_payment_plans']['Row']>
      }

      financial_security_deposits: {
        Row: {
          id: string
          property_id: string
          reservation_id: string
          deposit_amount_cents: number
          deductions_cents: number
          released_amount_cents: number
          status: 'held' | 'partially_released' | 'fully_released' | 'forfeited'
          stripe_payment_intent_id: string | null
          held_at: string
          released_at: string | null
          forfeited_at: string | null
          deductions: Json
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['financial_security_deposits']['Row']>
        Update: Partial<Database['public']['Tables']['financial_security_deposits']['Row']>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
