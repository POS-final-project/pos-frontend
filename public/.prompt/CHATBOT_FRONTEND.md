# Panduan Frontend — Chatbot AI POS

## Gambaran Umum

Chatbot memungkinkan user bertanya dalam bahasa natural dan mendapat jawaban berupa insight + tabel data dari database POS. Contoh: _"Produk apa yang paling laris bulan ini?"_

**Alur:**
```
User ketik pertanyaan
  → POST /api/ai/sessions/:id/chat  (Express)
    → FastAPI /query  (internal)
      → Qwen SQL gen → PostgreSQL execute → Groq insight
  → Tampilkan insight (teks) + tabel data (rows/columns)
```

---

## Tech Stack

```bash
npm install @chatscope/chat-ui-kit-react @chatscope/chat-ui-kit-styles axios
```

| Package | Fungsi |
|---------|--------|
| `@chatscope/chat-ui-kit-react` | Komponen UI chat siap pakai |
| `@chatscope/chat-ui-kit-styles` | CSS bawaan library |
| `axios` | HTTP client ke Express |

---

## Struktur Folder

```
src/
├── components/
│   └── chat/
│       ├── ChatPage.jsx          ← halaman utama, layout split
│       ├── SessionSidebar.jsx    ← daftar sesi (panel kiri)
│       ├── ChatWindow.jsx        ← area percakapan (panel kanan)
│       ├── NewSessionModal.jsx   ← modal buat sesi baru
│       └── DataTable.jsx         ← render tabel data hasil query
├── services/
│   └── aiChat.js                 ← semua pemanggilan API
└── hooks/
    └── useChat.js                ← state & logic chatbot
```

---

## API Service (`src/services/aiChat.js`)

Semua pemanggilan ke Express backend dipusatkan di sini.

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
});

// Inject token dari localStorage ke setiap request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const aiChatApi = {
  // Buat sesi baru
  createSession: (scope, shop_id = null) =>
    api.post('/ai/sessions', { scope, shop_id }),

  // List semua sesi milik user
  listSessions: (params = {}) =>
    api.get('/ai/sessions', { params }),

  // Detail sesi + history pesan (untuk restore percakapan)
  getSession: (sessionId) =>
    api.get(`/ai/sessions/${sessionId}`),

  // Hapus sesi
  deleteSession: (sessionId) =>
    api.delete(`/ai/sessions/${sessionId}`),

  // Kirim pertanyaan
  chat: (sessionId, question) =>
    api.post(`/ai/sessions/${sessionId}/chat`, { question }),
};
```

---

## Custom Hook (`src/hooks/useChat.js`)

Semua state dan logic dikelola di sini agar komponen tetap bersih.

```javascript
import { useState, useCallback } from 'react';
import { aiChatApi } from '../services/aiChat';

export function useChat() {
  const [sessions, setSessions]           = useState([]);
  const [activeSession, setActiveSession] = useState(null); // { id, scope, shop_id, ... }
  const [messages, setMessages]           = useState([]);   // { role, content, data?, created_at }
  const [isLoading, setIsLoading]         = useState(false);
  const [error, setError]                 = useState(null);

  // Muat daftar sesi dari server
  const loadSessions = useCallback(async () => {
    const { data } = await aiChatApi.listSessions();
    setSessions(data.data);
  }, []);

  // Pilih sesi — muat history pesan
  const selectSession = useCallback(async (sessionId) => {
    const { data } = await aiChatApi.getSession(sessionId);
    const session = data.data;
    setActiveSession(session);

    // Konversi messages dari DB ke format tampilan
    const displayed = session.messages.map((m) => ({
      id: m.id,
      role: m.role,           // 'user' | 'assistant'
      content: m.content,     // assistant = SQL (tidak ditampilkan)
      created_at: m.created_at,
    }));
    setMessages(displayed);
  }, []);

  // Buat sesi baru
  const createSession = useCallback(async (scope, shop_id = null) => {
    const { data } = await aiChatApi.createSession(scope, shop_id);
    const newSession = data.data;
    setSessions((prev) => [newSession, ...prev]);
    setActiveSession(newSession);
    setMessages([]);
    return newSession;
  }, []);

  // Hapus sesi
  const deleteSession = useCallback(async (sessionId) => {
    await aiChatApi.deleteSession(sessionId);
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    if (activeSession?.id === sessionId) {
      setActiveSession(null);
      setMessages([]);
    }
  }, [activeSession]);

  // Kirim pertanyaan
  const sendMessage = useCallback(async (question) => {
    if (!activeSession || isLoading) return;
    setError(null);

    // Tambahkan pesan user ke tampilan segera (optimistic)
    const userMsg = { role: 'user', content: question, created_at: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const { data } = await aiChatApi.chat(activeSession.id, question);
      const result = data.data; // { insight, columns, rows, row_count, sql, ... }

      // Tambahkan balasan AI — simpan insight + data tabel terpisah
      const aiMsg = {
        role: 'assistant',
        content: result.insight,
        tableData: result.row_count > 0 ? { columns: result.columns, rows: result.rows } : null,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMsg]);

      // Update last_active_at di sidebar
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSession.id ? { ...s, last_active_at: new Date().toISOString() } : s
        ).sort((a, b) => new Date(b.last_active_at) - new Date(a.last_active_at))
      );
    } catch (err) {
      const msg = err.response?.data?.message || 'Terjadi kesalahan, coba lagi.';
      setError(msg);
      // Hapus pesan user yang sudah ditambahkan (rollback optimistic)
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  }, [activeSession, isLoading]);

  return {
    sessions, activeSession, messages, isLoading, error,
    loadSessions, selectSession, createSession, deleteSession, sendMessage,
  };
}
```

---

## Komponen Tabel Data (`src/components/chat/DataTable.jsx`)

Hasil query berupa `columns` + `rows` ditampilkan sebagai tabel di bawah insight.

```jsx
export default function DataTable({ columns, rows }) {
  if (!columns?.length || !rows?.length) return null;

  return (
    <div style={{ overflowX: 'auto', marginTop: 8 }}>
      <table style={{ borderCollapse: 'collapse', fontSize: 13, width: '100%' }}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col} style={{ border: '1px solid #ddd', padding: '4px 8px', background: '#f5f5f5', textAlign: 'left' }}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} style={{ border: '1px solid #ddd', padding: '4px 8px' }}>
                  {cell ?? '-'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ fontSize: 11, color: '#999', marginTop: 4 }}>{rows.length} baris</p>
    </div>
  );
}
```

---

## Komponen Sidebar (`src/components/chat/SessionSidebar.jsx`)

```jsx
import { ConversationList, Conversation, Button } from '@chatscope/chat-ui-kit-react';

