// src/lib/webllm.ts
// Надійна одноразова ініціалізація WebLLM (через web-worker)
// + захист від повторного створення (HMR / кілька вкладок)

type Status = { ready: boolean; progress: number; message: string };
const status: Status = { ready: false, progress: 0, message: "" };

// Тримаємо engine у глобалі, щоб HMR/дві вкладки не створювали другий екземпляр
let engine: any = (globalThis as any).__ABD_ENGINE || null;

export const llm = {
  status,

  async init() {
    if (engine) {
      status.ready = true;
      return;
    }

    // Динамічний імпорт — щоб Vite не “предбандлив” пакет вдруге
    const { CreateMLCEngine } = await import("@mlc-ai/web-llm");

    // ВАЖЛИВО: запускаємо у веб-воркері, це прибирає більшість cross-realm глюків
    engine = await CreateMLCEngine("Phi-3.5-mini-instruct-q4f16_1-MLC", {
      useWebWorker: true,
      initProgressCallback(info: any) {
        status.progress = info?.progress ?? 0;
        status.message = info?.text ?? "";
      },
    });

    (globalThis as any).__ABD_ENGINE = engine;
    status.ready = true;
  },

  async complete(system: string, user: string) {
    if (!engine) throw new Error("Model is not ready yet");
    const res = await engine.chat.completions.create({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.3,
      stream: false,
    });
    // @ts-ignore
    return res?.choices?.[0]?.message?.content ?? String(res);
  },
};



