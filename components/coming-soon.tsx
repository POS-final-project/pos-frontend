import { Construction } from "lucide-react";

interface ComingSoonProps {
  title: string;
  description?: string;
}

export function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[500px] text-center p-8">
      <div className="relative mb-8">
        <div className="w-20 h-20 rounded-2xl bg-amber-50 border border-amber-200/60 flex items-center justify-center shadow-sm shadow-amber-100">
          <Construction className="w-9 h-9 text-amber-500" />
        </div>
        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 border-2 border-white" />
      </div>
      <div
        className="h-0.5 w-10 rounded-full mb-6 mx-auto"
        style={{ background: "oklch(0.72 0.19 48)" }}
      />
      <h1 className="text-2xl font-bold mb-2" style={{ color: "oklch(0.13 0.025 260)" }}>
        {title}
      </h1>
      <p className="text-sm leading-relaxed max-w-sm" style={{ color: "oklch(0.52 0.012 260)" }}>
        {description ?? "Halaman ini sedang dalam pengembangan dan akan segera hadir."}
      </p>
    </div>
  );
}
