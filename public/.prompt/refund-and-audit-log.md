# API Documentation — Refund & Audit Log

**Base URL:** `http://localhost:3000/api`

---

## Konvensi Umum

### Autentikasi

Semua endpoint memerlukan JWT access token di header:

```
Authorization: Bearer <accessToken>
```

Access token berlaku selama **15 menit**. Gunakan `/api/auth/refresh` untuk memperbarui.

---

### Format Respons

**Sukses (single object):**
```json
{
  "success": true,
  "message": "Pesan sukses",
  "data": { }
}
```

**Sukses (list dengan pagination):**
```json
{
  "success": true,
  "message": "Pesan sukses",
  "data": [ ],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}
```

**Error:**
```json
{
  "success": false,
  "message": "Pesan error"
}
```

---

### Pagination

Semua endpoint list mendukung parameter berikut:

| Parameter | Tipe    | Default | Batas              | Keterangan            |
|-----------|---------|---------|--------------------|-----------------------|
| `page`    | integer | `1`     | min `1`            | Nomor halaman         |
| `limit`   | integer | `20`    | min `1`, maks `100` | Jumlah data per halaman |

---

### shopAccess Middleware

Endpoint yang menggunakan middleware `shopAccess` menentukan `req.shopId` secara otomatis:

| Role | Perilaku |
|------|----------|
| `superAdmin` | `shopId` dari query (opsional). Jika tidak diberikan, melihat semua toko. |
| `admin` / `user` | `shopId` dari query wajib jika punya lebih dari 1 toko. Jika hanya 1 toko, otomatis dipakai. |

---

### Error Umum (Middleware Level)

Error berikut dapat terjadi di **semua endpoint** sebelum logika bisnis berjalan:

| HTTP | `message` | Penyebab |
|------|-----------|----------|
| `401` | `Unauthorized` | Header `Authorization` tidak ada atau tidak diawali `Bearer ` |
| `401` | `Token invalid atau expired` | Token tidak valid, salah format, atau sudah kadaluarsa |
| `403` | `Forbidden: insufficient role` | Role user tidak memiliki izin mengakses endpoint ini |
| `403` | `Akses ke toko ini tidak diizinkan` | `shopId` di query bukan milik user (endpoint dengan `shopAccess`) |
| `403` | `Anda belum ditugaskan ke toko manapun` | User tidak memiliki assignment toko (endpoint dengan `shopAccess`) |
| `400` | `Anda memiliki beberapa toko, sertakan shopId di query` | User punya >1 toko tapi tidak menyertakan `shopId` (endpoint dengan `shopAccess`) |
| `500` | `Internal Server Error` | Kesalahan server yang tidak terduga |

---

## Daftar Isi

