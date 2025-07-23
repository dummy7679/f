import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      meetings: {
        Row: {
          id: string;
          title: string;
          host_name: string;
          start_time: string;
          end_time?: string;
          is_private: boolean;
          access_code: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          host_name: string;
          start_time: string;
          end_time?: string;
          is_private?: boolean;
          access_code: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          host_name?: string;
          start_time?: string;
          end_time?: string;
          is_private?: boolean;
          access_code?: string;
          created_at?: string;
        };
      };
      participants: {
        Row: {
          id: string;
          user_id?: string;
          meeting_id: string;
          name: string;
          joined_at: string;
          left_at?: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          meeting_id: string;
          name: string;
          joined_at?: string;
          left_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          meeting_id?: string;
          name?: string;
          joined_at?: string;
          left_at?: string;
        };
      };
    };
  };
};