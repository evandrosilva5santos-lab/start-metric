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
      client_dashboard_layouts: {
        Row: {
          cards: Json
          client_id: string
          created_at: string
          id: string
          org_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cards: Json
          client_id: string
          created_at?: string
          id?: string
          org_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cards?: Json
          client_id?: string
          created_at?: string
          id?: string
          org_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_dashboard_layouts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_dashboard_layouts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          archived_at: string | null
          created_at: string
          email: string | null
          id: string
          logo_url: string | null
          name: string
          niche: string | null
          notes: string | null
          org_id: string
          phone: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name: string
          niche?: string | null
          notes?: string | null
          org_id: string
          phone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          niche?: string | null
          notes?: string | null
          org_id?: string
          phone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_instances: {
        Row: {
          api_key: string | null
          api_url: string | null
          client_id: string | null
          created_at: string
          id: string
          instance_name: string
          last_connected_at: string | null
          org_id: string
          phone_number: string | null
          qr_code: string | null
          status: string
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          api_key?: string | null
          api_url?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          instance_name: string
          last_connected_at?: string | null
          org_id: string
          phone_number?: string | null
          qr_code?: string | null
          status?: string
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          api_key?: string | null
          api_url?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          instance_name?: string
          last_connected_at?: string | null
          org_id?: string
          phone_number?: string | null
          qr_code?: string | null
          status?: string
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_instances_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_instances_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_connections: {
        Row: {
          connected_at: string
          connected_by: string | null
          fb_user_id: string | null
          id: string
          org_id: string
          status: string
          token_encrypted: string
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          connected_at?: string
          connected_by?: string | null
          fb_user_id?: string | null
          id?: string
          org_id: string
          status?: string
          token_encrypted: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          connected_at?: string
          connected_by?: string | null
          fb_user_id?: string | null
          id?: string
          org_id?: string
          status?: string
          token_encrypted?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_connections_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_accounts: {
        Row: {
          client_id: string | null
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
          client_id?: string | null
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
          client_id?: string | null
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
          {
            foreignKeyName: "ad_accounts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          acknowledged_at: string | null
          assigned_to: string | null
          campaign_id: string | null
          channel: string
          id: string
          message: string
          metadata: Json | null
          metric: string
          observed_value: number
          operator: string
          org_id: string
          read_at: string | null
          resolution_note: string | null
          resolved_at: string | null
          rule_id: string | null
          severity: string | null
          status: string
          threshold: number
          title: string
          triggered_at: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          assigned_to?: string | null
          campaign_id?: string | null
          channel?: string
          id?: string
          message: string
          metadata?: Json | null
          metric: string
          observed_value: number
          operator: string
          org_id: string
          read_at?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          rule_id?: string | null
          severity?: string | null
          status?: string
          threshold: number
          title: string
          triggered_at?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          assigned_to?: string | null
          campaign_id?: string | null
          channel?: string
          id?: string
          message?: string
          metadata?: Json | null
          metric?: string
          observed_value?: number
          operator?: string
          org_id?: string
          read_at?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          rule_id?: string | null
          severity?: string | null
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
          action_values: Json | null
          actions: Json | null
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
          action_values?: Json | null
          actions?: Json | null
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
          action_values?: Json | null
          actions?: Json | null
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
          ad_account_id: string | null
          campaign_id: string | null
          channel: string
          client_id: string | null
          created_at: string | null
          id: string
          metric: string
          operator: string
          org_id: string
          template_body: string | null
          threshold: number
          updated_at: string | null
        }
        Insert: {
          active?: boolean
          ad_account_id?: string | null
          campaign_id?: string | null
          channel?: string
          client_id?: string | null
          created_at?: string | null
          id?: string
          metric: string
          operator: string
          org_id: string
          template_body?: string | null
          threshold: number
          updated_at?: string | null
        }
        Update: {
          active?: boolean
          ad_account_id?: string | null
          campaign_id?: string | null
          channel?: string
          client_id?: string | null
          created_at?: string | null
          id?: string
          metric?: string
          operator?: string
          org_id?: string
          template_body?: string | null
          threshold?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_rules_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_rules_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_rules_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
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
          avatar_url: string | null
          country: string | null
          cpf: string | null
          created_at: string | null
          id: string
          language: string | null
          name: string | null
          org_id: string | null
          phone: string | null
          role: string
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          country?: string | null
          cpf?: string | null
          created_at?: string | null
          id: string
          language?: string | null
          name?: string | null
          org_id?: string | null
          phone?: string | null
          role?: string
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          country?: string | null
          cpf?: string | null
          created_at?: string | null
          id?: string
          language?: string | null
          name?: string | null
          org_id?: string | null
          phone?: string | null
          role?: string
          timezone?: string | null
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
      shared_links: {
        Row: {
          access_count: number
          access_type: string
          client_id: string
          created_at: string
          created_by: string
          expires_at: string
          id: string
          last_accessed_at: string | null
          max_accesses: number | null
          metadata: Json | null
          org_id: string
          password_hash: string | null
          revoked_at: string | null
          token: string
        }
        Insert: {
          access_count?: number
          access_type?: string
          client_id: string
          created_at?: string
          created_by: string
          expires_at: string
          id?: string
          last_accessed_at?: string | null
          max_accesses?: number | null
          metadata?: Json | null
          org_id: string
          password_hash?: string | null
          revoked_at?: string | null
          token: string
        }
        Update: {
          access_count?: number
          access_type?: string
          client_id?: string
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          last_accessed_at?: string | null
          max_accesses?: number | null
          metadata?: Json | null
          org_id?: string
          password_hash?: string | null
          revoked_at?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_links_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_links_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      reports_sent: {
        Row: {
          created_at: string
          delivery_method: string
          delivery_to: string | null
          error_message: string | null
          id: string
          org_id: string
          pdf_url: string | null
          report_template_id: string | null
          sent_at: string | null
          shared_link_token: string | null
          status: string
          client_id: string
        }
        Insert: {
          created_at?: string
          delivery_method: string
          delivery_to?: string | null
          error_message?: string | null
          id?: string
          org_id: string
          pdf_url?: string | null
          report_template_id?: string | null
          sent_at?: string | null
          shared_link_token?: string | null
          status?: string
          client_id: string
        }
        Update: {
          created_at?: string
          delivery_method?: string
          delivery_to?: string | null
          error_message?: string | null
          id?: string
          org_id?: string
          pdf_url?: string | null
          report_template_id?: string | null
          sent_at?: string | null
          shared_link_token?: string | null
          status?: string
          client_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_sent_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_sent_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_sent_report_template_id_fkey"
            columns: ["report_template_id"]
            isOneToOne: false
            referencedRelation: "report_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_sent_shared_link_token_fkey"
            columns: ["shared_link_token"]
            isOneToOne: false
            referencedRelation: "shared_links"
            referencedColumns: ["token"]
          },
        ]
      }
      report_templates: {
        Row: {
          created_at: string
          description: string | null
          frequency: string | null
          id: string
          includes_campaigns: boolean
          includes_comparison: boolean
          includes_kpis: boolean
          is_active: boolean
          is_default: boolean
          layout: Json
          message_template: string | null
          metrics: string[]
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          frequency?: string | null
          id?: string
          includes_campaigns?: boolean
          includes_comparison?: boolean
          includes_kpis?: boolean
          is_active?: boolean
          is_default?: boolean
          layout: Json
          message_template?: string | null
          metrics?: string[]
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          frequency?: string | null
          id?: string
          includes_campaigns?: boolean
          includes_comparison?: boolean
          includes_kpis?: boolean
          is_active?: boolean
          is_default?: boolean
          layout?: Json
          message_template?: string | null
          metrics?: string[]
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      garimpo_ads: {
        Row: {
          ad_archive_id: string
          body_text: string | null
          captured_at: string
          creative_hash: string | null
          cta: string | null
          format: string | null
          hash_kind: string | null
          id: string
          is_active: boolean
          media_url: string | null
          offer_id: string
          org_id: string
          page_id: string
          started_at: string | null
        }
        Insert: {
          ad_archive_id: string
          body_text?: string | null
          captured_at?: string
          creative_hash?: string | null
          cta?: string | null
          format?: string | null
          hash_kind?: string | null
          id?: string
          is_active?: boolean
          media_url?: string | null
          offer_id: string
          org_id: string
          page_id: string
          started_at?: string | null
        }
        Update: {
          ad_archive_id?: string
          body_text?: string | null
          captured_at?: string
          creative_hash?: string | null
          cta?: string | null
          format?: string | null
          hash_kind?: string | null
          id?: string
          is_active?: boolean
          media_url?: string | null
          offer_id?: string
          org_id?: string
          page_id?: string
          started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "garimpo_ads_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "garimpo_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garimpo_ads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garimpo_ads_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "garimpo_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      garimpo_cuts: {
        Row: {
          formats: string[]
          id: string
          min_ads: number
          min_days: number
          min_pages: number
          org_id: string
          updated_at: string
        }
        Insert: {
          formats?: string[]
          id?: string
          min_ads?: number
          min_days?: number
          min_pages?: number
          org_id: string
          updated_at?: string
        }
        Update: {
          formats?: string[]
          id?: string
          min_ads?: number
          min_days?: number
          min_pages?: number
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "garimpo_cuts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      garimpo_offer_daily: {
        Row: {
          active_ads: number
          day: string
          offer_id: string
          org_id: string
          pages: number
        }
        Insert: {
          active_ads: number
          day: string
          offer_id: string
          org_id: string
          pages: number
        }
        Update: {
          active_ads?: number
          day?: string
          offer_id?: string
          org_id?: string
          pages?: number
        }
        Relationships: [
          {
            foreignKeyName: "garimpo_offer_daily_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "garimpo_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garimpo_offer_daily_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      garimpo_offer_domains: {
        Row: {
          checked_at: string
          displayed_domain: string | null
          divergent: boolean
          id: string
          offer_id: string
          org_id: string
          raw_link: string
          redirect_chain: string[]
          resolve_error: string | null
          resolved_domain: string | null
        }
        Insert: {
          checked_at?: string
          displayed_domain?: string | null
          divergent?: boolean
          id?: string
          offer_id: string
          org_id: string
          raw_link: string
          redirect_chain?: string[]
          resolve_error?: string | null
          resolved_domain?: string | null
        }
        Update: {
          checked_at?: string
          displayed_domain?: string | null
          divergent?: boolean
          id?: string
          offer_id?: string
          org_id?: string
          raw_link?: string
          redirect_chain?: string[]
          resolve_error?: string | null
          resolved_domain?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "garimpo_offer_domains_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "garimpo_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garimpo_offer_domains_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      garimpo_offers: {
        Row: {
          country: string | null
          domain: string
          first_seen_at: string
          id: string
          last_seen_at: string
          niche: string | null
          org_id: string
          score: number | null
          score_parts: Json | null
          status: Database["public"]["Enums"]["garimpo_offer_status"]
          updated_at: string
          watch: boolean
        }
        Insert: {
          country?: string | null
          domain: string
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          niche?: string | null
          org_id: string
          score?: number | null
          score_parts?: Json | null
          status?: Database["public"]["Enums"]["garimpo_offer_status"]
          updated_at?: string
          watch?: boolean
        }
        Update: {
          country?: string | null
          domain?: string
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          niche?: string | null
          org_id?: string
          score?: number | null
          score_parts?: Json | null
          status?: Database["public"]["Enums"]["garimpo_offer_status"]
          updated_at?: string
          watch?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "garimpo_offers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      garimpo_pages: {
        Row: {
          first_seen_at: string
          id: string
          offer_id: string
          org_id: string
          page_id_meta: string
          page_name: string | null
        }
        Insert: {
          first_seen_at?: string
          id?: string
          offer_id: string
          org_id: string
          page_id_meta: string
          page_name?: string | null
        }
        Update: {
          first_seen_at?: string
          id?: string
          offer_id?: string
          org_id?: string
          page_id_meta?: string
          page_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "garimpo_pages_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "garimpo_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garimpo_pages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      garimpo_runs: {
        Row: {
          ads_read: number | null
          cost_per_thousand: number | null
          country: string | null
          domains_found: number | null
          error_text: string | null
          finished_at: string | null
          id: string
          niche: string | null
          org_id: string
          source: Database["public"]["Enums"]["garimpo_run_source"]
          started_at: string
          status: string
        }
        Insert: {
          ads_read?: number | null
          cost_per_thousand?: number | null
          country?: string | null
          domains_found?: number | null
          error_text?: string | null
          finished_at?: string | null
          id?: string
          niche?: string | null
          org_id: string
          source: Database["public"]["Enums"]["garimpo_run_source"]
          started_at?: string
          status?: string
        }
        Update: {
          ads_read?: number | null
          cost_per_thousand?: number | null
          country?: string | null
          domains_found?: number | null
          error_text?: string | null
          finished_at?: string | null
          id?: string
          niche?: string | null
          org_id?: string
          source?: Database["public"]["Enums"]["garimpo_run_source"]
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "garimpo_runs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          body: string
          channel: string | null
          context: string
          created_at: string
          id: string
          name: string
          objective: string | null
          org_id: string | null
          updated_at: string
        }
        Insert: {
          body: string
          channel?: string | null
          context: string
          created_at?: string
          id?: string
          name: string
          objective?: string | null
          org_id?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          channel?: string | null
          context?: string
          created_at?: string
          id?: string
          name?: string
          objective?: string | null
          org_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          client_id: string
          created_at: string
          frequency: string
          id: string
          month_day: number | null
          name: string
          next_run_at: string | null
          org_id: string
          send_time: string
          status: string
          timezone: string
          updated_at: string
          weekday: number | null
        }
        Insert: {
          client_id: string
          created_at?: string
          frequency?: string
          id?: string
          month_day?: number | null
          name: string
          next_run_at?: string | null
          org_id: string
          send_time?: string
          status?: string
          timezone?: string
          updated_at?: string
          weekday?: number | null
        }
        Update: {
          client_id?: string
          created_at?: string
          frequency?: string
          id?: string
          month_day?: number | null
          name?: string
          next_run_at?: string | null
          org_id?: string
          send_time?: string
          status?: string
          timezone?: string
          updated_at?: string
          weekday?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      report_parts: {
        Row: {
          ad_account_id: string | null
          body: string
          custom_end: string | null
          custom_start: string | null
          id: string
          period: string
          position: number
          report_id: string
          send_without_data: boolean
        }
        Insert: {
          ad_account_id?: string | null
          body: string
          custom_end?: string | null
          custom_start?: string | null
          id?: string
          period?: string
          position: number
          report_id: string
          send_without_data?: boolean
        }
        Update: {
          ad_account_id?: string | null
          body?: string
          custom_end?: string | null
          custom_start?: string | null
          id?: string
          period?: string
          position?: number
          report_id?: string
          send_without_data?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "report_parts_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_parts_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      report_runs: {
        Row: {
          approved_at: string | null
          delivery_note: string | null
          received_at: string | null
          sent_at: string | null
          sent_by: string | null
          created_at: string
          error_message: string | null
          finished_at: string | null
          id: string
          missing_variables: string[]
          org_id: string
          rendered_body: string | null
          report_id: string
          scheduled_for: string
          started_at: string | null
          status: string
        }
        Insert: {
          approved_at?: string | null
          delivery_note?: string | null
          received_at?: string | null
          sent_at?: string | null
          sent_by?: string | null
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          missing_variables?: string[]
          org_id: string
          rendered_body?: string | null
          report_id: string
          scheduled_for: string
          started_at?: string | null
          status?: string
        }
        Update: {
          approved_at?: string | null
          delivery_note?: string | null
          received_at?: string | null
          sent_at?: string | null
          sent_by?: string | null
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          missing_variables?: string[]
          org_id?: string
          rendered_body?: string | null
          report_id?: string
          scheduled_for?: string
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_runs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_runs_report_fkey"
            columns: ["report_id", "org_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      lead_webhooks: {
        Row: {
          active: boolean
          client_id: string | null
          created_at: string
          id: string
          name: string
          org_id: string
          provider: string | null
          template_body: string | null
          token: string
        }
        Insert: {
          active?: boolean
          client_id?: string | null
          created_at?: string
          id?: string
          name: string
          org_id: string
          provider?: string | null
          template_body?: string | null
          token?: string
        }
        Update: {
          active?: boolean
          client_id?: string | null
          created_at?: string
          id?: string
          name?: string
          org_id?: string
          provider?: string | null
          template_body?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_webhooks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_webhooks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          campaign: string | null
          client_id: string | null
          created_at: string
          email: string | null
          id: string
          name: string | null
          org_id: string
          payload: Json
          phone: string | null
          read_at: string | null
          rendered_message: string | null
          source: string | null
          webhook_id: string | null
        }
        Insert: {
          campaign?: string | null
          client_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          org_id: string
          payload?: Json
          phone?: string | null
          read_at?: string | null
          rendered_message?: string | null
          source?: string | null
          webhook_id?: string | null
        }
        Update: {
          campaign?: string | null
          client_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          org_id?: string
          payload?: Json
          phone?: string | null
          read_at?: string | null
          rendered_message?: string | null
          source?: string | null
          webhook_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "lead_webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      operational_ad_accounts: {
        Row: {
          client_id: string | null
          client_name: string | null
          connected_at: string | null
          currency: string | null
          external_id: string | null
          id: string | null
          last_synced_at: string | null
          name: string | null
          org_id: string | null
          platform: string | null
          status: string | null
          timezone: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      dashboard_metrics_rollup: {
        Args: {
          p_campaign_ids: string[]
          p_from: string
          p_org_id: string
          p_to: string
        }
        Returns: {
          clicks: number
          conversions: number
          impressions: number
          key: string
          kind: string
          revenue: number
          spend: number
        }[]
      }
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
      register_report_delivery: {
        Args: {
          p_note?: string | null
          p_run_id: string
          p_step: string
        }
        Returns: Database["public"]["Tables"]["report_runs"]["Row"]
      }
      set_client_ad_accounts: {
        Args: {
          p_client_id: string
          p_confirm_reassignment?: boolean
          p_external_ids: string[]
          p_org_id: string
          p_platform: string
        }
        Returns: {
          linked_count: number
          reassigned_count: number
          unlinked_count: number
        }[]
      }
    }
    Enums: {
      garimpo_offer_status: "novo" | "em_analise" | "aprovado" | "descartado"
      garimpo_run_source: "api_oficial" | "terceiro" | "scraper_proprio"
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
    Enums: {
      garimpo_offer_status: ["novo", "em_analise", "aprovado", "descartado"],
      garimpo_run_source: ["api_oficial", "terceiro", "scraper_proprio"],
    },
  },
} as const
