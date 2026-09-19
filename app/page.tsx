"use client";

import Image from "next/image";
import { useEffect, useState, type ChangeEvent } from "react";


type SpeechRecognitionResultLike = {
  [index: number]: {
    [index: number]: { transcript: string };
    isFinal?: boolean;
  };
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: SpeechRecognitionResultLike }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type Step = {
  text: string;
  completed: boolean;
};

type Source = {
  name: string;
  reason: string;
};

type Solution = {
  title: string;
  category: string;
  summary: string;
  clarification: string;
  steps: Step[];
  sources: Source[];
  urgent: boolean;
  urgentMessage: string;
  reminderSuggestion: string;
  sensitiveWarning: string;
};

type HistoryItem = {
  id: number;
  problem: string;
  solution: Solution;
};

const languages = [
  { code: "en", name: "English", native: "English" },
  { code: "te", name: "Telugu", native: "తెలుగు" },
  { code: "hi", name: "Hindi", native: "हिन्दी" },
  { code: "ta", name: "Tamil", native: "தமிழ்" },
  { code: "kn", name: "Kannada", native: "ಕನ್ನಡ" },
  { code: "ml", name: "Malayalam", native: "മലയാളം" },
  { code: "mr", name: "Marathi", native: "मराठी" },
  { code: "bn", name: "Bengali", native: "বাংলা" },
];

function normalizeSolution(data: unknown): Solution {
  const value = data as Partial<Solution> & { answer?: unknown };
  const answer = typeof value.answer === "string" ? value.answer.trim() : "";

  const steps: Step[] = Array.isArray(value.steps)
    ? value.steps
        .map((step): Step | null => {
          if (typeof step === "string") {
            return { text: step, completed: false };
          }
          if (
            step &&
            typeof step === "object" &&
            "text" in step &&
            typeof (step as { text?: unknown }).text === "string"
          ) {
            const item = step as { text: string; completed?: unknown };
            return {
              text: item.text,
              completed: item.completed === true,
            };
          }
          return null;
        })
        .filter((step): step is Step => step !== null)
    : [];

  const sources: Source[] = Array.isArray(value.sources)
    ? value.sources
        .map((source): Source | null => {
          if (
            source &&
            typeof source === "object" &&
            "name" in source &&
            "reason" in source &&
            typeof (source as { name?: unknown }).name === "string" &&
            typeof (source as { reason?: unknown }).reason === "string"
          ) {
            const item = source as { name: string; reason: string };
            return { name: item.name, reason: item.reason };
          }
          return null;
        })
        .filter((source): source is Source => source !== null)
    : [];

  return {
    title: typeof value.title === "string" && value.title.trim() ? value.title : "Your Problem",
    category: typeof value.category === "string" && value.category.trim() ? value.category : "General",
    summary:
      typeof value.summary === "string" && value.summary.trim()
        ? value.summary
        : answer || "Here is a practical way to approach your problem.",
    clarification: typeof value.clarification === "string" ? value.clarification : "",
    steps:
      steps.length > 0
        ? steps
        : [{ text: answer || "Review the problem and choose the next practical action.", completed: false }],
    sources,
    urgent: value.urgent === true,
    urgentMessage: typeof value.urgentMessage === "string" ? value.urgentMessage : "",
    reminderSuggestion:
      typeof value.reminderSuggestion === "string" ? value.reminderSuggestion : "",
    sensitiveWarning:
      typeof value.sensitiveWarning === "string" ? value.sensitiveWarning : "",
  };
}

