export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      action_throttle: {
        Row: {
          action: string;
          hits: number;
          user_id: string;
          window_start: string;
        };
        Insert: {
          action: string;
          hits?: number;
          user_id: string;
          window_start?: string;
        };
        Update: {
          action?: string;
          hits?: number;
          user_id?: string;
          window_start?: string;
        };
        Relationships: [];
      };
      bake_sessions: {
        Row: {
          completed_at: string | null;
          id: string;
          quality: number | null;
          recipe_code: string;
          started_at: string;
          status: string;
          user_id: string;
          visit_id: string | null;
        };
        Insert: {
          completed_at?: string | null;
          id?: string;
          quality?: number | null;
          recipe_code: string;
          started_at?: string;
          status?: string;
          user_id: string;
          visit_id?: string | null;
        };
        Update: {
          completed_at?: string | null;
          id?: string;
          quality?: number | null;
          recipe_code?: string;
          started_at?: string;
          status?: string;
          user_id?: string;
          visit_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "bake_sessions_recipe_code_fkey";
            columns: ["recipe_code"];
            isOneToOne: false;
            referencedRelation: "recipes";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "bake_sessions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "leaderboard";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bake_sessions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bake_sessions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bake_sessions_visit_id_fkey";
            columns: ["visit_id"];
            isOneToOne: false;
            referencedRelation: "customer_visits";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_visits: {
        Row: {
          arrive_at: string;
          created_at: string;
          customer_id: number;
          id: string;
          leave_at: string;
          paid: number | null;
          quality: number | null;
          recipe_code: string;
          reputation_delta: number | null;
          result: Json | null;
          sauce_code: string | null;
          served_at: string | null;
          status: string;
          tip: number | null;
          topping_code: string | null;
          user_id: string;
        };
        Insert: {
          arrive_at: string;
          created_at?: string;
          customer_id: number;
          id?: string;
          leave_at: string;
          paid?: number | null;
          quality?: number | null;
          recipe_code: string;
          reputation_delta?: number | null;
          result?: Json | null;
          sauce_code?: string | null;
          served_at?: string | null;
          status?: string;
          tip?: number | null;
          topping_code?: string | null;
          user_id: string;
        };
        Update: {
          arrive_at?: string;
          created_at?: string;
          customer_id?: number;
          id?: string;
          leave_at?: string;
          paid?: number | null;
          quality?: number | null;
          recipe_code?: string;
          reputation_delta?: number | null;
          result?: Json | null;
          sauce_code?: string | null;
          served_at?: string | null;
          status?: string;
          tip?: number | null;
          topping_code?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customer_visits_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_visits_recipe_code_fkey";
            columns: ["recipe_code"];
            isOneToOne: false;
            referencedRelation: "recipes";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "customer_visits_sauce_code_fkey";
            columns: ["sauce_code"];
            isOneToOne: false;
            referencedRelation: "ingredients";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "customer_visits_topping_code_fkey";
            columns: ["topping_code"];
            isOneToOne: false;
            referencedRelation: "ingredients";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "customer_visits_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "leaderboard";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_visits_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_visits_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      customers: {
        Row: {
          bio: string;
          created_at: string;
          dine_and_dash: boolean;
          dine_dash_pct: number;
          favorite_recipe: string;
          favorite_sauce: string | null;
          favorite_topping: string | null;
          gender: string;
          id: number;
          image: string | null;
          impatient: boolean;
          look: number;
          min_quality: number;
          name: string;
          patience_seconds: number;
          personality: string;
          picky: boolean;
          spend: number;
        };
        Insert: {
          bio?: string;
          created_at?: string;
          dine_and_dash?: boolean;
          dine_dash_pct?: number;
          favorite_recipe: string;
          favorite_sauce?: string | null;
          favorite_topping?: string | null;
          gender: string;
          id: number;
          image?: string | null;
          impatient?: boolean;
          look: number;
          min_quality?: number;
          name: string;
          patience_seconds: number;
          personality: string;
          picky?: boolean;
          spend?: number;
        };
        Update: {
          bio?: string;
          created_at?: string;
          dine_and_dash?: boolean;
          dine_dash_pct?: number;
          favorite_recipe?: string;
          favorite_sauce?: string | null;
          favorite_topping?: string | null;
          gender?: string;
          id?: number;
          image?: string | null;
          impatient?: boolean;
          look?: number;
          min_quality?: number;
          name?: string;
          patience_seconds?: number;
          personality?: string;
          picky?: boolean;
          spend?: number;
        };
        Relationships: [
          {
            foreignKeyName: "customers_favorite_recipe_fkey";
            columns: ["favorite_recipe"];
            isOneToOne: false;
            referencedRelation: "recipes";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "customers_favorite_sauce_fkey";
            columns: ["favorite_sauce"];
            isOneToOne: false;
            referencedRelation: "ingredients";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "customers_favorite_topping_fkey";
            columns: ["favorite_topping"];
            isOneToOne: false;
            referencedRelation: "ingredients";
            referencedColumns: ["code"];
          },
        ];
      };
      daily_quests: {
        Row: {
          claimed_at: string | null;
          created_at: string;
          day: string;
          quest_code: string;
          user_id: string;
        };
        Insert: {
          claimed_at?: string | null;
          created_at?: string;
          day: string;
          quest_code: string;
          user_id: string;
        };
        Update: {
          claimed_at?: string | null;
          created_at?: string;
          day?: string;
          quest_code?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "daily_quests_quest_code_fkey";
            columns: ["quest_code"];
            isOneToOne: false;
            referencedRelation: "quest_catalog";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "daily_quests_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "leaderboard";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "daily_quests_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "daily_quests_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      ingredients: {
        Row: {
          category: string | null;
          code: string;
          created_at: string;
          image: string | null;
          kind: string;
          name: string;
          price: number;
          sort: number;
        };
        Insert: {
          category?: string | null;
          code: string;
          created_at?: string;
          image?: string | null;
          kind?: string;
          name: string;
          price: number;
          sort?: number;
        };
        Update: {
          category?: string | null;
          code?: string;
          created_at?: string;
          image?: string | null;
          kind?: string;
          name?: string;
          price?: number;
          sort?: number;
        };
        Relationships: [];
      };
      inventory: {
        Row: {
          ingredient_code: string;
          qty: number;
          user_id: string;
        };
        Insert: {
          ingredient_code: string;
          qty?: number;
          user_id: string;
        };
        Update: {
          ingredient_code?: string;
          qty?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_ingredient_code_fkey";
            columns: ["ingredient_code"];
            isOneToOne: false;
            referencedRelation: "ingredients";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "inventory_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "leaderboard";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      market_listings: {
        Row: {
          buyer_id: string | null;
          closed_at: string | null;
          created_at: string;
          fee: number | null;
          id: string;
          item_code: string;
          kind: string;
          price: number;
          qty: number;
          quality: number | null;
          seller_id: string;
          status: string;
        };
        Insert: {
          buyer_id?: string | null;
          closed_at?: string | null;
          created_at?: string;
          fee?: number | null;
          id?: string;
          item_code: string;
          kind: string;
          price: number;
          qty: number;
          quality?: number | null;
          seller_id: string;
          status?: string;
        };
        Update: {
          buyer_id?: string | null;
          closed_at?: string | null;
          created_at?: string;
          fee?: number | null;
          id?: string;
          item_code?: string;
          kind?: string;
          price?: number;
          qty?: number;
          quality?: number | null;
          seller_id?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "market_listings_buyer_id_fkey";
            columns: ["buyer_id"];
            isOneToOne: false;
            referencedRelation: "leaderboard";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "market_listings_buyer_id_fkey";
            columns: ["buyer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "market_listings_buyer_id_fkey";
            columns: ["buyer_id"];
            isOneToOne: false;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "market_listings_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "leaderboard";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "market_listings_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "market_listings_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          active_theme: string;
          avatar: string;
          avatar_url: string | null;
          bio: string;
          checkin_streak: number;
          coins: number;
          color: string;
          created_at: string;
          gems: number;
          id: string;
          last_checkin: string | null;
          last_seen_at: string | null;
          level: number;
          owner_name: string;
          reputation: number;
          revenue_day: string | null;
          revenue_today: number;
          revenue_total: number;
          review_counts: number[];
          shop_name: string;
          shop_open: boolean;
          slug: string;
          updated_at: string;
          visits_until: string | null;
          xp: number;
          _market_eligible: boolean | null;
        };
        Insert: {
          active_theme?: string;
          avatar: string;
          avatar_url?: string | null;
          bio?: string;
          checkin_streak?: number;
          coins?: number;
          color: string;
          created_at?: string;
          gems?: number;
          id: string;
          last_checkin?: string | null;
          last_seen_at?: string | null;
          level?: number;
          owner_name: string;
          reputation?: number;
          revenue_day?: string | null;
          revenue_today?: number;
          revenue_total?: number;
          review_counts?: number[];
          shop_name: string;
          shop_open?: boolean;
          slug: string;
          updated_at?: string;
          visits_until?: string | null;
          xp?: number;
        };
        Update: {
          active_theme?: string;
          avatar?: string;
          avatar_url?: string | null;
          bio?: string;
          checkin_streak?: number;
          coins?: number;
          color?: string;
          created_at?: string;
          gems?: number;
          id?: string;
          last_checkin?: string | null;
          last_seen_at?: string | null;
          level?: number;
          owner_name?: string;
          reputation?: number;
          revenue_day?: string | null;
          revenue_today?: number;
          revenue_total?: number;
          review_counts?: number[];
          shop_name?: string;
          shop_open?: boolean;
          slug?: string;
          updated_at?: string;
          visits_until?: string | null;
          xp?: number;
        };
        Relationships: [];
      };
      quest_catalog: {
        Row: {
          code: string;
          description: string;
          grp: string;
          metric: string;
          min_level: number;
          n1: number | null;
          n2: number | null;
          param: string | null;
          reward_coins: number;
          reward_gems: number;
          reward_xp: number;
          sort: number;
          target: number;
          title: string;
        };
        Insert: {
          code: string;
          description: string;
          grp: string;
          metric: string;
          min_level?: number;
          n1?: number | null;
          n2?: number | null;
          param?: string | null;
          reward_coins?: number;
          reward_gems?: number;
          reward_xp?: number;
          sort?: number;
          target: number;
          title: string;
        };
        Update: {
          code?: string;
          description?: string;
          grp?: string;
          metric?: string;
          min_level?: number;
          n1?: number | null;
          n2?: number | null;
          param?: string | null;
          reward_coins?: number;
          reward_gems?: number;
          reward_xp?: number;
          sort?: number;
          target?: number;
          title?: string;
        };
        Relationships: [];
      };
      recipe_ingredients: {
        Row: {
          ingredient_code: string;
          qty: number;
          recipe_code: string;
        };
        Insert: {
          ingredient_code: string;
          qty: number;
          recipe_code: string;
        };
        Update: {
          ingredient_code?: string;
          qty?: number;
          recipe_code?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_ingredient_code_fkey";
            columns: ["ingredient_code"];
            isOneToOne: false;
            referencedRelation: "ingredients";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "recipe_ingredients_recipe_code_fkey";
            columns: ["recipe_code"];
            isOneToOne: false;
            referencedRelation: "recipes";
            referencedColumns: ["code"];
          },
        ];
      };
      recipes: {
        Row: {
          base_price: number;
          code: string;
          cook_method: string;
          created_at: string;
          image: string | null;
          min_play_seconds: number;
          name: string;
          packaging: string;
          sort: number;
          unlock_level: number;
          xp: number;
        };
        Insert: {
          base_price: number;
          code: string;
          cook_method?: string;
          created_at?: string;
          image?: string | null;
          min_play_seconds: number;
          name: string;
          packaging?: string;
          sort?: number;
          unlock_level?: number;
          xp: number;
        };
        Update: {
          base_price?: number;
          code?: string;
          cook_method?: string;
          created_at?: string;
          image?: string | null;
          min_play_seconds?: number;
          name?: string;
          packaging?: string;
          sort?: number;
          unlock_level?: number;
          xp?: number;
        };
        Relationships: [];
      };
      reviews: {
        Row: {
          comment: string;
          created_at: string;
          customer_id: number;
          id: string;
          replied_at: string | null;
          reply: string | null;
          stars: number;
          user_id: string;
          visit_id: string;
        };
        Insert: {
          comment: string;
          created_at?: string;
          customer_id: number;
          id?: string;
          replied_at?: string | null;
          reply?: string | null;
          stars: number;
          user_id: string;
          visit_id: string;
        };
        Update: {
          comment?: string;
          created_at?: string;
          customer_id?: number;
          id?: string;
          replied_at?: string | null;
          reply?: string | null;
          stars?: number;
          user_id?: string;
          visit_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "leaderboard";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_visit_id_fkey";
            columns: ["visit_id"];
            isOneToOne: true;
            referencedRelation: "customer_visits";
            referencedColumns: ["id"];
          },
        ];
      };
      transactions_log: {
        Row: {
          coins_delta: number;
          created_at: string;
          gems_delta: number;
          id: number;
          kind: string;
          meta: NonNullable<Json>;
          ref_id: string | null;
          user_id: string;
        };
        Insert: {
          coins_delta?: number;
          created_at?: string;
          gems_delta?: number;
          id?: never;
          kind: string;
          meta?: NonNullable<Json>;
          ref_id?: string | null;
          user_id: string;
        };
        Update: {
          coins_delta?: number;
          created_at?: string;
          gems_delta?: number;
          id?: never;
          kind?: string;
          meta?: NonNullable<Json>;
          ref_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transactions_log_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "leaderboard";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_log_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_log_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      upgrade_catalog: {
        Row: {
          code: string;
          cost_coins: number;
          cost_gems: number;
          created_at: string;
          decor_type: string | null;
          description: string;
          effect: number;
          image: string | null;
          kind: string;
          name: string;
          requires_code: string | null;
          scene_slot: string | null;
          seats: number;
          sort: number;
          tier: number;
          unlock_level: number;
        };
        Insert: {
          code: string;
          cost_coins?: number;
          cost_gems?: number;
          created_at?: string;
          decor_type?: string | null;
          description?: string;
          effect?: number;
          image?: string | null;
          kind: string;
          name: string;
          requires_code?: string | null;
          scene_slot?: string | null;
          seats?: number;
          sort?: number;
          tier?: number;
          unlock_level?: number;
        };
        Update: {
          code?: string;
          cost_coins?: number;
          cost_gems?: number;
          created_at?: string;
          decor_type?: string | null;
          description?: string;
          effect?: number;
          image?: string | null;
          kind?: string;
          name?: string;
          requires_code?: string | null;
          scene_slot?: string | null;
          seats?: number;
          sort?: number;
          tier?: number;
          unlock_level?: number;
        };
        Relationships: [
          {
            foreignKeyName: "upgrade_catalog_requires_code_fkey";
            columns: ["requires_code"];
            isOneToOne: false;
            referencedRelation: "upgrade_catalog";
            referencedColumns: ["code"];
          },
        ];
      };
      upgrades: {
        Row: {
          purchased_at: string;
          upgrade_code: string;
          user_id: string;
        };
        Insert: {
          purchased_at?: string;
          upgrade_code: string;
          user_id: string;
        };
        Update: {
          purchased_at?: string;
          upgrade_code?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "upgrades_upgrade_code_fkey";
            columns: ["upgrade_code"];
            isOneToOne: false;
            referencedRelation: "upgrade_catalog";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "upgrades_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "leaderboard";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "upgrades_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "upgrades_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      leaderboard: {
        Row: {
          avatar: string | null;
          avatar_url: string | null;
          color: string | null;
          id: string | null;
          level: number | null;
          reputation: number | null;
          reputation_rank: number | null;
          revenue_rank: number | null;
          revenue_total: number | null;
          shop_name: string | null;
          slug: string | null;
        };
        Relationships: [];
      };
      market_feed: {
        Row: {
          created_at: string | null;
          id: string | null;
          item_code: string | null;
          item_image: string | null;
          item_name: string | null;
          kind: string | null;
          price: number | null;
          qty: number | null;
          quality: number | null;
          seller_id: string | null;
          seller_shop: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "market_listings_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "leaderboard";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "market_listings_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "market_listings_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      public_profiles: {
        Row: {
          active_theme: string | null;
          avatar: string | null;
          avatar_url: string | null;
          bio: string | null;
          color: string | null;
          created_at: string | null;
          id: string | null;
          last_seen_at: string | null;
          level: number | null;
          owner_name: string | null;
          reputation: number | null;
          revenue_total: number | null;
          review_avg: number | null;
          review_count: number | null;
          shop_name: string | null;
          slug: string | null;
        };
        Insert: {
          active_theme?: string | null;
          avatar?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          color?: string | null;
          created_at?: string | null;
          id?: string | null;
          last_seen_at?: string | null;
          level?: number | null;
          owner_name?: string | null;
          reputation?: number | null;
          revenue_total?: number | null;
          review_avg?: never;
          review_count?: never;
          shop_name?: never;
          slug?: string | null;
        };
        Update: {
          active_theme?: string | null;
          avatar?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          color?: string | null;
          created_at?: string | null;
          id?: string | null;
          last_seen_at?: string | null;
          level?: number | null;
          owner_name?: string | null;
          reputation?: number | null;
          revenue_total?: number | null;
          review_avg?: never;
          review_count?: never;
          shop_name?: never;
          slug?: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      _add_inventory: {
        Args: { p_code: string; p_qty: number; p_user: string };
        Returns: undefined;
      };
      _customer_tick_at: { Args: { p_now: string; p_user: string }; Returns: Json };
      _ensure_daily_quests: {
        Args: { p_day: string; p_level: number; p_user: string };
        Returns: undefined;
      };
      _fail: { Args: { p_code: string }; Returns: undefined };
      _game_clock: { Args: { p_at: string }; Returns: Json };
      _game_minute: { Args: { p_at: string }; Returns: number };
      _game_open: { Args: { p_at: string }; Returns: boolean };
      _is_bad_name: { Args: { p_text: string }; Returns: boolean };
      _level_for_xp: { Args: { p_xp: number }; Returns: number };
      _lock_profile: {
        Args: { p_user: string };
        Returns: {
          active_theme: string;
          avatar: string;
          avatar_url: string | null;
          bio: string;
          checkin_streak: number;
          coins: number;
          color: string;
          created_at: string;
          gems: number;
          id: string;
          last_checkin: string | null;
          last_seen_at: string | null;
          level: number;
          owner_name: string;
          reputation: number;
          revenue_day: string | null;
          revenue_today: number;
          revenue_total: number;
          shop_name: string;
          shop_open: boolean;
          slug: string;
          updated_at: string;
          visits_until: string | null;
          xp: number;
        };
        SetofOptions: {
          from: "*";
          to: "profiles";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      _log: {
        Args: {
          p_coins: number;
          p_gems: number;
          p_kind: string;
          p_meta: Json;
          p_ref: string;
          p_user: string;
        };
        Returns: undefined;
      };
      _market_eligible: {
        Args: { p: Database["public"]["Tables"]["profiles"]["Row"] };
        Returns: boolean;
      };
      _pick: { Args: { p_options: string[] }; Returns: string };
      _quality_pct: { Args: { p_quality: number }; Returns: number };
      _quest_progress: {
        Args: {
          p_day: string;
          p_user: string;
          q: Database["public"]["Tables"]["quest_catalog"]["Row"];
        };
        Returns: number;
      };
      _quests_json: { Args: { p_day: string; p_user: string }; Returns: Json };
      _rate_limit: {
        Args: { p_kind: string; p_max: number; p_user: string; p_window: string };
        Returns: undefined;
      };
      _review_comment: {
        Args: {
          c: Database["public"]["Tables"]["customers"]["Row"];
          p_left: boolean;
          p_stars: number;
          p_wrong_extras: boolean;
        };
        Returns: string;
      };
      _seat_count: { Args: { p_user: string }; Returns: number };
      _slugify: { Args: { p_text: string }; Returns: string };
      _take_item: {
        Args: { p_code: string; p_kind: string; p_qty: number; p_quality: number; p_user: string };
        Returns: undefined;
      };
      _today: { Args: Record<PropertyKey, never>; Returns: string };
      _traffic_level: { Args: { p_minute_of_day: number }; Returns: string };
      _traffic_mult: { Args: { p_minute_of_day: number }; Returns: number };
      _upgrade_bonus: { Args: { p_kind: string; p_user: string }; Returns: number };
      _validate_names: { Args: { p_owner_name: string; p_shop_name: string }; Returns: undefined };
      _visit_json: { Args: { p_visit: string }; Returns: Json };
      accept_order: { Args: { p_user: string; p_visit: string }; Returns: Json };
      buy_ingredient: { Args: { p_code: string; p_qty: number; p_user: string }; Returns: Json };
      buy_listing: { Args: { p_listing: string; p_user: string }; Returns: Json };
      buy_upgrade: { Args: { p_code: string; p_user: string }; Returns: Json };
      cancel_listing: { Args: { p_listing: string; p_user: string }; Returns: Json };
      claim_daily: { Args: { p_user: string }; Returns: Json };
      claim_quest: { Args: { p_code: string; p_user: string }; Returns: Json };
      complete_order: {
        Args: {
          p_ingredients: string[];
          p_method: string;
          p_packaging: string;
          p_sauce: string;
          p_scores: number[];
          p_topping: string;
          p_user: string;
          p_visit: string;
        };
        Returns: Json;
      };
      create_listing: {
        Args: {
          p_item: string;
          p_kind: string;
          p_price: number;
          p_qty: number;
          p_quality: number;
          p_user: string;
        };
        Returns: Json;
      };
      create_profile: {
        Args: {
          p_avatar: string;
          p_color: string;
          p_owner_name: string;
          p_shop_name: string;
          p_user: string;
        };
        Returns: Json;
      };
      customer_tick: { Args: { p_user: string }; Returns: Json };
      get_daily_quests: { Args: { p_user: string }; Returns: Json };
      heartbeat: { Args: { p_user: string }; Returns: Json };
      market_fee: { Args: { p_price: number }; Returns: number };
      rename_shop: { Args: { p_shop_name: string; p_user: string }; Returns: Json };
      reply_review: { Args: { p_reply: string; p_review: string; p_user: string }; Returns: Json };
      set_avatar_photo: { Args: { p_url: string; p_user: string }; Returns: Json };
      set_shop_open: { Args: { p_open: boolean; p_user: string }; Returns: Json };
      set_theme: { Args: { p_theme: string; p_user: string }; Returns: Json };
      throttle: {
        Args: { p_action: string; p_max: number; p_user: string; p_window_seconds: number };
        Returns: boolean;
      };
      update_avatar: { Args: { p_avatar: string; p_color: string; p_user: string }; Returns: Json };
      update_bio: { Args: { p_bio: string; p_user: string }; Returns: Json };
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
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
