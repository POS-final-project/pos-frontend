"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QueryResult } from "@/lib/aiChat";

type ChatMessage = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  queries?: QueryResult[];
  created_at: string;
};

interface ChatWindowProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSend: (text: string) => void;
}

const SUGGESTIONS = [
  "Produk apa yang paling laris bulan ini?",
  "Berapa total pendapatan hari ini?",
  "Toko mana yang paling banyak transaksi?",
];

export function ChatWindow({ messages, isLoading, onSend }: ChatWindowProps) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const visible = messages.filter(
    (m) => m.role === "user" || (m.role === "assistant" && m.queries !== undefined),
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  function handleSend() {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    onSend(text);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const canSend = input.trim().length > 0 && !isLoading;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* ── Message list ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-3">
        {visible.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200/60 flex items-center justify-center mb-4">
              <Bot className="w-7 h-7 text-amber-500" />
            </div>
            <p className="text-sm font-semibold text-slate-700 mb-1.5">
              Tanyakan apa saja tentang data POS
            </p>
            <p className="text-xs text-slate-400 leading-relaxed mb-6 max-w-[280px]">
              AI akan menjawab berdasarkan data transaksi, produk, dan inventori
              toko Anda secara real-time.
            </p>
            <div className="flex flex-wrap gap-2 justify-center max-w-sm">
              {SUGGESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => onSend(q)}
                  className="text-xs px-3.5 py-1.5 rounded-full border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:border-amber-400 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {visible.map((msg, i) => (
              <div
                key={msg.id ?? i}
                className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[76%] px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words",
                    msg.role === "user"
                      ? "bg-amber-500 text-amber-950 rounded-2xl rounded-tr-sm"
                      : "bg-white border border-slate-200 text-slate-800 rounded-2xl rounded-tl-sm",
                  )}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2.5">
                  <span className="flex gap-1">
                    {[0, 150, 300].map((delay) => (
                      <span
                        key={delay}
                        className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce"
                        style={{ animationDelay: `${delay}ms` }}
                      />
                    ))}
                  </span>
                  <span className="text-xs text-slate-400">AI sedang memproses...</span>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* ── Input area ───────────────────────────────────────────── */}
      <div className="border-t border-slate-100 px-4 py-3 bg-white flex-shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tanyakan sesuatu tentang data POS..."
            rows={1}
            disabled={isLoading}
            className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/15 focus:bg-white transition-colors leading-relaxed disabled:opacity-50 max-h-32 overflow-y-auto"
          />
          <button
            onClick={handleSend}
            disabled={!canSend}
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors bg-amber-500 hover:bg-amber-600 active:bg-amber-700 disabled:bg-slate-100 disabled:cursor-not-allowed"
          >
            <Send className={cn("w-4 h-4", canSend ? "text-amber-950" : "text-slate-400")} />
          </button>
        </div>
        <p className="text-[10px] text-slate-400 mt-1.5 pl-1">
          Enter untuk kirim · Shift+Enter untuk baris baru
        </p>
      </div>
    </div>
  );
}
