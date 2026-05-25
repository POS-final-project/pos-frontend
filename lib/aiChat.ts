import { api } from "./api";

export type AiSession = {
  id: string;
  scope: "global" | "shop";
  shop_id: string | null;
  Shop: { id: string; name: string } | null;
  last_active_at: string;
  created_at: string;
};

export type AiMessage = {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export type AiSessionWithMessages = AiSession & {
  messages: AiMessage[];
};

export type QueryResult = {
  question: string;
  sql: string;
  columns: string[];
  rows: (string | number | null)[][];
  row_count: number;
  error?: string | null;
};

export type ChatResult = {
  reply: string;
  queries: QueryResult[];
  used_sql: boolean;
  total_latency_ms: number;
};

export const aiChatApi = {
  listSessions: () =>
    api.get<{ success: boolean; data: AiSession[] }>(
      "/api/ai/sessions?limit=50",
    ),

  createSession: (scope: "global" | "shop", shop_id: string | null) =>
    api.post<{ success: boolean; data: AiSession }>("/api/ai/sessions", {
      scope,
      shop_id,
    }),

  getSession: (sessionId: string) =>
    api.get<{ success: boolean; data: AiSessionWithMessages }>(
      `/api/ai/sessions/${sessionId}`,
    ),

  deleteSession: (sessionId: string) =>
    api.delete<{ success: boolean }>(`/api/ai/sessions/${sessionId}`),

  chat: (sessionId: string, message: string) =>
    api.post<{ success: boolean; data: ChatResult }>(
      `/api/ai/sessions/${sessionId}/chat`,
      { message },
    ),
};
