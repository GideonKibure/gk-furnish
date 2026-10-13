export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string;
          description: string | null;
          description_sw: string | null;
          id: string;
          image_key: string | null;
          name: string;
          name_sw: string | null;
          slug: string;
          sort_order: number;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          description_sw?: string | null;
          id?: string;
          image_key?: string | null;
          name: string;
          name_sw?: string | null;
          slug: string;
          sort_order?: number;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          description_sw?: string | null;
          id?: string;
          image_key?: string | null;
          name?: string;
          name_sw?: string | null;
          slug?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      contact_messages: {
        Row: {
          created_at: string;
          email: string | null;
          id: string;
          message: string;
          name: string;
          phone: string | null;
          subject: string | null;
        };
        Insert: {
          created_at?: string;
          email?: string | null;
          id?: string;
          message: string;
          name: string;
          phone?: string | null;
          subject?: string | null;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          id?: string;
          message?: string;
          name?: string;
          phone?: string | null;
          subject?: string | null;
        };
        Relationships: [];
      };
      admin_users: {
        Row: {
          created_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      custom_orders: {
        Row: {
          additional_requirements: string | null;
          budget_range: string | null;
          created_at: string;
          delivery_location: string;
          design_description: string;
          email: string | null;
          full_name: string;
          furniture_type: string;
          id: string;
          phone: string;
          preferred_color: string | null;
          preferred_dimensions: string | null;
          preferred_material: string | null;
          quantity: number;
          reference_image_url: string | null;
          request_number: string;
          status: string;
        };
        Insert: {
          additional_requirements?: string | null;
          budget_range?: string | null;
          created_at?: string;
          delivery_location: string;
          design_description: string;
          email?: string | null;
          full_name: string;
          furniture_type: string;
          id?: string;
          phone: string;
          preferred_color?: string | null;
          preferred_dimensions?: string | null;
          preferred_material?: string | null;
          quantity?: number;
          reference_image_url?: string | null;
          request_number?: string;
          status?: string;
        };
        Update: {
          additional_requirements?: string | null;
          budget_range?: string | null;
          created_at?: string;
          delivery_location?: string;
          design_description?: string;
          email?: string | null;
          full_name?: string;
          furniture_type?: string;
          id?: string;
          phone?: string;
          preferred_color?: string | null;
          preferred_dimensions?: string | null;
          preferred_material?: string | null;
          quantity?: number;
          reference_image_url?: string | null;
          request_number?: string;
          status?: string;
        };
        Relationships: [];
      };
      order_items: {
        Row: {
          created_at: string;
          id: string;
          order_id: string;
          product_id: string | null;
          product_name: string;
          quantity: number;
          unit_price: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          order_id: string;
          product_id?: string | null;
          product_name: string;
          quantity: number;
          unit_price: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          order_id?: string;
          product_id?: string | null;
          product_name?: string;
          quantity?: number;
          unit_price?: number;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      order_status_history: {
        Row: {
          created_at: string;
          id: string;
          note: string | null;
          order_id: string;
          status: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          note?: string | null;
          order_id: string;
          status: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          note?: string | null;
          order_id?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      offer_popups: {
        Row: {
          created_at: string;
          delay_seconds: number;
          duration_seconds: number;
          id: string;
          is_active: boolean;
          message_en: string;
          message_sw: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          delay_seconds?: number;
          duration_seconds?: number;
          id?: string;
          is_active?: boolean;
          message_en: string;
          message_sw?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          delay_seconds?: number;
          duration_seconds?: number;
          id?: string;
          is_active?: boolean;
          message_en?: string;
          message_sw?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      orders: {
        Row: {
          amount_due: number;
          amount_paid: number;
          created_at: string;
          customer_name: string;
          delivery_location: string;
          email: string | null;
          id: string;
          notes: string | null;
          order_number: string;
          payment_kind: string;
          payment_phone: string | null;
          payment_status: string;
          phone: string;
          preferred_color: string | null;
          preferred_size: string | null;
          snippe_reference: string | null;
          status: string;
        };
        Insert: {
          amount_due?: number;
          amount_paid?: number;
          created_at?: string;
          customer_name: string;
          delivery_location: string;
          email?: string | null;
          id?: string;
          notes?: string | null;
          order_number?: string;
          payment_kind?: string;
          payment_phone?: string | null;
          payment_status?: string;
          phone: string;
          preferred_color?: string | null;
          preferred_size?: string | null;
          snippe_reference?: string | null;
          status?: string;
        };
        Update: {
          amount_due?: number;
          amount_paid?: number;
          created_at?: string;
          customer_name?: string;
          delivery_location?: string;
          email?: string | null;
          id?: string;
          notes?: string | null;
          order_number?: string;
          payment_kind?: string;
          payment_phone?: string | null;
          payment_status?: string;
          phone?: string;
          preferred_color?: string | null;
          preferred_size?: string | null;
          snippe_reference?: string | null;
          status?: string;
        };
        Relationships: [];
      };
      page_sections: {
        Row: {
          content_en: string;
          content_sw: string;
          id: string;
          page_key: string;
          section_key: string;
          updated_at: string;
        };
        Insert: {
          content_en?: string;
          content_sw?: string;
          id?: string;
          page_key: string;
          section_key: string;
          updated_at?: string;
        };
        Update: {
          content_en?: string;
          content_sw?: string;
          id?: string;
          page_key?: string;
          section_key?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          amount: number;
          created_at: string;
          currency: string;
          id: string;
          metadata: Json;
          order_id: string;
          payment_kind: string;
          phone: string | null;
          provider: string | null;
          snippe_reference: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          currency?: string;
          id?: string;
          metadata?: Json;
          order_id: string;
          payment_kind: string;
          phone?: string | null;
          provider?: string | null;
          snippe_reference?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          currency?: string;
          id?: string;
          metadata?: Json;
          order_id?: string;
          payment_kind?: string;
          phone?: string | null;
          provider?: string | null;
          snippe_reference?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      site_settings: {
        Row: {
          email: string | null;
          facebook_url: string | null;
          id: number;
          instagram_url: string | null;
          location: string | null;
          phone_dial: string | null;
          phone_display: string | null;
          tagline: string | null;
          tiktok_url: string | null;
          updated_at: string;
          whatsapp_number: string | null;
        };
        Insert: {
          email?: string | null;
          facebook_url?: string | null;
          id?: number;
          instagram_url?: string | null;
          location?: string | null;
          phone_dial?: string | null;
          phone_display?: string | null;
          tagline?: string | null;
          tiktok_url?: string | null;
          updated_at?: string;
          whatsapp_number?: string | null;
        };
        Update: {
          email?: string | null;
          facebook_url?: string | null;
          id?: number;
          instagram_url?: string | null;
          location?: string | null;
          phone_dial?: string | null;
          phone_display?: string | null;
          tagline?: string | null;
          tiktok_url?: string | null;
          updated_at?: string;
          whatsapp_number?: string | null;
        };
        Relationships: [];
      };
      product_engagement: {
        Row: {
          liked: boolean;
          product_id: string;
          viewed: boolean;
          visitor_id: string;
        };
        Insert: {
          liked?: boolean;
          product_id: string;
          viewed?: boolean;
          visitor_id: string;
        };
        Update: {
          liked?: boolean;
          product_id?: string;
          viewed?: boolean;
          visitor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_engagement_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_images: {
        Row: {
          alt_text: string | null;
          created_at: string;
          id: string;
          image_key: string | null;
          image_url: string | null;
          product_id: string;
          sort_order: number;
        };
        Insert: {
          alt_text?: string | null;
          created_at?: string;
          id?: string;
          image_key?: string | null;
          image_url?: string | null;
          product_id: string;
          sort_order?: number;
        };
        Update: {
          alt_text?: string | null;
          created_at?: string;
          id?: string;
          image_key?: string | null;
          image_url?: string | null;
          product_id?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          available_colors: string[];
          category_id: string;
          created_at: string;
          description: string;
          description_sw: string | null;
          dimensions: string | null;
          features: string[];
          id: string;
          image_key: string | null;
          image_url: string | null;
          is_available: boolean;
          is_demo: boolean;
          is_featured: boolean;
          like_count: number;
          material: string | null;
          name: string;
          name_sw: string | null;
          price: number;
          short_description: string | null;
          slug: string;
          stock_quantity: number;
          updated_at: string;
          view_count: number;
        };
        Insert: {
          available_colors?: string[];
          category_id: string;
          created_at?: string;
          description?: string;
          description_sw?: string | null;
          dimensions?: string | null;
          features?: string[];
          id?: string;
          image_key?: string | null;
          image_url?: string | null;
          is_available?: boolean;
          is_demo?: boolean;
          is_featured?: boolean;
          like_count?: number;
          material?: string | null;
          name: string;
          name_sw?: string | null;
          price: number;
          short_description?: string | null;
          slug: string;
          stock_quantity?: number;
          updated_at?: string;
          view_count?: number;
        };
        Update: {
          available_colors?: string[];
          category_id?: string;
          created_at?: string;
          description?: string;
          description_sw?: string | null;
          dimensions?: string | null;
          features?: string[];
          id?: string;
          image_key?: string | null;
          image_url?: string | null;
          is_available?: boolean;
          is_demo?: boolean;
          is_featured?: boolean;
          like_count?: number;
          material?: string | null;
          name?: string;
          name_sw?: string | null;
          price?: number;
          short_description?: string | null;
          slug?: string;
          stock_quantity?: number;
          updated_at?: string;
          view_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      generate_order_number: { Args: never; Returns: string };
      record_product_view: {
        Args: { _product_id: string; _visitor_id: string };
        Returns: {
          like_count: number;
          liked: boolean;
          view_count: number;
        }[];
      };
      toggle_product_like: {
        Args: { _product_id: string; _visitor_id: string };
        Returns: {
          like_count: number;
          liked: boolean;
          view_count: number;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
