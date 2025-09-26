import * as webllm from "@mlc-ai/web-llm";

export type LoadStatus = { ready: boolean; progress: number; message?: string };

class LLMService {
  private engine: webllm.MLCEngine | null = null;
  status: LoadStatus = { ready: false, progress: 0, message: "Init..." };

  // Використаємо компактну модель, щоб завантажилась швидко:
  // TinyLlama-1.1B-Chat — надійний і легкий варіант для WebGPU
  async init(modelId = "Phi-3.5-mini-instruct-q4f16_1-MLC") {
    try {
      if (!("gpu" in navigator)) {
        this.status = { ready: false, progress: 0, message: "WebGPU недоступний у цьому браузері/пристрої" };
        return;
      }
      // ВАЖЛИВО: тут саме CreateMLCEngine (з великої літери)
      this.engine = await webllm.CreateMLCEngine(modelId, {
        initProgressCallback: (p: any) => {
          this.status = {
            ready: p.progress === 1,
            progress: p.progress ?? 0,
            message: p.text,
          };
        },
      });
    } catch (err: any) {
      console.error("WebLLM init error:", err);
      this.status = { ready: false, progress: 0, message: String(err?.message || err) };
    }
  }

  isReady() {
    return !!this.engine;
  }

  async complete(system: string, user: string) {
    if (!this.engine) throw new Error("LLM не ініціалізовано");
    const res = await this.engine.chat.completions.create({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.3,
      max_tokens: 600,
    });
    return res.choices?.[0]?.message?.content ?? "";
  }
}

export const llm = new LLMService();


