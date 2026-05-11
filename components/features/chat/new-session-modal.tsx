"use client";

import { useState } from "react";
import { X, Globe, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Shop = { id: string; name: string };

interface NewSessionModalProps {
  shops: Shop[];
  open: boolean;
  onConfirm: (scope: "global" | "shop", shopId: string | null) => void;
  onClose: () => void;
}

export function NewSessionModal({
  shops,
  open,
  onConfirm,
  onClose,
}: NewSessionModalProps) {
  const [scope, setScope] = useState<"global" | "shop">("global");
  const [shopId, setShopId] = useState("");

  const handleSubmit = () => {
    if (scope === "shop" && !shopId) return;
    onConfirm(scope, scope === "shop" ? shopId : null);
    setScope("global");
    setShopId("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Percakapan Baru</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <p className="text-sm text-slate-500">
            Pilih konteks data yang ingin dianalisis AI.
          </p>

          {/* Scope cards */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setScope("global")}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all",
                scope === "global"
                  ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                  : "border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50",
              )}
            >
              <Globe className="w-5 h-5" />
              <span className="text-xs font-medium leading-tight">
                Semua Toko
                <br />
                (Global)
              </span>
            </button>

            <button
              onClick={() => setScope("shop")}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all",
                scope === "shop"
                  ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                  : "border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50",
              )}
            >
              <Store className="w-5 h-5" />
              <span className="text-xs font-medium leading-tight">
                Toko
                <br />
                Tertentu
              </span>
            </button>
          </div>

          {/* Shop picker */}
          {scope === "shop" && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">
                Pilih Toko
              </label>
              <Select value={shopId} onValueChange={(v) => setShopId(v ?? "")}>
                <SelectTrigger className="w-full">
                  {shopId
                    ? shops.find((s) => s.id === shopId)?.name
                    : "-- Pilih toko --"}
                </SelectTrigger>
                <SelectContent>
                  {shops.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Batal
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={scope === "shop" && !shopId}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            Mulai Percakapan
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
