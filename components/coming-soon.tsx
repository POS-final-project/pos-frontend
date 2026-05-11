import { Construction } from "lucide-react";

interface ComingSoonProps {
  title: string;
  description?: string;
}

export function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[500px] text-center p-8">
      <div className="w-20 h-20 rounded-2xl bg-indigo-50 flex items-center justify-center mb-6">
        <Construction className="w-10 h-10 text-indigo-500" />
      </div>
      <h1 className="text-2xl font-bold text-slate-800 mb-2">{title}</h1>
      <p className="text-slate-500 max-w-md">
        {description ?? "Halaman ini sedang dalam pengembangan dan akan segera hadir."}
      </p>
    </div>
  );
}
