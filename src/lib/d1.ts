// Cloudflare D1 REST API client for Next.js/Vercel
interface D1Response {
  success: boolean;
  result?: Record<string, unknown>[];
  error?: string;
  messages?: string[];
  meta?: Record<string, unknown>;
}

class D1Client {
  private accountId: string;
  private databaseId: string;
  private apiToken: string;
  private email: string;

  constructor() {
    this.accountId = process.env.CLOUDFLARE_ACCOUNT_ID!;
    this.databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID!;
    this.apiToken = process.env.CLOUDFLARE_API_TOKEN!;
    this.email = process.env.CLOUDFLARE_EMAIL!;

    if (!this.accountId || !this.databaseId || !this.apiToken || !this.email) {
      console.warn('D1 credentials not fully configured. Database features will be disabled.');
    }
  }

  async query(sql: string, params?: unknown[]): Promise<D1Response> {
    if (!this.databaseId || this.databaseId === 'your_d1_database_id') {
      return { success: false, error: 'Database not configured' };
    }

    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/d1/database/${this.databaseId}/query`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiToken}`,
          },
          body: JSON.stringify({ sql, params }),
        }
      );

      const data = await response.json();
      
      if (!data.success) {
        console.error('D1 query failed:', data.errors || data.error);
        return { success: false, error: data.errors || data.error };
      }
      
      // D1 API returns results in data.result[0].results
      if (data.result && data.result[0]) {
        return {
          success: true,
          result: data.result[0].results || [],
          meta: data.result[0].meta
        };
      }
      
      return { success: false, result: [] };
    } catch (error) {
      console.error('D1 query error:', error);
      return { success: false, error: 'Query failed' };
    }
  }

  // Helper methods for common operations
  async createTables() {
    const schema = `
      CREATE TABLE IF NOT EXISTS debates (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        opponent TEXT NOT NULL,
        topic TEXT NOT NULL,
        messages TEXT NOT NULL,
        user_score INTEGER DEFAULT 0,
        ai_score INTEGER DEFAULT 0,
        score_data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        email TEXT,
        username TEXT,
        display_name TEXT,
        avatar_url TEXT,
        is_premium BOOLEAN DEFAULT FALSE,
        stripe_customer_id TEXT,
        stripe_subscription_id TEXT,
        stripe_plan TEXT,
        subscription_status TEXT,
        current_period_end DATETIME,
        cancel_at_period_end BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS subscriptions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        stripe_subscription_id TEXT NOT NULL,
        stripe_customer_id TEXT NOT NULL,
        status TEXT NOT NULL,
        current_period_start DATETIME,
        current_period_end DATETIME,
        cancel_at_period_end BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_debates_user ON debates(user_id);
      CREATE INDEX IF NOT EXISTS idx_debates_created ON debates(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_debates_user_created ON debates(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_debates_user_topic_created ON debates(user_id, topic, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_debates_created_user ON debates(created_at, user_id);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_subscription ON users(subscription_status, stripe_plan);
      CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users(stripe_customer_id);
      CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);

      CREATE TABLE IF NOT EXISTS rate_limits (
        key TEXT PRIMARY KEY,
        count INTEGER DEFAULT 1,
        expires_at INTEGER NOT NULL
      );
    `;

    const queries = schema.split(';').filter(q => q.trim());
    const results = [];
    for (const query of queries) {
      if (query.trim()) {
        const result = await this.query(query.trim());
        results.push(result);
      }
    }
    return { success: true, results };
  }

  async saveDebate(data: {
    userId: string;
    opponent: string;
    topic: string;
    messages: Array<{ role: string; content: string }>;
    userScore?: number;
    aiScore?: number;
    scoreData?: Record<string, unknown>;
    debateId?: string;
    opponentStyle?: string;
    promptVariant?: string;
  }) {
    // Use provided ID or generate a new one
    const debateId = data.debateId || crypto.randomUUID();
    
    // Store metadata in score_data json blob
    const metadata = {
      ...data.scoreData,
      opponentStyle: data.opponentStyle,
      promptVariant: data.promptVariant,
    };
    
    const result = await this.query(
      `INSERT OR REPLACE INTO debates (id, user_id, opponent, topic, messages, user_score, ai_score, score_data) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        debateId,
        data.userId,
        data.opponent,
        data.topic,
        JSON.stringify(data.messages),
        data.userScore || 0,
        data.aiScore || 0,
        JSON.stringify(metadata)
      ]
    );
    
    // Return the debate ID along with the result
    return { ...result, debateId };
  }
  
  async getDebate(debateId: string) {
    const result = await this.query(
      `SELECT * FROM debates WHERE id = ?`,
      [debateId]
    );
    
    if (result.success && result.result && result.result.length > 0) {
      const debate = result.result[0] as Record<string, unknown>;
      // Parse the JSON messages field
      if (debate.messages && typeof debate.messages === 'string') {
        debate.messages = JSON.parse(debate.messages);
      }
      // Parse the JSON score_data field if it exists
      if (debate.score_data && typeof debate.score_data === 'string') {
        debate.score_data = JSON.parse(debate.score_data);
        // Extract metadata and add it as a top-level field
        if (debate.score_data && typeof debate.score_data === 'object') {
          if ('opponentStyle' in debate.score_data) {
            debate.opponentStyle = (debate.score_data as any).opponentStyle;
          }
          if ('promptVariant' in debate.score_data) {
            debate.promptVariant = (debate.score_data as any).promptVariant;
          }
        }
      }
      return { success: true, debate };
    }
    
    return { success: false, error: 'Debate not found' };
  }

  async getRecentDebates(userId: string, limit = 10) {
    return this.query(
      `SELECT id, opponent, topic, json_array_length(messages) as message_count, 
              user_score, ai_score, score_data, created_at 
       FROM debates WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
      [userId, limit]
    );
  }

  async updateLeaderboard(userId: string, username: string, wonDebate: boolean) {
    // Check if user exists
    const existing = await this.query(
      `SELECT * FROM leaderboard WHERE user_id = ?`,
      [userId]
    );

    if (existing.result && existing.result.length > 0) {
      // Update existing
      return this.query(
        `UPDATE leaderboard 
         SET total_score = total_score + ?, 
             debates_won = debates_won + ?,
             debates_total = debates_total + 1,
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ?`,
        [wonDebate ? 10 : 1, wonDebate ? 1 : 0, userId]
      );
    } else {
      // Insert new
      return this.query(
        `INSERT INTO leaderboard (user_id, username, total_score, debates_won, debates_total) 
         VALUES (?, ?, ?, ?, 1)`,
        [userId, username, wonDebate ? 10 : 1, wonDebate ? 1 : 0]
      );
    }
  }

  async getLeaderboard(limit = 10) {
    return this.query(
      `SELECT * FROM leaderboard ORDER BY total_score DESC LIMIT ?`,
      [limit]
    );
  }

  // User subscription functions
  async getUser(clerkUserId: string) {
    try {
      const result = await this.query(
        `SELECT * FROM users WHERE user_id = ? LIMIT 1`,
        [clerkUserId]
      );

      if (!result.success || !result.result || result.result.length === 0) {
        return null;
      }

      const user = result.result[0];
      return user;
    } catch (error) {
      console.error('D1 get user error:', error);
      return null;
    }
  }
  
  async hasActiveSubscription(clerkUserId: string): Promise<boolean> {
    const user = await this.getUser(clerkUserId);
    return user?.subscription_status === 'active' && user?.stripe_plan === 'premium';
  }

  async upsertUser(userData: {
    clerkUserId: string;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    stripePlan?: string;
    subscriptionStatus?: string;
    currentPeriodEnd?: string;
    cancelAtPeriodEnd?: boolean;
  }) {
    try {
      // Use INSERT OR REPLACE to handle both cases atomically
      const result = await this.query(
        `INSERT INTO users (
          user_id, 
          stripe_customer_id, 
          stripe_subscription_id, 
          stripe_plan, 
          subscription_status, 
          current_period_end,
          cancel_at_period_end,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
          stripe_customer_id = CASE WHEN excluded.stripe_customer_id IS NOT NULL THEN excluded.stripe_customer_id ELSE stripe_customer_id END,
          stripe_subscription_id = CASE WHEN excluded.stripe_subscription_id IS NOT NULL THEN excluded.stripe_subscription_id ELSE stripe_subscription_id END,
          stripe_plan = CASE WHEN excluded.stripe_plan IS NOT NULL THEN excluded.stripe_plan ELSE stripe_plan END,
          subscription_status = CASE WHEN excluded.subscription_status IS NOT NULL THEN excluded.subscription_status ELSE subscription_status END,
          current_period_end = CASE WHEN excluded.current_period_end IS NOT NULL THEN excluded.current_period_end ELSE current_period_end END,
          cancel_at_period_end = excluded.cancel_at_period_end,
          updated_at = CURRENT_TIMESTAMP`,
        [
          userData.clerkUserId,
          userData.stripeCustomerId || null,
          userData.stripeSubscriptionId || null,
          userData.stripePlan || null,
          userData.subscriptionStatus || null,
          userData.currentPeriodEnd || null,
          userData.cancelAtPeriodEnd ? 1 : 0
        ]
      );
      
      return { success: result.success, operation: 'upsert' };
    } catch (error) {
      console.error('D1 upsert user error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Rate limiting functions
  async checkUserDebateLimit(userId: string) {
    // First check if user is premium
    const user = await this.getUser(userId);
    if (user && user.subscription_status === 'active' && user.stripe_plan === 'premium') {
      return {
        success: true,
        count: 0,
        limit: -1, // Unlimited
        allowed: true,
        remaining: -1,
        isPremium: true
      };
    }

    const result = await this.query(
      `SELECT COUNT(*) as debate_count FROM debates WHERE user_id = ?`,
      [userId]
    );
    
    if (result.success && result.result && result.result.length > 0) {
      const count = (result.result[0] as Record<string, unknown>).debate_count as number;
      // GUEST MODE: Guests get 1 debate, Free users get 3
      const isGuest = userId.startsWith('guest_');
      const limit = isGuest ? 1 : 3;
      return {
        success: true,
        count,
        limit,
        allowed: count < limit,
        remaining: Math.max(0, limit - count),
        isPremium: false
      };
    }
    
    return { success: false, count: 0, limit: 2, allowed: true, remaining: 2, isPremium: false };
  }

  async checkDebateMessageLimit(debateId: string) {
    // Optimized: fetch only user_id and total message count from DB
    // Use json_array_length to avoid transferring the full messages blob.
    // User message count ≈ total/2 (alternating user/ai), but we fetch
    // the messages field only if we need an exact count and user isn't premium.
    const metaResult = await this.query(
      `SELECT user_id, json_array_length(messages) as msg_count FROM debates WHERE id = ?`,
      [debateId]
    );

    if (metaResult.success && metaResult.result && metaResult.result.length > 0) {
      const debate = metaResult.result[0] as Record<string, unknown>;
      const userId = debate.user_id as string;
      const totalMsgCount = (debate.msg_count as number) || 0;

      // Check if user is premium (avoids parsing messages entirely)
      const user = await this.getUser(userId);
      if (user && user.subscription_status === 'active' && user.stripe_plan === 'premium') {
        return {
          success: true,
          count: 0,
          limit: -1, // Unlimited
          allowed: true,
          remaining: -1,
          isPremium: true
        };
      }

      // Quick check: if total messages < limit*2, user is definitely under limit
      // (each user message is paired with an AI response)
      const isGuest = userId.startsWith('guest_');
      const limit = isGuest ? 40 : 50; // Free tier limit per debate (40 for guests, 50 for free)
      if (totalMsgCount < limit) {
        // Under limit for sure — user msgs can't exceed total msgs
        const estimatedUserMsgs = Math.ceil(totalMsgCount / 2);
        return {
          success: true,
          count: estimatedUserMsgs,
          limit,
          allowed: true,
          remaining: Math.max(0, limit - estimatedUserMsgs),
          isPremium: false
        };
      }

      // Near or over limit — need exact count, fetch messages
      const fullResult = await this.query(
        `SELECT messages FROM debates WHERE id = ?`,
        [debateId]
      );

      let messages: Array<{ role: string }> = [];
      if (fullResult.success && fullResult.result && fullResult.result.length > 0) {
        const raw = fullResult.result[0].messages;
        if (typeof raw === 'string') {
          try { messages = JSON.parse(raw); } catch { messages = []; }
        } else if (Array.isArray(raw)) {
          messages = raw as Array<{ role: string }>;
        }
      }
      
      const userMessageCount = messages.filter(m => m.role === 'user').length;
      
      return {
        success: true,
        count: userMessageCount,
        limit,
        allowed: userMessageCount < limit,
        remaining: Math.max(0, limit - userMessageCount),
        isPremium: false
      };
    }
    
    return { success: false, count: 0, limit: 2, allowed: true, remaining: 2, isPremium: false };
  }

  async addMessage(debateId: string, message: { role: string; content: string; aiAssisted?: boolean; citations?: unknown[] }) {
    // First get the existing debate
    const debateResult = await this.getDebate(debateId);
    
    if (!debateResult.success || !debateResult.debate) {
      return { success: false, error: 'Debate not found' };
    }
    
    // Get existing messages
    const existingMessages = Array.isArray(debateResult.debate.messages) 
      ? debateResult.debate.messages 
      : [];
    
    // Add new message
    const updatedMessages = [...existingMessages, message];
    
    // Update the debate with new messages
    const result = await this.query(
      `UPDATE debates SET messages = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [JSON.stringify(updatedMessages), debateId]
    );
    
    return result;
  }

  /**
   * Find a recent debate by the same user with the same topic (within windowSeconds).
   * Used to deduplicate rapid duplicate debate creation (e.g., double-click, back button).
   */
  async findRecentDuplicate(userId: string, topic: string, windowSeconds = 30) {
    const result = await this.query(
      `SELECT id FROM debates
       WHERE user_id = ? AND topic = ? AND created_at >= datetime('now', '-' || ? || ' seconds')
       ORDER BY created_at DESC LIMIT 1`,
      [userId, topic, windowSeconds]
    );

    if (result.success && result.result && result.result.length > 0) {
      const debate = result.result[0] as Record<string, unknown>;
      return { found: true, debateId: debate.id as string };
    }
    return { found: false, debateId: null };
  }

  async checkRateLimit(key: string, limit: number, windowSeconds: number) {
    const now = Math.floor(Date.now() / 1000);
    
    // 1. Get current status
    const result = await this.query(
      `SELECT count, expires_at FROM rate_limits WHERE key = ?`,
      [key]
    );

    let currentCount = 0;
    let currentExpiresAt = now + windowSeconds;
    let isNew = true;

    if (result.success && result.result && result.result.length > 0) {
      const row = result.result[0] as { count: number; expires_at: number };
      if (row.expires_at > now) {
        currentCount = row.count;
        currentExpiresAt = row.expires_at;
        isNew = false;
      }
    }

    // 2. Decide action
    if (currentCount >= limit) {
      return {
        success: true,
        allowed: false,
        remaining: 0,
        resetAt: currentExpiresAt
      };
    }

    // 3. Update or Insert
    if (isNew) {
      // New or expired
      await this.query(
        `INSERT OR REPLACE INTO rate_limits (key, count, expires_at) VALUES (?, 1, ?)`,
        [key, currentExpiresAt]
      );
      return {
        success: true,
        allowed: true,
        remaining: limit - 1,
        resetAt: currentExpiresAt
      };
    } else {
      // Increment existing
      await this.query(
        `UPDATE rate_limits SET count = count + 1 WHERE key = ?`,
        [key]
      );
      return {
        success: true,
        allowed: true,
        remaining: limit - (currentCount + 1),
        resetAt: currentExpiresAt
      };
    }
  }
}

// Export singleton instance
export const d1 = new D1Client();