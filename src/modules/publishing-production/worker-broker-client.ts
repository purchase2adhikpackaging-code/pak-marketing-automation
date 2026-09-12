import "server-only";

export interface PublishingWorkerBrokerClientOptions {
  credential: string;
  fetchImpl?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

type JsonRecord = Record<string, unknown>;

function required(name: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY"): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Publishing worker environment variable ${name} is required.`);
  return value;
}

function objectValue(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Publishing worker broker returned invalid ${label}.`);
  }
  return value as JsonRecord;
}

export class PublishingWorkerBrokerError extends Error {
  constructor(readonly status: number) {
    super(`Publishing worker broker request failed with HTTP ${status}.`);
    this.name = "PublishingWorkerBrokerError";
  }
}

export function createPublishingWorkerBrokerClient(options: PublishingWorkerBrokerClientOptions) {
  const credential = options.credential.trim();
  if (!credential) throw new Error("Publishing worker credential is required.");
  const supabaseUrl = required("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
  const anonKey = required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const fetchImpl = options.fetchImpl ?? fetch;
  const endpoint = `${supabaseUrl}/functions/v1/publishing-worker-broker`;

  async function request<T>(body: JsonRecord): Promise<T> {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        apikey: anonKey,
        authorization: `Bearer ${anonKey}`,
        "content-type": "application/json",
        "x-publishing-worker-secret": credential,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!response.ok) throw new PublishingWorkerBrokerError(response.status);
    return await response.json() as T;
  }

  return {
    async authorize(): Promise<boolean> {
      const payload = await request<{ ok?: unknown }>({ action: "authorize" });
      return payload.ok === true;
    },

    async claimJobs(input: { workerId: string; limit: number; leaseSeconds: number }): Promise<JsonRecord[]> {
      const payload = await request<{ jobs?: unknown }>({ action: "claimJobs", ...input });
      if (!Array.isArray(payload.jobs)) throw new Error("Publishing worker broker returned invalid jobs.");
      return payload.jobs.map((job) => objectValue(job, "job"));
    },

    async yieldJob(input: { jobId: string; workerId: string; currentStage: string }): Promise<JsonRecord> {
      const payload = await request<{ job?: unknown }>({ action: "yieldJob", ...input });
      return objectValue(payload.job, "job");
    },

    async completeJob(input: {
      jobId: string;
      workerId: string;
      qaStatus: "QA_PASSED";
      pdfArtifactPath: string;
      manifestArtifactPath: string;
      providerName?: string;
      providerModel?: string;
      knowledgeHashes?: unknown[];
    }): Promise<JsonRecord> {
      const payload = await request<{ job?: unknown }>({ action: "completeJob", ...input });
      return objectValue(payload.job, "job");
    },

    async failJob(input: { jobId: string; workerId: string; error: string }): Promise<JsonRecord> {
      const payload = await request<{ job?: unknown }>({ action: "failJob", ...input });
      return objectValue(payload.job, "job");
    },

    async listCheckpointFiles(input: { jobId: string; workerId: string }): Promise<string[]> {
      const payload = await request<{ paths?: unknown }>({ action: "listCheckpointFiles", ...input });
      if (!Array.isArray(payload.paths) || payload.paths.some((path) => typeof path !== "string")) {
        throw new Error("Publishing worker broker returned invalid checkpoint paths.");
      }
      return payload.paths as string[];
    },

    async createCheckpointDownload(input: { jobId: string; workerId: string; path: string }): Promise<{ path: string; signedUrl: string }> {
      const payload = await request<{ path?: unknown; signedUrl?: unknown }>({
        action: "createCheckpointDownload",
        ...input,
      });
      if (typeof payload.path !== "string" || typeof payload.signedUrl !== "string") {
        throw new Error("Publishing worker broker returned invalid checkpoint download.");
      }
      return { path: payload.path, signedUrl: payload.signedUrl };
    },

    async createStorageUpload(input: { jobId: string; workerId: string; path: string }): Promise<{ path: string; token: string }> {
      const payload = await request<{ path?: unknown; token?: unknown }>({ action: "createStorageUpload", ...input });
      if (typeof payload.path !== "string" || typeof payload.token !== "string") {
        throw new Error("Publishing worker broker returned invalid storage upload capability.");
      }
      return { path: payload.path, token: payload.token };
    },

    async upsertPublication(input: { jobId: string; workerId: string; publication: JsonRecord }): Promise<JsonRecord> {
      const payload = await request<{ publication?: unknown }>({ action: "upsertPublication", ...input });
      return objectValue(payload.publication, "publication");
    },
  };
}

export type PublishingWorkerBrokerClient = ReturnType<typeof createPublishingWorkerBrokerClient>;
