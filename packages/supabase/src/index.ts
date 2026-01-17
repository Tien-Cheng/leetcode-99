import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export * from "./queries.js";

/**
 * @leet99/supabase - Supabase client helpers
 *
 * Provides typed Supabase client creation for server and browser contexts.
 */

/**
 * Create a Supabase client for server-side use (with service role key).
 * Only use this in server contexts (API routes, PartyKit).
 */
export function createServerClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing Supabase server credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Create a Supabase client for browser use (with anon key).
 * Safe for client-side bundles.
 */
export function createBrowserClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing Supabase browser credentials. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  return createClient(url, key);
}

/**
 * Database types (to be generated from Supabase schema).
 * For now, define manually based on Backend API Spec.
 */
export interface Database {
  public: {
    Tables: {
      matches: {
        Row: {
          id: string;
          room_id: string;
          started_at: string;
          ended_at: string;
          end_reason: "lastAlive" | "timeExpired";
          settings: Record<string, unknown>;
        };
        Insert: {
          id: string;
          room_id: string;
          started_at: string;
          ended_at: string;
          end_reason: "lastAlive" | "timeExpired";
          settings: Record<string, unknown>;
        };
        Update: Partial<Database["public"]["Tables"]["matches"]["Insert"]>;
      };
      match_players: {
        Row: {
          match_id: string;
          player_id: string;
          username: string;
          role: "player" | "bot";
          score: number;
          rank: number;
          eliminated_at: string | null;
        };
        Insert: {
          match_id: string;
          player_id: string;
          username: string;
          role: "player" | "bot";
          score: number;
          rank: number;
          eliminated_at?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["match_players"]["Insert"]
        >;
      };
    };
  };
}
