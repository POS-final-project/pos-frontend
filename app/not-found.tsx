import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="w-20 h-20 rounded-2xl bg-indigo-100 flex items-center justify-center mx-auto mb-6">
          <FileQuestion className="w-10 h-10 text-indigo-600" />
        </div>
        <p className="text-8xl font-bold text-indigo-600 mb-4">404</p>
        <h1 className="text-2xl font-semibold text-slate-800 mb-2">
          Halaman Tidak Ditemukan
        </h1>
        <p className="text-slate-500 mb-8 max-w-sm mx-auto">
          Halaman yang Anda cari tidak ada atau telah dipindahkan.
        </p>
        <Link href="/login">
          <Button>Kembali ke Beranda</Button>
        </Link>
      </div>
    </div>
  );
}
