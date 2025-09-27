// src/features/generator/profile.ts
export type Profile = { name: string; phone: string; email: string; address: string; };

const KEY = "abd_profile_v1";
const EMPTY: Profile = { name: "", phone: "", email: "", address: "" };

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw);
    return { ...EMPTY, ...parsed };
  } catch { return { ...EMPTY }; }
}

export function saveProfile(p: Profile) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch {}
}