export default function SessionSidebar({ sessions, activeId, onSelect, onNew, onDelete }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: 12 }}>
        <button onClick={onNew} style={{ width: '100%', padding: 8, cursor: 'pointer' }}>
          + Percakapan Baru
        </button>
      </div>

      <ConversationList style={{ flex: 1, overflowY: 'auto' }}>
        {sessions.map((s) => (
          <Conversation
            key={s.id}
            active={s.id === activeId}
            onClick={() => onSelect(s.id)}
            name={s.Shop?.name || 'Semua Toko'}
            info={new Date(s.last_active_at).toLocaleDateString('id-ID')}
          >
            <Conversation.Operations>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(s.id); }}
                title="Hapus sesi"
              >
                🗑
              </button>
            </Conversation.Operations>
          </Conversation>
        ))}
      </ConversationList>
    </div>
  );
}
```

---

## Komponen Chat Window (`src/components/chat/ChatWindow.jsx`)

```jsx
import '@chatscope/chat-ui-kit-styles/dist/default/styles.min.css';
import {
  ChatContainer, MessageList, Message,
  MessageInput, TypingIndicator,
} from '@chatscope/chat-ui-kit-react';
import DataTable from './DataTable';

export default function ChatWindow({ messages, isLoading, error, onSend }) {
  return (
    <ChatContainer style={{ height: '100%' }}>
      <MessageList
        typingIndicator={isLoading ? <TypingIndicator content="AI sedang memproses..." /> : null}
      >
        {messages.length === 0 && !isLoading && (
          <MessageList.Content style={{ textAlign: 'center', padding: 40, color: '#999' }}>
            Mulai dengan mengetik pertanyaan tentang data POS Anda.
            <br />
            Contoh: <em>"Produk apa yang paling laris bulan ini?"</em>
          </MessageList.Content>
        )}

        {messages.map((msg, i) => {
          // Pesan dari assistant yang berisi SQL (dari history DB) tidak ditampilkan
          if (msg.role === 'assistant' && !msg.content?.startsWith('[') && msg.tableData === undefined) {
            // Pesan dari history — tidak punya tableData karena yang disimpan = SQL
            // Skip render, atau tampilkan placeholder
            return null;
          }

          return (
            <Message
              key={msg.id || i}
              model={{
                message: msg.role === 'user' ? msg.content : (msg.content || ''),
                direction: msg.role === 'user' ? 'outgoing' : 'incoming',
                position: 'single',
              }}
            >
              {/* Tabel data hanya untuk pesan AI baru (bukan history dari DB) */}
              {msg.role === 'assistant' && msg.tableData && (
                <Message.CustomContent>
                  <p style={{ margin: '0 0 8px 0' }}>{msg.content}</p>
                  <DataTable columns={msg.tableData.columns} rows={msg.tableData.rows} />
                </Message.CustomContent>
              )}
            </Message>
          );
        })}

        {error && (
          <Message
            model={{ message: `⚠️ ${error}`, direction: 'incoming', position: 'single' }}
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
```

---

## Modal Sesi Baru (`src/components/chat/NewSessionModal.jsx`)

```jsx
import { useState } from 'react';

// shops: array [{id, name}] dari GET /api/shops
export default function NewSessionModal({ shops, onConfirm, onClose }) {
  const [scope, setScope]   = useState('global');
  const [shopId, setShopId] = useState('');

  const handleSubmit = () => {
    if (scope === 'shop' && !shopId) return;
    onConfirm(scope, scope === 'shop' ? shopId : null);
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', padding: 24, borderRadius: 8, minWidth: 320 }}>
        <h3 style={{ marginTop: 0 }}>Percakapan Baru</h3>

        <label>Konteks:</label>
        <select value={scope} onChange={(e) => setScope(e.target.value)} style={{ display: 'block', width: '100%', margin: '4px 0 12px' }}>
          <option value="global">Semua Toko (Global)</option>
          <option value="shop">Toko Tertentu</option>
        </select>

        {scope === 'shop' && (
          <>
            <label>Pilih Toko:</label>
            <select value={shopId} onChange={(e) => setShopId(e.target.value)} style={{ display: 'block', width: '100%', margin: '4px 0 12px' }}>
              <option value="">-- Pilih --</option>
              {shops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose}>Batal</button>
          <button onClick={handleSubmit} disabled={scope === 'shop' && !shopId}>
            Mulai
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## Halaman Utama (`src/components/chat/ChatPage.jsx`)

Komponen root yang menyatukan semua bagian.

```jsx
import { useEffect, useState } from 'react';
import { MainContainer } from '@chatscope/chat-ui-kit-react';
import SessionSidebar from './SessionSidebar';
import ChatWindow from './ChatWindow';
import NewSessionModal from './NewSessionModal';
import { useChat } from '../../hooks/useChat';
import axios from 'axios';

export default function ChatPage() {
  const {
    sessions, activeSession, messages, isLoading, error,
    loadSessions, selectSession, createSession, deleteSession, sendMessage,
  } = useChat();

  const [showModal, setShowModal] = useState(false);
  const [shops, setShops]         = useState([]);

  // Muat sesi dan daftar toko saat halaman dibuka
  useEffect(() => {
    loadSessions();
    axios.get('/api/shops').then(({ data }) => setShops(data.data));
  }, []);

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Panel Kiri — Daftar Sesi */}
      <div style={{ width: 280, borderRight: '1px solid #eee', flexShrink: 0 }}>
        <SessionSidebar
          sessions={sessions}
          activeId={activeSession?.id}
          onSelect={selectSession}
          onNew={() => setShowModal(true)}
          onDelete={deleteSession}
        />
      </div>

      {/* Panel Kanan — Area Chat */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activeSession ? (
          <MainContainer style={{ height: '100%' }}>
            <ChatWindow
              messages={messages}
              isLoading={isLoading}
              error={error}
              onSend={sendMessage}
            />
          </MainContainer>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#999' }}>
            <div style={{ textAlign: 'center' }}>
              <p>Pilih sesi di sebelah kiri atau buat percakapan baru.</p>
              <button onClick={() => setShowModal(true)}>+ Percakapan Baru</button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <NewSessionModal
          shops={shops}
          onConfirm={createSession}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
```

---

## Catatan History Percakapan

History yang disimpan di DB berbeda dengan tampilan chat:

| Yang disimpan di `ai_chat_messages` | Yang ditampilkan di UI |
|-------------------------------------|------------------------|
| `user` → pertanyaan asli | ✅ Tampilkan sebagai bubble kiri |
| `assistant` → **SQL** (bukan insight) | ❌ Jangan tampilkan (tidak ramah user) |

Karena itu, saat restore history dari `GET /api/ai/sessions/:id`, pesan `assistant` dari DB berisi SQL — tidak perlu ditampilkan. Hanya pesan dari sesi aktif yang baru dikirim (`msg.tableData !== undefined`) yang menampilkan insight + tabel.

**Solusi praktis untuk TA:** Jika ingin history tetap terbaca, simpan insight juga sebagai pesan terpisah dengan role `assistant_insight`, atau cukup tampilkan history `user` saja dan beri label _"Riwayat tersedia, mulai bertanya untuk melanjutkan."_

---

## UX yang Perlu Diperhatikan

| Kondisi | Penanganan |
|---------|-----------|
| Loading (~3–5 detik) | `TypingIndicator` dari chatscope sudah menangani ini |
| SQL error (422) | Tampilkan pesan error dari `err.response.data.message` |
| AI service mati (502) | Tampilkan _"Layanan AI sedang tidak tersedia"_ |
| Pertanyaan tidak relevan | AI tetap menjawab — insight menjelaskan hasil kosong |
| `row_count = 0` | Tampilkan insight saja, skip tabel |

---

## Variabel Environment

Tambahkan ke `.env` frontend:

```env
VITE_API_URL=http://localhost:3000/api
```

Jika menggunakan proxy di `vite.config.js`:

```javascript
export default {
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
};
```
