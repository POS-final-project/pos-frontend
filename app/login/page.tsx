import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex">
      {/* ── Left panel ──────────────────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[46%] flex-col relative overflow-hidden"
        style={{ background: "oklch(0.11 0.025 262)" }}
      >
        {/* Content */}
        <div className="relative z-10 flex flex-col h-full px-10 py-10">
          {/* Brand mark */}
          <div className="flex items-center gap-3">
            <img
              src="/icon.png"
              alt="lihatinsales"
              className="w-9 h-9 rounded-xl object-cover flex-shrink-0"
            />
            <span
              className="font-semibold text-lg tracking-wide"
              style={{ color: "oklch(0.88 0.006 80)" }}
            >
              lihatinsales
            </span>
          </div>

          {/* Hero copy */}
          <div className="mt-auto mb-auto pt-16 pb-8">
            <p
              className="text-[11px] font-bold tracking-[0.22em] uppercase mb-5"
              style={{ color: "oklch(0.72 0.19 48)" }}
            >
              Sistem Manajemen Terintegrasi
            </p>
            <h1
              className="font-extrabold leading-[1.07] mb-5"
              style={{
                fontSize: "clamp(2.2rem, 3.5vw, 2.9rem)",
                color: "oklch(0.96 0.005 80)",
                letterSpacing: "-0.025em",
              }}
            >
              Kelola Bisnis
              <br />
              Anda Lebih{" "}
              <span style={{ color: "oklch(0.72 0.19 48)" }}>Efisien.</span>
            </h1>
            <p
              className="text-sm leading-relaxed max-w-[280px]"
              style={{ color: "oklch(0.58 0.012 260)" }}
            >
              Platform POS terintegrasi untuk manajemen multi-toko, transaksi,
              inventori, dan analitik bisnis dalam satu sistem.
            </p>
          </div>

          {/* Footer */}
          <p className="text-[11px]" style={{ color: "oklch(0.38 0.008 260)" }}>
            &copy; {new Date().getFullYear()} lihatinsales. All rights reserved.
          </p>
        </div>
      </div>

      {/* ── Right panel ─────────────────────────────────────────── */}
      <div
        className="flex-1 flex items-center justify-center p-8 lg:p-16"
        style={{ background: "oklch(0.995 0.004 80)" }}
      >
        <div className="w-full max-w-[360px]">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <img
              src="/icon.png"
              alt="lihatinsales"
              className="w-9 h-9 rounded-xl object-cover flex-shrink-0"
            />
            <span
              className="font-bold text-base"
              style={{ color: "oklch(0.13 0.025 260)" }}
            >
              lihatinsales
            </span>
          </div>

          {/* Heading */}
          <div
            className="animate-fade-up mb-8"
            style={{ animationDelay: "0ms" }}
          >
            <h2
              className="font-extrabold tracking-tight mb-1.5"
              style={{
                fontSize: "2rem",
                color: "oklch(0.13 0.025 260)",
                letterSpacing: "-0.03em",
              }}
            >
              Selamat Datang
            </h2>
            <p className="text-sm" style={{ color: "oklch(0.52 0.012 260)" }}>
              Masuk ke akun Anda untuk melanjutkan
            </p>
          </div>

          {/* Accent divider */}
          <div
            className="animate-fade-up h-[3px] w-10 rounded-full mb-8"
            style={{
              background: "oklch(0.72 0.19 48)",
              animationDelay: "80ms",
            }}
          />

          <div className="animate-fade-up" style={{ animationDelay: "160ms" }}>
            <LoginForm />
          </div>

          <p
            className="animate-fade-up text-center text-[11px] mt-10"
            style={{ color: "oklch(0.62 0.006 260)", animationDelay: "240ms" }}
          >
            lihatinsales &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}
