export interface TokenValidationResult {
  token: string;
  tokenMasked: string;
  valid: boolean;
  username?: string;
  discriminator?: string;
  userId?: string;
  avatar?: string;
  nitroType?: "none" | "classic" | "nitro" | "basic";
  availableBoostSlots: number;
  boostSlotIds: string[];
  error?: string;
}

export interface BoostResult {
  token: string;
  tokenMasked: string;
  username?: string;
  userId?: string;
  joinStatus: "joined" | "already_member" | "failed";
  boostStatus: "boosted" | "no_slots" | "failed" | "skipped";
  boostCount: number;
  error?: string;
}

export interface SessionData {
  guildId: string;
  guildName?: string;
  guildIcon?: string;
  memberCount?: number;
  nonce: string;
  guildVerified?: boolean;
}

export interface GuildInfo {
  id: string;
  name: string;
  icon?: string;
  approximate_member_count?: number;
}

export interface JobStatus {
  jobId: string;
  status: "pending" | "running" | "completed" | "failed";
  progress: number;
  total: number;
  results: BoostResult[];
  summary?: {
    totalBoosted: number;
    totalFailed: number;
    totalAlreadyMember: number;
    totalBoostCount: number;
  };
  createdAt: number;
  updatedAt: number;
}
