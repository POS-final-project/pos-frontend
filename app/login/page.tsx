import { CheckCircle2, ShoppingCart } from "lucide-react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex">
      {/* Left - Brand panel */}
      <div className="hidden lg:flex lg:w-[45%] bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 flex-col items-center justify-center p-12 relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-white/5" />
        <div className="absolute -bottom-10 -right-10 w-96 h-96 rounded-full bg-white/5" />

        <div className="relative z-10 text-center">
          <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center mx-auto mb-8 border border-white/20">
            <ShoppingCart className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">
            Point of Sale
          </h1>
          <p className="text-indigo-200 text-lg mb-8">
            Kelola bisnis Anda dengan mudah
          </p>
          <div className="flex flex-col gap-3 text-left max-w-xs mx-auto">
            {[
              "Manajemen multi-toko dalam satu platform",
              "Laporan dan analitik real-time",
              "AI Assistant untuk insight bisnis",
            ].map((feat) => (
              <div key={feat} className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-indigo-400 flex-shrink-0" />
                <span className="text-indigo-100 text-sm">{feat}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right - Form panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-200">
              <ShoppingCart className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl text-slate-900">Point of Sale</span>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-8">
            <div className="mb-7">
              <h2 className="text-2xl font-bold text-slate-900 mb-1 tracking-tight">
                Selamat Datang
              </h2>
              <p className="text-slate-500 text-sm">
                Masuk ke akun Anda untuk melanjutkan
              </p>
            </div>

            <LoginForm />
          </div>

          <p className="text-center text-xs text-slate-400 mt-6">
            Point of Sale &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}
