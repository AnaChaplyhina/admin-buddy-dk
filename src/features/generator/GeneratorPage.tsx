import { useEffect, useRef, useState } from "react";
import { copyToClipboard, exportDocx, exportPdfFromElement } from "./exporters";
import { llm } from "../../lib/webllm";
import { PRESETS, type ScenarioKey, type Tone } from "./presets";
import { loadProfile, saveProfile, type Profile } from "./profile";
import StatusBar from "./StatusBar";

type Lang = "uk" | "en" | "da";
type Draft = {
  inputLang: Lang; tone: Tone; scenario: ScenarioKey | "custom";
  subject: string; recipient: string; body: string; output: string; savedAt?: number;
};

const STORAGE_KEY = "abd_draft_v1";

export default function GeneratorPage() {
  const [inputLang, setInputLang] = useState<Lang>("uk");
  const [tone, setTone] = useState<Tone>("formel");
  const [scenario, setScenario] = useState<ScenarioKey | "custom">("custom");

  const [subject, setSubject] = useState("");
  const [recipient, setRecipient] = useState("");
  const [body, setBody] = useState("");
  const [output, setOutput] = useState("");

  // профіль
  const initialProfile = loadProfile();
  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [profileSavedAt, setProfileSavedAt] = useState<number | null>(null);
  const [showProfile, setShowProfile] = useState(true);

  // модель
  const [modelReady, setModelReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState<string | undefined>("");

  // чернетка
  const hasMounted = useRef(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // refs для скролу до помилки
  const subjRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // --------- пресет ---------
  function applyPreset(key: ScenarioKey) {
    const p = PRESETS[key];
    setScenario(key); setTone(p.tone);
    if (!subject) setSubject(p.subject);
    if (!body) setBody(p.bodyHint);
  }

  // --------- підпис ---------
  function signature(): string {
    const lines = [
      "Med venlig hilsen",
      profile.name || "[Dit navn]",
      profile.phone ? `Tlf.: ${profile.phone}` : "",
      profile.email ? `Email: ${profile.email}` : "",
      profile.address ? profile.address : "",
    ].filter(Boolean);
    return lines.join("\n");
  }

  // --------- тестова генерація ---------
  function generateMock() {
    const emne = subject || "(uden emne)";
    const greeting = recipient ? `Kære ${recipient},` : "Kære modtager,";
    const text = `Emne: ${emne}

${greeting}

${body || "(beskrivelse…)"}

${signature()}`;
    setOutput(text);
  }

  // --------- ініт моделі ---------
  useEffect(() => {
    const t = setInterval(() => {
      setModelReady(llm.status.ready);
      setProgress(llm.status.progress);
      setStatusMsg(llm.status.message);
    }, 300);
    llm.init();
    return () => clearInterval(t);
  }, []);

  // --------- відновлення чернетки ---------
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const d = JSON.parse(raw) as Draft;
        setInputLang(d.inputLang); setTone(d.tone); setScenario(d.scenario);
        setSubject(d.subject); setRecipient(d.recipient); setBody(d.body); setOutput(d.output);
      }
    } catch {}
    finally { hasMounted.current = true; }
  }, []);

  // --------- автозбереження ---------
  useEffect(() => {
    if (!hasMounted.current) return;
    const isEmpty = !subject && !recipient && !body && !output;
    if (isEmpty) return;
    const id = setTimeout(() => {
      try {
        const data: Draft = { inputLang, tone, scenario, subject, recipient, body, output, savedAt: Date.now() };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        setSavedAt(data.savedAt!);
      } catch {}
    }, 400);
    return () => clearTimeout(id);
  }, [inputLang, tone, scenario, subject, recipient, body, output]);

  // --------- зберегти профіль ---------
  function saveProfileNow() { saveProfile(profile); setProfileSavedAt(Date.now()); }

  // ===================== ВАЛІДАЦІЯ =====================
  type Errors = { subject?: string; recipient?: string; body?: string; };
  const [touched, setTouched] = useState({ subject: false, recipient: false, body: false });

  function getErrors(): Errors {
    const e: Errors = {};
    if (!subject.trim()) e.subject = "Вкажіть тему листа";
    if (!recipient.trim()) e.recipient = "Вкажіть одержувача";
    if (body.trim().length < 10) e.body = "Опишіть деталі (мінімум 10 символів)";
    return e;
  }
  const errors = getErrors();
  const hasErrors = Object.keys(errors).length > 0;

  function inputCls(hasErr: boolean) {
    return (
      "w-full rounded-xl px-3 py-2 border " +
      (hasErr ? "border-red-500 focus:outline-none" : "")
    );
  }

  // --------- генерація з AI (з валідацією) ---------
  async function onGenerateAI() {
    setTouched({ subject: true, recipient: true, body: true });
    const e = getErrors();
    if (Object.keys(e).length) {
      (e.subject ? subjRef : e.recipient ? recRef : bodyRef).current?.focus();
      return;
    }
    await generateAI();
  }

  async function generateAI() {
    if (!("gpu" in navigator)) { alert("WebGPU недоступний у цьому браузері/пристрої."); return; }
    if (!modelReady)          { alert("Модель ще завантажується."); return; }

    const toneTxt =
      tone === "formel" ? "formelt og kortfattet" :
      tone === "venlig" ? "venligt og imødekommende" : "neutralt og professionelt";

    const sys = [
      "Du er en assistent, der skriver officielle breve på DANSK.",
      `Skriv ${toneTxt}. Brug KUN oplysninger fra brugerens input.`,
      "SVAR KUN med selve brevet – ingen forklaringer, ingen markdown.",
      "FORMAT:",
      "Emne: (kort emne)",
      "Kære [modtager],",
      "(2–5 korte afsnit)",
      "Med venlig hilsen",
      "[Dit navn]",
    ].join("\n");

    const presetLine = scenario !== "custom" ? `Scenario: ${PRESETS[scenario].title}.` : "";

    const user = [
      `Input language: ${inputLang}. If not Danish, translate meaningfully.`,
      presetLine,
      `Subject: ${subject}`, `Recipient: ${recipient}`, "Body:", body,
      "Return ONLY the final letter text."
    ].filter(Boolean).join("\n");

    const raw = await llm.complete(sys, user);

    const cleaned = raw
      .replace(/^\s*(?:Assistant|User)\s*:.*$/gmi, "")
      .replace(/^\s*(?:Subject|Recipient|Body)\s*:.*$/gmi, "")
      .trim();

    let finalText = /^Emne\s*:/i.test(cleaned) ? cleaned : `Emne: ${subject}\n\n${cleaned}`;
    if (!/Med venlig hilsen/i.test(finalText)) {
      finalText = `${finalText}\n\nMed venlig hilsen\n[Dit navn]`;
    }
    finalText = finalText.replace("[Dit navn]", profile.name || "[Dit navn]");

    const contacts = [profile.phone && `Tlf.: ${profile.phone}`, profile.email && `Email: ${profile.email}`, profile.address]
      .filter(Boolean).join("\n");
    if (contacts) finalText = `${finalText}\n${contacts}`;

    setOutput(finalText.trim());
  }

  const savedText = savedAt ? `Збережено о ${new Date(savedAt).toLocaleTimeString()}` : "";
  const profileSavedText = profileSavedAt ? `Профіль збережено о ${new Date(profileSavedAt).toLocaleTimeString()}` : "";

  return (
    <div className="mx-auto max-w-6xl p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Ліва колонка */}
      <section className="space-y-4 rounded-2xl border bg-white p-4">
        {/* Панель стану */}
        <StatusBar
          gpu={"gpu" in navigator}
          ready={modelReady}
          progress={progress}
          msg={statusMsg}
        />

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm">Мова вводу:</span>
          <select value={inputLang} onChange={e => setInputLang(e.target.value as Lang)} className="rounded-xl border px-3 py-2">
            <option value="uk">Українська</option><option value="en">English</option><option value="da">Dansk</option>
          </select>

          <span className="ml-4 text-sm">Тон:</span>
          <select value={tone} onChange={e => setTone(e.target.value as Tone)} className="rounded-xl border px-3 py-2">
            <option value="formel">Formel</option><option value="neutral">Neutral</option><option value="venlig">Venlig</option>
          </select>

          <span className="ml-4 text-sm">Сценарій:</span>
          <select
            value={scenario}
            onChange={(e) => { const val = e.target.value as ScenarioKey | "custom"; setScenario(val); if (val !== "custom") applyPreset(val as ScenarioKey); }}
            className="rounded-xl border px-3 py-2"
          >
            <option value="custom">Без пресету</option>
            {Object.values(PRESETS).map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>

          <span className="ml-auto text-xs text-gray-500">{savedText}</span>
        </div>

        {/* Дані відправника */}
        <div className="rounded-2xl border bg-gray-50">
          <button type="button" onClick={() => setShowProfile(s => !s)} className="w-full text-left px-3 py-2 text-sm font-medium">
            {showProfile ? "▼" : "▶"} Дані відправника (підпис)
          </button>
          {showProfile && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-3 pb-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Імʼя</label>
                <input value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} className="w-full rounded-xl border px-3 py-2" placeholder="Ваше ім’я" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Телефон</label>
                <input value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })} className="w-full rounded-xl border px-3 py-2" placeholder="+45 …" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Email</label>
                <input value={profile.email} onChange={e => setProfile({ ...profile, email: e.target.value })} className="w-full rounded-xl border px-3 py-2" placeholder="you@example.com" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Адреса</label>
                <input value={profile.address} onChange={e => setProfile({ ...profile, address: e.target.value })} className="w-full rounded-xl border px-3 py-2" placeholder="Adresse, postnr, by" />
              </div>

              {/* Превʼю підпису */}
              <div className="sm:col-span-2">
                <div className="text-xs text-gray-500 mb-1">Підпис (превʼю):</div>
                <pre className="text-xs whitespace-pre-wrap rounded-xl border bg-white p-2">{signature()}</pre>
              </div>

              <div className="sm:col-span-2 flex items-center gap-2">
                <button type="button" onClick={saveProfileNow} className="rounded-lg border px-3 py-2 text-sm">Зберегти профіль</button>
                <span className="text-xs text-gray-500">{profileSavedText}</span>
              </div>
            </div>
          )}
        </div>

        {/* Поля з валідацією */}
        <div>
          <label className="block text-sm font-medium mb-1">Тема (Emne)</label>
          <input
            ref={subjRef}
            value={subject}
            onChange={e => setSubject(e.target.value)}
            onBlur={() => setTouched(s => ({ ...s, subject: true }))}
            className={inputCls(touched.subject && !!errors.subject)}
            placeholder="Коротко: про що запит/прохання"
          />
          {touched.subject && errors.subject && <p className="text-xs text-red-600 mt-1">{errors.subject}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Кому (Modtager)</label>
          <input
            ref={recRef}
            value={recipient}
            onChange={e => setRecipient(e.target.value)}
            onBlur={() => setTouched(s => ({ ...s, recipient: true }))}
            className={inputCls(touched.recipient && !!errors.recipient)}
            placeholder="Kommune / afdeling / institution / udlejer"
          />
          {touched.recipient && errors.recipient && <p className="text-xs text-red-600 mt-1">{errors.recipient}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Текст (будь-якою мовою)</label>
          <textarea
            ref={bodyRef}
            value={body}
            onChange={e => setBody(e.target.value)}
            onBlur={() => setTouched(s => ({ ...s, body: true }))}
            className={inputCls(touched.body && !!errors.body) + " h-40"}
            placeholder={scenario !== "custom" ? PRESETS[scenario as ScenarioKey].bodyHint : "Опишіть деталі вашого запиту"}
          />
          {touched.body && errors.body && <p className="text-xs text-red-600 mt-1">{errors.body}</p>}
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={generateMock} className="rounded-2xl px-4 py-2 border shadow-sm hover:shadow transition">
            Згенерувати (тест)
          </button>

          <button
            onClick={onGenerateAI}
            disabled={!modelReady || hasErrors}
            className="rounded-2xl px-4 py-2 border shadow-sm hover:shadow transition disabled:opacity-50"
            title={!modelReady ? "Модель ще завантажується" : hasErrors ? "Заповніть обовʼязкові поля" : ""}
          >
            {modelReady ? "Згенерувати (AI)" : "Завантаження…"}
          </button>

          <button onClick={() => copyToClipboard(output)} disabled={!output} className="rounded-2xl px-4 py-2 border shadow-sm hover:shadow transition disabled:opacity-50">
            Копіювати
          </button>
          <button onClick={() => exportDocx(output)} disabled={!output} className="rounded-2xl px-4 py-2 border shadow-sm hover:shadow transition disabled:opacity-50">
            Експорт .docx
          </button>
          <button onClick={() => {
              const el = document.activeElement as HTMLElement | null; el?.blur();
              const node = document.querySelector("#preview-hook") as HTMLDivElement | null;
              node && exportPdfFromElement(node);
            }}
            disabled={!output}
            className="rounded-2xl px-4 py-2 border shadow-sm hover:shadow transition disabled:opacity-50"
          >
            Експорт PDF
          </button>

          <button
            onClick={() => { setScenario("custom"); setSubject(""); setRecipient(""); setBody(""); setOutput(""); try { localStorage.removeItem(STORAGE_KEY); setSavedAt(null); } catch {} }}
            className="rounded-2xl px-4 py-2 border shadow-sm hover:shadow transition"
            title="Очистити форму та чернетку"
          >
            Очистити
          </button>
        </div>

        <p className="text-xs text-gray-500">
          *Лист генерується локально в браузері. Нічого не відправляється на сервер.
        </p>
      </section>

      {/* Превʼю */}
      <section className="rounded-2xl border bg-white p-4">
        <h2 className="text-sm font-medium mb-2">Прев’ю</h2>
        <div id="preview-hook" className="max-w-none whitespace-pre-wrap">
          {output || "Тут з’явиться згенерований лист у датському форматі."}
        </div>
      </section>
    </div>
  );
}








