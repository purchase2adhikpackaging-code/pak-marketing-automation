import "server-only";

export interface PublishingWorkerBrokerClientOptions {
  credential: string;
  fetchImpl?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

function required(name: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY"): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Publishing worker environment variable ${name} is required.`);
  return value;
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

  async function request<T>(body: Record<string, unknown>): Promise<T> {
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
  };
}
