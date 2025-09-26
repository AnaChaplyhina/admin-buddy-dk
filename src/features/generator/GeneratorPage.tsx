import { useEffect, useRef, useState } from "react";
import { copyToClipboard, exportDocx, exportPdfFromElement } from "./exporters";
import { llm } from "../../lib/webllm";

type Lang = "uk" | "en" | "da";
type Tone = "formel" | "neutral" | "venlig";

export default function GeneratorPage() {
  const [inputLang, setInputLang] = useState<Lang>("uk");
  const [tone, setTone] = useState<Tone>("formel");
  const [subject, setSubject] = useState("");
  const [recipient, setRecipient] = useState("");
  const [body, setBody] = useState("");
  const [output, setOutput] = useState("");

  const [modelReady, setModelReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState<string | undefined>("");

  const [busy, setBusy] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  // -------- MOCK без AI --------
  function generateMock() {
    const greeting = recipient ? `Kære ${recipient},` : "Kære modtager,";
    const footer = tone === "venlig" ? "De bedste hilsner" : "Med venlig hilsen";
    const emne = subject || "(uden emne)";
    const text = `Emne: ${emne}

${greeting}

${body || "(beskrivelse…)"}

${footer}
[Dit navn]`;
    setOutput(text);
  }

  // -------- ІНІЦІАЛІЗАЦІЯ МОДЕЛІ --------
  useEffect(() => {
    // одразу починаємо опитувати статус, щоб бачили прогрес у реальному часі
    const timer = setInterval(() => {
      setModelReady(llm.status.ready);
      setProgress(llm.status.progress);
      setStatusMsg(llm.status.message);
    }, 300);

    // стартуємо завантаження моделі (модель задається у webllm.ts)
    llm.init();

    return () => clearInterval(timer);
  }, []);

  // -------- ГЕНЕРАЦІЯ З AI --------
  async function generateAI() {
    if (!("gpu" in navigator)) {
      alert("WebGPU недоступний у цьому браузері/пристрої. Спробуй Chrome/Edge на ПК.");
      return;
    }
    if (!modelReady) {
      alert("Модель ще завантажується.");
      return;
    }
    setBusy(true);
    try {
      const toneTxt =
        tone === "formel" ? "formelt og kortfattet" :
        tone === "venlig" ? "venligt og imødekommende" :
        "neutralt og professionelt";

      // без кутових дужок, щоб TSX нічого не плутав
      const sys = [
        "Du er en assistent, der skriver officielle breve på DANSK.",
        `Skriv ${toneTxt}. Brug KUN oplysninger fra brugerens input.`,
        "SVAR KUN med selve brevet – ingen forklaringer, ingen roller (Assistant/User), ingen markdown.",
        "FORMAT (præcis linjestruktur):",
        "Emne: (kort emne)",
        "Kære [modtager],",
        "(2–5 korte afsnit med klare sætninger)",
        "Med venlig hilsen",
        "[Dit navn]",
        "Forbudt at bruge 'Subject:', 'Recipient:', 'Body:' osv."
      ].join("\n");

      const user = [
        `Input language: ${inputLang}. Hvis input ikke er på dansk, oversæt men bevar betydning.`,
        `Subject: ${subject || ""}`,
        `Recipient: ${recipient || ""}`,
        "Body:",
        body || "",
        "Returnér KUN det endelige brev i formatet ovenfor."
      ].join("\n");

      const raw = await llm.complete(sys, user);

      // без /.../ літералів — використовуємо RegExp конструктор
      const cleaned = raw
        .replace(new RegExp("^\\s*(?:Assistant|User)\\s*:.*$", "gmi"), "")
        .replace(new RegExp("^\\s*(?:Subject|Recipient|Body)\\s*:.*$", "gmi"), "")
        .trim();

      const withEmne = /^Emne\s*:/i.test(cleaned)
        ? cleaned
        : `Emne: ${subject || "(uden emne)"}\n\n${cleaned}`;

      setOutput(withEmne.trim());
    } catch (e: any) {
      alert(e?.message || "Generation error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Ліва колонка — форма */}
      <section className="space-y-4 rounded-2xl border bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm">Мова вводу:</span>
          <select
            value={inputLang}
            onChange={(e) => setInputLang(e.target.value as Lang)}
            className="rounded-xl border px-3 py-2"
          >
            <option value="uk">Українська</option>
            <option value="en">English</option>
            <option value="da">Dansk</option>
          </select>

          <span className="ml-4 text-sm">Тон:</span>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value as Tone)}
            className="rounded-xl border px-3 py-2"
          >
            <option value="formel">Formel</option>
            <option value="neutral">Neutral</option>
            <option value="venlig">Venlig</option>
          </select>
        </div>

        {!modelReady && (
          <div className="rounded-xl border p-3 bg-gray-50">
            <div className="text-sm font-medium mb-1">Завантаження локальної моделі…</div>
            <div className="h-2 bg-gray-200 rounded overflow-hidden">
              <div className="h-full bg-black" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <div className="text-xs text-gray-500 mt-1">{statusMsg}</div>
          </div>
        )}

        {!("gpu" in navigator) && (
          <div className="rounded-xl border p-3 bg-amber-50 text-sm">
            Ваш браузер/пристрій не підтримує WebGPU. Спробуйте Chrome/Edge на ПК з підтримкою WebGPU.
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Тема (Emne)</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full rounded-xl border px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Кому (Modtager)</label>
          <input
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            className="w-full rounded-xl border px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Текст (будь-якою мовою)</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full h-40 rounded-xl border px-3 py-2"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={generateMock}
            className="rounded-2xl px-4 py-2 border shadow-sm hover:shadow transition"
          >
            Згенерувати (тест)
          </button>

          <button
            onClick={generateAI}
            disabled={!modelReady || busy}
            className="rounded-2xl px-4 py-2 border shadow-sm hover:shadow transition disabled:opacity-50"
          >
            {busy ? "Генерація…" : "Згенерувати (AI)"}
          </button>

          <button
            onClick={() => copyToClipboard(output)}
            disabled={!output}
            className="rounded-2xl px-4 py-2 border shadow-sm hover:shadow transition disabled:opacity-50"
          >
            Копіювати
          </button>

          <button
            onClick={() => exportDocx(output)}
            disabled={!output}
            className="rounded-2xl px-4 py-2 border shadow-sm hover:shadow transition disabled:opacity-50"
          >
            Експорт .docx
          </button>

          <button
            onClick={() => previewRef.current && exportPdfFromElement(previewRef.current)}
            disabled={!output}
            className="rounded-2xl px-4 py-2 border shadow-sm hover:shadow transition disabled:opacity-50"
          >
            Експорт PDF
          </button>
        </div>

        <p className="text-xs text-gray-500">
          *Лист генерується локально в браузері. Нічого не відправляється на сервер.
        </p>
      </section>

      {/* Права колонка — превʼю */}
      <section className="rounded-2xl border bg-white p-4">
        <h2 className="text-sm font-medium mb-2">Прев’ю</h2>
        <div ref={previewRef} className="max-w-none whitespace-pre-wrap">
          {output || "Тут з’явиться згенерований лист у датському форматі."}
        </div>
      </section>
    </div>
  );
}
