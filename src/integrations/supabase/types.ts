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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string
          description: string | null
          description_sw: string | null
          id: string
          image_key: string | null
          is_active: boolean
          name: string
          name_sw: string | null
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          description_sw?: string | null
          id?: string
          image_key?: string | null
          is_active?: boolean
          name: string
          name_sw?: string | null
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          description_sw?: string | null
          id?: string
          image_key?: string | null
          is_active?: boolean
          name?: string
          name_sw?: string | null
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          color: string
          created_at: string
          id: string
          material: string
          product_id: string
          quantity: number
          size: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          material?: string
          product_id: string
          quantity: number
          size?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          material?: string
          product_id?: string
          quantity?: number
          size?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      customer_profiles: {
        Row: {
          created_at: string
          default_location: string | null
          full_name: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_location?: string | null
          full_name?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_location?: string | null
          full_name?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string | null
          id: string
          message: string
          name: string
          phone: string | null
          subject: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          message: string
          name: string
          phone?: string | null
          subject?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          message?: string
          name?: string
          phone?: string | null
          subject?: string | null
        }
        Relationships: []
      }
      admin_users: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      custom_orders: {
        Row: {
          additional_requirements: string | null
          advance_percent: number | null
          budget: string | null
          budget_range: string | null
          cancel_reason: string | null
          created_at: string
          delivery_location: string
          design_description: string
          email: string | null
          exception_note: string | null
          finish: string | null
          full_name: string
          furniture_type: string
          id: string
          needed_by: string | null
          phone: string
          preferred_color: string | null
          preferred_dimensions: string | null
          preferred_material: string | null
          quantity: number
          reference_image_url: string | null
          request_number: string
          status: string
          tracking_token: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          additional_requirements?: string | null
          advance_percent?: number | null
          budget?: string | null
          budget_range?: string | null
          cancel_reason?: string | null
          created_at?: string
          delivery_location: string
          design_description: string
          email?: string | null
          exception_note?: string | null
          finish?: string | null
          full_name: string
          furniture_type: string
          id?: string
          needed_by?: string | null
          phone: string
          preferred_color?: string | null
          preferred_dimensions?: string | null
          preferred_material?: string | null
          quantity?: number
          reference_image_url?: string | null
          request_number?: string
          status?: string
          tracking_token?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          additional_requirements?: string | null
          advance_percent?: number | null
          budget?: string | null
          budget_range?: string | null
          cancel_reason?: string | null
          created_at?: string
          delivery_location?: string
          design_description?: string
          email?: string | null
          exception_note?: string | null
          finish?: string | null
          full_name?: string
          furniture_type?: string
          id?: string
          needed_by?: string | null
          phone?: string
          preferred_color?: string | null
          preferred_dimensions?: string | null
          preferred_material?: string | null
          quantity?: number
          reference_image_url?: string | null
          request_number?: string
          status?: string
          tracking_token?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      customer_addresses: {
        Row: {
          address_line: string | null
          area: string | null
          created_at: string
          district: string | null
          full_name: string | null
          id: string
          is_default: boolean
          label: string | null
          phone: string | null
          region: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address_line?: string | null
          area?: string | null
          created_at?: string
          district?: string | null
          full_name?: string | null
          id?: string
          is_default?: boolean
          label?: string | null
          phone?: string | null
          region: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address_line?: string | null
          area?: string | null
          created_at?: string
          district?: string | null
          full_name?: string | null
          id?: string
          is_default?: boolean
          label?: string | null
          phone?: string | null
          region?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          audience: string
          body: string | null
          created_at: string
          entity: string | null
          entity_id: string | null
          id: string
          link: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          audience: string
          body?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          audience?: string
          body?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      product_reviews: {
        Row: {
          author_name: string
          body: string | null
          created_at: string
          id: string
          order_id: string | null
          product_id: string
          rating: number
          status: string
          title: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          author_name: string
          body?: string | null
          created_at?: string
          id?: string
          order_id?: string | null
          product_id: string
          rating: number
          status?: string
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          author_name?: string
          body?: string | null
          created_at?: string
          id?: string
          order_id?: string | null
          product_id?: string
          rating?: number
          status?: string
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      quotations: {
        Row: {
          advance_percent: number
          created_at: string
          created_by: string | null
          custom_order_id: string
          customer_response: string | null
          details: Json
          estimated_completion: string | null
          exclusions: string | null
          id: string
          inclusions: string | null
          lines: Json
          notes: string | null
          quote_number: string
          responded_at: string | null
          status: string
          total: number
          valid_until: string | null
          version: number
        }
        Insert: {
          advance_percent?: number
          created_at?: string
          created_by?: string | null
          custom_order_id: string
          customer_response?: string | null
          details?: Json
          estimated_completion?: string | null
          exclusions?: string | null
          id?: string
          inclusions?: string | null
          lines?: Json
          notes?: string | null
          quote_number: string
          responded_at?: string | null
          status?: string
          total?: number
          valid_until?: string | null
          version: number
        }
        Update: {
          advance_percent?: number
          created_at?: string
          created_by?: string | null
          custom_order_id?: string
          customer_response?: string | null
          details?: Json
          estimated_completion?: string | null
          exclusions?: string | null
          id?: string
          inclusions?: string | null
          lines?: Json
          notes?: string | null
          quote_number?: string
          responded_at?: string | null
          status?: string
          total?: number
          valid_until?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotations_custom_order_id_fkey"
            columns: ["custom_order_id"]
            isOneToOne: false
            referencedRelation: "custom_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          color: string | null
          created_at: string
          id: string
          material: string | null
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          size: string | null
          sku: string | null
          snapshot: Json
          unit_price: number
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          material?: string | null
          order_id: string
          product_id?: string | null
          product_name: string
          quantity: number
          size?: string | null
          sku?: string | null
          snapshot?: Json
          unit_price: number
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          material?: string | null
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          size?: string | null
          sku?: string | null
          snapshot?: Json
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          actor: string | null
          created_at: string
          id: string
          note: string | null
          order_id: string
          previous_status: string | null
          status: string
        }
        Insert: {
          actor?: string | null
          created_at?: string
          id?: string
          note?: string | null
          order_id: string
          previous_status?: string | null
          status: string
        }
        Update: {
          actor?: string | null
          created_at?: string
          id?: string
          note?: string | null
          order_id?: string
          previous_status?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_popups: {
        Row: {
          created_at: string
          delay_seconds: number
          duration_seconds: number
          id: string
          is_active: boolean
          message_en: string
          message_sw: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          delay_seconds?: number
          duration_seconds?: number
          id?: string
          is_active?: boolean
          message_en: string
          message_sw?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          delay_seconds?: number
          duration_seconds?: number
          id?: string
          is_active?: boolean
          message_en?: string
          message_sw?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          advance_percent: number
          advance_required: number
          amount_due: number
          amount_paid: number
          address_line: string | null
          archived_at: string | null
          cancel_reason: string | null
          created_at: string
          customer_name: string
          delivery_fee: number | null
          delivery_fee_status: string
          delivery_location: string
          district: string | null
          email: string | null
          fulfilment_method: string
          id: string
          needed_by: string | null
          notes: string | null
          order_number: string
          payment_kind: string
          payment_phone: string | null
          payment_status: string
          phone: string
          preferred_color: string | null
          preferred_size: string | null
          region: string | null
          snippe_reference: string | null
          specs_agreed_at: string | null
          specs_agreed_by: string | null
          status: string
          status_reason: string | null
          stock_applied: boolean
          subtotal_amount: number | null
          total_amount: number
          tracking_token: string
          user_id: string | null
        }
        Insert: {
          advance_percent?: number
          advance_required?: number
          amount_due?: number
          amount_paid?: number
          address_line?: string | null
          archived_at?: string | null
          cancel_reason?: string | null
          created_at?: string
          customer_name: string
          delivery_fee?: number | null
          delivery_fee_status?: string
          delivery_location: string
          district?: string | null
          email?: string | null
          fulfilment_method?: string
          id?: string
          needed_by?: string | null
          notes?: string | null
          order_number?: string
          payment_kind?: string
          payment_phone?: string | null
          payment_status?: string
          phone: string
          preferred_color?: string | null
          preferred_size?: string | null
          region?: string | null
          snippe_reference?: string | null
          specs_agreed_at?: string | null
          specs_agreed_by?: string | null
          status?: string
          status_reason?: string | null
          stock_applied?: boolean
          subtotal_amount?: number | null
          total_amount?: number
          tracking_token?: string
          user_id?: string | null
        }
        Update: {
          advance_percent?: number
          advance_required?: number
          amount_due?: number
          amount_paid?: number
          address_line?: string | null
          archived_at?: string | null
          cancel_reason?: string | null
          created_at?: string
          customer_name?: string
          delivery_fee?: number | null
          delivery_fee_status?: string
          delivery_location?: string
          district?: string | null
          email?: string | null
          fulfilment_method?: string
          id?: string
          needed_by?: string | null
          notes?: string | null
          order_number?: string
          payment_kind?: string
          payment_phone?: string | null
          payment_status?: string
          phone?: string
          preferred_color?: string | null
          preferred_size?: string | null
          region?: string | null
          snippe_reference?: string | null
          specs_agreed_at?: string | null
          specs_agreed_by?: string | null
          status?: string
          status_reason?: string | null
          stock_applied?: boolean
          subtotal_amount?: number | null
          total_amount?: number
          tracking_token?: string
          user_id?: string | null
        }
        Relationships: []
      }
      page_sections: {
        Row: {
          content_en: string
          content_sw: string
          id: string
          page_key: string
          section_key: string
          updated_at: string
        }
        Insert: {
          content_en?: string
          content_sw?: string
          id?: string
          page_key: string
          section_key: string
          updated_at?: string
        }
        Update: {
          content_en?: string
          content_sw?: string
          id?: string
          page_key?: string
          section_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          metadata: Json
          order_id: string
          payment_kind: string
          phone: string | null
          channel: string | null
          failure_reason: string | null
          paid_at: string | null
          payment_method: string | null
          provider: string | null
          provider_order_id: string | null
          provider_reference: string | null
          purpose: string
          receipt_number: string | null
          snippe_reference: string | null
          status: string
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json
          order_id: string
          payment_kind: string
          phone?: string | null
          channel?: string | null
          failure_reason?: string | null
          paid_at?: string | null
          payment_method?: string | null
          provider?: string | null
          provider_order_id?: string | null
          provider_reference?: string | null
          purpose?: string
          receipt_number?: string | null
          snippe_reference?: string | null
          status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json
          order_id?: string
          payment_kind?: string
          phone?: string | null
          channel?: string | null
          failure_reason?: string | null
          paid_at?: string | null
          payment_method?: string | null
          provider?: string | null
          provider_order_id?: string | null
          provider_reference?: string | null
          purpose?: string
          receipt_number?: string | null
          snippe_reference?: string | null
          status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          created_at: string
          event_id: string
          event_type: string
          id: string
          payload: Json
          payment_id: string | null
          processed_at: string | null
        }
        Insert: {
          created_at?: string
          event_id: string
          event_type: string
          id?: string
          payload?: Json
          payment_id?: string | null
          processed_at?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string
          event_type?: string
          id?: string
          payload?: Json
          payment_id?: string | null
          processed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          advance_custom_percent: number
          advance_expensive_from: number
          advance_large_from: number
          advance_large_items: number
          advance_large_percent: number
          advance_standard_percent: number
          collection_address: string | null
          email: string | null
          facebook_url: string | null
          id: number
          instagram_url: string | null
          location: string | null
          phone_dial: string | null
          phone_display: string | null
          tagline: string | null
          tiktok_url: string | null
          updated_at: string
          whatsapp_number: string | null
        }
        Insert: {
          advance_custom_percent?: number
          advance_expensive_from?: number
          advance_large_from?: number
          advance_large_items?: number
          advance_large_percent?: number
          advance_standard_percent?: number
          collection_address?: string | null
          email?: string | null
          facebook_url?: string | null
          id?: number
          instagram_url?: string | null
          location?: string | null
          phone_dial?: string | null
          phone_display?: string | null
          tagline?: string | null
          tiktok_url?: string | null
          updated_at?: string
          whatsapp_number?: string | null
        }
        Update: {
          advance_custom_percent?: number
          advance_expensive_from?: number
          advance_large_from?: number
          advance_large_items?: number
          advance_large_percent?: number
          advance_standard_percent?: number
          collection_address?: string | null
          email?: string | null
          facebook_url?: string | null
          id?: number
          instagram_url?: string | null
          location?: string | null
          phone_dial?: string | null
          phone_display?: string | null
          tagline?: string | null
          tiktok_url?: string | null
          updated_at?: string
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      product_engagement: {
        Row: {
          liked: boolean
          product_id: string
          viewed: boolean
          visitor_id: string
        }
        Insert: {
          liked?: boolean
          product_id: string
          viewed?: boolean
          visitor_id: string
        }
        Update: {
          liked?: boolean
          product_id?: string
          viewed?: boolean
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_engagement_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          alt_text: string | null
          created_at: string
          id: string
          image_key: string | null
          image_url: string | null
          product_id: string
          sort_order: number
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          id?: string
          image_key?: string | null
          image_url?: string | null
          product_id: string
          sort_order?: number
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          id?: string
          image_key?: string | null
          image_url?: string | null
          product_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          available_colors: string[]
          care_info: string | null
          care_info_sw: string | null
          category_id: string
          compare_at_price: number | null
          created_at: string
          description: string
          description_sw: string | null
          dimensions: string | null
          discount_percent: number | null
          features: string[]
          finish: string | null
          finish_sw: string | null
          free_delivery: boolean
          id: string
          image_key: string | null
          image_url: string | null
          is_available: boolean
          is_customisable: boolean
          is_demo: boolean
          is_featured: boolean
          like_count: number
          material: string | null
          name: string
          name_sw: string | null
          price: number
          short_description: string | null
          sku: string | null
          slug: string
          source_type: string
          status: string
          stock_display: string
          stock_quantity: number
          updated_at: string
          view_count: number
        }
        Insert: {
          available_colors?: string[]
          care_info?: string | null
          care_info_sw?: string | null
          category_id: string
          compare_at_price?: number | null
          created_at?: string
          description?: string
          description_sw?: string | null
          dimensions?: string | null
          discount_percent?: number | null
          features?: string[]
          finish?: string | null
          finish_sw?: string | null
          free_delivery?: boolean
          id?: string
          image_key?: string | null
          image_url?: string | null
          is_available?: boolean
          is_customisable?: boolean
          is_demo?: boolean
          is_featured?: boolean
          like_count?: number
          material?: string | null
          name: string
          name_sw?: string | null
          price: number
          short_description?: string | null
          sku?: string | null
          slug: string
          source_type?: string
          status?: string
          stock_display?: string
          stock_quantity?: number
          updated_at?: string
          view_count?: number
        }
        Update: {
          available_colors?: string[]
          care_info?: string | null
          care_info_sw?: string | null
          category_id?: string
          compare_at_price?: number | null
          created_at?: string
          description?: string
          description_sw?: string | null
          dimensions?: string | null
          discount_percent?: number | null
          features?: string[]
          finish?: string | null
          finish_sw?: string | null
          free_delivery?: boolean
          id?: string
          image_key?: string | null
          image_url?: string | null
          is_available?: boolean
          is_customisable?: boolean
          is_demo?: boolean
          is_featured?: boolean
          like_count?: number
          material?: string | null
          name?: string
          name_sw?: string | null
          price?: number
          short_description?: string | null
          sku?: string | null
          slug?: string
          source_type?: string
          status?: string
          stock_display?: string
          stock_quantity?: number
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          category: string | null
          cost: number
          created_at: string
          disposed_at: string | null
          id: string
          name: string
          notes: string | null
          purchase_date: string | null
          useful_life_months: number | null
        }
        Insert: {
          category?: string | null
          cost?: number
          created_at?: string
          disposed_at?: string | null
          id?: string
          name: string
          notes?: string | null
          purchase_date?: string | null
          useful_life_months?: number | null
        }
        Update: {
          category?: string | null
          cost?: number
          created_at?: string
          disposed_at?: string | null
          id?: string
          name?: string
          notes?: string | null
          purchase_date?: string | null
          useful_life_months?: number | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor: string | null
          actor_email: string | null
          after: Json | null
          before: Json | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
        }
        Insert: {
          action: string
          actor?: string | null
          actor_email?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor?: string | null
          actor_email?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
        }
        Relationships: []
      }
      capital_contributions: {
        Row: {
          amount: number
          contributor: string | null
          created_at: string
          date: string
          due_date: string | null
          id: string
          notes: string | null
          source: string
          terms: string | null
        }
        Insert: {
          amount: number
          contributor?: string | null
          created_at?: string
          date?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          source: string
          terms?: string | null
        }
        Update: {
          amount?: number
          contributor?: string | null
          created_at?: string
          date?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          source?: string
          terms?: string | null
        }
        Relationships: []
      }
      loan_repayments: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          interest: number
          loan_id: string
          method: string | null
          notes: string | null
          paid_on: string
          principal: number
          reference: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          interest?: number
          loan_id: string
          method?: string | null
          notes?: string | null
          paid_on?: string
          principal?: number
          reference?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          interest?: number
          loan_id?: string
          method?: string | null
          notes?: string | null
          paid_on?: string
          principal?: number
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loan_repayments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "capital_contributions"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_records: {
        Row: {
          completed_at: string | null
          cost: number
          created_at: string
          handled_by: string | null
          id: string
          method: string
          notes: string | null
          order_id: string
          received_by: string | null
          scheduled_at: string | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          cost?: number
          created_at?: string
          handled_by?: string | null
          id?: string
          method?: string
          notes?: string | null
          order_id: string
          received_by?: string | null
          scheduled_at?: string | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          cost?: number
          created_at?: string
          handled_by?: string | null
          id?: string
          method?: string
          notes?: string | null
          order_id?: string
          received_by?: string | null
          scheduled_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_records_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          archived_at: string | null
          category: string
          created_at: string
          created_by: string | null
          description: string
          expense_date: string
          id: string
          order_id: string | null
          payment_method: string | null
          receipt_path: string | null
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          archived_at?: string | null
          category: string
          created_at?: string
          created_by?: string | null
          description: string
          expense_date?: string
          id?: string
          order_id?: string | null
          payment_method?: string | null
          receipt_path?: string | null
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          archived_at?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string
          expense_date?: string
          id?: string
          order_id?: string | null
          payment_method?: string | null
          receipt_path?: string | null
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          kind: string
          location: string | null
          name: string
          product_id: string | null
          quantity: number
          reorder_level: number
          sku: string | null
          unit: string
          unit_cost: number
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          kind?: string
          location?: string | null
          name: string
          product_id?: string | null
          quantity?: number
          reorder_level?: number
          sku?: string | null
          unit?: string
          unit_cost?: number
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          kind?: string
          location?: string | null
          name?: string
          product_id?: string | null
          quantity?: number
          reorder_level?: number
          sku?: string | null
          unit?: string
          unit_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          actor: string | null
          authorised_negative: boolean
          created_at: string
          id: string
          item_id: string
          note: string | null
          quantity_after: number | null
          quantity_change: number
          ref_entity: string | null
          ref_id: string | null
          type: string
          unit_cost: number | null
        }
        Insert: {
          actor?: string | null
          authorised_negative?: boolean
          created_at?: string
          id?: string
          item_id: string
          note?: string | null
          quantity_after?: number | null
          quantity_change: number
          ref_entity?: string | null
          ref_id?: string | null
          type: string
          unit_cost?: number | null
        }
        Update: {
          actor?: string | null
          authorised_negative?: boolean
          created_at?: string
          id?: string
          item_id?: string
          note?: string | null
          quantity_after?: number | null
          quantity_change?: number
          ref_entity?: string | null
          ref_id?: string | null
          type?: string
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      product_costs: {
        Row: {
          labour_cost: number
          material_cost: number
          overhead_cost: number
          partner_price: number | null
          product_id: string
          transport_cost: number
          updated_at: string
        }
        Insert: {
          labour_cost?: number
          material_cost?: number
          overhead_cost?: number
          partner_price?: number | null
          product_id: string
          transport_cost?: number
          updated_at?: string
        }
        Update: {
          labour_cost?: number
          material_cost?: number
          overhead_cost?: number
          partner_price?: number | null
          product_id?: string
          transport_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_costs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      production_jobs: {
        Row: {
          act_labour_cost: number
          act_material_cost: number
          act_overhead_cost: number
          assignee: string | null
          completed_at: string | null
          completed_qty: number
          created_at: string
          description: string
          est_labour_cost: number
          est_material_cost: number
          est_overhead_cost: number
          exception_reason: string | null
          id: string
          job_number: string
          notes: string | null
          order_id: string | null
          order_item_id: string | null
          product_id: string | null
          quantity: number
          route: string
          started_at: string | null
          status: string
          supplier_id: string | null
          target_date: string | null
          updated_at: string
        }
        Insert: {
          act_labour_cost?: number
          act_material_cost?: number
          act_overhead_cost?: number
          assignee?: string | null
          completed_at?: string | null
          completed_qty?: number
          created_at?: string
          description: string
          est_labour_cost?: number
          est_material_cost?: number
          est_overhead_cost?: number
          exception_reason?: string | null
          id?: string
          job_number?: string
          notes?: string | null
          order_id?: string | null
          order_item_id?: string | null
          product_id?: string | null
          quantity?: number
          route?: string
          started_at?: string | null
          status?: string
          supplier_id?: string | null
          target_date?: string | null
          updated_at?: string
        }
        Update: {
          act_labour_cost?: number
          act_material_cost?: number
          act_overhead_cost?: number
          assignee?: string | null
          completed_at?: string | null
          completed_qty?: number
          created_at?: string
          description?: string
          est_labour_cost?: number
          est_material_cost?: number
          est_overhead_cost?: number
          exception_reason?: string | null
          id?: string
          job_number?: string
          notes?: string | null
          order_id?: string | null
          order_item_id?: string | null
          product_id?: string | null
          quantity?: number
          route?: string
          started_at?: string | null
          status?: string
          supplier_id?: string | null
          target_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_jobs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_jobs_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_jobs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_jobs_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      production_materials: {
        Row: {
          created_at: string
          id: string
          inventory_item_id: string
          job_id: string
          quantity: number
          unit_cost: number
        }
        Insert: {
          created_at?: string
          id?: string
          inventory_item_id: string
          job_id: string
          quantity: number
          unit_cost?: number
        }
        Update: {
          created_at?: string
          id?: string
          inventory_item_id?: string
          job_id?: string
          quantity?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "production_materials_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "production_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_materials_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_items: {
        Row: {
          accepted_qty: number
          created_at: string
          defect_notes: string | null
          description: string
          id: string
          inventory_item_id: string | null
          order_item_id: string | null
          po_id: string
          quantity: number
          rejected_qty: number
          unit_cost: number
        }
        Insert: {
          accepted_qty?: number
          created_at?: string
          defect_notes?: string | null
          description: string
          id?: string
          inventory_item_id?: string | null
          order_item_id?: string | null
          po_id: string
          quantity: number
          rejected_qty?: number
          unit_cost?: number
        }
        Update: {
          accepted_qty?: number
          created_at?: string
          defect_notes?: string | null
          description?: string
          id?: string
          inventory_item_id?: string | null
          order_item_id?: string | null
          po_id?: string
          quantity?: number
          rejected_qty?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string
          deposit_paid: number
          expected_date: string | null
          id: string
          inspection_cost: number
          notes: string | null
          order_date: string
          order_id: string | null
          po_number: string
          received_at: string | null
          status: string
          supplier_id: string
          total: number
          transport_cost: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          deposit_paid?: number
          expected_date?: string | null
          id?: string
          inspection_cost?: number
          notes?: string | null
          order_date?: string
          order_id?: string | null
          po_number?: string
          received_at?: string | null
          status?: string
          supplier_id: string
          total?: number
          transport_cost?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          deposit_paid?: number
          expected_date?: string | null
          id?: string
          inspection_cost?: number
          notes?: string | null
          order_date?: string
          order_id?: string | null
          po_number?: string
          received_at?: string | null
          status?: string
          supplier_id?: string
          total?: number
          transport_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_checks: {
        Row: {
          checked_at: string
          checked_by: string | null
          id: string
          job_id: string | null
          notes: string | null
          po_id: string | null
          result: string
        }
        Insert: {
          checked_at?: string
          checked_by?: string | null
          id?: string
          job_id?: string | null
          notes?: string | null
          po_id?: string | null
          result: string
        }
        Update: {
          checked_at?: string
          checked_by?: string | null
          id?: string
          job_id?: string | null
          notes?: string | null
          po_id?: string | null
          result?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_checks_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "production_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_checks_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      refunds: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          method: string | null
          order_id: string
          payment_id: string
          reason: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          method?: string | null
          order_id: string
          payment_id: string
          reason: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          method?: string | null
          order_id?: string
          payment_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          method: string | null
          note: string | null
          paid_at: string
          po_id: string | null
          reference: string | null
          supplier_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          method?: string | null
          note?: string | null
          paid_at?: string
          po_id?: string | null
          reference?: string | null
          supplier_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          method?: string | null
          note?: string | null
          paid_at?: string
          po_id?: string | null
          reference?: string | null
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payments_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          contact_person: string | null
          created_at: string
          email: string | null
          id: string
          location: string | null
          name: string
          notes: string | null
          payment_terms: string | null
          phone: string | null
          products_services: string | null
          rating: number | null
          status: string
          updated_at: string
        }
        Insert: {
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          location?: string | null
          name: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          products_services?: string | null
          rating?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          location?: string | null
          name?: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          products_services?: string | null
          rating?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      product_rating_summary: {
        Row: {
          product_id: string
          rating_avg: number
          rating_count: number
        }
        Relationships: []
      }
    }
    Functions: {
      generate_job_number: { Args: never; Returns: string }
      generate_order_number: { Args: never; Returns: string }
      generate_po_number: { Args: never; Returns: string }
      record_product_view: {
        Args: { _product_id: string; _visitor_id: string }
        Returns: {
          like_count: number
          liked: boolean
          view_count: number
        }[]
      }
      toggle_product_like: {
        Args: { _product_id: string; _visitor_id: string }
        Returns: {
          like_count: number
          liked: boolean
          view_count: number
        }[]
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
