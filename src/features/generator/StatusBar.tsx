import { useEffect, useState } from "react";

const CACHE_KEY = "abd_model_cached_v1";

function Badge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={
        "rounded-full px-2 py-1 border text-xs " +
        (ok ? "bg-emerald-50 border-emerald-300" : "bg-amber-50 border-amber-300")
      }
    >
      {label}
    </span>
  );
}

export default function StatusBar({
  gpu,
  ready,
  progress,
  msg,
}: {
  gpu: boolean;
  ready: boolean;
  progress: number;
  msg?: string;
}) {
  const [cached, setCached] = useState<boolean>(() => !!localStorage.getItem(CACHE_KEY));

  useEffect(() => {
    if (ready && !cached) {
      localStorage.setItem(CACHE_KEY, "1");
      setCached(true);
    }
  }, [ready, cached]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge ok={gpu} label={gpu ? "WebGPU: OK" : "WebGPU: немає"} />
      <Badge ok={ready} label={ready ? "Модель: готова" : "Модель: завантажується"} />
      {!ready && <span className="text-xs">{Math.round(progress * 100)}%</span>}
      {!ready && msg && (
        <span className="text-xs text-gray-500 truncate max-w-[280px]">— {msg}</span>
      )}
      <Badge ok={cached} label={cached ? "Кеш: є" : "Кеш: ще ні"} />
    </div>
  );
}
