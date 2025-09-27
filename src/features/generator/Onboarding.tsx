import { useEffect, useState } from "react";

const KEY = "abd_onboard_done_v1";

export default function Onboarding() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    setShow(!localStorage.getItem(KEY));
  }, []);

  if (!show) return null;

  return (
    <div className="rounded-2xl border bg-amber-50 p-3">
      <div className="font-medium">Як користуватися</div>
      <ol className="list-decimal ml-5 mt-2 space-y-1 text-sm">
        <li>Обери <b>Сценарій</b> або заповни поля вручну.</li>
        <li>Натисни <b>Згенерувати (AI)</b> (або «тест» для шаблону).</li>
        <li>Перевір <b>Прев’ю</b>, потім експортуй у <b>.docx</b> або <b>PDF</b>.</li>
      </ol>
      <button
        onClick={() => { localStorage.setItem(KEY, "1"); setShow(false); }}
        className="mt-3 rounded-lg border px-3 py-1 text-sm"
      >
        Зрозуміло
      </button>
    </div>
  );
}
