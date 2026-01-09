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
      signals: {
        Row: {
          id: string
          user_id: string
          signal_type: 'email' | 'youtube' | 'social_media' | 'rss' | 'podcast'
          raw_content: string | null
          title: string
          source_identifier: string
          source_url: string | null
          received_date: string
          processed_at: string | null
          status: 'pending' | 'processed' | 'failed'
          error_message: string | null
          retry_count: number
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          signal_type: 'email' | 'youtube' | 'social_media' | 'rss' | 'podcast'
          raw_content?: string | null
          title: string
          source_identifier: string
          source_url?: string | null
          received_date: string
          processed_at?: string | null
          status?: 'pending' | 'processed' | 'failed'
          error_message?: string | null
          retry_count?: number
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          signal_type?: 'email' | 'youtube' | 'social_media' | 'rss' | 'podcast'
          raw_content?: string | null
          title?: string
          source_identifier?: string
          source_url?: string | null
          received_date?: string
          processed_at?: string | null
          status?: 'pending' | 'processed' | 'failed'
          error_message?: string | null
          retry_count?: number
          metadata?: Json | null
          created_at?: string
        }
      }
      nuggets: {
        Row: {
          id: string
          user_id: string
          signal_id: string
          title: string
          description: string
          content: string | null
          link: string | null
          source: string
          published_date: string
          relevancy_score: number
          topic: string
          tags: string[]
          duplicate_group_id: string | null
          is_primary: boolean
          is_read: boolean
          read_at: string | null
          is_archived: boolean
          user_notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          signal_id: string
          title: string
          description: string
          content?: string | null
          link?: string | null
          source: string
          published_date: string
          relevancy_score: number
          topic: string
          tags?: string[]
          duplicate_group_id?: string | null
          is_primary?: boolean
          is_read?: boolean
          read_at?: string | null
          is_archived?: boolean
          user_notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          signal_id?: string
          title?: string
          description?: string
          content?: string | null
          link?: string | null
          source?: string
          published_date?: string
          relevancy_score?: number
          topic?: string
          tags?: string[]
          duplicate_group_id?: string | null
          is_primary?: boolean
          is_read?: boolean
          read_at?: string | null
          is_archived?: boolean
          user_notes?: string | null
          created_at?: string
        }
      }
      user_settings: {
        Row: {
          user_id: string
          interests_description: string | null
          relevancy_threshold: number
          approved_topics: string[]
          taxonomy_topics: string[]
          email_check_frequency: string
          api_key_hash: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          interests_description?: string | null
          relevancy_threshold?: number
          approved_topics?: string[]
          taxonomy_topics?: string[]
          email_check_frequency?: string
          api_key_hash?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          interests_description?: string | null
          relevancy_threshold?: number
          approved_topics?: string[]
          taxonomy_topics?: string[]
          email_check_frequency?: string
          api_key_hash?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      processing_errors: {
        Row: {
          id: string
          signal_id: string | null
          error_type: string
          error_message: string
          stack_trace: string | null
          occurred_at: string
          resolved: boolean
        }
        Insert: {
          id?: string
          signal_id?: string | null
          error_type: string
          error_message: string
          stack_trace?: string | null
          occurred_at?: string
          resolved?: boolean
        }
        Update: {
          id?: string
          signal_id?: string | null
          error_type?: string
          error_message?: string
          stack_trace?: string | null
          occurred_at?: string
          resolved?: boolean
        }
      }
    }
  }
}
