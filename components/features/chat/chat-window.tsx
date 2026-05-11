"use client";

import "@chatscope/chat-ui-kit-styles/dist/default/styles.min.css";
import {
  ChatContainer,
  MessageList,
  Message,
  MessageInput,
  TypingIndicator,
} from "@chatscope/chat-ui-kit-react";
import { DataTable } from "./data-table";

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

interface ChatWindowProps {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  onSend: (text: string) => void;
}

export function ChatWindow({
  messages,
  isLoading,
  error,
  onSend,
}: ChatWindowProps) {
  return (
    <ChatContainer style={{ height: "100%" }}>
      <MessageList
        typingIndicator={
          isLoading ? (
            <TypingIndicator content="AI sedang memproses..." />
          ) : null
        }
      >
        {messages.length === 0 && !isLoading && (
          <MessageList.Content
            style={{ textAlign: "center", padding: "40px 20px", color: "#94a3b8" }}
          >
            <div style={{ fontSize: 32, marginBottom: 12 }}>🤖</div>
            <p style={{ fontWeight: 600, color: "#64748b", marginBottom: 8 }}>
              Tanyakan apa saja tentang data POS Anda
            </p>
            <p style={{ fontSize: 13, lineHeight: 1.6 }}>
              Contoh pertanyaan:
              <br />
              <em>&quot;Produk apa yang paling laris bulan ini?&quot;</em>
              <br />
              <em>&quot;Berapa total pendapatan minggu lalu?&quot;</em>
              <br />
              <em>&quot;Toko mana yang paling banyak transaksi?&quot;</em>
            </p>
          </MessageList.Content>
        )}

        {messages.map((msg, i) => {
          if (msg.role === "assistant" && msg.tableData === undefined) {
            return null;
          }

          const isAssistantWithTable =
            msg.role === "assistant" && msg.tableData;

          return (
            <Message
              key={msg.id ?? i}
              model={{
                message: msg.role === "user" ? msg.content : msg.content || "",
                direction: msg.role === "user" ? "outgoing" : "incoming",
                position: "single",
              }}
            >
              {isAssistantWithTable && (
                <Message.CustomContent>
                  <p style={{ margin: "0 0 8px 0", lineHeight: 1.6 }}>
                    {msg.content}
                  </p>
                  <DataTable
                    columns={msg.tableData!.columns}
                    rows={msg.tableData!.rows}
                  />
                </Message.CustomContent>
              )}
            </Message>
          );
        })}

        {error && (
          <Message
            model={{
              message: `⚠️ ${error}`,
              direction: "incoming",
              position: "single",
            }}
          />
        )}
      </MessageList>

      <MessageInput
        placeholder="Tanyakan sesuatu tentang data POS..."
        onSend={onSend}
        attachButton={false}
        disabled={isLoading}
      />
    </ChatContainer>
  );
}
