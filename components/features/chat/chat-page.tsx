"use client";

import { useState } from "react";
import { MainContainer } from "@chatscope/chat-ui-kit-react";
import { Bot, Globe, Store } from "lucide-react";
import { SessionSidebar } from "./session-sidebar";
import { ChatWindow } from "./chat-window";
import { NewSessionModal } from "./new-session-modal";

type Session = {
  id: string;
  scope: "global" | "shop";
  shop_id: string | null;
  Shop: { name: string } | null;
  last_active_at: string;
};

type ChatMessage = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  tableData?: {
    columns: string[];
    rows: (string | number | null)[][];
  } | null;
  created_at: string;
};

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_SHOPS = [
  { id: "shop1", name: "Toko Jakarta Pusat" },
  { id: "shop2", name: "Toko Bandung" },
  { id: "shop3", name: "Toko Surabaya" },
];

const MOCK_SESSIONS: Session[] = [
  {
    id: "sess1",
    scope: "global",
    shop_id: null,
    Shop: null,
    last_active_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  },
  {
    id: "sess2",
    scope: "shop",
    shop_id: "shop1",
    Shop: { name: "Toko Jakarta Pusat" },
    last_active_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
];

const MOCK_MESSAGES: Record<string, ChatMessage[]> = {
  sess1: [
    {
      id: "m1",
      role: "user",
      content: "Produk apa yang paling laris bulan ini?",
      created_at: new Date(Date.now() - 9 * 60 * 1000).toISOString(),
    },
    {
      id: "m2",
      role: "assistant",
      content:
        "Berdasarkan data transaksi bulan Mei 2026, berikut 5 produk terlaris di semua toko:",
      tableData: {
        columns: ["Produk", "Toko", "Total Terjual", "Pendapatan"],
        rows: [
          ["Kopi Arabica 250gr", "Semua Toko", "342", "Rp 8.550.000"],
          ["Teh Hijau Organik", "Semua Toko", "278", "Rp 5.560.000"],
          ["Milo Sachet 3in1", "Semua Toko", "241", "Rp 3.615.000"],
          ["Susu UHT Full Cream", "Semua Toko", "198", "Rp 4.950.000"],
          ["Roti Tawar Gandum", "Semua Toko", "165", "Rp 2.475.000"],
        ],
      },
      created_at: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    },
    {
      id: "m3",
      role: "user",
      content: "Berapa total pendapatan bulan ini dibanding bulan lalu?",
      created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    },
    {
      id: "m4",
      role: "assistant",
      content:
        "Total pendapatan bulan Mei 2026 sebesar Rp 128.450.000, naik 12,3% dibanding April 2026 (Rp 114.380.000). Kenaikan terbesar berasal dari kategori Minuman (+18%) dan Snack (+15%).",
      tableData: null,
      created_at: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    },
  ],
  sess2: [
    {
      id: "m5",
      role: "user",
      content: "Siapa pelanggan paling aktif di toko ini bulan ini?",
      created_at: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
    },
    {
      id: "m6",
      role: "assistant",
      content:
        "Berikut 3 pelanggan dengan frekuensi pembelian tertinggi di Toko Jakarta Pusat bulan Mei 2026:",
      tableData: {
        columns: ["Pelanggan", "Transaksi", "Total Belanja"],
        rows: [
          ["Budi Santoso", "14", "Rp 2.340.000"],
          ["Siti Rahayu", "11", "Rp 1.870.000"],
          ["Ahmad Fauzi", "9", "Rp 1.520.000"],
        ],
      },
      created_at: new Date(Date.now() - 89 * 60 * 1000).toISOString(),
    },
  ],
};

// ── Component ──────────────────────────────────────────────────────────────────

export function ChatPage() {
  const [sessions, setSessions] = useState<Session[]>(MOCK_SESSIONS);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  function selectSession(id: string) {
    const session = sessions.find((s) => s.id === id) ?? null;
    setActiveSession(session);
    setMessages(MOCK_MESSAGES[id] ?? []);
    setError(null);
  }

  function createSession(scope: "global" | "shop", shopId: string | null) {
    const newSession: Session = {
      id: `sess_${Date.now()}`,
      scope,
      shop_id: shopId,
      Shop: shopId ? { name: MOCK_SHOPS.find((s) => s.id === shopId)?.name ?? "" } : null,
      last_active_at: new Date().toISOString(),
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSession(newSession);
    setMessages([]);
    setError(null);
  }

  function deleteSession(id: string) {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (activeSession?.id === id) {
      setActiveSession(null);
      setMessages([]);
    }
  }

  function sendMessage(question: string) {
    if (!activeSession || isLoading) return;
    setError(null);

    const userMsg: ChatMessage = {
      role: "user",
      content: question,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    // Simulate API delay
    setTimeout(() => {
      const aiMsg: ChatMessage = {
        role: "assistant",
        content:
          "Ini adalah respons simulasi. Integrasi API akan diimplementasikan pada tahap berikutnya.",
        tableData: null,
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
      setIsLoading(false);
    }, 1500);
  }

  return (
    <div className="flex h-full rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-white">
      {/* Left panel — session list */}
      <div className="w-72 flex-shrink-0">
        <SessionSidebar
          sessions={sessions}
          activeId={activeSession?.id ?? null}
          onSelect={selectSession}
          onNew={() => setShowModal(true)}
          onDelete={deleteSession}
        />
      </div>

      {/* Right panel — chat area */}
      <div className="flex-1 overflow-hidden">
        {activeSession ? (
          <div className="flex flex-col h-full">
            {/* Session header */}
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-3 bg-white flex-shrink-0">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                {activeSession.scope === "global" ? (
                  <Globe className="w-4 h-4" />
                ) : (
                  <Store className="w-4 h-4" />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {activeSession.Shop?.name ?? "Semua Toko (Global)"}
                </p>
                <p className="text-[10px] text-slate-400">
                  {activeSession.scope === "global"
                    ? "Analisis seluruh toko"
                    : "Analisis toko tertentu"}
                </p>
              </div>
            </div>

            {/* Chat */}
            <div className="flex-1 overflow-hidden">
              <MainContainer style={{ height: "100%", border: "none" }}>
                <ChatWindow
                  messages={messages}
                  isLoading={isLoading}
                  error={error}
                  onSend={sendMessage}
                />
              </MainContainer>
            </div>
          </div>
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full text-slate-400 px-8">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-400 flex items-center justify-center mb-4">
              <Bot className="w-8 h-8" />
            </div>
            <p className="text-base font-semibold text-slate-600 mb-1">
              AI Assistant POS
            </p>
            <p className="text-sm text-center leading-relaxed mb-6">
              Pilih sesi di sebelah kiri atau buat percakapan baru untuk mulai
              menganalisis data POS Anda.
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
            >
              Mulai Percakapan
            </button>
          </div>
        )}
      </div>

      <NewSessionModal
        shops={MOCK_SHOPS}
        open={showModal}
        onConfirm={createSession}
        onClose={() => setShowModal(false)}
      />
    </div>
  );
}
