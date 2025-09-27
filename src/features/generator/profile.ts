// src/features/generator/profile.ts
export type Profile = {
  name: string;
  phone: string;
  email: string;
  address: string;
};

const KEY = "abd_profile_v1";
const DEFAULT_PROFILE: Profile = { name: "", phone: "", email: "", address: "" };

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_PROFILE };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_PROFILE, ...parsed };
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

export function saveProfile(p: Profile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}
