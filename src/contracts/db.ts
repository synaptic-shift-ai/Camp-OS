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
      payments: {
        Row: {
          amount: number
          amount_cents: number
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
          amount_cents: number
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
          amount_cents?: number
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
          check_in_time: string | null
          check_out_time: string | null
          city: string | null
          country: string | null
          created_at: string | null
          description: string | null
          email: string | null
          id: string
          name: string
          owner_id: string | null
          phone: string | null
          property_type: string | null
          settings: Json | null
          slug: string
          state: string | null
          status: string | null
          subdomain: string | null
          timezone: string | null
          updated_at: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          amenities?: Json | null
          check_in_time?: string | null
          check_out_time?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          email?: string | null
          id?: string
          name: string
          owner_id?: string | null
          phone?: string | null
          property_type?: string | null
          settings?: Json | null
          slug: string
          state?: string | null
          status?: string | null
          subdomain?: string | null
          timezone?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          amenities?: Json | null
          check_in_time?: string | null
          check_out_time?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          email?: string | null
          id?: string
          name?: string
          owner_id?: string | null
          phone?: string | null
          property_type?: string | null
          settings?: Json | null
          slug?: string
          state?: string | null
          status?: string | null
          subdomain?: string | null
          timezone?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Relationships: []
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
      reservations: {
        Row: {
          cancelled_at: string | null
          check_in_date: string
          check_out_date: string
          confirmation_number: string
          created_at: string | null
          guest_id: string | null
          id: string
          notes: string | null
          num_adults: number | null
          num_children: number | null
          num_pets: number | null
          num_vehicles: number | null
          paid_amount: number | null
          paid_amount_cents: number
          payment_status: string | null
          property_id: string | null
          site_id: string | null
          source: string | null
          special_requests: string | null
          status: string | null
          total_amount: number
          total_amount_cents: number
          updated_at: string | null
          vehicle_info: Json | null
        }
        Insert: {
          cancelled_at?: string | null
          check_in_date: string
          check_out_date: string
          confirmation_number: string
          created_at?: string | null
          guest_id?: string | null
          id?: string
          notes?: string | null
          num_adults?: number | null
          num_children?: number | null
          num_pets?: number | null
          num_vehicles?: number | null
          paid_amount?: number | null
          paid_amount_cents: number
          payment_status?: string | null
          property_id?: string | null
          site_id?: string | null
          source?: string | null
          special_requests?: string | null
          status?: string | null
          total_amount: number
          total_amount_cents: number
          updated_at?: string | null
          vehicle_info?: Json | null
        }
        Update: {
          cancelled_at?: string | null
          check_in_date?: string
          check_out_date?: string
          confirmation_number?: string
          created_at?: string | null
          guest_id?: string | null
          id?: string
          notes?: string | null
          num_adults?: number | null
          num_children?: number | null
          num_pets?: number | null
          num_vehicles?: number | null
          paid_amount?: number | null
          paid_amount_cents?: number
          payment_status?: string | null
          property_id?: string | null
          site_id?: string | null
          source?: string | null
          special_requests?: string | null
          status?: string | null
          total_amount?: number
          total_amount_cents?: number
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
      sites: {
        Row: {
          amenities: Json | null
          base_price: number
          base_price_cents: number
          created_at: string | null
          description: string | null
          hookups: Json | null
          id: string
          images: Json | null
          location_map: Json | null
          max_occupancy: number | null
          max_vehicles: number | null
          property_id: string | null
          site_name: string | null
          site_number: string
          site_type: string | null
          size_sqft: number | null
          status: string | null
          updated_at: string | null
          weekend_price: number | null
          weekend_price_cents: number | null
        }
        Insert: {
          amenities?: Json | null
          base_price: number
          base_price_cents: number
          created_at?: string | null
          description?: string | null
          hookups?: Json | null
          id?: string
          images?: Json | null
          location_map?: Json | null
          max_occupancy?: number | null
          max_vehicles?: number | null
          property_id?: string | null
          site_name?: string | null
          site_number: string
          site_type?: string | null
          size_sqft?: number | null
          status?: string | null
          updated_at?: string | null
          weekend_price?: number | null
          weekend_price_cents?: number | null
        }
        Update: {
          amenities?: Json | null
          base_price?: number
          base_price_cents?: number
          created_at?: string | null
          description?: string | null
          hookups?: Json | null
          id?: string
          images?: Json | null
          location_map?: Json | null
          max_occupancy?: number | null
          max_vehicles?: number | null
          property_id?: string | null
          site_name?: string | null
          site_number?: string
          site_type?: string | null
          size_sqft?: number | null
          status?: string | null
          updated_at?: string | null
          weekend_price?: number | null
          weekend_price_cents?: number | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
