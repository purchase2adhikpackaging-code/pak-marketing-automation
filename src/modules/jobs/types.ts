export const JOB_STATES = [
  "QUEUED",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "RETRYING",
  "CANCELLED",
] as const;

export type JobState = (typeof JOB_STATES)[number];

export type JobRecord = {
  id: string;
  organizationId: string;
  parentJobId: string | null;
  jobType: string;
  resourceType: string | null;
  resourceId: string | null;
  state: JobState;
  attemptCount: number;
  maxAttempts: number;
  retryPolicy: Record<string, unknown>;
  input: Record<string, unknown>;
  result: Record<string, unknown> | null;
  failure: Record<string, unknown> | null;
  idempotencyKey: string | null;
  leaseOwner: string | null;
  leaseExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};
