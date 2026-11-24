import { useCallback, useEffect, useRef, useState } from "react";
import { getStatus, postJson } from "@/lib/api";

export interface Language {
  code: string;
  label: string;
  native: string;
}

export const LANGUAGES: Language[] = [
  { code: "en-IN", label: "English", native: "English" },
  { code: "hi-IN", label: "Hindi", native: "हिन्दी" },
  { code: "kn-IN", label: "Kannada", native: "ಕನ್ನಡ" },
  { code: "ta-IN", label: "Tamil", native: "தமிழ்" },
  { code: "te-IN", label: "Telugu", native: "తెలుగు" },
  { code: "bn-IN", label: "Bengali", native: "বাংলা" },
  { code: "mr-IN", label: "Marathi", native: "मराठी" },
  { code: "es-ES", label: "Spanish", native: "Español" },
  { code: "fr-FR", label: "French", native: "Français" },
];

const translations = new Map<string, string>();

/**
 * Translate a whole lab's narration in ONE request (the server only sends lines it hasn't translated
 * before), so speaking each part later costs nothing.
 */
export async function prepareTranslations(texts: string[], lang: string): Promise<void> {
  if (lang.startsWith("en")) return;
  const todo = [...new Set(texts.filter((t) => t && !translations.has(`${lang}|${t}`)))];
  if (!todo.length) return;
  const status = await getStatus();
  if (!status.gemini) return;
  try {
    const r = await postJson<{ texts?: string[] }>("/api/v1/voice/translate", { texts: todo, language: lang });
    todo.forEach((t, i) => {
      const tr = r.texts?.[i];
      if (tr && tr !== t) translations.set(`${lang}|${t}`, tr);
    });
  } catch {
    // speak() falls back to translating line by line, or to English
  }
}

/** Translate one narration line, cached per language. Falls back to English if translation is unavailable. */
async function translate(text: string, lang: string): Promise<string> {
  if (lang.startsWith("en")) return text;
  const key = `${lang}|${text}`;
  const hit = translations.get(key);
  if (hit) return hit;
  const status = await getStatus();
  if (!status.gemini) return text;
  try {
    const r = await postJson<{ texts?: string[] }>("/api/v1/voice/translate", { texts: [text], language: lang });
    const out = r.texts?.[0] || text;
    translations.set(key, out);
    return out;
  } catch {
    return text;
  }
}

/**
 * Spoken explanations in the chosen language.
 * Uses ElevenLabs through the local proxy when a key is set, otherwise the browser's built-in voice.
 */
export function useVoice() {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [language, setLanguage] = useState("en-IN");
  const [canTranslate, setCanTranslate] = useState(false);
  const [natural, setNatural] = useState(false);
  const tokenRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const langRef = useRef(language);
  langRef.current = language;

  useEffect(() => {
    setSupported("speechSynthesis" in window);
    getStatus().then((s) => {
      setCanTranslate(s.gemini);
      setNatural(s.elevenlabs);
    });
    return () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      if (timerRef.current) clearTimeout(timerRef.current);
      audioRef.current?.pause();
    };
  }, []);

  const stop = useCallback(() => {
    tokenRef.current += 1;
    if (timerRef.current) clearTimeout(timerRef.current);
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    audioRef.current?.pause();
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    async (english: string, onEnd?: () => void, opts?: { translated?: boolean }) => {
      const token = ++tokenRef.current;
      if (timerRef.current) clearTimeout(timerRef.current);
      audioRef.current?.pause();
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      const finish = () => {
        if (token !== tokenRef.current) return;
        setSpeaking(false);
        onEnd?.();
      };
      setSpeaking(true);
      const lang = langRef.current;
      const text = opts?.translated ? english : await translate(english, lang);
      if (token !== tokenRef.current) return;

      if (natural) {
        try {
          const r = await fetch("/api/v1/voice/speak", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, language: lang }) });
          if (r.ok && token === tokenRef.current) {
            const url = URL.createObjectURL(await r.blob());
            const audio = new Audio(url);
            audioRef.current = audio;
            audio.onended = () => {
              URL.revokeObjectURL(url);
              finish();
            };
            audio.onerror = finish;
            await audio.play();
            return;
          }
        } catch {
          // fall through to the browser voice
        }
      }
      if (token !== tokenRef.current) return;
      if (!("speechSynthesis" in window)) {
        timerRef.current = setTimeout(finish, Math.max(2500, text.length * 55));
        return;
      }
      const synth = window.speechSynthesis;
      const u = new SpeechSynthesisUtterance(text);
      const voices = synth.getVoices();
      const base = lang.slice(0, 2);
      const preferred =
        voices.find((v) => v.lang === lang && /natural|neural|google|premium|enhanced/i.test(v.name)) ??
        voices.find((v) => v.lang === lang) ??
        voices.find((v) => v.lang.startsWith(base) && /natural|neural|google|samantha|aria|jenny/i.test(v.name)) ??
        voices.find((v) => v.lang.startsWith(base));
      if (preferred) u.voice = preferred;
      u.lang = lang;
      u.rate = 0.98;
      u.pitch = 1.05;
      u.onend = finish;
      u.onerror = finish;
      synth.speak(u);
    },
    [natural],
  );

  /** The line in the chosen language (cached), so the speech bubble can show what is being spoken. */
  const localize = useCallback((text: string) => translate(text, langRef.current), []);

  return { supported, speaking, speak, stop, localize, language, setLanguage, canTranslate, natural };
}

export type Voice = ReturnType<typeof useVoice>;
