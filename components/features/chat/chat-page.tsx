"use client";

import { useState, useEffect } from "react";
import { Bot, Globe, Store, Loader2, AlertTriangle, WifiOff, X, RefreshCw, PanelLeftOpen } from "lucide-react";
import { SessionSidebar } from "./session-sidebar";
import { ChatWindow } from "./chat-window";
import { NewSessionModal } from "./new-session-modal";
import { aiChatApi, type AiSession, type QueryResult, type AiMessage } from "@/lib/aiChat";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { getCookie, setCookie, removeCookie } from "@/lib/cookies";

type Shop = { id: string; name: string };

type ChatMessage = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  // undefined = pesan lama dari history DB (tidak ditampilkan di chat-window)
  // [] = balasan tanpa data (small talk)
  // [...] = balasan dengan satu atau lebih hasil query
  queries?: QueryResult[];
  created_at: string;
};

function parseAssistantMessage(m: AiMessage): { content: string; queries: QueryResult[] } {
  if (m.role !== "assistant") return { content: m.content, queries: [] };
  try {
    const parsed = JSON.parse(m.content);
    if (parsed._v === 2 && typeof parsed.reply === "string") {
      return { content: parsed.reply, queries: parsed.queries ?? [] };
    }
  } catch {
    // bukan JSON — pesan lama, tampilkan apa adanya
  }
  return { content: m.content, queries: [] };
}

function isServiceDown(msg: string) {
  return (
    msg.toLowerCase().includes("service") ||
    msg.toLowerCase().includes("dihubungi") ||
    msg.toLowerCase().includes("502") ||
    msg.toLowerCase().includes("tersedia")
  );
}

interface ErrorBannerProps {
  message: string;
  onDismiss: () => void;
  onRetry?: () => void;
}

