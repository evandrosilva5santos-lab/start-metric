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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ad_accounts: {
        Row: {
          connected_at: string | null
          currency: string | null
          external_id: string
          id: string
          last_synced_at: string | null
          name: string
          org_id: string
          platform: string
          status: string
          timezone: string | null
          token_encrypted: string | null
          token_expires_at: string | null
          updated_at: string | null
        }
        Insert: {
          connected_at?: string | null
          currency?: string | null
          external_id: string
          id?: string
          last_synced_at?: string | null
          name: string
          org_id: string
          platform: string
          status?: string
          timezone?: string | null
          token_encrypted?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
        }
        Update: {
          connected_at?: string | null
          currency?: string | null
          external_id?: string
          id?: string
          last_synced_at?: string | null
          name?: string
          org_id?: string
          platform?: string
          status?: string
          timezone?: string | null
          token_encrypted?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_accounts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          campaign_id: string | null
          channel: string
          id: string
          message: string
          metric: string
          observed_value: number
          operator: string
          org_id: string
          read_at: string | null
          rule_id: string | null
          status: string
          threshold: number
          title: string
          triggered_at: string | null
        }
        Insert: {
          campaign_id?: string | null
          channel?: string
          id?: string
          message: string
          metric: string
          observed_value: number
          operator: string
          org_id: string
          read_at?: string | null
          rule_id?: string | null
          status?: string
          threshold: number
          title: string
          triggered_at?: string | null
        }
        Update: {
          campaign_id?: string | null
          channel?: string
          id?: string
          message?: string
          metric?: string
          observed_value?: number
          operator?: string
          org_id?: string
          read_at?: string | null
          rule_id?: string | null
          status?: string
          threshold?: number
          title?: string
          triggered_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alerts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "notification_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          ad_account_id: string
          budget_remaining: number | null
          conversions: number | null
          cpa: number | null
          created_at: string | null
          daily_budget: number | null
          id: string
          last_synced_at: string | null
          meta_id: string
          name: string
          objective: string | null
          org_id: string
          roas: number | null
          spend: number | null
          status: string
          updated_at: string | null
        }
        Insert: {
          ad_account_id: string
          budget_remaining?: number | null
          conversions?: number | null
          cpa?: number | null
          created_at?: string | null
          daily_budget?: number | null
          id?: string
          last_synced_at?: string | null
          meta_id: string
          name: string
          objective?: string | null
          org_id: string
          roas?: number | null
          spend?: number | null
          status: string
          updated_at?: string | null
        }
        Update: {
          ad_account_id?: string
          budget_remaining?: number | null
          conversions?: number | null
          cpa?: number | null
          created_at?: string | null
          daily_budget?: number | null
          id?: string
          last_synced_at?: string | null
          meta_id?: string
          name?: string
          objective?: string | null
          org_id?: string
          roas?: number | null
          spend?: number | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_metrics: {
        Row: {
          campaign_id: string
          clicks: number | null
          conversions: number | null
          cpa: number | null
          created_at: string | null
          date: string
          id: string
          impressions: number | null
          org_id: string
          revenue_attributed: number | null
          roas: number | null
          spend: number | null
        }
        Insert: {
          campaign_id: string
          clicks?: number | null
          conversions?: number | null
          cpa?: number | null
          created_at?: string | null
          date: string
          id?: string
          impressions?: number | null
          org_id: string
          revenue_attributed?: number | null
          roas?: number | null
          spend?: number | null
        }
        Update: {
          campaign_id?: string
          clicks?: number | null
          conversions?: number | null
          cpa?: number | null
          created_at?: string | null
          date?: string
          id?: string
          impressions?: number | null
          org_id?: string
          revenue_attributed?: number | null
          roas?: number | null
          spend?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_metrics_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_metrics_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_rules: {
        Row: {
          active: boolean
          campaign_id: string | null
          channel: string
          created_at: string | null
          id: string
          metric: string
          operator: string
          org_id: string
          threshold: number
          updated_at: string | null
        }
        Insert: {
          active?: boolean
          campaign_id?: string | null
          channel?: string
          created_at?: string | null
          id?: string
          metric: string
          operator: string
          org_id: string
          threshold: number
          updated_at?: string | null
        }
        Update: {
          active?: boolean
          campaign_id?: string | null
          channel?: string
          created_at?: string | null
          id?: string
          metric?: string
          operator?: string
          org_id?: string
          threshold?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_rules_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_rules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tracking_events: {
        Row: {
          ad_id: string | null
          adset_id: string | null
          campaign_id: string | null
          created_at: string
          currency: string | null
          event_id: string
          event_name: string
          event_time: string
          fbclid: string | null
          gclid: string | null
          id: string
          ip_hash: string | null
          org_id: string
          page_url: string | null
          payload: Json
          referrer: string | null
          session_id: string | null
          ttclid: string | null
          user_agent: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_source: string | null
          value: number | null
        }
        Insert: {
          ad_id?: string | null
          adset_id?: string | null
          campaign_id?: string | null
          created_at?: string
          currency?: string | null
          event_id: string
          event_name: string
          event_time?: string
          fbclid?: string | null
          gclid?: string | null
          id?: string
          ip_hash?: string | null
          org_id: string
          page_url?: string | null
          payload?: Json
          referrer?: string | null
          session_id?: string | null
          ttclid?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_source?: string | null
          value?: number | null
        }
        Update: {
          ad_id?: string | null
          adset_id?: string | null
          campaign_id?: string | null
          created_at?: string
          currency?: string | null
          event_id?: string
          event_name?: string
          event_time?: string
          fbclid?: string | null
          gclid?: string | null
          id?: string
          ip_hash?: string | null
          org_id?: string
          page_url?: string | null
          payload?: Json
          referrer?: string | null
          session_id?: string | null
          ttclid?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_source?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tracking_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          id: string
          name: string
          timezone: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          timezone?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          timezone?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          id: string
          name: string | null
          org_id: string | null
          phone: string | null
          role: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id: string
          name?: string | null
          org_id?: string | null
          phone?: string | null
          role?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string | null
          org_id?: string | null
          phone?: string | null
          role?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      decrypt_token: {
        Args: {
          encrypted_token: string
          encryption_key: string
        }
        Returns: string
      }
      encrypt_token: {
        Args: {
          encryption_key: string
          raw_token: string
        }
        Returns: string
      }
      get_user_org_id: { Args: never; Returns: string }
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
  public: {
    Enums: {},
  },
} as const
