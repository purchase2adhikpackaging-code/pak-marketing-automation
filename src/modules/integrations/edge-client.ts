import "server-only";

import { AppError } from "@/lib/errors/app-error";
import { getPublicEnv } from "@/lib/env/public";
import type { PublicEnv } from "@/lib/env/schema";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type EdgeInvokeDependencies = {
  env: PublicEnv;
  getAccessToken(): Promise<string | null>;
  fetchFn: typeof fetch;
};

export type VideoGenerationEdgeRequest = {
  operation: "submit" | "reconcile" | "retry";
  organizationId: string;
  jobId: string;
  attemptId: string;
};

async function productionAccessToken(): Promise<string | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) return null;
  return data.session.access_token;
}

function mapStatus(status: number): "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "PROVIDER_ERROR" | "INTERNAL_ERROR" {
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 422 || status === 429 || status === 502 || status === 503) return "PROVIDER_ERROR";
  return "INTERNAL_ERROR";
}

export async function invokeEdgeFunction<T>(
  functionName: string,
  body: unknown,
  dependencies: EdgeInvokeDependencies,
): Promise<T> {
  const accessToken = await dependencies.getAccessToken();
  if (!accessToken) throw new AppError("UNAUTHORIZED", "You must be signed in to continue.");

  let response: Response;
  try {
    response = await dependencies.fetchFn(
      `${dependencies.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/${functionName}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          apikey: dependencies.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
        cache: "no-store",
      },
    );
  } catch {
    throw new AppError("INTERNAL_ERROR", "Secure integration service is temporarily unavailable.");
  }

  if (!response.ok) {
    throw new AppError(mapStatus(response.status), "Secure integration service request failed.");
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new AppError("INTERNAL_ERROR", "Secure integration service returned an invalid response.");
  }
}

function productionDependencies(): EdgeInvokeDependencies {
  return {
    env: getPublicEnv(),
    getAccessToken: productionAccessToken,
    fetchFn: fetch,
  };
}

export function invokeIntegrationVault<T>(body: unknown): Promise<T> {
  return invokeEdgeFunction<T>("integration-vault", body, productionDependencies());
}

export function invokeContentGeneration<T>(body: unknown): Promise<T> {
  return invokeEdgeFunction<T>("generate-content", body, productionDependencies());
}

export function invokeVideoGenerationWithDependencies<T>(
  body: VideoGenerationEdgeRequest,
  dependencies: EdgeInvokeDependencies,
): Promise<T> {
  return invokeEdgeFunction<T>("video-generation", body, dependencies);
}

export function invokeVideoGeneration<T>(body: VideoGenerationEdgeRequest): Promise<T> {
  return invokeVideoGenerationWithDependencies<T>(body, productionDependencies());
}