function ErrorBanner({ message, onDismiss, onRetry }: ErrorBannerProps) {
  const down = isServiceDown(message);
  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 border-b flex-shrink-0 ${
        down
          ? "bg-amber-50 border-amber-200"
          : "bg-red-50 border-red-200"
      }`}
    >
      <div className={`mt-0.5 flex-shrink-0 ${down ? "text-amber-500" : "text-red-500"}`}>
        {down ? <WifiOff className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${down ? "text-amber-800" : "text-red-800"}`}>
          {down ? "Layanan AI tidak tersedia" : "Terjadi kesalahan"}
        </p>
        <p className={`text-xs mt-0.5 ${down ? "text-amber-700" : "text-red-700"}`}>
          {message}
        </p>
        {down && (
          <p className="text-xs text-amber-600 mt-1">
            Pastikan FastAPI AI service sudah berjalan di port 8000.
          </p>
        )}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {onRetry && (
          <button
            onClick={onRetry}
            className={`p-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors ${
              down
                ? "hover:bg-amber-100 text-amber-600 hover:text-amber-800"
                : "hover:bg-red-100 text-red-500 hover:text-red-700"
            }`}
            title="Coba lagi"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          onClick={onDismiss}
          className={`p-1.5 rounded-lg transition-colors ${
            down
              ? "hover:bg-amber-100 text-amber-500 hover:text-amber-700"
              : "hover:bg-red-100 text-red-400 hover:text-red-600"
          }`}
          title="Tutup"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export function ChatPage() {
  const currentUser = getUser();
  const isAdmin = currentUser?.role === "admin";
  const adminShopId = isAdmin ? (currentUser?.shopId ?? null) : null;

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sessions, setSessions] = useState<AiSession[]>([]);
  const [activeSession, setActiveSession] = useState<AiSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingSession, setLoadingSession] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastQuestion, setLastQuestion] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [shops, setShops] = useState<Shop[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  const ACTIVE_SESSION_KEY = `ai_active_session_${currentUser?.id ?? "guest"}`;

  useEffect(() => {
    async function init() {
      try {
        const [sessRes, shopRes] = await Promise.all([
          aiChatApi.listSessions(),
          api.get<{ success: boolean; data: Shop[] }>(
            "/api/shops?page=1&limit=100",
          ),
        ]);
        const fetchedSessions = sessRes.data ?? [];
        setSessions(fetchedSessions);
        setShops(shopRes.data ?? []);

        const savedId = getCookie(ACTIVE_SESSION_KEY);
        if (savedId && fetchedSessions.some((s) => s.id === savedId)) {
          await selectSession(savedId);
        }
      } catch {
        // silently fail — user can still create sessions
      } finally {
        setSessionsLoading(false);
      }
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function selectSession(id: string) {
    setLoadingSession(true);
    setError(null);
    try {
      const res = await aiChatApi.getSession(id);
      const session = res.data;
      setActiveSession(session);
      setCookie(ACTIVE_SESSION_KEY, id);

      const displayed: ChatMessage[] = session.messages.map((m) => {
        const { content, queries } = parseAssistantMessage(m);
        return {
          id:         m.id,
          role:       m.role,
          content,
          queries:    m.role === "assistant" ? queries : undefined,
          created_at: m.created_at,
        };
      });
      setMessages(displayed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat sesi");
    } finally {
      setLoadingSession(false);
    }
  }

  async function createSession(
    scope: "global" | "shop",
    shopId: string | null,
  ) {
    try {
      const res = await aiChatApi.createSession(scope, shopId);
      const newSession = res.data;
      setSessions((prev) => [newSession, ...prev]);
      setActiveSession(newSession);
      setCookie(ACTIVE_SESSION_KEY, newSession.id);
      setMessages([]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat sesi");
    }
  }

  async function deleteSession(id: string) {
    try {
      await aiChatApi.deleteSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (activeSession?.id === id) {
        setActiveSession(null);
        setMessages([]);
        removeCookie(ACTIVE_SESSION_KEY);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus sesi");
    }
  }

  async function sendMessage(question: string) {
    if (!activeSession || isLoading) return;
    setError(null);
    setLastQuestion(question);

    const userMsg: ChatMessage = {
      role: "user",
      content: question,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const res = await aiChatApi.chat(activeSession.id, question);
      const result = res.data;

      const aiMsg: ChatMessage = {
        role: "assistant",
        content: result.reply,
        queries: result.queries ?? [],
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMsg]);

      setSessions((prev) =>
        prev
          .map((s) =>
            s.id === activeSession.id
              ? { ...s, last_active_at: new Date().toISOString() }
              : s,
          )
          .sort(
            (a, b) =>
              new Date(b.last_active_at).getTime() -
              new Date(a.last_active_at).getTime(),
          ),
      );
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Terjadi kesalahan, coba lagi.";
      setError(msg);
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  }

  const sessionSidebarContent = sessionsLoading ? (
    <div className="flex items-center justify-center h-full text-slate-400">
      <Loader2 className="w-5 h-5 animate-spin" />
    </div>
  ) : (
    <SessionSidebar
      sessions={sessions}
      activeId={activeSession?.id ?? null}
      onSelect={(id) => { selectSession(id); setMobileSidebarOpen(false); }}
      onNew={() => { setShowModal(true); setMobileSidebarOpen(false); }}
      onDelete={deleteSession}
    />
  );

  return (
    <div className="flex h-full rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-white relative">

      {/* ── Mobile sidebar drawer backdrop ───────────────────────── */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* ── Session sidebar — desktop: permanent | mobile: drawer ─── */}
      {/* Desktop */}
      <div className="hidden lg:flex w-72 flex-shrink-0">
        {sessionSidebarContent}
      </div>

      {/* Mobile drawer */}
      <div
        className={`
          fixed top-0 left-0 z-40 h-full w-72 bg-white shadow-xl transition-transform duration-300 ease-in-out
          lg:hidden
          ${mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white">
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Sesi Chat</span>
          <button
            onClick={() => setMobileSidebarOpen(false)}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="h-[calc(100%-49px)]">
          {sessionSidebarContent}
        </div>
      </div>

      {/* ── Right panel — chat area ───────────────────────────────── */}
      <div className="flex-1 overflow-hidden min-w-0">
        {loadingSession ? (
          <div className="flex items-center justify-center h-full text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : activeSession ? (
          <div className="flex flex-col h-full">
            {/* Session header */}
            <div className="px-3 sm:px-4 py-3 border-b border-slate-100 flex items-center gap-2 sm:gap-3 bg-white flex-shrink-0">
              {/* Mobile: toggle sidebar button */}
              <button
                onClick={() => setMobileSidebarOpen(true)}
                className="lg:hidden p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0"
                aria-label="Buka daftar sesi"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>

              <div className="w-7 h-7 rounded-md bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0">
                {activeSession.scope === "global" ? (
                  <Globe className="w-3.5 h-3.5" />
                ) : (
                  <Store className="w-3.5 h-3.5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800 truncate">
                  {activeSession.Shop?.name ?? "Semua Toko (Global)"}
                </p>
                <p className="text-[10px] text-slate-400 hidden sm:block">
                  {activeSession.scope === "global"
                    ? "Analisis seluruh data toko"
                    : "Analisis data toko tertentu"}
                </p>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-50 border border-green-200 flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] font-medium text-green-700 hidden sm:inline">AI Aktif</span>
              </div>
            </div>

            {/* Error banner */}
            {error && (
              <ErrorBanner
                message={error}
                onDismiss={() => setError(null)}
                onRetry={
                  lastQuestion
                    ? () => { setError(null); sendMessage(lastQuestion); }
                    : undefined
                }
              />
            )}

            {/* Chat */}
            <div className="flex-1 overflow-hidden">
              <ChatWindow
                messages={messages}
                isLoading={isLoading}
                onSend={sendMessage}
              />
            </div>
          </div>
        ) : (
          /* No active session — empty state */
          <div className="flex flex-col h-full bg-slate-50/40">
            {error && (
              <ErrorBanner message={error} onDismiss={() => setError(null)} />
            )}
            <div className="flex flex-col items-center justify-center flex-1 px-6 sm:px-8 text-center">
              {/* Mobile: show sessions button */}
              <button
                onClick={() => setMobileSidebarOpen(true)}
                className="lg:hidden mb-4 flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                <PanelLeftOpen className="w-4 h-4" />
                Lihat Sesi Sebelumnya
              </button>

              <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200/70 flex items-center justify-center mb-5 shadow-sm shadow-amber-100">
                <Bot className="w-8 h-8 text-amber-500" />
              </div>
              <p className="text-base font-semibold text-slate-700 mb-2">
                AI Assistant POS
              </p>
              <p className="text-sm text-slate-400 leading-relaxed mb-6 max-w-xs">
                Mulai percakapan baru untuk menganalisis data toko Anda.
              </p>
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-amber-950 text-sm font-semibold transition-colors shadow-sm shadow-amber-200/60"
              >
                Mulai Percakapan
              </button>
            </div>
          </div>
        )}
      </div>

      <NewSessionModal
        shops={shops}
        open={showModal}
        onConfirm={createSession}
        onClose={() => setShowModal(false)}
        allowGlobal={!isAdmin}
        forcedShopId={adminShopId}
      />
    </div>
  );
}
