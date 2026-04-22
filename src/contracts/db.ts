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
      activity_log: {
        Row: {
          action: string
          company_id: string
          created_at: string
          details: string | null
          id: string
          property_id: string | null
          resource: string
          user_id: string | null
        }
        Insert: {
          action: string
          company_id: string
          created_at?: string
          details?: string | null
          id?: string
          property_id?: string | null
          resource: string
          user_id?: string | null
        }
        Update: {
          action?: string
          company_id?: string
          created_at?: string
          details?: string | null
          id?: string
          property_id?: string | null
          resource?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      api_audit_log: {
        Row: {
          api_version: string | null
          company_id: string | null
          created_at: string
          duration_ms: number | null
          error_code: string | null
          id: string
          ip_address: unknown
          method: string
          path: string
          property_id: string | null
          query_params: Json | null
          request_body: Json | null
          request_headers: Json | null
          request_id: string
          response_body: Json | null
          status_code: number
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          api_version?: string | null
          company_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          id?: string
          ip_address?: unknown
          method: string
          path: string
          property_id?: string | null
          query_params?: Json | null
          request_body?: Json | null
          request_headers?: Json | null
          request_id: string
          response_body?: Json | null
          status_code: number
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          api_version?: string | null
          company_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          id?: string
          ip_address?: unknown
          method?: string
          path?: string
          property_id?: string | null
          query_params?: Json | null
          request_body?: Json | null
          request_headers?: Json | null
          request_id?: string
          response_body?: Json | null
          status_code?: number
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_audit_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_audit_log_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_actions: {
        Row: {
          action_config: Json
          action_type: string
          automation_id: string
          branch_id: string | null
          created_at: string
          delay_unit: string | null
          delay_value: number | null
          id: string
          sort_order: number
        }
        Insert: {
          action_config?: Json
          action_type: string
          automation_id: string
          branch_id?: string | null
          created_at?: string
          delay_unit?: string | null
          delay_value?: number | null
          id?: string
          sort_order?: number
        }
        Update: {
          action_config?: Json
          action_type?: string
          automation_id?: string
          branch_id?: string | null
          created_at?: string
          delay_unit?: string | null
          delay_value?: number | null
          id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "automation_actions_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_actions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "automation_branches"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_branches: {
        Row: {
          automation_id: string
          branch_type: string
          created_at: string
          id: string
          parent_action_id: string
        }
        Insert: {
          automation_id: string
          branch_type: string
          created_at?: string
          id?: string
          parent_action_id: string
        }
        Update: {
          automation_id?: string
          branch_type?: string
          created_at?: string
          id?: string
          parent_action_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_branches_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_branches_parent_action_id_fkey"
            columns: ["parent_action_id"]
            isOneToOne: false
            referencedRelation: "automation_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_condition_groups: {
        Row: {
          automation_id: string
          created_at: string
          id: string
          logic_operator: string
          parent_group_id: string | null
          sort_order: number
        }
        Insert: {
          automation_id: string
          created_at?: string
          id?: string
          logic_operator: string
          parent_group_id?: string | null
          sort_order?: number
        }
        Update: {
          automation_id?: string
          created_at?: string
          id?: string
          logic_operator?: string
          parent_group_id?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "automation_condition_groups_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_condition_groups_parent_group_id_fkey"
            columns: ["parent_group_id"]
            isOneToOne: false
            referencedRelation: "automation_condition_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_conditions: {
        Row: {
          automation_id: string
          created_at: string
          group_id: string
          id: string
          operator: string
          sort_order: number
          value: Json
          variable: string
        }
        Insert: {
          automation_id: string
          created_at?: string
          group_id: string
          id?: string
          operator: string
          sort_order?: number
          value: Json
          variable: string
        }
        Update: {
          automation_id?: string
          created_at?: string
          group_id?: string
          id?: string
          operator?: string
          sort_order?: number
          value?: Json
          variable?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_conditions_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_conditions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "automation_condition_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_execution_log: {
        Row: {
          actions_executed: Json
          automation_id: string | null
          company_id: string
          conditions_passed: boolean | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          event_type: string
          execution_duration_ms: number | null
          id: string
          property_id: string | null
          skipped_reason: string | null
        }
        Insert: {
          actions_executed?: Json
          automation_id?: string | null
          company_id: string
          conditions_passed?: boolean | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type: string
          execution_duration_ms?: number | null
          id?: string
          property_id?: string | null
          skipped_reason?: string | null
        }
        Update: {
          actions_executed?: Json
          automation_id?: string | null
          company_id?: string
          conditions_passed?: boolean | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string
          execution_duration_ms?: number | null
          id?: string
          property_id?: string | null
          skipped_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_execution_log_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_execution_log_tenant_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      automations: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_terminal: boolean
          name: string
          phase: string
          property_id: string | null
          scope: string
          sort_order: number
          trigger_config: Json
          trigger_type: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_terminal?: boolean
          name: string
          phase: string
          property_id?: string | null
          scope?: string
          sort_order?: number
          trigger_config?: Json
          trigger_type: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_terminal?: boolean
          name?: string
          phase?: string
          property_id?: string | null
          scope?: string
          sort_order?: number
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automations_tenant_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          item: Json
          name: string
          property_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          item?: Json
          name: string
          property_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          item?: Json
          name?: string
          property_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          billing_cycle: string | null
          company_logo_url: string | null
          created_at: string | null
          id: string
          name: string
          onboarding_completed: boolean
          onboarding_step: string | null
          onboarding_token: string | null
          onboarding_token_expires_at: string | null
          onboarding_token_used_at: string | null
          owner_id: string
          quick_tour_completed: boolean
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
          company_logo_url?: string | null
          created_at?: string | null
          id?: string
          name: string
          onboarding_completed?: boolean
          onboarding_step?: string | null
          onboarding_token?: string | null
          onboarding_token_expires_at?: string | null
          onboarding_token_used_at?: string | null
          owner_id: string
          quick_tour_completed?: boolean
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
          company_logo_url?: string | null
          created_at?: string | null
          id?: string
          name?: string
          onboarding_completed?: boolean
          onboarding_step?: string | null
          onboarding_token?: string | null
          onboarding_token_expires_at?: string | null
          onboarding_token_used_at?: string | null
          owner_id?: string
          quick_tour_completed?: boolean
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
      email_templates: {
        Row: {
          category: string
          company_id: string
          created_at: string
          description: string | null
          html_template: string
          id: string
          is_active: boolean
          is_system_default: boolean
          name: string
          property_id: string | null
          slug: string
          subject_template: string
          updated_at: string
        }
        Insert: {
          category?: string
          company_id: string
          created_at?: string
          description?: string | null
          html_template?: string
          id?: string
          is_active?: boolean
          is_system_default?: boolean
          name: string
          property_id?: string | null
          slug: string
          subject_template?: string
          updated_at?: string
        }
        Update: {
          category?: string
          company_id?: string
          created_at?: string
          description?: string | null
          html_template?: string
          id?: string
          is_active?: boolean
          is_system_default?: boolean
          name?: string
          property_id?: string | null
          slug?: string
          subject_template?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_templates_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      event_store: {
        Row: {
          aggregate_id: string
          aggregate_type: string
          created_at: string
          event_data: Json
          event_id: string
          event_type: string
          id: string
          metadata: Json | null
          occurred_at: string
        }
        Insert: {
          aggregate_id: string
          aggregate_type: string
          created_at?: string
          event_data: Json
          event_id: string
          event_type: string
          id?: string
          metadata?: Json | null
          occurred_at?: string
        }
        Update: {
          aggregate_id?: string
          aggregate_type?: string
          created_at?: string
          event_data?: Json
          event_id?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          occurred_at?: string
        }
        Relationships: []
      }
      financial_invoices: {
        Row: {
          cancelled_at: string | null
          created_at: string
          due_date: string
          id: string
          installment_number: number | null
          installment_total: number | null
          invoice_number: string
          is_installment: boolean
          issued_at: string | null
          line_items: Json
          paid_at: string | null
          paid_cents: number
          property_id: string
          reservation_id: string
          status: string
          subtotal_cents: number
          tax_cents: number
          tax_rate: number
          total_cents: number
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          due_date: string
          id?: string
          installment_number?: number | null
          installment_total?: number | null
          invoice_number: string
          is_installment?: boolean
          issued_at?: string | null
          line_items: Json
          paid_at?: string | null
          paid_cents?: number
          property_id: string
          reservation_id: string
          status?: string
          subtotal_cents: number
          tax_cents: number
          tax_rate: number
          total_cents: number
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          due_date?: string
          id?: string
          installment_number?: number | null
          installment_total?: number | null
          invoice_number?: string
          is_installment?: boolean
          issued_at?: string | null
          line_items?: Json
          paid_at?: string | null
          paid_cents?: number
          property_id?: string
          reservation_id?: string
          status?: string
          subtotal_cents?: number
          tax_cents?: number
          tax_rate?: number
          total_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_invoices_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_invoices_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_payment_plans: {
        Row: {
          created_at: string
          id: string
          installment_interval_days: number
          invoice_ids: Json
          number_of_installments: number
          property_id: string
          reservation_id: string
          start_date: string
          status: string
          total_amount_cents: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          installment_interval_days: number
          invoice_ids?: Json
          number_of_installments: number
          property_id: string
          reservation_id: string
          start_date: string
          status?: string
          total_amount_cents: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          installment_interval_days?: number
          invoice_ids?: Json
          number_of_installments?: number
          property_id?: string
          reservation_id?: string
          start_date?: string
          status?: string
          total_amount_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_payment_plans_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_payment_plans_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: true
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_security_deposits: {
        Row: {
          created_at: string
          deductions: Json
          deductions_cents: number
          deposit_amount_cents: number
          forfeited_at: string | null
          held_at: string
          id: string
          property_id: string
          released_amount_cents: number
          released_at: string | null
          reservation_id: string
          status: string
          stripe_payment_intent_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deductions?: Json
          deductions_cents?: number
          deposit_amount_cents: number
          forfeited_at?: string | null
          held_at: string
          id?: string
          property_id: string
          released_amount_cents?: number
          released_at?: string | null
          reservation_id: string
          status?: string
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deductions?: Json
          deductions_cents?: number
          deposit_amount_cents?: number
          forfeited_at?: string | null
          held_at?: string
          id?: string
          property_id?: string
          released_amount_cents?: number
          released_at?: string | null
          reservation_id?: string
          status?: string
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_security_deposits_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_security_deposits_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: true
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_transactions: {
        Row: {
          amount_cents: number
          created_at: string
          created_by: string
          currency: string
          failure_reason: string | null
          id: string
          invoice_id: string | null
          notes: string | null
          payment_method: string
          processed_at: string | null
          property_id: string
          reconciled_at: string | null
          reconciled_by: string | null
          reservation_id: string | null
          status: string
          stripe_payment_intent_id: string | null
          stripe_refund_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          created_by: string
          currency?: string
          failure_reason?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          payment_method: string
          processed_at?: string | null
          property_id: string
          reconciled_at?: string | null
          reconciled_by?: string | null
          reservation_id?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_refund_id?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          created_by?: string
          currency?: string
          failure_reason?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          payment_method?: string
          processed_at?: string | null
          property_id?: string
          reconciled_at?: string | null
          reconciled_by?: string | null
          reservation_id?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_refund_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "financial_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_vehicles: {
        Row: {
          color: string | null
          created_at: string
          guest_id: string
          id: string
          insurance_company: string | null
          insurance_policy_number: string | null
          is_primary: boolean | null
          license_plate: string | null
          license_plate_state: string | null
          make: string | null
          model: string | null
          num_slide_outs: number | null
          personal_vehicle_type: string | null
          property_id: string
          rv_length_feet: number | null
          rv_type: string | null
          rv_width_feet: number | null
          updated_at: string
          vehicle_type: string
          year: number | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          guest_id: string
          id?: string
          insurance_company?: string | null
          insurance_policy_number?: string | null
          is_primary?: boolean | null
          license_plate?: string | null
          license_plate_state?: string | null
          make?: string | null
          model?: string | null
          num_slide_outs?: number | null
          personal_vehicle_type?: string | null
          property_id: string
          rv_length_feet?: number | null
          rv_type?: string | null
          rv_width_feet?: number | null
          updated_at?: string
          vehicle_type: string
          year?: number | null
        }
        Update: {
          color?: string | null
          created_at?: string
          guest_id?: string
          id?: string
          insurance_company?: string | null
          insurance_policy_number?: string | null
          is_primary?: boolean | null
          license_plate?: string | null
          license_plate_state?: string | null
          make?: string | null
          model?: string | null
          num_slide_outs?: number | null
          personal_vehicle_type?: string | null
          property_id?: string
          rv_length_feet?: number | null
          rv_type?: string | null
          rv_width_feet?: number | null
          updated_at?: string
          vehicle_type?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "guest_vehicles_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_vehicles_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      guests: {
        Row: {
          address: string | null
          city: string | null
          country: string | null
          created_at: string | null
          deleted_at: string | null
          email: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          first_name: string
          id: string
          last_name: string
          notes: string | null
          phone: string | null
          property_id: string | null
          spouse_email: string | null
          spouse_first_name: string | null
          spouse_is_alternate_contact: boolean | null
          spouse_last_name: string | null
          spouse_phone: string | null
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
          deleted_at?: string | null
          email: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name: string
          id?: string
          last_name: string
          notes?: string | null
          phone?: string | null
          property_id?: string | null
          spouse_email?: string | null
          spouse_first_name?: string | null
          spouse_is_alternate_contact?: boolean | null
          spouse_last_name?: string | null
          spouse_phone?: string | null
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
          deleted_at?: string | null
          email?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name?: string
          id?: string
          last_name?: string
          notes?: string | null
          phone?: string | null
          property_id?: string | null
          spouse_email?: string | null
          spouse_first_name?: string | null
          spouse_is_alternate_contact?: boolean | null
          spouse_last_name?: string | null
          spouse_phone?: string | null
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
      housekeeping_tasks: {
        Row: {
          checklist_id: string | null
          checklist_item_done: Json
          created_at: string
          created_by: string
          description: string | null
          end_date: string | null
          id: string
          priority: string
          property_id: string
          reservation_id: string | null
          site_id: string
          staff_id: string | null
          start_at: string | null
          start_date: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          checklist_id?: string | null
          checklist_item_done?: Json
          created_at?: string
          created_by: string
          description?: string | null
          end_date?: string | null
          id?: string
          priority?: string
          property_id: string
          reservation_id?: string | null
          site_id: string
          staff_id?: string | null
          start_at?: string | null
          start_date?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          checklist_id?: string | null
          checklist_item_done?: Json
          created_at?: string
          created_by?: string
          description?: string | null
          end_date?: string | null
          id?: string
          priority?: string
          property_id?: string
          reservation_id?: string | null
          site_id?: string
          staff_id?: string | null
          start_at?: string | null
          start_date?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "housekeeping_tasks_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "checklist"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "housekeeping_tasks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "housekeeping_tasks_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "housekeeping_tasks_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "housekeeping_tasks_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "property_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_tasks: {
        Row: {
          category: string
          created_at: string
          created_by: string
          description: string | null
          estimated_labor_cost: number | null
          estimated_parts_cost: number | null
          id: string
          priority: string
          property_id: string
          site_id: string
          source: string
          staff_id: string | null
          status: string
          title: string
          updated_at: string
          vendor_email: string | null
          vendor_name: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          created_by: string
          description?: string | null
          estimated_labor_cost?: number | null
          estimated_parts_cost?: number | null
          id?: string
          priority?: string
          property_id: string
          site_id: string
          source?: string
          staff_id?: string | null
          status?: string
          title: string
          updated_at?: string
          vendor_email?: string | null
          vendor_name?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string
          description?: string | null
          estimated_labor_cost?: number | null
          estimated_parts_cost?: number | null
          id?: string
          priority?: string
          property_id?: string
          site_id?: string
          source?: string
          staff_id?: string | null
          status?: string
          title?: string
          updated_at?: string
          vendor_email?: string | null
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_tasks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tasks_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tasks_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "property_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      module_licenses: {
        Row: {
          company_id: string
          created_at: string
          expires_at: string | null
          features: Json | null
          id: string
          is_active: boolean
          module_name: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          expires_at?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean
          module_name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          expires_at?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean
          module_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_licenses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
      processed_webhook_events: {
        Row: {
          created_at: string
          created_company_id: string | null
          created_property_ids: string[] | null
          error_message: string | null
          event_type: string
          id: string
          processed_at: string
          processing_time_ms: number | null
          status: string
          stripe_event_id: string
        }
        Insert: {
          created_at?: string
          created_company_id?: string | null
          created_property_ids?: string[] | null
          error_message?: string | null
          event_type: string
          id?: string
          processed_at?: string
          processing_time_ms?: number | null
          status?: string
          stripe_event_id: string
        }
        Update: {
          created_at?: string
          created_company_id?: string | null
          created_property_ids?: string[] | null
          error_message?: string | null
          event_type?: string
          id?: string
          processed_at?: string
          processing_time_ms?: number | null
          status?: string
          stripe_event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "processed_webhook_events_created_company_id_fkey"
            columns: ["created_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
          cancellation_policy_config: Json | null
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
          enabled_reservation_types: Json | null
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
          reservation_type_config: Json | null
          settings: Json | null
          site_amenities: Json | null
          site_count: number | null
          site_type_config: Json | null
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
          terms_and_conditions: string | null
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
          cancellation_policy_config?: Json | null
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
          enabled_reservation_types?: Json | null
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
          reservation_type_config?: Json | null
          settings?: Json | null
          site_amenities?: Json | null
          site_count?: number | null
          site_type_config?: Json | null
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
          terms_and_conditions?: string | null
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
          cancellation_policy_config?: Json | null
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
          enabled_reservation_types?: Json | null
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
          reservation_type_config?: Json | null
          settings?: Json | null
          site_amenities?: Json | null
          site_count?: number | null
          site_type_config?: Json | null
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
          terms_and_conditions?: string | null
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
      property_booking_slug_aliases: {
        Row: {
          booking_page_slug: string
          created_at: string
          id: string
          property_id: string
        }
        Insert: {
          booking_page_slug: string
          created_at?: string
          id?: string
          property_id: string
        }
        Update: {
          booking_page_slug?: string
          created_at?: string
          id?: string
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_booking_slug_aliases_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_role_categories: {
        Row: {
          access: Json | null
          created_at: string
          id: string
          name: string
          property_id: string
          role: string
          updated_at: string
        }
        Insert: {
          access?: Json | null
          created_at?: string
          id?: string
          name: string
          property_id: string
          role: string
          updated_at?: string
        }
        Update: {
          access?: Json | null
          created_at?: string
          id?: string
          name?: string
          property_id?: string
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_role_categories_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_seasonal_periods: {
        Row: {
          base_rate_cents: number
          created_at: string | null
          end_day: number
          end_month: number
          id: string
          name: string
          property_id: string
          recurring: boolean | null
          start_day: number
          start_month: number
          updated_at: string | null
        }
        Insert: {
          base_rate_cents: number
          created_at?: string | null
          end_day: number
          end_month: number
          id?: string
          name: string
          property_id: string
          recurring?: boolean | null
          start_day: number
          start_month: number
          updated_at?: string | null
        }
        Update: {
          base_rate_cents?: number
          created_at?: string | null
          end_day?: number
          end_month?: number
          id?: string
          name?: string
          property_id?: string
          recurring?: boolean | null
          start_day?: number
          start_month?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_seasonal_periods_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
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
          role: string
          role_category_id: string[] | null
          status: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          permissions?: Json | null
          property_id?: string | null
          role?: string
          role_category_id?: string[] | null
          status?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          permissions?: Json | null
          property_id?: string | null
          role?: string
          role_category_id?: string[] | null
          status?: string
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
      reservation_children: {
        Row: {
          age: number | null
          created_at: string
          date_of_birth: string | null
          first_name: string
          id: string
          property_id: string
          reservation_id: string
          special_needs_allergies: string | null
        }
        Insert: {
          age?: number | null
          created_at?: string
          date_of_birth?: string | null
          first_name: string
          id?: string
          property_id: string
          reservation_id: string
          special_needs_allergies?: string | null
        }
        Update: {
          age?: number | null
          created_at?: string
          date_of_birth?: string | null
          first_name?: string
          id?: string
          property_id?: string
          reservation_id?: string
          special_needs_allergies?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservation_children_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_children_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      reservation_pets: {
        Row: {
          breed: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          property_id: string
          reservation_id: string
          type: string
          weight_lbs: number | null
        }
        Insert: {
          breed?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          property_id: string
          reservation_id: string
          type: string
          weight_lbs?: number | null
        }
        Update: {
          breed?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          property_id?: string
          reservation_id?: string
          type?: string
          weight_lbs?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reservation_pets_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_pets_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      reservation_vehicles: {
        Row: {
          created_at: string
          guest_vehicle_id: string
          id: string
          reservation_id: string
        }
        Insert: {
          created_at?: string
          guest_vehicle_id: string
          id?: string
          reservation_id: string
        }
        Update: {
          created_at?: string
          guest_vehicle_id?: string
          id?: string
          reservation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservation_vehicles_guest_vehicle_id_fkey"
            columns: ["guest_vehicle_id"]
            isOneToOne: false
            referencedRelation: "guest_vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_vehicles_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          balance_paid_at_check_in_cents: number | null
          balance_paid_at_checkin: number | null
          booking_period: Json | null
          booking_type: string | null
          cancellation_reason: string | null
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
          evacuation_contact_name: string | null
          evacuation_contact_phone: string | null
          evacuation_contact_relationship: string | null
          guest_id: string | null
          has_damages: boolean | null
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
          refund_amount_cents: number | null
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
          balance_paid_at_check_in_cents?: number | null
          balance_paid_at_checkin?: number | null
          booking_period?: Json | null
          booking_type?: string | null
          cancellation_reason?: string | null
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
          evacuation_contact_name?: string | null
          evacuation_contact_phone?: string | null
          evacuation_contact_relationship?: string | null
          guest_id?: string | null
          has_damages?: boolean | null
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
          refund_amount_cents?: number | null
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
          balance_paid_at_check_in_cents?: number | null
          balance_paid_at_checkin?: number | null
          booking_period?: Json | null
          booking_type?: string | null
          cancellation_reason?: string | null
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
          evacuation_contact_name?: string | null
          evacuation_contact_phone?: string | null
          evacuation_contact_relationship?: string | null
          guest_id?: string | null
          has_damages?: boolean | null
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
          refund_amount_cents?: number | null
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
      site_seasonal_rates: {
        Row: {
          created_at: string | null
          id: string
          rate_cents: number
          seasonal_period_id: string
          site_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          rate_cents: number
          seasonal_period_id: string
          site_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          rate_cents?: number
          seasonal_period_id?: string
          site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_seasonal_rates_seasonal_period_id_fkey"
            columns: ["seasonal_period_id"]
            isOneToOne: false
            referencedRelation: "property_seasonal_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_seasonal_rates_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
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
          default_reservation_type: string | null
          deleted_at: string | null
          deposit_override: Json | null
          description: string | null
          enabled_reservation_types_override: Json | null
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
          seasonal_rate_cents: number | null
          site_amenities: Json | null
          site_images: Json | null
          site_name: string | null
          site_number: string
          site_type: string | null
          size_sqft: number | null
          status: string | null
          updated_at: string | null
          weekend_price: number | null
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
          default_reservation_type?: string | null
          deleted_at?: string | null
          deposit_override?: Json | null
          description?: string | null
          enabled_reservation_types_override?: Json | null
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
          seasonal_rate_cents?: number | null
          site_amenities?: Json | null
          site_images?: Json | null
          site_name?: string | null
          site_number: string
          site_type?: string | null
          size_sqft?: number | null
          status?: string | null
          updated_at?: string | null
          weekend_price?: number | null
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
          default_reservation_type?: string | null
          deleted_at?: string | null
          deposit_override?: Json | null
          description?: string | null
          enabled_reservation_types_override?: Json | null
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
          seasonal_rate_cents?: number | null
          site_amenities?: Json | null
          site_images?: Json | null
          site_name?: string | null
          site_number?: string
          site_type?: string | null
          size_sqft?: number | null
          status?: string | null
          updated_at?: string | null
          weekend_price?: number | null
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
      task_images: {
        Row: {
          created_at: string
          id: string
          property_id: string
          storage_path: string
          task_id: string
          task_type: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          property_id: string
          storage_path: string
          task_id: string
          task_type: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          property_id?: string
          storage_path?: string
          task_id?: string
          task_type?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_images_property_id_fkey"
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
      cleanup_old_api_audit_logs: {
        Args: { days_to_keep?: number }
        Returns: number
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
      is_automation_company_member: {
        Args: { aut_id: string }
        Returns: boolean
      }
      is_eligible_for_renewal: {
        Args: { reservation_id: string }
        Returns: boolean
      }
      is_property_owner: { Args: { prop_id: string }; Returns: boolean }
      is_property_staff: { Args: { prop_id: string }; Returns: boolean }
      migrate_legacy_discounts_to_user_defined: {
        Args: { p_property_id: string }
        Returns: Json
      }
      migrate_legacy_fees_to_user_defined: {
        Args: { p_property_id: string }
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