export default function Home() {
  const [problem, setProblem] = useState("");
  const [solution, setSolution] = useState<Solution | null>(null);
  const [loading, setLoading] = useState(false);

  const [history, setHistory] = useState<HistoryItem[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }

    try {
      const saved = window.localStorage.getItem("problem-history");

      if (!saved) {
        return [];
      }

      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? (parsed as HistoryItem[]) : [];
    } catch (error) {
      console.error("Unable to load problem history:", error);
      window.localStorage.removeItem("problem-history");
      return [];
    }
  });

  const [image, setImage] = useState<string | null>(null);
  const [language, setLanguage] = useState("en");
  const [reminder, setReminder] = useState("");
  const [reminderMinutes, setReminderMinutes] = useState("30");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const selectedLanguage =
    languages.find((item) => item.code === language) ||
    languages[0];

  const getVoiceLanguage = () => {
    const voiceLanguages: Record<string, string> = {
      en: "en-IN", te: "te-IN", hi: "hi-IN", ta: "ta-IN",
      kn: "kn-IN", ml: "ml-IN", mr: "mr-IN", bn: "bn-IN",
    };
    return voiceLanguages[language] || "en-IN";
  };

  const startVoiceInput = () => {
    if (isListening) return;
    const browserWindow = window as unknown as {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Recognition = browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition;
    if (!Recognition) {
      alert("Voice input is not supported in this browser. Please use Google Chrome or Microsoft Edge.");
      return;
    }
    const recognition = new Recognition();
    recognition.lang = getVoiceLanguage();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript || "";
      if (transcript) {
        setProblem((current) => current.trim() ? `${current.trim()} ${transcript}` : transcript);
      }
    };
    recognition.onerror = (event) => {
  console.warn("Voice input:", event.error);
  setIsListening(false);

  if (event.error === "not-allowed") {
    alert("Please allow microphone access in your browser.");
  } else if (event.error === "network") {
    alert(
      "Voice recognition could not connect. Please check your internet connection and try again."
    );
  } else if (event.error !== "aborted" && event.error !== "no-speech") {
    alert("Voice input could not start. Please try again.");
  }
};
    recognition.onend = () => setIsListening(false);
    setIsListening(true);
    recognition.start();
  };

  const stopSpeaking = () => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  const speakSolution = () => {
    if (!solution || !("speechSynthesis" in window)) {
      alert("Voice playback is not supported in this browser.");
      return;
    }
    if (isSpeaking) { stopSpeaking(); return; }
    const text = [solution.title, solution.summary, "Action plan.", ...solution.steps.map((step, index) => `Step ${index + 1}. ${step.text}`)].join(". ");
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = getVoiceLanguage();
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  const solveProblem = async () => {
    if (!problem.trim() && !image) {
      return;
    }

    setLoading(true);
    setSolution(null);

    try {
      const response = await fetch("/api/solve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          problem,
          prompt: problem,
          image,
          imageUrl: image,
          language,
          languageName: selectedLanguage.name,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Something went wrong"
        );
      }

      const normalizedSolution: Solution = normalizeSolution(data);

      setSolution(normalizedSolution);

      const newItem: HistoryItem = {
        id: Date.now(),
        problem: problem || "Image problem",
        solution: normalizedSolution,
      };

      const updatedHistory = [
        newItem,
        ...history,
      ].slice(0, 20);

      setHistory(updatedHistory);

      localStorage.setItem(
        "problem-history",
        JSON.stringify(updatedHistory)
      );
    } catch (error) {
      console.error("Solve error:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Unable to solve the problem. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const updateStep = (index: number) => {
    if (!solution) {
      return;
    }

    const updatedSolution: Solution = {
      ...solution,
      steps: solution.steps.map((step, stepIndex) => {
        if (stepIndex === index) {
          return {
            ...step,
            completed: !step.completed,
          };
        }

        return step;
      }),
    };

    setSolution(updatedSolution);

    const updatedHistory = history.map((item) => {
      if (item.problem === problem) {
        return {
          ...item,
          solution: updatedSolution,
        };
      }

      return item;
    });

    setHistory(updatedHistory);

    localStorage.setItem(
      "problem-history",
      JSON.stringify(updatedHistory)
    );
  };

  const openHistory = (item: HistoryItem) => {
    setProblem(item.problem);
    setSolution(item.solution);
    setImage(null);
  };

  const deleteHistory = (id: number) => {
    const updatedHistory = history.filter(
      (item) => item.id !== id
    );

    setHistory(updatedHistory);

    localStorage.setItem(
      "problem-history",
      JSON.stringify(updatedHistory)
    );
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem("problem-history");
  };

  const newProblem = () => {
    setProblem("");
    setSolution(null);
    setImage(null);
    setReminder("");
  };

  const handleImage = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert(
        "Please choose an image smaller than 10 MB."
      );
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      setImage(reader.result as string);
    };

    reader.readAsDataURL(file);
  };

  const shareProblem = async () => {
    if (!solution) {
      return;
    }

    const shareText = `
Problem: ${solution.title}

${solution.summary}

Action Plan:
${solution.steps
  .map(
    (step, index) =>
      `${index + 1}. ${step.text}`
  )
  .join("\n")}
`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: "Problem Solver",
          text: shareText,
        });
      } else {
        await navigator.clipboard.writeText(
          shareText
        );

        alert(
          "Solution copied. You can send it to your trusted person."
        );
      }
    } catch {
      console.log("Sharing cancelled.");
    }
  };

  const setReminderTimer = () => {
    const minutes = Number(reminderMinutes);

    if (!reminder.trim()) {
      alert("Enter a reminder first.");
      return;
    }

    if (!minutes || minutes < 1) {
      alert("Enter a valid number of minutes.");
      return;
    }

    setTimeout(() => {
      alert(`Reminder: ${reminder}`);
    }, minutes * 60 * 1000);

    alert(
      `Reminder set for ${minutes} minute(s).`
    );
  };

  const completedSteps =
    solution?.steps.filter(
      (step) => step.completed
    ).length || 0;

  const totalSteps =
    solution?.steps.length || 0;

  const progress =
    totalSteps > 0
      ? Math.round(
          (completedSteps / totalSteps) * 100
        )
      : 0;

  return (
    <main className="min-h-screen overflow-hidden bg-slate-50 text-slate-900">

      {/* IMMERSIVE BACKGROUND */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(99,102,241,0.16),transparent_32%),radial-gradient(circle_at_100%_35%,rgba(168,85,247,0.12),transparent_28%),radial-gradient(circle_at_0%_70%,rgba(14,165,233,0.10),transparent_28%)]" />
        <div className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(15,23,42,1)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,1)_1px,transparent_1px)] [background-size:44px_44px]" />
        <div className="absolute left-[8%] top-28 h-40 w-40 animate-[float_8s_ease-in-out_infinite] rounded-full bg-indigo-400/15 blur-3xl" />
        <div className="absolute right-[5%] top-[32rem] h-56 w-56 animate-[float_10s_ease-in-out_infinite_reverse] rounded-full bg-fuchsia-400/10 blur-3xl" />
      </div>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">

        {/* PREMIUM HEADER */}
        <header className="relative text-center">
          <div className="mx-auto inline-flex items-center gap-3 rounded-full border border-white/70 bg-white/70 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-500 shadow-sm backdrop-blur-xl">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            Your everyday AI problem companion
          </div>

          <div className="relative mx-auto mt-6 h-28 w-28">
            <div className="absolute inset-0 animate-pulse rounded-[2rem] bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 blur-2xl opacity-50" />
            <div className="absolute -inset-2 animate-[spin_12s_linear_infinite] rounded-[2.4rem] border border-indigo-300/40" />
            <div className="relative flex h-24 w-24 items-center justify-center rounded-[2rem] border border-white/80 bg-slate-950 text-5xl shadow-2xl ring-8 ring-white/50">🧠</div>
          </div>

          <h1 className="mt-7 bg-gradient-to-r from-slate-950 via-indigo-900 to-violet-800 bg-clip-text text-5xl font-black tracking-[-0.04em] text-transparent sm:text-7xl">
            Problem Solver
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-xl">
            Turn confusion into a clear next step — using text, images, and your voice.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {['Think','Understand','Plan','Act'].map((item, index) => (
              <div key={item} className="flex items-center gap-2">
                <span className="rounded-full border border-white/80 bg-white/75 px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm backdrop-blur">
                  {index + 1}. {item}
                </span>
                {index < 3 && <span className="text-slate-300">→</span>}
              </div>
            ))}
          </div>
        </header>

        {/* HERO EXPERIENCE */}
        <section className="mx-auto mt-10 max-w-4xl">
          <div className="group relative overflow-hidden rounded-[2rem] border border-white/80 bg-white/70 p-6 shadow-[0_30px_90px_-35px_rgba(79,70,229,0.45)] backdrop-blur-2xl sm:p-10">
            <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-indigo-400/20 blur-3xl transition duration-700 group-hover:scale-125" />
            <div className="absolute -bottom-24 -left-20 h-56 w-56 rounded-full bg-fuchsia-400/10 blur-3xl" />

            <div className="relative text-center">
              <div className="mx-auto flex w-fit items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-xs font-bold text-white shadow-lg">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                FROM PROBLEM TO PROGRESS
              </div>
              <h2 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">
                One problem. A smarter path forward.
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500">
                Explain it your way. Problem Solver understands the situation, builds a practical plan, and helps you take the next step.
              </p>

              <div className="relative mx-auto mt-9 grid max-w-3xl gap-3 sm:grid-cols-4">
                {[
                  ['💭','Tell','Describe it'],
                  ['👁️','Understand','Find what matters'],
                  ['🧭','Plan','Get clear steps'],
                  ['🚀','Act','Move forward'],
                ].map(([icon,title,text], index) => (
                  <div key={title} className="relative rounded-2xl border border-slate-200/80 bg-white/80 p-4 text-center shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-2xl shadow-lg">{icon}</div>
                    <p className="mt-3 text-sm font-black">{title}</p>
                    <p className="mt-1 text-xs text-slate-500">{text}</p>
                    {index < 3 && <span className="absolute -right-3 top-9 z-10 hidden text-lg text-indigo-300 sm:block">→</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* INPUT */}

        <section className="mx-auto mt-10 max-w-4xl rounded-[2rem] border border-white/80 bg-white/85 p-5 shadow-[0_25px_70px_-35px_rgba(15,23,42,0.45)] backdrop-blur-xl sm:p-8">

          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">

            <div>

              <h2 className="text-xl font-bold">
                What can we solve?
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Describe anything you need help with.
              </p>

            </div>

            {/* LANGUAGE */}

            <div>

              <label
                htmlFor="language"
                className="mb-1 block text-xs font-semibold text-slate-500"
              >
                🌍 Language
              </label>

              <select
                id="language"
                value={language}
                onChange={(event) =>
                  setLanguage(event.target.value)
                }
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-100"
              >

                {languages.map((item) => (
                  <option
                    key={item.code}
                    value={item.code}
                  >
                    {item.native}
                  </option>
                ))}

              </select>

            </div>

          </div>

          {/* LANGUAGE STATUS */}

          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-violet-50 px-4 py-3 text-sm text-indigo-700 shadow-sm">

            🌍 You are using{" "}

            <span className="font-bold">
              {selectedLanguage.name}
            </span>

          </div>

          {/* PROBLEM */}

          <textarea
            value={problem}
            onChange={(event) =>
              setProblem(event.target.value)
            }
            placeholder="Example: I lost my PAN card and don't know what to do..."
            className="mt-5 min-h-44 w-full resize-none rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-5 text-base leading-7 outline-none transition duration-300 placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-8 focus:ring-indigo-100/70"
          />

          {/* IMAGE */}

          {image && (
            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-3">

            <Image
              src={image}
              alt="Uploaded problem"
              width={800}
              height={600}
              unoptimized
              className="h-auto max-h-96 w-full rounded-xl object-contain"
            />

              <button
                onClick={() => setImage(null)}
                className="mt-3 text-sm font-medium text-red-500 hover:underline"
              >
                Remove image
              </button>

            </div>
          )}

          {/* ACTION BUTTONS */}

          <div className="mt-4 flex flex-wrap gap-3">

            <label className="cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold shadow-sm transition hover:bg-slate-50">

              📷 Add Photo

              <input
                type="file"
                accept="image/*"
                onChange={handleImage}
                className="hidden"
              />

            </label>

            <button
              type="button"
              onClick={isListening ? undefined : startVoiceInput}
              className={`rounded-xl border px-4 py-3 text-sm font-semibold shadow-sm transition ${
                isListening ? "border-red-200 bg-red-50 text-red-700 animate-pulse" : "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
              }`}
            >
              {isListening ? "🔴 Listening..." : "🎙️ Speak"}
            </button>

            <button
              onClick={newProblem}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold shadow-sm transition hover:bg-slate-50"
            >
              ✨ New Problem
            </button>

          </div>

          {isListening && (
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-700">
              <div className="flex items-center gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-500" />
                <span className="h-3 w-2 animate-bounce rounded-full bg-indigo-400 [animation-delay:120ms]" />
                <span className="h-4 w-2 animate-bounce rounded-full bg-indigo-300 [animation-delay:240ms]" />
              </div>
              Listening in {selectedLanguage.name}...
            </div>
          )}

          {/* SOLVE BUTTON */}

          <button
            onClick={solveProblem}
            disabled={
              loading ||
              (!problem.trim() && !image)
            }
            className="group mt-5 w-full overflow-hidden rounded-2xl bg-slate-950 py-4 font-bold text-white shadow-[0_18px_45px_-18px_rgba(15,23,42,0.8)] transition duration-300 hover:-translate-y-0.5 hover:bg-indigo-950 disabled:cursor-not-allowed disabled:opacity-50"
          >

            {loading
              ? "Understanding Your Problem..."
              : "Solve My Problem →"}

          </button>

          <p className="mt-3 text-center text-xs text-slate-400">
            Don&apos;t share passwords, OTPs, API keys or other
            sensitive information.
          </p>

        </section>

        {/* LOADING */}

        {loading && (
          <section className="mx-auto mt-6 max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow">

            <div className="flex items-center gap-4">

              <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />

              <div>

                <p className="font-semibold">
                  Understanding your problem...
                </p>

                <p className="text-sm text-slate-500">
                  Creating a practical action plan.
                </p>

              </div>

            </div>

          </section>
        )}

        {/* SOLUTION */}

        {solution && !loading && (
          <section className="mx-auto mt-8 max-w-3xl space-y-5">

            {/* URGENT */}

            {solution.urgent && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-5">

                <div className="flex gap-3">

                  <div className="text-2xl">
                    🚨
                  </div>

                  <div>

                    <h2 className="font-bold text-red-800">
                      Important
                    </h2>

                    <p className="mt-2 text-sm text-red-700">
                      {solution.urgentMessage ||
                        "This situation may need immediate human help."}
                    </p>

                  </div>

                </div>

              </div>
            )}

            {/* SOLUTION HEADER */}

            <div className="overflow-hidden rounded-3xl bg-slate-900 p-6 text-white shadow-xl">

              <div className="flex items-center justify-between gap-4">

                <div>

                  <span className="inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">
                    {solution.category}
                  </span>

                  <h2 className="mt-4 text-2xl font-bold">
                    {solution.title}
                  </h2>

                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    {solution.summary}
                  </p>

                </div>

                <div className="hidden text-6xl sm:block">
                  ✨
                </div>

              </div>

            </div>

            {/* CLARIFICATION */}

            {solution.clarification && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">

                <div className="flex gap-3">

                  <div className="text-xl">
                    ❓
                  </div>

                  <div>

                    <h3 className="font-bold">
                      One thing to clarify
                    </h3>

                    <p className="mt-1 text-sm text-slate-700">
                      {solution.clarification}
                    </p>

                  </div>

                </div>

              </div>
            )}

            {/* ACTION PLAN */}

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">

              <div className="flex items-center justify-between">

                <div>

                  <h2 className="text-xl font-bold">
                    Your Action Plan
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Complete each step to move forward.
                  </p>

                </div>

                <div className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-slate-200 text-sm font-bold">
                  {progress}%
                </div>

              </div>

              {/* PROGRESS */}

              <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100">

                <div
                  className="h-full rounded-full bg-slate-900 transition-all duration-500"
                  style={{
                    width: `${progress}%`,
                  }}
                />

              </div>

              {/* STEPS */}

              <div className="mt-6 space-y-3">

                {solution.steps.map(
                  (step, index) => (
                    <button
                      key={index}
                      onClick={() =>
                        updateStep(index)
                      }
                      className="flex w-full items-center gap-4 rounded-2xl border border-slate-200 p-4 text-left transition hover:bg-slate-50"
                    >

                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold ${
                          step.completed
                            ? "bg-emerald-500 text-white"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {step.completed
                          ? "✓"
                          : index + 1}
                      </div>

                      <span
                        className={
                          step.completed
                            ? "text-slate-400 line-through"
                            : "font-medium text-slate-800"
                        }
                      >
                        {step.text}
                      </span>

                    </button>
                  )
                )}

              </div>

              <p className="mt-5 text-sm text-slate-500">
                {completedSteps} of {totalSteps} steps completed
              </p>

            </div>

            {/* SOURCES */}

            {solution.sources.length > 0 && (
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">

                <div className="flex gap-3">

                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-xl">
                    🔎
                  </div>

                  <div>

                    <h2 className="text-xl font-bold">
                      Verify Important Information
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      Check important information with the
                      relevant official source before acting.
                    </p>

                  </div>

                </div>

                <div className="mt-5 space-y-3">

                  {solution.sources.map(
                    (source, index) => (
                      <div
                        key={index}
                        className="rounded-2xl bg-slate-50 p-4"
                      >

                        <p className="font-semibold">
                          {source.name}
                        </p>

                        <p className="mt-1 text-sm text-slate-600">
                          {source.reason}
                        </p>

                      </div>
                    )
                  )}

                </div>

              </div>
            )}

            {/* PRIVACY */}

            {solution.sensitiveWarning && (
              <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5">

                <div className="flex gap-3">

                  <div className="text-xl">
                    🔒
                  </div>

                  <div>

                    <h3 className="font-bold">
                      Privacy Reminder
                    </h3>

                    <p className="mt-1 text-sm text-slate-700">
                      {solution.sensitiveWarning}
                    </p>

                  </div>

                </div>

              </div>
            )}

            {/* TOOLS */}

            <div className="grid gap-4 sm:grid-cols-2">

              {/* VOICE */}

              <button
                onClick={speakSolution}
                className={`rounded-2xl border p-5 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md ${
                  isSpeaking ? "border-indigo-200 bg-indigo-50" : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-2xl">
                  {isSpeaking ? "🔊" : "🎧"}
                </div>
                <h3 className="mt-4 font-bold">{isSpeaking ? "Stop Voice" : "Listen to Solution"}</h3>
                <p className="mt-1 text-sm text-slate-500">Hear your solution and action plan aloud.</p>
              </button>

              {/* SHARE */}

              <button
                onClick={shareProblem}
                className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >

                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-2xl">
                  👤
                </div>

                <h3 className="mt-4 font-bold">
                  Share With Trusted Person
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Share the problem and action plan.
                </p>

              </button>

              {/* REMINDER */}

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-2xl">
                  ⏰
                </div>

                <h3 className="mt-4 font-bold">
                  Set Reminder
                </h3>

                <input
                  value={reminder}
                  onChange={(event) =>
                    setReminder(event.target.value)
                  }
                  placeholder="Example: Call the office"
                  className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-slate-900"
                />

                <div className="mt-3 flex gap-2">

                  <input
                    value={reminderMinutes}
                    onChange={(event) =>
                      setReminderMinutes(
                        event.target.value
                      )
                    }
                    type="number"
                    min="1"
                    className="w-24 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none"
                  />

                  <button
                    onClick={setReminderTimer}
                    className="flex-1 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
                  >
                    Set Reminder
                  </button>

                </div>

              </div>

            </div>

          </section>
        )}

        {/* HISTORY */}

        <section className="mx-auto mt-10 max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">

          <div className="flex items-center justify-between">

            <div>

              <h2 className="text-xl font-bold">
                Problem History
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Your recent solved problems.
              </p>

            </div>

            {history.length > 0 && (
              <button
                onClick={clearHistory}
                className="text-sm font-medium text-red-500 hover:underline"
              >
                Clear All
              </button>
            )}

          </div>

          {history.length === 0 ? (
            <div className="py-10 text-center">

              <div className="text-4xl">
                📚
              </div>

              <p className="mt-3 font-medium">
                No problems solved yet.
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Your solved problems will appear here.
              </p>

            </div>
          ) : (
            <div className="mt-5 space-y-3">

              {history.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 transition hover:bg-slate-50"
                >

                  <button
                    onClick={() =>
                      openHistory(item)
                    }
                    className="flex-1 text-left"
                  >

                    <p className="font-semibold text-slate-800">
                      {item.problem}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {item.solution.category}
                    </p>

                  </button>

                  <button
                    onClick={() =>
                      deleteHistory(item.id)
                    }
                    className="rounded-lg px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50"
                  >
                    Delete
                  </button>

                </div>
              ))}

            </div>
          )}

        </section>

        <section className="mx-auto mt-8 max-w-3xl overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-violet-50 p-6 shadow-sm">
          <div className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600">Voice Assistant</p>
              <h2 className="mt-1 text-lg font-bold text-slate-900">Speak naturally. Get help naturally.</h2>
              <p className="mt-1 text-sm text-slate-500">Speak your problem or listen to your action plan.</p>
            </div>
            <button type="button" onClick={startVoiceInput} className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-slate-800">🎙️ Try Voice</button>
          </div>
        </section>

        {/* FOOTER */}

        <footer className="py-10 text-center">

          <p className="text-sm font-medium text-slate-500">
            Problem Solver
          </p>

          <p className="mt-1 text-xs text-slate-400">
            Understand → Plan → Act → Track
          </p>

        </footer>

      </div>

      <style jsx global>{`
        @keyframes float {
          0%, 100% { transform: translate3d(0, 0, 0); }
          50% { transform: translate3d(0, -18px, 0); }
        }
        ::selection {
          background: rgba(99, 102, 241, 0.18);
        }
        html {
          scroll-behavior: smooth;
        }
      `}</style>
    </main>
  );
}