- [Refund](#1-refund)
  - [GET /refunds](#11-get-refunds)
  - [GET /refunds/:refundId](#12-get-refundsrefundid)
  - [POST /refunds](#13-post-refunds)
- [Audit Log](#2-audit-log)
  - [GET /audit-logs](#21-get-audit-logs)

---

# 1. Refund

Modul refund mengelola pengembalian barang atas transaksi yang sudah berstatus `completed`.

**Alur:**
```
[Kasir/Admin] POST /refunds
                    │
                    ▼
            approved (langsung)
        + stok dikembalikan otomatis
```

> Refund bersifat **langsung** (tanpa proses approval). Begitu request berhasil, stok barang dikembalikan ke inventory dan refund tercatat dengan status `approved`. Hanya transaksi berstatus `completed` yang dapat direfund.

---

## 1.1 GET /refunds

Mengambil daftar refund dengan dukungan filter dan pagination.

**Middleware:** `auth` → `authorize(superAdmin, admin)` → `shopAccess`

---

### Request

**Headers:**

| Header | Wajib | Keterangan |
|--------|-------|------------|
| `Authorization` | Ya | `Bearer <accessToken>` |

**Query Parameters:**

| Parameter | Tipe | Wajib | Keterangan |
|-----------|------|-------|------------|
| `page` | integer | Tidak | Nomor halaman (default: `1`) |
| `limit` | integer | Tidak | Jumlah per halaman (default: `20`, maks: `100`) |
| `transaction_id` | UUID | Tidak | Filter berdasarkan ID transaksi tertentu |
| `shopId` | UUID | Kondisional | Filter berdasarkan toko. `superAdmin`: opsional. `admin`: wajib jika punya >1 toko. |

**Contoh:**
```
GET /api/refunds
GET /api/refunds?page=1&limit=10
GET /api/refunds?shopId=uuid-toko
GET /api/refunds?transaction_id=uuid-transaksi
```

---

### Response

**`200 OK` — Berhasil:**
```json
{
  "success": true,
  "message": "Daftar refund berhasil diambil",
  "data": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "transaction_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "user_id": "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed",
      "reason": "Barang cacat saat diterima",
      "total_amount": 75000,
      "status": "approved",
      "created_at": "2026-05-04T08:00:00.000Z",
      "User": {
        "id": "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed",
        "name": "Kasir A"
      },
      "Transaction": {
        "id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        "invoice_no": "INV/2026/05/000001",
        "shop_id": "c4a9b7e2-1234-4abc-8def-000000000001",
        "Shop": {
          "id": "c4a9b7e2-1234-4abc-8def-000000000001",
          "name": "Toko Utama"
        }
      }
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

**`200 OK` — Data kosong:**
```json
{
  "success": true,
  "message": "Daftar refund berhasil diambil",
  "data": [],
  "meta": {
    "total": 0,
    "page": 1,
    "limit": 20,
    "totalPages": 0
  }
}
```

**Error — Middleware:**

| HTTP | `message` |
|------|-----------|
| `401` | `Unauthorized` |
| `401` | `Token invalid atau expired` |
| `403` | `Forbidden: insufficient role` |
| `403` | `Akses ke toko ini tidak diizinkan` |
| `403` | `Anda belum ditugaskan ke toko manapun` |
| `400` | `Anda memiliki beberapa toko, sertakan shopId di query` |

---

## 1.2 GET /refunds/:refundId

Mengambil detail satu refund beserta seluruh item yang di-refund.

**Middleware:** `auth` → `authorize(superAdmin, admin)` → `shopAccess`

---

### Request

**Headers:**

| Header | Wajib | Keterangan |
|--------|-------|------------|
| `Authorization` | Ya | `Bearer <accessToken>` |

**Path Parameters:**

| Parameter | Tipe | Wajib | Keterangan |
|-----------|------|-------|------------|
| `refundId` | UUID | Ya | ID refund yang ingin dilihat |

**Query Parameters:**

| Parameter | Tipe | Wajib | Keterangan |
|-----------|------|-------|------------|
| `shopId` | UUID | Kondisional | Wajib jika `admin` dengan >1 toko |

**Contoh:**
```
GET /api/refunds/3fa85f64-5717-4562-b3fc-2c963f66afa6
```

---

### Response

**`200 OK` — Berhasil:**
```json
{
  "success": true,
  "message": "Detail refund berhasil diambil",
  "data": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "transaction_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "user_id": "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed",
    "reason": "Barang cacat saat diterima",
    "total_amount": 75000,
    "status": "approved",
    "created_at": "2026-05-04T08:00:00.000Z",
    "User": {
      "id": "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed",
      "name": "Kasir A"
    },
    "Transaction": {
      "id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "invoice_no": "INV/2026/05/000001",
      "shop_id": "c4a9b7e2-1234-4abc-8def-000000000001",
      "Shop": {
        "id": "c4a9b7e2-1234-4abc-8def-000000000001",
        "name": "Toko Utama"
      }
    },
    "items": [
      {
        "id": "a1b2c3d4-0000-0000-0000-000000000001",
        "refund_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "transaction_item_id": "f1e2d3c4-0000-0000-0000-000000000001",
        "qty": 1,
        "amount": 75000,
        "TransactionItem": {
          "id": "f1e2d3c4-0000-0000-0000-000000000001",
          "product_variant_id": "b2c3d4e5-0000-0000-0000-000000000001",
          "qty": 2,
          "price": 75000
        }
      }
    ]
  }
}
```

**Error — Bisnis:**

| HTTP | `message` | Penyebab |
|------|-----------|----------|
| `403` | `Akses ke refund ini tidak diizinkan` | Refund bukan milik toko yang diakses user |
| `404` | `Refund tidak ditemukan` | `refundId` tidak ditemukan di database |

**Error — Middleware:**

| HTTP | `message` |
|------|-----------|
| `401` | `Unauthorized` |
| `401` | `Token invalid atau expired` |
| `403` | `Forbidden: insufficient role` |
| `403` | `Akses ke toko ini tidak diizinkan` |
| `403` | `Anda belum ditugaskan ke toko manapun` |
| `400` | `Anda memiliki beberapa toko, sertakan shopId di query` |

---

## 1.3 POST /refunds

Memproses refund secara langsung. Dalam satu operasi atomik:
1. Refund dibuat dengan status `approved`
2. Stok setiap item dikembalikan ke inventory toko
3. Stock movement bertipe `refund` dibuat untuk setiap item

**Middleware:** `auth` → `authorize(superAdmin, admin, user)`

> Tidak menggunakan `shopAccess`. Validasi akses dilakukan berdasarkan kepemilikan toko dari transaksi yang di-refund.

---

### Request

**Headers:**

| Header | Wajib | Keterangan |
|--------|-------|------------|
| `Authorization` | Ya | `Bearer <accessToken>` |
| `Content-Type` | Ya | `application/json` |

**Body Parameters:**

| Field | Tipe | Wajib | Keterangan |
|-------|------|-------|------------|
| `transaction_id` | UUID | Ya | ID transaksi yang akan di-refund. Harus berstatus `completed`. |
| `reason` | string | Tidak | Alasan pengajuan refund |
| `items` | array | Ya | Minimal 1 item |
| `items[].transaction_item_id` | UUID | Ya | ID item dari transaksi asal |
| `items[].qty` | integer | Ya | Jumlah unit yang di-refund. Harus `>= 1`, tidak boleh melebihi qty pembelian dikurangi qty yang sudah pernah di-refund sebelumnya. |

**Contoh Body (1 item):**
```json
{
  "transaction_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "reason": "Barang cacat saat diterima",
  "items": [
    {
      "transaction_item_id": "f1e2d3c4-0000-0000-0000-000000000001",
      "qty": 1
    }
  ]
}
```

**Contoh Body (beberapa item, tanpa reason):**
```json
{
  "transaction_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "items": [
    {
      "transaction_item_id": "f1e2d3c4-0000-0000-0000-000000000001",
      "qty": 1
    },
    {
      "transaction_item_id": "f1e2d3c4-0000-0000-0000-000000000002",
      "qty": 2
    }
  ]
}
```

---

### Response

**`201 Created` — Berhasil:**
```json
{
  "success": true,
  "message": "Refund berhasil diproses",
  "data": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "transaction_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "user_id": "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed",
    "reason": "Barang cacat saat diterima",
    "total_amount": 225000,
    "status": "approved",
    "created_at": "2026-05-04T08:00:00.000Z",
    "User": {
      "id": "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed",
      "name": "Kasir A"
    },
    "Transaction": {
      "id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "invoice_no": "INV/2026/05/000001",
      "shop_id": "c4a9b7e2-1234-4abc-8def-000000000001"
    },
    "items": [
      {
        "id": "a1b2c3d4-0000-0000-0000-000000000001",
        "refund_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "transaction_item_id": "f1e2d3c4-0000-0000-0000-000000000001",
        "qty": 1,
        "amount": 75000,
        "TransactionItem": {
          "id": "f1e2d3c4-0000-0000-0000-000000000001",
          "product_variant_id": "b2c3d4e5-0000-0000-0000-000000000001",
          "qty": 2,
          "price": 75000
        }
      },
      {
        "id": "a1b2c3d4-0000-0000-0000-000000000002",
        "refund_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "transaction_item_id": "f1e2d3c4-0000-0000-0000-000000000002",
        "qty": 2,
        "amount": 150000,
        "TransactionItem": {
          "id": "f1e2d3c4-0000-0000-0000-000000000002",
          "product_variant_id": "b2c3d4e5-0000-0000-0000-000000000002",
          "qty": 3,
          "price": 75000
        }
      }
    ]
  }
}
```

**Error — Validasi Request:**

| HTTP | `message` | Penyebab |
|------|-----------|----------|
| `400` | `transaction_id dan items wajib diisi` | Field `transaction_id` atau `items` tidak dikirim |
| `400` | `Refund harus memiliki minimal satu item` | Array `items` kosong |
| `400` | `Setiap item wajib memiliki transaction_item_id dan qty > 0` | Salah satu item tidak memiliki `transaction_item_id` atau `qty < 1` |

**Error — Bisnis:**

| HTTP | `message` | Penyebab |
|------|-----------|----------|
| `400` | `Hanya transaksi berstatus completed yang bisa direfund` | Status transaksi bukan `completed` |
| `400` | `Qty refund melebihi qty pembelian untuk item {id}` | `qty` yang diminta melebihi `qty` pada item transaksi asal |
| `400` | `Total qty refund melebihi qty pembelian untuk item {id}` | Sudah ada refund sebelumnya untuk item ini dan total melebihi qty pembelian |
| `400` | `Item {id} bukan bagian dari transaksi ini` | `transaction_item_id` tidak termasuk dalam transaksi yang di-refund |
| `403` | `Akses ke transaksi ini tidak diizinkan` | User tidak memiliki akses ke toko dari transaksi tersebut |
| `404` | `Transaksi tidak ditemukan` | `transaction_id` tidak ditemukan di database |
| `404` | `Transaction item {id} tidak ditemukan` | Salah satu `transaction_item_id` tidak ditemukan |

**Error — Middleware:**

| HTTP | `message` |
|------|-----------|
| `401` | `Unauthorized` |
| `401` | `Token invalid atau expired` |
| `403` | `Forbidden: insufficient role` |

---

# 2. Audit Log

Modul audit log menyimpan rekam jejak seluruh aksi mutasi yang terjadi di sistem. Data bersifat **read-only** — tidak ada endpoint untuk create, update, atau delete log secara manual.

### Aksi yang Direkam Sistem

| Modul | `entity_type` | `action` yang tersedia |
|-------|---------------|------------------------|
| Autentikasi | `user` | `login`, `register_admin`, `register_user`, `reset_password`, `change_password` |
| Produk | `product` | `create`, `update`, `delete` |
| Varian Produk | `product_variant` | `create`, `update`, `delete` |
| Toko | `shop` | `create`, `update`, `delete`, `assign_staff`, `remove_staff` |
| Kategori | `category` | `create`, `update`, `delete` |
| Inventory | `inventory` | `restock`, `adjust_out`, `set_threshold` |
| Transfer Stok | `transfer` | `create`, `approve`, `reject`, `cancel` |
| Transaksi | `transaction` | `create`, `cancel` |
| Refund | `refund` | `create` |
| Customer | `customer` | `create`, `update`, `delete` |
| User | `user` | `update` |
| Profil | `user` | `update_profile`, `update_photo` |

### Isi `old_values` dan `new_values`

| Tipe Aksi | `old_values` | `new_values` |
|-----------|-------------|--------------|
| `create` | `null` | Data objek yang baru dibuat |
| `update` | Data sebelum diubah | Data setelah diubah |
| `delete` | Data yang dihapus | `null` |
| `login`, `approve`, `reject`, `cancel` | `null` | `null` |

---

## 2.1 GET /audit-logs

Mengambil daftar audit log dengan filter lengkap dan pagination.

**Middleware:** `auth` → `authorize(superAdmin, admin)` → `shopAccess`

---

### Request

**Headers:**

| Header | Wajib | Keterangan |
|--------|-------|------------|
| `Authorization` | Ya | `Bearer <accessToken>` |

**Query Parameters:**

| Parameter | Tipe | Wajib | Keterangan |
|-----------|------|-------|------------|
| `page` | integer | Tidak | Nomor halaman (default: `1`) |
| `limit` | integer | Tidak | Jumlah per halaman (default: `20`, maks: `100`) |
| `entity_type` | string | Tidak | Filter tipe entitas. Nilai: `user` \| `shop` \| `product` \| `product_variant` \| `category` \| `inventory` \| `transfer` \| `transaction` \| `refund` \| `customer` |
| `action` | string | Tidak | Filter aksi. Nilai: lihat tabel aksi di atas |
| `user_id` | UUID | Tidak | Filter log berdasarkan user yang melakukan aksi |
| `date_from` | string | Tidak | Filter dari tanggal (inklusif). Format: `YYYY-MM-DD` atau ISO 8601 |
| `date_to` | string | Tidak | Filter sampai tanggal (inklusif). Format: `YYYY-MM-DD` atau ISO 8601 |
| `shopId` | UUID | Kondisional | Filter berdasarkan toko. `superAdmin`: opsional. `admin`: wajib jika punya >1 toko. |

**Contoh:**
```
GET /api/audit-logs
GET /api/audit-logs?entity_type=transaction&action=create
GET /api/audit-logs?entity_type=refund&date_from=2026-05-01&date_to=2026-05-31
GET /api/audit-logs?user_id=uuid-user&page=2&limit=10
GET /api/audit-logs?shopId=uuid-toko&entity_type=inventory
```

---

### Response

**`200 OK` — Berhasil:**
```json
{
  "success": true,
  "message": "Daftar audit log berhasil diambil",
  "data": [
    {
      "id": "aabbccdd-1111-2222-3333-444444444444",
      "user_id": "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed",
      "shop_id": "c4a9b7e2-1234-4abc-8def-000000000001",
      "entity_type": "refund",
      "entity_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "action": "create",
      "old_values": null,
      "new_values": {
        "transaction_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        "reason": "Barang cacat saat diterima",
        "total_amount": 75000
      },
      "ip_address": "192.168.1.10",
      "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "created_at": "2026-05-04T08:30:00.000Z",
      "User": {
        "id": "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed",
        "name": "Kasir A",
        "email": "kasir@toko.com"
      },
      "Shop": {
        "id": "c4a9b7e2-1234-4abc-8def-000000000001",
        "name": "Toko Utama"
      }
    },
    {
      "id": "aabbccdd-1111-2222-3333-555555555555",
      "user_id": "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed",
      "shop_id": null,
      "entity_type": "user",
      "entity_id": "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed",
      "action": "login",
      "old_values": null,
      "new_values": null,
      "ip_address": "192.168.1.10",
      "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "created_at": "2026-05-04T08:00:00.000Z",
      "User": {
        "id": "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed",
        "name": "Kasir A",
        "email": "kasir@toko.com"
      },
      "Shop": null
    }
  ],
  "meta": {
    "total": 248,
    "page": 1,
    "limit": 20,
    "totalPages": 13
  }
}
```

**`200 OK` — Data kosong:**
```json
{
  "success": true,
  "message": "Daftar audit log berhasil diambil",
  "data": [],
  "meta": {
    "total": 0,
    "page": 1,
    "limit": 20,
    "totalPages": 0
  }
}
```

---

### Struktur Objek Data

| Field | Tipe | Nullable | Keterangan |
|-------|------|----------|------------|
| `id` | UUID | Tidak | ID unik log |
| `user_id` | UUID | Ya | ID user yang melakukan aksi |
| `shop_id` | UUID | Ya | ID toko terkait. `null` untuk aksi yang tidak toko-spesifik (login, kategori, produk, dll.) |
| `entity_type` | string | Tidak | Tipe entitas yang terkena aksi |
| `entity_id` | UUID | Tidak | ID entitas yang terkena aksi |
| `action` | string | Tidak | Jenis aksi yang dilakukan |
| `old_values` | object | Ya | State sebelum perubahan. Tersedia pada `update` dan `delete`. |
| `new_values` | object | Ya | State setelah perubahan. Tersedia pada `create` dan `update`. |
| `ip_address` | string | Ya | IP address asal request |
| `user_agent` | string | Ya | User-agent browser/client |
| `created_at` | ISO 8601 | Tidak | Waktu aksi dilakukan (UTC) |
| `User` | object | Ya | Data user pelaku aksi. `null` jika user sudah dihapus. |
| `User.id` | UUID | — | ID user |
| `User.name` | string | — | Nama user |
| `User.email` | string | — | Email user |
| `Shop` | object | Ya | Data toko terkait. `null` jika `shop_id` null atau toko sudah dihapus. |
| `Shop.id` | UUID | — | ID toko |
| `Shop.name` | string | — | Nama toko |

---

### Contoh `old_values` / `new_values` per Skenario

**Buat refund:**
```json
{
  "old_values": null,
  "new_values": {
    "transaction_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "reason": "Barang cacat saat diterima",
    "total_amount": 75000
  }
}
```

**Update produk:**
```json
{
  "old_values": {
    "id": "uuid-produk",
    "name": "Kopi Hitam",
    "is_active": true,
    "category_id": "uuid-kategori"
  },
  "new_values": {
    "id": "uuid-produk",
    "name": "Kopi Hitam Premium",
    "is_active": true,
    "category_id": "uuid-kategori"
  }
}
```

**Delete customer:**
```json
{
  "old_values": {
    "id": "uuid-customer",
    "name": "Budi Santoso",
    "phone": "08123456789",
    "email": "budi@email.com"
  },
  "new_values": null
}
```

**Restock inventory:**
```json
{
  "old_values": null,
  "new_values": {
    "product_variant_id": "uuid-variant",
    "qty": 100,
    "cost_price": 5000,
    "note": "Restock rutin bulanan"
  }
}
```

**Login / approve transfer / cancel transaksi:**
```json
{
  "old_values": null,
  "new_values": null
}
```

**Assign staff ke toko:**
```json
{
  "old_values": null,
  "new_values": {
    "userId": "uuid-user-baru",
    "shopId": "uuid-toko"
  }
}
```

---

**Error — Middleware:**

| HTTP | `message` |
|------|-----------|
| `401` | `Unauthorized` |
| `401` | `Token invalid atau expired` |
| `403` | `Forbidden: insufficient role` |
| `403` | `Akses ke toko ini tidak diizinkan` |
| `403` | `Anda belum ditugaskan ke toko manapun` |
| `400` | `Anda memiliki beberapa toko, sertakan shopId di query` |
