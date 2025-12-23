/**
 * Automation session ma'lumotlari
 */
export interface SessionData {
  userId: number;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed';
  startedAt: string;
  progress: number;
  currentStep?: string;
  totalSteps?: number;
  completedSteps?: number;
  errorMessage?: string;
  metadata?: {
    checksProcessed?: number;
    checksTotal?: number;
    lastActivity?: string;
    [key: string]: any;
  };
}

/**
 * Session store options
 */
export interface SessionStoreOptions {
  prefix?: string;
  ttl?: number; // seconds
}

/**
 * Session status enum
 */
export enum SessionStatus {
  IDLE = 'idle',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
}