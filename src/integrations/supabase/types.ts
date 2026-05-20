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
  public: {
    Tables: {
      browsing_history: {
        Row: {
          content_id: string
          content_title: string | null
          content_type: string
          created_at: string
          id: string
          poster_path: string | null
          user_id: string
          viewed_at: string
        }
        Insert: {
          content_id: string
          content_title?: string | null
          content_type: string
          created_at?: string
          id?: string
          poster_path?: string | null
          user_id: string
          viewed_at?: string
        }
        Update: {
          content_id?: string
          content_title?: string | null
          content_type?: string
          created_at?: string
          id?: string
          poster_path?: string | null
          user_id?: string
          viewed_at?: string
        }
        Relationships: []
      }
      contact_submissions: {
        Row: {
          comments: string
          created_at: string
          email: string
          id: string
          phone_number: string | null
        }
        Insert: {
          comments: string
          created_at?: string
          email: string
          id?: string
          phone_number?: string | null
        }
        Update: {
          comments?: string
          created_at?: string
          email?: string
          id?: string
          phone_number?: string | null
        }
        Relationships: []
      }
      internal_secrets: {
        Row: {
          created_at: string | null
          key_name: string
          key_value: string
        }
        Insert: {
          created_at?: string | null
          key_name: string
          key_value: string
        }
        Update: {
          created_at?: string | null
          key_name?: string
          key_value?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          genre_preferences: Json | null
          id: string
          language_preferences: Json | null
          mobile_number: string | null
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          genre_preferences?: Json | null
          id?: string
          language_preferences?: Json | null
          mobile_number?: string | null
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          created_at?: string
          email?: string | null
          genre_preferences?: Json | null
          id?: string
          language_preferences?: Json | null
          mobile_number?: string | null
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      reminders: {
        Row: {
          content_id: string
          content_title: string | null
          content_type: string | null
          created_at: string
          id: string
          last_notified_on: string | null
          notified_at: string | null
          notify_email: boolean
          notify_whatsapp: boolean
          release_date: string
          remind_at: string
          retry_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          content_id: string
          content_title?: string | null
          content_type?: string | null
          created_at?: string
          id?: string
          last_notified_on?: string | null
          notified_at?: string | null
          notify_email?: boolean
          notify_whatsapp?: boolean
          release_date: string
          remind_at: string
          retry_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          content_id?: string
          content_title?: string | null
          content_type?: string | null
          created_at?: string
          id?: string
          last_notified_on?: string | null
          notified_at?: string | null
          notify_email?: boolean
          notify_whatsapp?: boolean
          release_date?: string
          remind_at?: string
          retry_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      taste_classics: {
        Row: {
          description: string | null
          genre: string
          id: number
          language: string
          ott_platform: string | null
          popularity_score: number | null
          poster_url: string | null
          title: string
          year: number | null
        }
        Insert: {
          description?: string | null
          genre: string
          id?: number
          language: string
          ott_platform?: string | null
          popularity_score?: number | null
          poster_url?: string | null
          title: string
          year?: number | null
        }
        Update: {
          description?: string | null
          genre?: string
          id?: number
          language?: string
          ott_platform?: string | null
          popularity_score?: number | null
          poster_url?: string | null
          title?: string
          year?: number | null
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          content_id: string
          content_title: string | null
          content_type: string
          created_at: string
          id: string
          poster_path: string | null
          reaction: string | null
          user_id: string
        }
        Insert: {
          content_id: string
          content_title?: string | null
          content_type: string
          created_at?: string
          id?: string
          poster_path?: string | null
          reaction?: string | null
          user_id: string
        }
        Update: {
          content_id?: string
          content_title?: string | null
          content_type?: string
          created_at?: string
          id?: string
          poster_path?: string | null
          reaction?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      send_due_reminders: { Args: never; Returns: undefined }
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
