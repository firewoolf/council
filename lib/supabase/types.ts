/**
 * Supabase Database 타입.
 *
 * 정식 방법: `supabase gen types typescript --project-id <id> > lib/supabase/types.ts`
 * 지금은 0001_init.sql 스키마에 맞춰 수기로 정의 — supabase CLI 연결 전까지의 임시본.
 *
 * 스키마가 바뀌면 이 파일도 함께 갱신할 것.
 *
 * 참고: @supabase/postgrest-js@2.106 의 GenericTable 은 Relationships 필드를
 * 요구한다. 비워두면 Schema = never 로 좁혀져 SupabaseClient<Database> 가
 * 깨지므로 Relationships: [] 를 반드시 채워둔다.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      sessions: {
        Row: {
          id: string;
          user_id: string | null;
          device_id: string | null;
          title: string;
          concern: string;
          status: 'active' | 'concluded';
          ai_provider: 'gemini' | 'groq' | 'openrouter' | 'cerebras' | 'claude';
          domain: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          device_id?: string | null;
          title: string;
          concern: string;
          status?: 'active' | 'concluded';
          ai_provider?: 'gemini' | 'groq' | 'openrouter' | 'cerebras' | 'claude';
          domain?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['sessions']['Insert']>;
        Relationships: [];
      };
      personas: {
        Row: {
          id: string;
          name: string;
          role: string;
          core_value: string;
          debate_style: string;
          non_negotiable: string;
          weakness: string;
          system_prompt: string;
          color_from: string;
          color_to: string;
          is_dynamic: boolean;
          is_builtin: boolean;
          created_at: string;
        };
        Insert: Omit<
          Database['public']['Tables']['personas']['Row'],
          'created_at'
        > & { created_at?: string };
        Update: Partial<Database['public']['Tables']['personas']['Insert']>;
        Relationships: [];
      };
      session_personas: {
        Row: {
          session_id: string;
          persona_id: string;
          is_active: boolean;
          joined_at: string;
        };
        Insert: {
          session_id: string;
          persona_id: string;
          is_active?: boolean;
          joined_at?: string;
        };
        Update: Partial<
          Database['public']['Tables']['session_personas']['Insert']
        >;
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          session_id: string;
          speaker_id: string | null;
          kind: 'speech' | 'instruction';
          content: string;
          reply_to: string | null;
          is_question: boolean;
          token_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          speaker_id?: string | null;
          kind?: 'speech' | 'instruction';
          content: string;
          reply_to?: string | null;
          is_question?: boolean;
          token_count?: number;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['messages']['Insert']>;
        Relationships: [];
      };
      conclusions: {
        Row: {
          session_id: string;
          key_conclusion: string;
          risks: string[];
          persona_positions: { personaId: string; position: string }[];
          recommended_actions: string[];
          created_at: string;
        };
        Insert: {
          session_id: string;
          key_conclusion: string;
          risks: string[];
          persona_positions: { personaId: string; position: string }[];
          recommended_actions: string[];
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['conclusions']['Insert']>;
        Relationships: [];
      };
      user_credits: {
        Row: {
          user_id: string;
          credits_remaining: number;
          credits_purchased: number;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          credits_remaining?: number;
          credits_purchased?: number;
          updated_at?: string;
        };
        Update: Partial<
          Database['public']['Tables']['user_credits']['Insert']
        >;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
