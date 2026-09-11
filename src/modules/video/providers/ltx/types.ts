export type LtxSubmitResponse = {
  id: string;
  created_at?: string;
};

export type LtxJobError = {
  type: string;
  message: string;
};

export type LtxJobStatusPayload = {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress?: number;
  created_at?: string;
  completed_at?: string;
  result?: {
    video_url?: string;
  };
  error?: LtxJobError;
};
