# POS API — Panduan Frontend

Base URL: `http://localhost:3000/api`

---

## Daftar Isi

1. [Konvensi Umum](#1-konvensi-umum)
2. [Auth](#2-auth)
3. [Profile](#3-profile)
4. [Users](#4-users)
5. [Shops](#5-shops)
6. [Categories](#6-categories)
7. [Products & Variants](#7-products--variants)
8. [Inventory](#8-inventory)
9. [Transfers](#9-transfers)
10. [Customers](#10-customers)
11. [Transactions](#11-transactions)
12. [Refunds](#12-refunds)
13. [Audit Logs](#13-audit-logs)

---

## 1. Konvensi Umum

### Authentication

Semua endpoint (kecuali yang ditandai **Public**) wajib menyertakan header:

```
Authorization: Bearer <accessToken>
```

### Role

| Role | Keterangan |
|------|-----------|
| `superAdmin` | Akses penuh ke semua toko |
| `admin` | Akses terbatas ke toko yang di-assign |
| `user` | Kasir, akses terbatas ke toko yang di-assign |

### shopAccess — Cara Kerja

Endpoint yang memerlukan konteks toko menggunakan middleware `shopAccess`:

- **superAdmin**: sertakan `?shopId=<uuid>` untuk filter per-toko; jika tidak disertakan, data semua toko ditampilkan.
- **admin/user**: sertakan `?shopId=<uuid>` jika memiliki lebih dari satu toko; jika hanya satu toko, `shopId` di-infer otomatis.

Endpoint yang **wajib** `shopAccess` ditandai dengan ikon 🏪 di bawah.

### Format Response

**Sukses (single data):**
```json
{
  "success": true,
  "message": "...",
  "data": { ... }
}
```

**Sukses (daftar / paginasi):**
```json
{
  "success": true,
  "message": "...",
  "data": [ ... ],
  "meta": {
    "total": 42,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

**Gagal:**
```json
{
  "success": false,
  "message": "Pesan error"
}
```

### Paginasi

Semua endpoint daftar mendukung query:

| Parameter | Default | Maks | Keterangan |
|-----------|---------|------|-----------|
| `page` | `1` | — | Halaman ke-n |
| `limit` | `20` | `100` | Jumlah item per halaman |

### Upload File

- Foto profil & gambar variant diunggah via `multipart/form-data`.
- Gambar tersimpan di: `/uploads/profile/...` dan `/uploads/product-variant/...`
- Akses langsung: `GET /uploads/profile/<filename>` (tidak perlu token)

---

## 2. Auth

Base path: `/api/auth`

---

### POST /api/auth/login

**Public** · Login dan dapatkan token.

**Body (JSON):**

| Field | Tipe | Wajib | Keterangan |
|-------|------|-------|-----------|
| `email` | string | ✓ | |
| `password` | string | ✓ | |

**Contoh request:**
```json
{
  "email": "superadmin@segarjaya.com",
  "password": "password123"
}
```

**Contoh response `200`:**
```json
{
  "success": true,
  "message": "Login berhasil",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "name": "Super Admin",
      "email": "superadmin@segarjaya.com",
      "role": "superAdmin"
    }
  }
}
```

> **Catatan:** `accessToken` berlaku 15 menit. `refreshToken` berlaku 7 hari. Simpan kedua token di sisi klien.

---

### POST /api/auth/refresh

**Public** · Perbarui access token menggunakan refresh token.

**Body (JSON):**

| Field | Tipe | Wajib |
|-------|------|-------|
| `refreshToken` | string | ✓ |

**Contoh response `200`:**
```json
{
  "success": true,
  "message": "Token diperbarui",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

### POST /api/auth/logout

**Role:** semua · Logout (sisi server stateless, cukup hapus token di klien).

**Response `200`:**
```json
{
  "success": true,
  "message": "Logout berhasil",
  "data": null
}
```

---

### POST /api/auth/register/admin

**Role:** `superAdmin` · Daftarkan akun admin baru dan assign ke toko.

**Body (JSON):**

| Field | Tipe | Wajib | Keterangan |
|-------|------|-------|-----------|
| `name` | string | ✓ | |
| `email` | string | ✓ | Harus unik |
| `password` | string | ✓ | |
| `shopId` | UUID | ✓ | Toko yang di-assign |

**Contoh request:**
```json
{
  "name": "Admin Pusat",
  "email": "admin.pusat@segarjaya.com",
  "password": "admin123",
  "shopId": "shop-uuid-1234"
}
```

**Contoh response `201`:**
```json
{
  "success": true,
  "message": "Admin berhasil didaftarkan",
  "data": {
    "id": "user-uuid-5678",
    "name": "Admin Pusat",
    "email": "admin.pusat@segarjaya.com",
    "role": "admin"
  }
}
```

---

### POST /api/auth/register/user

**Role:** `superAdmin`, `admin` · Daftarkan akun user/kasir dan assign ke toko.

> Admin hanya bisa mendaftarkan user ke toko miliknya sendiri.

**Body (JSON):**

| Field | Tipe | Wajib | Keterangan |
|-------|------|-------|-----------|
| `name` | string | ✓ | |
| `email` | string | ✓ | Harus unik |
| `password` | string | ✓ | |
| `shopId` | UUID | ✓ | Toko yang di-assign |

**Contoh response `201`:**
```json
{
  "success": true,
  "message": "User berhasil didaftarkan",
  "data": {
    "id": "user-uuid-9999",
    "name": "Kasir 1",
    "email": "kasir1@segarjaya.com",
    "role": "user"
  }
}
```

---

### POST /api/auth/forgot-password

**Public** · Kirim link reset password ke email.

**Body (JSON):**

| Field | Tipe | Wajib |
|-------|------|-------|
| `email` | string | ✓ |

**Contoh response `200`:**
```json
{
  "success": true,
  "message": "Jika email terdaftar, link reset password telah dikirim",
  "data": null
}
```

> Selalu mengembalikan 200 (security reason — tidak membocorkan apakah email terdaftar).

---

### POST /api/auth/reset-password

**Public** · Reset password menggunakan token dari email.

**Body (JSON):**

| Field | Tipe | Wajib | Keterangan |
|-------|------|-------|-----------|
| `token` | string | ✓ | Token dari link email |
| `newPassword` | string | ✓ | |

**Contoh response `200`:**
```json
{
  "success": true,
  "message": "Password berhasil direset",
  "data": null
}
```

---

### POST /api/auth/change-password

**Role:** semua · Ganti password sendiri (harus tahu password lama).

**Body (JSON):**

| Field | Tipe | Wajib |
|-------|------|-------|
| `currentPassword` | string | ✓ |
| `newPassword` | string | ✓ |

**Contoh response `200`:**
```json
{
  "success": true,
  "message": "Password berhasil diubah",
  "data": null
}
```

---

## 3. Profile

Base path: `/api/profile`

---

### GET /api/profile

**Role:** semua · Ambil data profil sendiri.

**Contoh response `200`:**
```json
{
  "success": true,
  "message": "Profil berhasil diambil",
  "data": {
    "id": "user-uuid-1234",
    "name": "Kasir 1",
    "email": "kasir1@segarjaya.com",
    "role": "user",
    "phone": "081234567890",
    "image_url": "/uploads/profile/abc123.jpg",
    "is_active": true,
    "created_at": "2026-01-15T08:00:00.000Z",
    "updated_at": "2026-04-20T10:30:00.000Z"
  }
}
```

---

### PATCH /api/profile

**Role:** semua · Perbarui nama, email, atau nomor telepon sendiri.

**Body (JSON):** semua field opsional.

| Field | Tipe | Keterangan |
|-------|------|-----------|
| `name` | string | |
| `email` | string | Harus unik |
| `phone` | string | |

**Contoh request:**
```json
{
  "name": "Kasir Satu",
  "phone": "081298765432"
}
```

**Response:** sama seperti GET `/api/profile`.

---

### PATCH /api/profile/photo

**Role:** semua · Upload foto profil.

**Content-Type:** `multipart/form-data`

| Field | Tipe | Wajib | Keterangan |
|-------|------|-------|-----------|
| `photo` | file | ✓ | Gambar (max 2MB) |

**Contoh response `200`:**
```json
{
  "success": true,
  "message": "Foto profil berhasil diperbarui",
  "data": {
    "image_url": "/uploads/profile/1714567890123-photo.jpg"
  }
}
```

---

## 4. Users

Base path: `/api/users`

> Semua endpoint di sini hanya untuk **`superAdmin`**.

---

### GET /api/users

**Role:** `superAdmin` · Daftar semua user.

**Query params:**

| Parameter | Tipe | Keterangan |
|-----------|------|-----------|
| `role` | `superAdmin` \| `admin` \| `user` | Filter berdasarkan role |
| `is_active` | `true` \| `false` | Filter status aktif |
| `search` | string | Cari nama atau email (case-insensitive) |
| `page` | number | |
| `limit` | number | |

**Contoh response `200`:**
```json
{
  "success": true,
  "message": "Daftar user berhasil diambil",
  "data": [
    {
      "id": "user-uuid-1234",
      "name": "Admin Pusat",
      "email": "admin.pusat@segarjaya.com",
      "role": "admin",
      "phone": "081234567890",
      "image_url": null,
      "is_active": true,
      "created_at": "2026-01-15T08:00:00.000Z"
    }
  ],
  "meta": {
    "total": 10,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

---

### GET /api/users/:userId

**Role:** `superAdmin` · Detail satu user.

**Contoh response `200`:**
```json
{
  "success": true,
  "message": "Detail user berhasil diambil",
  "data": {
    "id": "user-uuid-1234",
    "name": "Admin Pusat",
    "email": "admin.pusat@segarjaya.com",
    "role": "admin",
    "phone": "081234567890",
    "image_url": null,
    "is_active": true,
    "created_at": "2026-01-15T08:00:00.000Z"
  }
}
```

---

### PATCH /api/users/:userId

**Role:** `superAdmin` · Perbarui data user (nama, nomor, role, status aktif).

**Body (JSON):** semua field opsional.

| Field | Tipe | Keterangan |
|-------|------|-----------|
| `name` | string | |
| `phone` | string | |
| `role` | `superAdmin` \| `admin` \| `user` | |
| `is_active` | boolean | |

**Contoh request:**
```json
{
  "is_active": false
}
```

**Response:** sama seperti GET `/api/users/:userId`.

---

## 5. Shops

Base path: `/api/shops`

---

### GET /api/shops

**Role:** semua · Daftar toko.

> `superAdmin` melihat semua toko aktif. `admin`/`user` hanya melihat toko yang di-assign ke mereka.

**Query params:** `page`, `limit`

**Contoh response `200`:**
```json
{
  "success": true,
  "message": "Daftar toko berhasil diambil",
  "data": [
    {
      "id": "shop-uuid-1111",
      "name": "Segar Jaya Pusat",
      "address": "Jl. Sudirman No. 1, Jakarta",
      "phone": "02112345678",
      "is_active": true,
      "created_at": "2026-01-01T00:00:00.000Z",
      "updated_at": "2026-01-01T00:00:00.000Z"
    }
  ],
  "meta": { "total": 3, "page": 1, "limit": 20, "totalPages": 1 }
}
```

---

### POST /api/shops

**Role:** `superAdmin` · Buat toko baru.

**Body (JSON):**

| Field | Tipe | Wajib | Keterangan |
|-------|------|-------|-----------|
| `name` | string | ✓ | |
| `address` | string | — | |
| `phone` | string | — | |

**Contoh request:**
```json
{
  "name": "Segar Jaya Cabang Bandung",
  "address": "Jl. Asia Afrika No. 5, Bandung",
  "phone": "02298765432"
}
```

**Contoh response `201`:**
```json
{
  "success": true,
  "message": "Toko berhasil dibuat",
  "data": {
    "id": "shop-uuid-2222",
    "name": "Segar Jaya Cabang Bandung",
    "address": "Jl. Asia Afrika No. 5, Bandung",
    "phone": "02298765432",
    "is_active": true,
    "created_at": "2026-05-06T09:00:00.000Z",
    "updated_at": "2026-05-06T09:00:00.000Z"
  }
}
```

---

### GET /api/shops/:shopId

**Role:** semua · Detail satu toko.

> `admin`/`user` hanya bisa mengakses toko yang di-assign ke mereka.

**Response:** sama seperti item di GET `/api/shops`.

---

### PATCH /api/shops/:shopId

**Role:** `superAdmin`, `admin` · Perbarui data toko.

> `admin` hanya bisa mengubah toko miliknya sendiri.

**Body (JSON):** semua field opsional.

| Field | Tipe |
|-------|------|
| `name` | string |
| `address` | string |
| `phone` | string |
| `is_active` | boolean |

**Response:** data toko yang sudah diperbarui.

---

### DELETE /api/shops/:shopId

**Role:** `superAdmin` · Nonaktifkan toko (soft delete, set `is_active = false`).

**Response `200`:**
```json
{
  "success": true,
  "message": "Toko berhasil dihapus",
  "data": null
}
```

---

### GET /api/shops/:shopId/staff

**Role:** `superAdmin`, `admin` · Daftar staff yang di-assign ke toko.

**Contoh response `200`:**
```json
{
  "success": true,
  "message": "Daftar staff berhasil diambil",
  "data": [
    {
      "id": "user-uuid-5678",
      "name": "Admin Pusat",
      "email": "admin.pusat@segarjaya.com",
      "role": "admin",
      "is_active": true,
      "phone": "081234567890"
    }
  ]
}
```

---

### POST /api/shops/:shopId/staff

**Role:** `superAdmin`, `admin` · Assign user ke toko.

**Body (JSON):**

| Field | Tipe | Wajib | Keterangan |
|-------|------|-------|-----------|
| `userId` | UUID | ✓ | ID user yang akan di-assign |

**Contoh request:**
```json
{
  "userId": "user-uuid-9999"
}
```

**Response `201`:**
```json
{
  "success": true,
  "message": "Staff berhasil ditugaskan ke toko",
  "data": null
}
```

---

### DELETE /api/shops/:shopId/staff/:userId

**Role:** `superAdmin`, `admin` · Lepas user dari toko.

**Response `200`:**
```json
{
  "success": true,
  "message": "Staff berhasil dihapus dari toko",
  "data": null
}
```

---

## 6. Categories

Base path: `/api/categories`

> Kategori adalah entitas **global** (tidak terikat toko). Hanya `superAdmin` yang bisa membuat/mengubah/menghapus.

---

### GET /api/categories

**Role:** semua · Daftar semua kategori.

**Query params:** `page`, `limit`

**Contoh response `200`:**
```json
{
  "success": true,
  "message": "Daftar kategori berhasil diambil",
  "data": [
    {
      "id": "cat-uuid-1111",
      "name": "Sayuran",
      "created_at": "2026-01-01T00:00:00.000Z",
      "updated_at": "2026-01-01T00:00:00.000Z"
    },
    {
      "id": "cat-uuid-2222",
      "name": "Buah-buahan",
      "created_at": "2026-01-01T00:00:00.000Z",
      "updated_at": "2026-01-01T00:00:00.000Z"
    }
  ],
  "meta": { "total": 5, "page": 1, "limit": 20, "totalPages": 1 }
}
```

---

### POST /api/categories

**Role:** `superAdmin` · Buat kategori baru.

**Body (JSON):**

| Field | Tipe | Wajib |
|-------|------|-------|
| `name` | string | ✓ |

**Contoh response `201`:**
```json
{
  "success": true,
  "message": "Kategori berhasil dibuat",
  "data": {
    "id": "cat-uuid-3333",
    "name": "Rempah-rempah",
    "created_at": "2026-05-06T09:00:00.000Z",
    "updated_at": "2026-05-06T09:00:00.000Z"
  }
}
```

---

### PATCH /api/categories/:categoryId

**Role:** `superAdmin` · Ubah nama kategori.

**Body (JSON):**

| Field | Tipe | Wajib |
|-------|------|-------|
| `name` | string | ✓ |

**Response:** data kategori yang sudah diperbarui.

---

### DELETE /api/categories/:categoryId

**Role:** `superAdmin` · Hapus kategori (hard delete).

**Response `200`:**
```json
{
  "success": true,
  "message": "Kategori berhasil dihapus",
  "data": null
}
```

---

## 7. Products & Variants

Base path: `/api/products`

> Produk adalah entitas **global** (tidak terikat toko). Stok per-toko dikelola di [Inventory](#8-inventory).

---

### GET /api/products

**Role:** semua · Daftar produk.

**Query params:**

| Parameter | Tipe | Keterangan |
|-----------|------|-----------|
| `search` | string | Cari nama produk (case-insensitive) |
| `categoryId` | UUID | Filter berdasarkan kategori |
| `isActive` | `true` \| `false` | Filter status aktif |
| `page` | number | |
| `limit` | number | |

**Contoh response `200`:**
```json
{
  "success": true,
  "message": "Daftar produk berhasil diambil",
  "data": [
    {
      "id": "prod-uuid-1111",
      "name": "Bayam",
      "description": "Bayam segar organik",
      "is_active": true,
      "image_url": "/uploads/product-variant/bayam-250g.jpg",
      "category_id": "cat-uuid-1111",
      "created_at": "2026-01-10T00:00:00.000Z",
      "updated_at": "2026-04-01T00:00:00.000Z",
      "Category": {
        "id": "cat-uuid-1111",
        "name": "Sayuran"
      },
      "variants": [
        {
          "id": "var-uuid-aaaa",
          "product_id": "prod-uuid-1111",
          "name": "250gr",
          "sku": "BYM-250",
          "price": "5000.00",
          "image_url": "/uploads/product-variant/bayam-250g.jpg",
          "is_active": true
        },
        {
          "id": "var-uuid-bbbb",
          "product_id": "prod-uuid-1111",
          "name": "500gr",
          "sku": "BYM-500",
          "price": "9000.00",
          "image_url": null,
          "is_active": true
        }
      ]
    }
  ],
  "meta": { "total": 25, "page": 1, "limit": 20, "totalPages": 2 }
}
```

> `image_url` di level produk diambil otomatis dari variant aktif pertama.

---

### POST /api/products

**Role:** `superAdmin`, `admin`, `user` · Buat produk beserta variant-nya.

**Content-Type:** `multipart/form-data` (mendukung upload gambar variant)

**Fields:**

| Field | Tipe | Wajib | Keterangan |
|-------|------|-------|-----------|
| `name` | string | ✓ | Nama produk |
| `description` | string | — | |
| `category_id` | UUID | — | |
| `variants` | JSON string | ✓ | Array variant (min. 1) |

**Format `variants` (JSON string):**
```json
[
  { "name": "250gr", "sku": "BYM-250", "price": 5000 },
  { "name": "500gr", "sku": "BYM-500", "price": 9000 }
]
```

**Mengirim gambar per variant:**

Bisa dengan dua cara:

**Cara 1 — bracket notation:**
```
variants[0][name] = 250gr
variants[0][sku]  = BYM-250
variants[0][price] = 5000
variants[0][image] = <file>
variants[1][name] = 500gr
...
```

**Cara 2 — JSON string + file sequential:**
```
variants = [{"name":"250gr","sku":"BYM-250","price":5000}]
variant_images = <file untuk variant 0>
```

**Contoh response `201`:**
```json
{
  "success": true,
  "message": "Produk berhasil dibuat",
  "data": {
    "id": "prod-uuid-2222",
    "name": "Bayam",
    "description": "Bayam segar organik",
    "is_active": true,
    "image_url": "/uploads/product-variant/bayam-250g.jpg",
    "category_id": "cat-uuid-1111",
    "Category": { "id": "cat-uuid-1111", "name": "Sayuran" },
    "variants": [
      {
        "id": "var-uuid-cccc",
        "name": "250gr",
        "sku": "BYM-250",
        "price": "5000.00",
        "image_url": "/uploads/product-variant/bayam-250g.jpg",
        "is_active": true
      }
    ]
  }
}
```

---

### GET /api/products/:productId

**Role:** semua · Detail satu produk beserta semua variantnya.

**Response:** sama seperti item di GET `/api/products`.

---

### PATCH /api/products/:productId

**Role:** `superAdmin`, `admin` · Perbarui data produk (bukan variant).

**Body (JSON):** semua field opsional.

| Field | Tipe |
|-------|------|
| `name` | string |
| `description` | string |
| `category_id` | UUID |
| `is_active` | boolean |

**Response:** data produk lengkap beserta variant.

---

### DELETE /api/products/:productId

**Role:** `superAdmin`, `admin` · Nonaktifkan produk (soft delete).

**Response `200`:**
```json
{
  "success": true,
  "message": "Produk berhasil dihapus",
  "data": null
}
```

---

### GET /api/products/:productId/variants

**Role:** semua · Daftar variant sebuah produk.

**Query params:** `page`, `limit`

**Contoh response `200`:**
```json
{
  "success": true,
  "message": "Daftar variant berhasil diambil",
  "data": [
    {
      "id": "var-uuid-aaaa",
      "product_id": "prod-uuid-1111",
      "name": "250gr",
      "sku": "BYM-250",
      "price": "5000.00",
      "image_url": "/uploads/product-variant/bayam-250g.jpg",
      "is_active": true,
      "created_at": "2026-01-10T00:00:00.000Z",
      "updated_at": "2026-01-10T00:00:00.000Z"
    }
  ],
  "meta": { "total": 2, "page": 1, "limit": 20, "totalPages": 1 }
}
```

---

### POST /api/products/:productId/variants

**Role:** `superAdmin`, `admin`, `user` · Tambah variant ke produk yang sudah ada.

**Content-Type:** `multipart/form-data`

| Field | Tipe | Wajib | Keterangan |
|-------|------|-------|-----------|
| `name` | string | ✓ | Nama variant (mis. "1kg") |
| `sku` | string | ✓ | Kode unik |
| `price` | number | ✓ | |
| `image` | file | — | Gambar variant |

**Contoh response `201`:**
```json
{
  "success": true,
  "message": "Variant berhasil dibuat",
  "data": {
    "id": "var-uuid-dddd",
    "product_id": "prod-uuid-1111",
    "name": "1kg",
    "sku": "BYM-1KG",
    "price": "17000.00",
    "image_url": null,
    "is_active": true
  }
}
```

---

### GET /api/products/:productId/variants/:variantId

**Role:** semua · Detail satu variant.

**Response:** sama seperti item di GET `/api/products/:productId/variants`.

---

### PATCH /api/products/:productId/variants/:variantId

**Role:** `superAdmin`, `admin` · Perbarui data variant.

**Content-Type:** `multipart/form-data` atau `application/json`

| Field | Tipe | Keterangan |
|-------|------|-----------|
| `name` | string | |
| `sku` | string | |
| `price` | number | |
| `image` | file | Upload gambar baru |
| `is_active` | boolean | |

**Response:** data variant yang diperbarui.

---

### DELETE /api/products/:productId/variants/:variantId

**Role:** `superAdmin`, `admin` · Hapus variant (hard delete).

**Response `200`:**
```json
{
  "success": true,
  "message": "Variant berhasil dihapus",
  "data": null
}
```

---

## 8. Inventory

Base path: `/api/inventory`

---

### GET /api/inventory 🏪

**Role:** `superAdmin`, `admin`, `user`

Daftar inventory (stok per-toko per-variant). Data difilter berdasarkan `shopId` via `shopAccess`.

**Query params:**

| Parameter | Tipe | Keterangan |
|-----------|------|-----------|
| `shopId` | UUID | Wajib untuk `admin`/`user` jika lebih dari 1 toko |
| `page` | number | |
| `limit` | number | |

**Contoh response `200`:**
```json
{
  "success": true,
  "message": "Daftar inventory berhasil diambil",
  "data": [
    {
      "id": "inv-uuid-1111",
      "shop_id": "shop-uuid-1111",
      "product_variant_id": "var-uuid-aaaa",
      "stock": 150,
      "avg_cost_price": "4200.00",
      "low_stock_threshold": 20,
      "updated_at": "2026-05-05T14:00:00.000Z",
      "ProductVariant": {
        "id": "var-uuid-aaaa",
        "name": "250gr",
        "sku": "BYM-250",
        "price": "5000.00",
        "Product": { "id": "prod-uuid-1111", "name": "Bayam" }
      },
      "Shop": { "id": "shop-uuid-1111", "name": "Segar Jaya Pusat" }
    }
  ],
  "meta": { "total": 40, "page": 1, "limit": 20, "totalPages": 2 }
}
```

---

### GET /api/inventory/products/:productId 🏪

**Role:** `superAdmin`, `admin`, `user`

Stok semua variant dari satu produk di toko tertentu.

**Query params:** `shopId` (via shopAccess), `page`, `limit`

**Response:** sama seperti GET `/api/inventory`.

---

### GET /api/inventory/movements 🏪

**Role:** `superAdmin`, `admin`, `user`

Riwayat pergerakan stok di toko tertentu.

**Query params:**

| Parameter | Tipe | Keterangan |
|-----------|------|-----------|
| `shopId` | UUID | via shopAccess |
| `type` | string | Filter tipe: `restock` \| `adjustment` \| `sale` \| `refund` \| `transfer_out` \| `transfer_in` |
| `page` | number | |
| `limit` | number | |

**Contoh response `200`:**
```json
{
  "success": true,
  "message": "Riwayat pergerakan stok berhasil diambil",
  "data": [
    {
      "id": "mov-uuid-aaaa",
      "shop_id": "shop-uuid-1111",
      "product_variant_id": "var-uuid-aaaa",
      "user_id": "user-uuid-5678",
      "transaction_id": null,
      "transfer_id": null,
      "type": "restock",
      "qty": 100,
      "cost_price": "4200.00",
      "stock_before": 50,
      "stock_after": 150,
      "avg_cost_before": "4000.00",
      "avg_cost_after": "4200.00",
      "note": "Restock mingguan",
      "created_at": "2026-05-05T09:00:00.000Z",
      "ProductVariant": {
        "id": "var-uuid-aaaa",
        "name": "250gr",
        "sku": "BYM-250",
        "Product": { "id": "prod-uuid-1111", "name": "Bayam" }
      },
      "Shop": { "id": "shop-uuid-1111", "name": "Segar Jaya Pusat" }
    }
  ],
  "meta": { "total": 120, "page": 1, "limit": 20, "totalPages": 6 }
}
```

---

### POST /api/inventory/restock

**Role:** `superAdmin`, `admin` · Tambah stok produk.

**Body (JSON):**

| Field | Tipe | Wajib | Keterangan |
|-------|------|-------|-----------|
| `shop_id` | UUID | ✓ | |
| `product_variant_id` | UUID | ✓ | |
| `qty` | number | ✓ | Harus > 0 |
| `cost_price` | number | — | Harga modal per unit |
| `note` | string | — | Catatan restock |

**Contoh request:**
```json
{
  "shop_id": "shop-uuid-1111",
  "product_variant_id": "var-uuid-aaaa",
  "qty": 100,
  "cost_price": 4200,
  "note": "Restock dari supplier A"
}
```

**Contoh response `201`:**
```json
{
  "success": true,
  "message": "Restock berhasil",
  "data": {
    "id": "inv-uuid-1111",
    "shop_id": "shop-uuid-1111",
    "product_variant_id": "var-uuid-aaaa",
    "stock": 150,
    "avg_cost_price": "4200.00",
    "low_stock_threshold": 20,
    "updated_at": "2026-05-06T09:00:00.000Z"
  }
}
```

---

### POST /api/inventory/adjustment-out

**Role:** `superAdmin`, `admin` · Kurangi stok (penyesuaian keluar, mis. barang rusak/hilang).

**Body (JSON):**

| Field | Tipe | Wajib | Keterangan |
|-------|------|-------|-----------|
| `shop_id` | UUID | ✓ | |
| `product_variant_id` | UUID | ✓ | |
| `qty` | number | ✓ | Harus > 0, tidak boleh melebihi stok |
| `note` | string | — | Alasan penyesuaian |

**Contoh request:**
```json
{
  "shop_id": "shop-uuid-1111",
  "product_variant_id": "var-uuid-aaaa",
  "qty": 5,
  "note": "Barang rusak saat pengiriman"
}
```

**Response `201`:** data inventory setelah penyesuaian (sama seperti restock).

---

### PATCH /api/inventory/:inventoryId/threshold

**Role:** `superAdmin`, `admin` · Set batas stok minimum (low stock alert).

> `admin` hanya bisa mengubah threshold untuk toko miliknya.

**Body (JSON):**

| Field | Tipe | Wajib | Keterangan |
|-------|------|-------|-----------|
| `low_stock_threshold` | number | ✓ | Tidak boleh negatif |

**Contoh request:**
```json
{
  "low_stock_threshold": 30
}
```

**Response `200`:** data inventory yang diperbarui.

---

## 9. Transfers

Base path: `/api/transfers`

Transfer stok antar toko. Alur: `pending` → `approved` atau `rejected` / `cancelled`.

---

### POST /api/transfers

**Role:** `superAdmin`, `admin` · Buat permintaan transfer stok.

> `admin` hanya bisa membuat transfer dari toko miliknya.

**Body (JSON):**

| Field | Tipe | Wajib | Keterangan |
|-------|------|-------|-----------|
| `from_shop_id` | UUID | ✓ | Toko pengirim |
| `to_shop_id` | UUID | ✓ | Toko penerima (harus berbeda) |
| `note` | string | — | Catatan transfer |
| `items` | array | ✓ | Minimal 1 item |

**Format `items`:**
```json
[
  { "product_variant_id": "var-uuid-aaaa", "qty": 20 },
  { "product_variant_id": "var-uuid-bbbb", "qty": 10, "note": "Prioritas" }
]
```

**Contoh response `201`:**
```json
{
  "success": true,
  "message": "Transfer berhasil dibuat",
  "data": {
    "id": "trn-uuid-1111",
    "from_shop_id": "shop-uuid-1111",
    "to_shop_id": "shop-uuid-2222",
    "requested_by": "user-uuid-5678",
    "confirmed_by": null,
    "status": "pending",
    "note": null,
    "confirmed_at": null,
    "created_at": "2026-05-06T10:00:00.000Z",
    "fromShop": { "id": "shop-uuid-1111", "name": "Segar Jaya Pusat" },
    "toShop": { "id": "shop-uuid-2222", "name": "Segar Jaya Bandung" },
    "requester": { "id": "user-uuid-5678", "name": "Admin Pusat" },
    "confirmer": null,
    "items": [
      {
        "id": "trni-uuid-aaaa",
        "transfer_id": "trn-uuid-1111",
        "product_variant_id": "var-uuid-aaaa",
        "qty": 20,
        "note": null
      }
    ]
  }
}
```

---

### GET /api/transfers/outgoing 🏪

**Role:** `superAdmin`, `admin` · Daftar transfer keluar (toko ini sebagai pengirim).

**Query params:**

| Parameter | Tipe | Keterangan |
|-----------|------|-----------|
| `shopId` | UUID | via shopAccess |
| `status` | `pending` \| `approved` \| `rejected` \| `cancelled` | Filter status |
| `page` | number | |
| `limit` | number | |

**Contoh response `200`:** array objek Transfer (tanpa `items`), dengan `meta`.

---

### GET /api/transfers/incoming 🏪

**Role:** `superAdmin`, `admin` · Daftar transfer masuk (toko ini sebagai penerima).

**Query params:** sama seperti `/outgoing`.

---

### GET /api/transfers/:transferId

**Role:** `superAdmin`, `admin` · Detail transfer tanpa item.

**Response:** objek Transfer tunggal (tanpa `items`).

---

### GET /api/transfers/:transferId/items

**Role:** `superAdmin`, `admin` · Daftar item dari satu transfer.

**Contoh response `200`:**
```json
{
  "success": true,
  "message": "Item transfer berhasil diambil",
  "data": [
    {
      "id": "trni-uuid-aaaa",
      "transfer_id": "trn-uuid-1111",
      "product_variant_id": "var-uuid-aaaa",
      "qty": 20,
      "note": null
    }
  ]
}
```

---

### PATCH /api/transfers/:transferId/approve

**Role:** `superAdmin`, `admin`, `user` · Setujui transfer.

> Hanya admin/user toko **penerima** yang bisa menyetujui. Persetujuan otomatis memindahkan stok dari toko asal ke toko tujuan.

**Body:** tidak perlu.

**Response `200`:** data transfer yang sudah diperbarui (status: `approved`).

---

### PATCH /api/transfers/:transferId/reject

**Role:** `superAdmin`, `admin` · Tolak transfer.

> Hanya admin toko **penerima** yang bisa menolak.

**Response `200`:** data transfer (status: `rejected`).

---

### PATCH /api/transfers/:transferId/cancel

**Role:** `superAdmin`, `admin` · Batalkan transfer.

> Hanya admin toko **pengirim** yang bisa membatalkan. Transfer harus berstatus `pending`.

**Response `200`:** data transfer (status: `cancelled`).

---

## 10. Customers

Base path: `/api/customers`

> Customer adalah entitas **global** (terlihat dari semua toko dalam satu sistem).

---

### GET /api/customers

**Role:** `superAdmin`, `admin`, `user` · Daftar semua customer.

**Query params:**

| Parameter | Tipe | Keterangan |
|-----------|------|-----------|
| `search` | string | Cari nama, telepon, atau email |
| `page` | number | |
| `limit` | number | |

**Contoh response `200`:**
```json
{
  "success": true,
  "message": "Daftar customer berhasil diambil",
  "data": [
    {
      "id": "cust-uuid-1111",
      "name": "Budi Santoso",
      "phone": "081234567890",
      "email": "budi@example.com",
      "address": "Jl. Melati No. 5, Jakarta",
      "created_at": "2026-02-10T00:00:00.000Z",
      "updated_at": "2026-02-10T00:00:00.000Z"
    }
  ],
  "meta": { "total": 80, "page": 1, "limit": 20, "totalPages": 4 }
}
```

---

### POST /api/customers

**Role:** `superAdmin`, `admin`, `user` · Tambah customer baru.

**Body (JSON):**

| Field | Tipe | Wajib | Keterangan |
|-------|------|-------|-----------|
| `name` | string | ✓ | |
| `phone` | string | — | Harus unik jika diisi |
| `email` | string | — | Harus unik jika diisi |
| `address` | string | — | |

**Contoh request:**
```json
{
  "name": "Siti Rahayu",
  "phone": "082298765432",
  "email": "siti@example.com",
  "address": "Jl. Mawar No. 10, Bandung"
}
```

**Contoh response `201`:** data customer yang baru dibuat.

---

### GET /api/customers/:customerId

**Role:** `superAdmin`, `admin`, `user` · Detail satu customer.

**Response:** sama seperti item di GET `/api/customers`.

---

### PATCH /api/customers/:customerId

**Role:** `superAdmin`, `admin` · Perbarui data customer.

**Body (JSON):** semua field opsional (sama seperti POST).

**Response:** data customer yang diperbarui.

---

### DELETE /api/customers/:customerId

**Role:** `superAdmin`, `admin` · Hapus customer (hard delete).

**Response `200`:**
```json
{
  "success": true,
  "message": "Customer berhasil dihapus",
  "data": null
}
```

---

### GET /api/customers/:customerId/transactions

**Role:** `superAdmin`, `admin` · Riwayat transaksi customer ini.

**Query params:** `page`, `limit`

**Contoh response `200`:**
```json
{
  "success": true,
  "message": "Riwayat transaksi customer berhasil diambil",
  "data": [
    {
      "id": "trx-uuid-aaaa",
      "invoice_no": "INV/2026/05/000001",
      "shop_id": "shop-uuid-1111",
      "user_id": "user-uuid-9999",
      "customer_id": "cust-uuid-1111",
      "status": "completed",
      "payment_method": "cash",
      "subtotal": "45000.00",
      "paid_at": "2026-05-06T11:00:00.000Z",
      "note": null,
      "created_at": "2026-05-06T11:00:00.000Z",
      "items": [
        {
          "id": "trxi-uuid-1111",
          "product_variant_id": "var-uuid-aaaa",
          "qty": 3,
          "price": "5000.00",
          "cost_price": "4200.00",
          "subtotal": "15000.00"
        }
      ]
    }
  ],
  "meta": { "total": 5, "page": 1, "limit": 20, "totalPages": 1 }
}
```

---

## 11. Transactions

Base path: `/api/transactions`

---

### GET /api/transactions 🏪

**Role:** `superAdmin`, `admin`, `user`

Daftar transaksi. Data difilter berdasarkan toko via `shopAccess`.

**Query params:**

| Parameter | Tipe | Keterangan |
|-----------|------|-----------|
| `shopId` | UUID | via shopAccess |
| `status` | `completed` \| `pending` \| `cancelled` | |
| `payment_method` | `cash` \| `transfer` \| `qris` \| `credit` | |
| `customer_id` | UUID | |
| `user_id` | UUID | Filter berdasarkan kasir |
| `date_from` | ISO date | Mis. `2026-05-01` |
| `date_to` | ISO date | Mis. `2026-05-31` |
| `page` | number | |
| `limit` | number | |

**Contoh response `200`:**
```json
{
  "success": true,
  "message": "Daftar transaksi berhasil diambil",
  "data": [
    {
      "id": "trx-uuid-aaaa",
      "invoice_no": "INV/2026/05/000001",
      "shop_id": "shop-uuid-1111",
      "user_id": "user-uuid-9999",
      "customer_id": "cust-uuid-1111",
      "status": "completed",
      "payment_method": "cash",
      "subtotal": "45000.00",
      "paid_at": "2026-05-06T11:00:00.000Z",
      "note": null,
      "created_at": "2026-05-06T11:00:00.000Z",
      "Shop": { "id": "shop-uuid-1111", "name": "Segar Jaya Pusat" },
      "User": { "id": "user-uuid-9999", "name": "Kasir 1" },
      "Customer": { "id": "cust-uuid-1111", "name": "Budi Santoso", "phone": "081234567890" }
    }
  ],
  "meta": { "total": 120, "page": 1, "limit": 20, "totalPages": 6 }
}
```

---

### POST /api/transactions

**Role:** `superAdmin`, `admin`, `user` · Buat transaksi penjualan baru.

> Stok produk akan otomatis berkurang.

**Body (JSON):**

| Field | Tipe | Wajib | Keterangan |
|-------|------|-------|-----------|
| `shop_id` | UUID | ✓ | |
| `payment_method` | string | ✓ | `cash` \| `transfer` \| `qris` \| `credit` |
| `items` | array | ✓ | Minimal 1 item |
| `customer_id` | UUID | — | Customer yang bertransaksi |
| `note` | string | — | |

**Format `items`:**
```json
[
  {
    "product_variant_id": "var-uuid-aaaa",
    "qty": 3,
    "price": 5000
  }
]
```

> `price` opsional — jika tidak diisi, digunakan harga dari tabel variant.

**Contoh request:**
```json
{
  "shop_id": "shop-uuid-1111",
  "payment_method": "cash",
  "customer_id": "cust-uuid-1111",
  "items": [
    { "product_variant_id": "var-uuid-aaaa", "qty": 3 },
    { "product_variant_id": "var-uuid-bbbb", "qty": 2 }
  ]
}
```

**Contoh response `201`:**
```json
{
  "success": true,
  "message": "Transaksi berhasil dibuat",
  "data": {
    "id": "trx-uuid-bbbb",
    "invoice_no": "INV/2026/05/000002",
    "shop_id": "shop-uuid-1111",
    "user_id": "user-uuid-9999",
    "customer_id": "cust-uuid-1111",
    "status": "completed",
    "payment_method": "cash",
    "subtotal": "33000.00",
    "paid_at": "2026-05-06T11:05:00.000Z",
    "note": null,
    "created_at": "2026-05-06T11:05:00.000Z",
    "Shop": { "id": "shop-uuid-1111", "name": "Segar Jaya Pusat" },
    "User": { "id": "user-uuid-9999", "name": "Kasir 1" },
    "Customer": { "id": "cust-uuid-1111", "name": "Budi Santoso", "phone": "081234567890" },
    "items": [
      {
        "id": "trxi-uuid-2222",
        "product_variant_id": "var-uuid-aaaa",
        "qty": 3,
        "price": "5000.00",
        "cost_price": "4200.00",
        "subtotal": "15000.00",
        "ProductVariant": {
          "id": "var-uuid-aaaa",
          "name": "250gr",
          "sku": "BYM-250",
          "price": "5000.00",
          "Product": { "id": "prod-uuid-1111", "name": "Bayam" }
        }
      }
    ]
  }
}
```

> **Catatan status:**
> - `payment_method = credit` → status `pending`
> - Semua metode lain → status `completed`, `paid_at` terisi otomatis

---

### GET /api/transactions/:transactionId 🏪

**Role:** `superAdmin`, `admin`, `user` · Detail satu transaksi beserta item-nya.

**Query params:** `shopId` (via shopAccess)

**Response:** sama seperti item di POST `/api/transactions` (response 201).

---

### PATCH /api/transactions/:transactionId/cancel 🏪

**Role:** `superAdmin`, `admin`, `user` · Batalkan transaksi.

> Pembatalan otomatis mengembalikan stok ke inventory.

**Query params:** `shopId` (via shopAccess)

**Body:** tidak perlu.

**Contoh response `200`:**
```json
{
  "success": true,
  "message": "Transaksi berhasil dibatalkan",
  "data": {
    "id": "trx-uuid-bbbb",
    "status": "cancelled",
    "paid_at": null,
    ...
  }
}
```

---

## 12. Refunds

Base path: `/api/refunds`

> Refund hanya bisa dilakukan untuk transaksi berstatus `completed`. Stok otomatis dikembalikan saat refund diproses.

---

### GET /api/refunds 🏪

**Role:** `superAdmin`, `admin`

Daftar refund. Difilter berdasarkan toko dari transaksi asal.

**Query params:**

| Parameter | Tipe | Keterangan |
|-----------|------|-----------|
| `shopId` | UUID | via shopAccess |
| `transaction_id` | UUID | Filter berdasarkan transaksi tertentu |
| `page` | number | |
| `limit` | number | |

**Contoh response `200`:**
```json
{
  "success": true,
  "message": "Daftar refund berhasil diambil",
  "data": [
    {
      "id": "ref-uuid-1111",
      "user_id": "user-uuid-9999",
      "transaction_id": "trx-uuid-aaaa",
      "reason": "Barang tidak sesuai",
      "total_amount": "15000.00",
      "status": "approved",
      "created_at": "2026-05-06T12:00:00.000Z",
      "User": { "id": "user-uuid-9999", "name": "Kasir 1" },
      "Transaction": {
        "id": "trx-uuid-aaaa",
        "invoice_no": "INV/2026/05/000001",
        "shop_id": "shop-uuid-1111",
        "Shop": { "id": "shop-uuid-1111", "name": "Segar Jaya Pusat" }
      }
    }
  ],
  "meta": { "total": 3, "page": 1, "limit": 20, "totalPages": 1 }
}
```

---

### POST /api/refunds

**Role:** `superAdmin`, `admin`, `user` · Proses refund.

> Refund langsung berstatus `approved`. Pastikan user memiliki akses ke toko dari transaksi tersebut.

**Body (JSON):**

| Field | Tipe | Wajib | Keterangan |
|-------|------|-------|-----------|
| `transaction_id` | UUID | ✓ | Transaksi yang akan di-refund |
| `items` | array | ✓ | Minimal 1 item |
| `reason` | string | — | Alasan refund |

**Format `items`:**
```json
[
  {
    "transaction_item_id": "trxi-uuid-1111",
    "qty": 1
  }
]
```

> `qty` tidak boleh melebihi qty pembelian asli, dan jumlah refund yang sudah di-approve sebelumnya.

**Contoh request:**
```json
{
  "transaction_id": "trx-uuid-aaaa",
  "reason": "Barang tidak sesuai pesanan",
  "items": [
    { "transaction_item_id": "trxi-uuid-1111", "qty": 1 }
  ]
}
```

**Contoh response `201`:**
```json
{
  "success": true,
  "message": "Refund berhasil diproses",
  "data": {
    "id": "ref-uuid-2222",
    "user_id": "user-uuid-9999",
    "transaction_id": "trx-uuid-aaaa",
    "reason": "Barang tidak sesuai pesanan",
    "total_amount": "5000.00",
    "status": "approved",
    "created_at": "2026-05-06T12:30:00.000Z",
    "User": { "id": "user-uuid-9999", "name": "Kasir 1" },
    "Transaction": {
      "id": "trx-uuid-aaaa",
      "invoice_no": "INV/2026/05/000001",
      "shop_id": "shop-uuid-1111"
    },
    "items": [
      {
        "id": "refi-uuid-aaaa",
        "refund_id": "ref-uuid-2222",
        "transaction_item_id": "trxi-uuid-1111",
        "qty": 1,
        "amount": "5000.00",
        "TransactionItem": {
          "id": "trxi-uuid-1111",
          "product_variant_id": "var-uuid-aaaa",
          "qty": 3,
          "price": "5000.00"
        }
      }
    ]
  }
}
```

---

### GET /api/refunds/:refundId 🏪

**Role:** `superAdmin`, `admin` · Detail satu refund.

**Query params:** `shopId` (via shopAccess)

**Response:** sama seperti item di POST `/api/refunds` (response 201).

---

## 13. Audit Logs

Base path: `/api/audit-logs`

Log semua aktivitas penting (create/update/delete/login/dll.).

---

### GET /api/audit-logs 🏪

**Role:** `superAdmin`, `admin`

**Perilaku berdasarkan role:**
- `superAdmin` tanpa `shopId`: menampilkan **semua** log dari semua toko.
- `superAdmin` dengan `?shopId=<uuid>`: menampilkan log dari toko tersebut.
- `admin`: menampilkan log dari toko mereka **plus** log entitas global (produk, kategori, user).

**Query params:**

| Parameter | Tipe | Keterangan |
|-----------|------|-----------|
| `shopId` | UUID | via shopAccess (opsional untuk superAdmin) |
| `entity_type` | string | `product` \| `category` \| `user` \| `shop` \| `inventory` \| `transfer` \| `transaction` \| `refund` \| `customer` |
| `action` | string | `create` \| `update` \| `delete` \| `login` \| `logout` \| `register_admin` \| `register_user` \| `reset_password` \| `change_password` \| `update_profile` \| `update_photo` \| `restock` \| `adjust_out` \| `set_threshold` \| `approve` \| `reject` \| `cancel` \| `assign_staff` \| `remove_staff` |
| `user_id` | UUID | Filter berdasarkan user yang melakukan aksi |
| `date_from` | ISO date | Mis. `2026-05-01` |
| `date_to` | ISO date | Mis. `2026-05-31` |
| `page` | number | |
| `limit` | number | |

**Contoh response `200`:**
```json
{
  "success": true,
  "message": "Daftar audit log berhasil diambil",
  "data": [
    {
      "id": "log-uuid-1111",
      "user_id": "user-uuid-5678",
      "shop_id": "shop-uuid-1111",
      "entity_type": "product",
      "entity_id": "prod-uuid-1111",
      "action": "update",
      "old_values": {
        "name": "Bayam",
        "is_active": true
      },
      "new_values": {
        "name": "Bayam Segar",
        "is_active": true
      },
      "ip_address": "127.0.0.1",
      "user_agent": "Mozilla/5.0 ...",
      "created_at": "2026-05-06T09:15:00.000Z",
      "User": {
        "id": "user-uuid-5678",
        "name": "Admin Pusat",
        "email": "admin.pusat@segarjaya.com"
      },
      "Shop": {
        "id": "shop-uuid-1111",
        "name": "Segar Jaya Pusat"
      }
    }
  ],
  "meta": { "total": 250, "page": 1, "limit": 20, "totalPages": 13 }
}
```

> `old_values` dan `new_values` hanya terisi untuk operasi `update`. `Shop` bisa `null` untuk log entitas global (produk, kategori, dll.).

---

## Ringkasan Error Umum

| HTTP Status | Keterangan |
|-------------|-----------|
| `400` | Validasi gagal (field wajib tidak diisi, nilai tidak valid) |
| `401` | Token tidak ada, expired, atau invalid |
| `403` | Tidak punya hak akses ke resource ini |
| `404` | Data tidak ditemukan |
| `409` | Konflik data (mis. email/SKU sudah ada) |
| `500` | Server error |
