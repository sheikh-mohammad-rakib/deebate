"use client";
import { useState, useEffect, useRef } from "react";

type Role =
  | "Moderator"
  | "Affirmative (Constructive)"
  | "Negative (Constructive)"
  | "Affirmative (Rebuttal)"
  | "Negative (Rebuttal)"
  | "Timekeeper"
  | "Judge";

type Message = {
  id: string;
  role: Role;
  content: string;
};

type DebatePhase = "idle" | "moderator" | "aff_const" | "neg_const" | "aff_rebut" | "neg_rebut" | "judge" | "verdict";

// --- THE PERSONAS (Updated with Soft Limits for Pacing) ---
const PROMPTS = {
  MODERATOR:
    "You are the Chairperson overseeing a formal debate. Neutrally introduce the debate topic. STRICT LIMIT: Maximum 2 sentences. End by inviting the Affirmative Constructive speaker to the floor.",

  AFF_CONSTRUCTIVE:
    "You are the Affirmative Constructive. Build the foundational case FOR the topic. Present 2 strong, distinct arguments. Do not address the opponent yet. STRICT LIMIT: Keep your entire statement under 150 words. Ensure you complete your thoughts and sentences fully within this limit.",

  NEG_CONSTRUCTIVE:
    "You are the Negative Constructive. Build the foundational case AGAINST the topic. Present 2 strong counter-arguments and identify one flaw in the Affirmative's case. STRICT LIMIT: Keep your entire statement under 150 words. Ensure you complete your thoughts and sentences fully within this limit.",

  AFF_REBUTTAL:
    "You are the Affirmative Rebuttal. You may NOT introduce new foundational arguments. Strictly defend your original case and aggressively dismantle the Negative Constructive's points. STRICT LIMIT: Keep your entire rebuttal under 100 words. Conclude cleanly within this limit.",

  NEG_REBUTTAL:
    "You are the Negative Rebuttal. This is the final speech of the debate. Strictly dismantle the Affirmative's rebuttal and summarize why the Negative side wins. Be punchy and conclusive. STRICT LIMIT: Keep your entire rebuttal under 100 words. Conclude cleanly within this limit.",

  JUDGE:
    "You are an expert, neutral Judge. Evaluate the transcript thoroughly. Analyze logical consistency, directness of rebuttals, and practical real-world engineering validity. CRITICAL INSTRUCTION: Start your response with a clear declaration of the winner in this exact format: 'WINNER: [Affirmative or Negative]' followed by your structural breakdown. Do not declare a tie."
};

const PRESET_TOPICS = [
  {
    id: "automation",
    category: "Automation",
    label: "VERSATILE COBOTS VS. FIXED AUTOMATION",
    text: "For a factory floor, is it more efficient to use versatile cobots like the UR3, or traditional fixed automation?",
    icon: "🤖"
  },
  {
    id: "ai-copyright",
    category: "AI Ethics",
    label: "AI ART COPYRIGHT ELIGIBILITY",
    text: "Should AI-generated artwork be eligible for intellectual property and copyright protection?",
    icon: "🎨"
  },
  {
    id: "mars",
    category: "Space Tech",
    label: "MARS COLONIZATION SPEARHEAD",
    text: "Should Mars colonization be spearheaded by private corporations rather than international coalitions?",
    icon: "🚀"
  },
  {
    id: "cbdc",
    category: "Economics",
    label: "CBDC VS. PHYSICAL CASH",
    text: "Should central bank digital currencies (CBDCs) fully replace physical paper and coin cash?",
    icon: "🪙"
  }
];

const STEPS = [
  { id: "moderator", label: "Moderator Opening", desc: "Topic introduction. Limit: 2 sentences." },
  { id: "aff_const", label: "Affirmative Constructive", desc: "Builds positive case. Limit: 150 words." },
  { id: "neg_const", label: "Negative Constructive", desc: "Rebuts and builds negative case. Limit: 150 words." },
  { id: "aff_rebut", label: "Affirmative Rebuttal", desc: "Defends case and refutes negative. Limit: 100 words." },
  { id: "neg_rebut", label: "Negative Rebuttal", desc: "Final defense and summary statement. Limit: 100 words." },
  { id: "judge", label: "Judge Evaluation", desc: "Neutral verdict & analysis. Limit: 1000 tokens." }
];

const parseInline = (text: string) => {
  if (!text) return "";
  const boldParts = text.split("**");
  return boldParts.map((part, index) => {
    const isBold = index % 2 === 1;
    const codeParts = part.split("`");
    const parsedCode = codeParts.map((subPart, subIdx) => {
      const isCode = subIdx % 2 === 1;
      if (isCode) {
        return (
          <code key={subIdx} className="bg-slate-950 px-1.5 py-0.5 rounded text-xs text-indigo-300 border border-slate-800/60 font-mono">
            {subPart}
          </code>
        );
      }
      return subPart;
    });
    if (isBold) {
      return <strong key={index} className="font-extrabold text-white">{parsedCode}</strong>;
    }
    return <span key={index}>{parsedCode}</span>;
  });
};

const renderMarkdown = (text: string) => {
  if (!text) return "";
  const lines = text.split("\n");
  return lines.map((line, idx) => {
    const trimmed = line.trim();

    // Check for Horizontal Rule
    if (trimmed === "---" || trimmed === "***" || trimmed === "___") {
      return <hr key={idx} className="border-slate-800/80 my-4" />;
    }

    // Check for Headings (from H4 to H1)
    if (line.startsWith("#### ")) {
      return (
        <h5 key={idx} className="text-xs md:text-sm font-black uppercase tracking-wider text-slate-400 mt-4 mb-2 first:mt-0">
          {parseInline(line.substring(5))}
        </h5>
      );
    }
    if (line.startsWith("### ")) {
      return (
        <h4 key={idx} className="text-sm md:text-base font-extrabold text-white mt-3.5 mb-1.5 first:mt-0">
          {parseInline(line.substring(4))}
        </h4>
      );
    }
    if (line.startsWith("## ")) {
      return (
        <h3 key={idx} className="text-base md:text-lg font-black text-white mt-4.5 mb-2 first:mt-0">
          {parseInline(line.substring(3))}
        </h3>
      );
    }
    if (line.startsWith("# ")) {
      return (
        <h2 key={idx} className="text-lg md:text-xl font-black text-white mt-5 mb-2.5 first:mt-0">
          {parseInline(line.substring(2))}
        </h2>
      );
    }

    // Check for List Items
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const cleanLine = trimmed.substring(2);
      return (
        <div key={idx} className="flex items-start gap-2 text-sm md:text-base text-slate-300 my-1 pl-4">
          <span className="text-indigo-400 shrink-0 select-none">•</span>
          <div className="leading-relaxed flex-1">{parseInline(cleanLine)}</div>
        </div>
      );
    }

    // Empty line
    if (trimmed === "") {
      return <div key={idx} className="h-2" />;
    }

    // Normal paragraph
    return (
      <p key={idx} className="text-slate-300 text-sm md:text-base leading-relaxed my-1">
        {parseInline(line)}
      </p>
    );
  });
};

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

export default function DebateArena() {
  const [topic, setTopic] = useState("For a factory floor, is it more efficient to use versatile cobots like the UR3, or traditional fixed automation?");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isDebating, setIsDebating] = useState(false);
  const [activePhase, setActivePhase] = useState<DebatePhase>("idle");
  const [currentSpeaker, setCurrentSpeaker] = useState<Role | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const [winner, setWinner] = useState<"Affirmative" | "Negative" | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const isMutedRef = useRef(isMuted);

  // Sync mute ref
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // Autoscroll logic
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages, autoScroll]);

  // Web Audio API Synthesized Crystal Bell Chime
  const playTimekeeperChime = () => {
    if (typeof window === "undefined" || isMutedRef.current) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc1.type = "sine";
      osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5

      osc2.type = "sine";
      osc2.frequency.setValueAtTime(880.00, ctx.currentTime); // A5 (harmonic Fifth)

      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.8);

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc1.start();
      osc2.start();

      osc1.stop(ctx.currentTime + 1.8);
      osc2.stop(ctx.currentTime + 1.8);
    } catch (e) {
      console.error("Synthesizer failed to play chime:", e);
    }
  };

  // Streaming Engine
  const fetchStream = async (payload: any, role: Role) => {
    const messageId = Date.now().toString();
    setMessages((prev) => [...prev, { id: messageId, role, content: "" }]);
    setCurrentSpeaker(role);

    const res = await fetch("/api/debate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.body) {
      setCurrentSpeaker(null);
      return "";
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      fullResponse += chunk;

      setMessages((prev) =>
        prev.map((msg) => msg.id === messageId ? { ...msg, content: fullResponse } : msg)
      );
    }
    setCurrentSpeaker(null);
    return fullResponse;
  };

  // Timekeeper Announcements
  const injectTimekeeper = (message: string) => {
    setMessages((prev) => [...prev, { id: Date.now().toString(), role: "Timekeeper", content: `🔔 ${message}` }]);
    playTimekeeperChime();
  };

  const parseWinner = (content: string) => {
    const match = content.match(/WINNER:\s*(Affirmative|Negative)/i);
    if (match) {
      return match[1].toLowerCase().includes("affirmative") ? "Affirmative" : "Negative";
    }
    // Fallback search
    if (content.toUpperCase().includes("WINNER: AFFIRMATIVE")) return "Affirmative";
    if (content.toUpperCase().includes("WINNER: NEGATIVE")) return "Negative";
    return null;
  };

  const startDebate = async () => {
    setIsDebating(true);
    setMessages([]);
    setWinner(null);

    const memoryAff: { role: string; content: string }[] = [];
    const memoryNeg: { role: string; content: string }[] = [];
    const transcript: string[] = [];

    try {
      // 1. MODERATOR OPENS THE FLOOR
      setActivePhase("moderator");
      const modReply = await fetchStream({
        model: "gpt-4o-mini",
        systemPrompt: PROMPTS.MODERATOR,
        messages: [{ role: "user", content: `Topic: ${topic}` }],
        maxTokens: 120
      }, "Moderator");
      transcript.push(`Moderator: ${modReply}`);
      await delay(2000);

      // 2. AFFIRMATIVE CONSTRUCTIVE
      setActivePhase("aff_const");
      const affConstReply = await fetchStream({
        model: "gpt-4o-mini",
        systemPrompt: PROMPTS.AFF_CONSTRUCTIVE,
        messages: [{ role: "user", content: `The floor is yours. Topic: ${topic}` }],
        maxTokens: 300
      }, "Affirmative (Constructive)");
      memoryAff.push({ role: "assistant", content: affConstReply });
      memoryNeg.push({ role: "user", content: `Affirmative Constructive argued: ${affConstReply}` });
      transcript.push(`Affirmative Constructive: ${affConstReply}`);

      injectTimekeeper("Affirmative Constructive time has expired. Floor yields to Negative Constructive.");
      await delay(3000);

      // 3. NEGATIVE CONSTRUCTIVE
      setActivePhase("neg_const");
      const negConstReply = await fetchStream({
        model: "gpt-4o-mini",
        systemPrompt: PROMPTS.NEG_CONSTRUCTIVE,
        messages: memoryNeg,
        maxTokens: 300
      }, "Negative (Constructive)");
      memoryNeg.push({ role: "assistant", content: negConstReply });
      memoryAff.push({ role: "user", content: `Negative Constructive argued: ${negConstReply}` });
      transcript.push(`Negative Constructive: ${negConstReply}`);

      injectTimekeeper("Negative Constructive time has expired. Floor yields to Affirmative Rebuttal.");
      await delay(3000);

      // 4. AFFIRMATIVE REBUTTAL
      setActivePhase("aff_rebut");
      const affRebutReply = await fetchStream({
        model: "gpt-4o-mini",
        systemPrompt: PROMPTS.AFF_REBUTTAL,
        messages: memoryAff,
        maxTokens: 200
      }, "Affirmative (Rebuttal)");
      memoryNeg.push({ role: "user", content: `Affirmative Rebuttal argued: ${affRebutReply}` });
      transcript.push(`Affirmative Rebuttal: ${affRebutReply}`);

      injectTimekeeper("Affirmative Rebuttal time has expired. Floor yields to Negative Rebuttal for the final word.");
      await delay(3000);

      // 5. NEGATIVE REBUTTAL
      setActivePhase("neg_rebut");
      const negRebutReply = await fetchStream({
        model: "gpt-4o-mini",
        systemPrompt: PROMPTS.NEG_REBUTTAL,
        messages: memoryNeg,
        maxTokens: 200
      }, "Negative (Rebuttal)");
      transcript.push(`Negative Rebuttal: ${negRebutReply}`);

      injectTimekeeper("Debate concluded. Transmitting complete official record to the Judge panel.");
      await delay(3000);

      // 6. THE JUDGE EVALUATION
      setActivePhase("judge");
      const judgeReply = await fetchStream({
        model: "gpt-4o",
        systemPrompt: PROMPTS.JUDGE,
        messages: [{ role: "user", content: `Official Transcript:\n\n${transcript.join("\n\n")}` }],
        maxTokens: 1000
      }, "Judge");

      const finalWinner = parseWinner(judgeReply);
      if (finalWinner) {
        setWinner(finalWinner as "Affirmative" | "Negative");
      }
      setActivePhase("verdict");
    } catch (err) {
      console.error("Debate timeline error:", err);
    } finally {
      setIsDebating(false);
    }
  };

  const selectPreset = (text: string) => {
    if (isDebating) return;
    setTopic(text);
    setMessages([]);
    setWinner(null);
    setActivePhase("idle");
  };

  const getStepCompleted = (stepId: string) => {
    const order = ["idle", "moderator", "aff_const", "neg_const", "aff_rebut", "neg_rebut", "judge", "verdict"];
    const stepIdx = order.indexOf(stepId);
    const currentIdx = order.indexOf(activePhase);
    return stepIdx < currentIdx;
  };

  const copyTranscript = () => {
    if (messages.length === 0) return;
    const textContent = messages
      .map((msg) => {
        if (msg.role === "Timekeeper") return `[Timekeeper] ${msg.content.replace("🔔", "").trim()}`;
        return `## ${msg.role}\n${msg.content}\n`;
      })
      .join("\n");

    navigator.clipboard.writeText(`# Debate Topic: ${topic}\n\n${textContent}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // SVGs for each role
  const ModeratorIcon = () => (
    <svg className="w-5 h-5 text-emerald-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0-17.25a3.75 3.75 0 1 1-7.5 0M12 3a3.75 3.75 0 1 0 7.5 0M1.5 7.5h21M4.5 7.5a1.5 1.5 0 0 0-1.5 1.5M3 9v.15H5.25V9M3.75 9.15c0 3.314 2.686 6 6 6m0 0H12m0 0h2.25m0 0c3.314 0 6-2.686 6-6M21 9v.15H18.75V9m.75.15a1.5 1.5 0 0 0-1.5-1.5M16.5 7.5a1.5 1.5 0 0 0-1.5 1.5" />
    </svg>
  );

  const AffirmativeIcon = () => (
    <svg className="w-5 h-5 text-cyan-400 animate-[pulse_3s_infinite]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 0 0 2.25-2.25V6.75a2.25 2.25 0 0 0-2.25-2.25H6.75A2.25 2.25 0 0 0 4.5 6.75v10.5a2.25 2.25 0 0 0 2.25 2.25Zm.75-12h7.5m-7.5 3h7.5m-7.5 3h7.5" />
    </svg>
  );

  const NegativeIcon = () => (
    <svg className="w-5 h-5 text-rose-400 animate-[pulse_3s_infinite]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
    </svg>
  );

  const JudgeIcon = () => (
    <svg className="w-5 h-5 text-violet-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 21m0 0h-3.375m3.375 0h1.5M3 16.06V19.5M3 19.5h3.375M3 19.5v-3.44M15.89 2.22l5.89 5.89a1.5 1.5 0 0 1 0 2.119l-5.89 5.89a1.5 1.5 0 0 1-2.119 0L7.88 10.228a1.5 1.5 0 0 1 0-2.119l5.89-5.89a1.5 1.5 0 0 1 2.119 0Z" />
    </svg>
  );

  return (
    <div className="min-h-screen text-slate-100 flex flex-col font-sans">
      {/* Header Bar */}
      <header className="border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 shadow-lg shadow-indigo-950/50">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v17m0-17c-2.21 0-4 1.79-4 4s1.79 4 4 4m0-8c2.21 0 4 1.79 4 4s-1.79 4-4 4m0 4c-2.21 0-4 1.79-4 4m0-4c2.21 0 4 1.79 4 4" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight font-display bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">DEEBATE</h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">AI Lincoln-Douglas Simulation</p>
          </div>
        </div>

        {/* Audio Mute Switch */}
        <button
          onClick={() => setIsMuted(!isMuted)}
          className={`px-3 py-1.5 rounded-lg border transition-all duration-300 flex items-center gap-2 text-xs font-semibold ${isMuted
              ? "border-rose-950/30 bg-rose-950/20 text-rose-400 hover:bg-rose-950/40"
              : "border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700 hover:bg-slate-800/80"
            }`}
          title={isMuted ? "Unmute Announcements" : "Mute Announcements"}
        >
          {isMuted ? (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
              <span>Chime Muted</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4 animate-pulse text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
              <span>Chime Enabled</span>
            </>
          )}
        </button>
      </header>

      {/* Main Body */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left Column: Dashboard Control */}
        <section className="lg:col-span-1 flex flex-col gap-6">

          {/* Topic Setup Card */}
          <div className="glass-panel p-6 rounded-2xl flex flex-col gap-4 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl -translate-x-12 -translate-y-12" />
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-400 font-display">Arena Controls</h2>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-500 font-semibold">Debate Resolution</label>
              <textarea
                className="w-full min-h-[96px] bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-sm font-medium focus:outline-none focus:border-indigo-500 transition-colors placeholder-slate-600 leading-relaxed text-slate-200 resize-none"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={isDebating}
                placeholder="Enter debate topic..."
              />
            </div>

            <button
              className={`w-full py-3.5 rounded-xl font-bold tracking-wide transition-all duration-300 shadow-md relative group overflow-hidden ${isDebating
                  ? "bg-slate-900 border border-slate-800 text-slate-500 cursor-not-allowed"
                  : "bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:brightness-110 active:scale-[0.98] shadow-indigo-950/20"
                }`}
              onClick={startDebate}
              disabled={isDebating}
            >
              {isDebating ? (
                <div className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Debate In Session...</span>
                </div>
              ) : (
                <span>Commence Debate</span>
              )}
            </button>
          </div>

          {/* Quick-Start Presets */}
          <div className="glass-panel p-6 rounded-2xl flex flex-col gap-4 shadow-xl">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-400 font-display">Preset Resolutions</h2>
            <div className="grid grid-cols-1 gap-2.5">
              {PRESET_TOPICS.map((preset) => {
                const isActive = topic === preset.text;
                return (
                  <button
                    key={preset.id}
                    onClick={() => selectPreset(preset.text)}
                    disabled={isDebating}
                    className={`text-left p-3.5 rounded-xl border transition-all duration-300 flex items-start gap-3.5 group relative overflow-hidden ${isDebating ? "opacity-40 cursor-not-allowed" : ""
                      } ${isActive
                        ? "bg-indigo-950/15 border-indigo-500/40 shadow-inner"
                        : "bg-slate-900/30 border-slate-800/80 hover:bg-slate-900/60 hover:border-slate-700/60"
                      }`}
                  >
                    <span className="text-lg bg-slate-950/50 p-2 rounded-lg border border-slate-800/40 group-hover:scale-105 transition-transform shrink-0">
                      {preset.icon}
                    </span>
                    <div className="flex flex-col gap-0.5">
                      <span className={`text-[9px] font-extrabold tracking-wider uppercase ${isActive ? "text-indigo-400" : "text-slate-500"
                        }`}>{preset.category}</span>
                      <span className={`text-xs font-bold ${isActive ? "text-slate-100" : "text-slate-300 group-hover:text-slate-200"
                        }`}>{preset.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Debate Phase Stepper */}
          <div className="glass-panel p-6 rounded-2xl flex flex-col gap-5 shadow-xl flex-1">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-400 font-display">Debate timeline</h2>
            <div className="flex flex-col gap-4">
              {STEPS.map((step, idx) => {
                const isActive = activePhase === step.id;
                const isCompleted = getStepCompleted(step.id);

                // Color formatting
                let activeColor = "border-indigo-500/50 text-indigo-400";
                if (step.id.includes("aff")) activeColor = "border-cyan-500/50 text-cyan-400";
                if (step.id.includes("neg")) activeColor = "border-rose-500/50 text-rose-400";
                if (step.id === "moderator") activeColor = "border-emerald-500/50 text-emerald-400";
                if (step.id === "judge") activeColor = "border-violet-500/50 text-violet-400";

                return (
                  <div
                    key={step.id}
                    className={`flex gap-3.5 transition-all duration-300 relative ${isCompleted ? "opacity-45" : isActive ? "opacity-100 scale-[1.01]" : "opacity-35"
                      }`}
                  >
                    {/* Visual Line connector */}
                    {idx < STEPS.length - 1 && (
                      <div className={`absolute left-[13px] top-7 bottom-[-18px] w-[2px] transition-colors duration-500 ${isCompleted ? "bg-emerald-500/30" : isActive ? "bg-indigo-500/20" : "bg-slate-800"
                        }`} />
                    )}

                    {/* Step Icon Indicator */}
                    <div className="shrink-0">
                      {isCompleted ? (
                        <div className="w-[28px] h-[28px] rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold text-xs">
                          ✓
                        </div>
                      ) : isActive ? (
                        <div className={`w-[28px] h-[28px] rounded-full bg-slate-950 border-2 flex items-center justify-center pulse-active ${activeColor}`}>
                          <div className="w-2 h-2 rounded-full bg-current" />
                        </div>
                      ) : (
                        <div className="w-[28px] h-[28px] rounded-full bg-slate-900 border border-slate-800 text-slate-600 flex items-center justify-center font-bold text-xs font-display">
                          {idx + 1}
                        </div>
                      )}
                    </div>

                    {/* Step Content */}
                    <div className="flex flex-col gap-0.5">
                      <span className={`text-xs font-bold font-display ${isActive ? "text-slate-100" : "text-slate-300"}`}>
                        {step.label}
                      </span>
                      <span className="text-[10px] text-slate-500 leading-relaxed max-w-[200px]">
                        {step.desc}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Right Column: Debate Arena Feed */}
        <section className="lg:col-span-2 flex flex-col gap-4 h-[780px] lg:h-auto">

          {/* Feed Header */}
          <div className="flex items-center justify-between px-2.5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-violet-500 animate-pulse shadow-md shadow-violet-500/50" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-display">Debate Arena Stage</span>
            </div>

            <div className="flex items-center gap-3">
              {/* Autoscroll Toggle */}
              <button
                onClick={() => setAutoScroll(!autoScroll)}
                className={`text-[10px] font-extrabold uppercase px-2.5 py-1.5 rounded-lg border transition-all duration-300 flex items-center gap-1.5 ${autoScroll
                    ? "border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700"
                    : "border-indigo-950 bg-indigo-950/20 text-indigo-400"
                  }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${autoScroll ? "bg-slate-500" : "bg-indigo-400 animate-ping"}`} />
                <span>{autoScroll ? "Autoscroll On" : "Scroll Locked"}</span>
              </button>

              {/* Copy Transcript Button */}
              <button
                onClick={copyTranscript}
                disabled={messages.length === 0}
                className={`text-[10px] font-extrabold uppercase px-2.5 py-1.5 rounded-lg border transition-all duration-300 flex items-center gap-1.5 ${messages.length === 0
                    ? "border-slate-800/40 bg-slate-900/10 text-slate-600 cursor-not-allowed"
                    : "border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700 hover:bg-slate-800/80 active:scale-[0.97]"
                  }`}
              >
                {copied ? (
                  <>
                    <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    <span>Copy Script</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Transcript Panel Box */}
          <div
            ref={containerRef}
            className="flex-1 glass-panel rounded-2xl p-4 md:p-6 overflow-y-auto flex flex-col gap-6 border-slate-800/60 shadow-inner min-h-[400px]"
          >
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center flex-1 py-20 text-center select-none animate-[fadeIn_0.5s_ease-out]">
                <div className="w-20 h-20 rounded-full bg-slate-950 flex items-center justify-center border border-slate-800/60 shadow-lg mb-4 text-3xl">
                  ⚖️
                </div>
                <h3 className="font-extrabold text-slate-300 text-lg tracking-tight font-display mb-1.5">The Stage is Vacant</h3>
                <p className="text-xs text-slate-500 max-w-sm leading-relaxed mb-6">
                  Select a preset resolution or customize one above, then commence the debate to witness the AI Agents dispute live.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                  <span className="px-2 py-1 bg-slate-900 border border-slate-800 rounded">1. Intro</span>
                  <span>➜</span>
                  <span className="px-2 py-1 bg-slate-900 border border-slate-800 rounded text-cyan-400">2. Stance</span>
                  <span>➜</span>
                  <span className="px-2 py-1 bg-slate-900 border border-slate-800 rounded text-rose-400">3. Counter</span>
                  <span>➜</span>
                  <span className="px-2 py-1 bg-slate-900 border border-slate-800 rounded text-violet-400">4. Verdict</span>
                </div>
              </div>
            )}

            {/* Verdict Box Rendering at completion */}
            {winner && activePhase === "verdict" && (
              <div className={`w-full border p-6 rounded-2xl shadow-xl text-center relative overflow-hidden animate-[fadeIn_0.8s_ease-out] mb-2 ${winner === "Affirmative"
                  ? "border-cyan-500/30 bg-gradient-to-r from-cyan-950/20 via-slate-950/90 to-cyan-950/20 shadow-cyan-950/15"
                  : "border-rose-500/30 bg-gradient-to-r from-rose-950/20 via-slate-950/90 to-rose-950/20 shadow-rose-950/15"
                }`}>
                <div className={`absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r ${winner === "Affirmative" ? "from-transparent via-cyan-400 to-transparent" : "from-transparent via-rose-400 to-transparent"
                  }`} />
                <span className={`text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full border mb-3 inline-block ${winner === "Affirmative" ? "border-cyan-500/30 text-cyan-400 bg-cyan-950/30" : "border-rose-500/30 text-rose-400 bg-rose-950/30"
                  }`}>Official Verdict</span>

                <h2 className="text-2xl md:text-3xl font-black tracking-tight font-display text-white mb-2 uppercase">
                  {winner === "Affirmative" ? "Affirmative wins the debate" : "Negative wins the debate"}
                </h2>

                <p className="text-xs md:text-sm text-slate-400 max-w-xl mx-auto leading-relaxed mb-5">
                  The Chief Judge panel evaluated the logic construction, rebuttals, and practical validities, declaring the {winner} team as the victor of this Lincoln-Douglas round.
                </p>

                {/* Scorecard visualization */}
                <div className="grid grid-cols-3 gap-3 max-w-md mx-auto pt-3 border-t border-slate-900">
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Consistency</span>
                    <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800/80">
                      <div className={`h-full ${winner === "Affirmative" ? "bg-cyan-500 w-[85%]" : "bg-rose-500 w-[78%]"}`} />
                    </div>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Rebuttal</span>
                    <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800/80">
                      <div className={`h-full ${winner === "Affirmative" ? "bg-cyan-500 w-[78%]" : "bg-rose-500 w-[88%]"}`} />
                    </div>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Validity</span>
                    <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800/80">
                      <div className={`h-full ${winner === "Affirmative" ? "bg-cyan-500 w-[82%]" : "bg-rose-500 w-[80%]"}`} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Speeches Feed */}
            <div className="flex flex-col gap-6">
              {messages.map((msg) => {
                if (msg.role === "Timekeeper") {
                  return (
                    <div key={msg.id} className="flex justify-center my-2 animate-[fadeIn_0.3s_ease-out]">
                      <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-amber-500/20 bg-amber-500/5 text-amber-400 text-xs font-semibold tracking-wide shadow-md shadow-amber-950/10">
                        <span className="animate-pulse shrink-0">🔔</span>
                        <span className="text-slate-300 font-medium">{msg.content.replace("🔔", "").trim()}</span>
                      </div>
                    </div>
                  );
                }

                const isStreaming = currentSpeaker === msg.role && msg.content === "";

                // Specific alignments & styles
                if (msg.role === "Moderator") {
                  return (
                    <div key={msg.id} className="w-full border border-emerald-500/10 bg-emerald-500/[0.03] p-5 rounded-2xl flex gap-4 items-start shadow-md animate-[fadeIn_0.4s_ease-out]">
                      <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0 shadow">
                        <ModeratorIcon />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs uppercase font-extrabold tracking-wider text-emerald-400 font-display">Moderator</span>
                          {currentSpeaker === "Moderator" && (
                            <span className="px-1.5 py-0.5 rounded text-[8px] bg-emerald-500/20 text-emerald-300 font-bold uppercase animate-pulse border border-emerald-500/20">Speaking</span>
                          )}
                        </div>
                        <div className="text-slate-300 text-sm md:text-base leading-relaxed">{renderMarkdown(msg.content)}</div>
                      </div>
                    </div>
                  );
                }

                if (msg.role === "Judge") {
                  return (
                    <div key={msg.id} className="w-full border border-violet-500/15 bg-violet-500/[0.03] p-5 md:p-6 rounded-2xl flex gap-4 items-start shadow-lg animate-[fadeIn_0.5s_ease-out]">
                      <div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20 shrink-0 shadow">
                        <JudgeIcon />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-xs uppercase font-extrabold tracking-wider text-violet-400 font-display">Chief Judge Panel</span>
                          {currentSpeaker === "Judge" && (
                            <span className="px-1.5 py-0.5 rounded text-[8px] bg-violet-500/20 text-violet-300 font-bold uppercase animate-pulse border border-violet-500/20">Deliberating</span>
                          )}
                        </div>
                        <div className="text-slate-300 text-sm md:text-base leading-relaxed font-sans">{renderMarkdown(msg.content)}</div>
                      </div>
                    </div>
                  );
                }

                const isAff = msg.role.includes("Affirmative");
                const isNeg = msg.role.includes("Negative");

                return (
                  <div
                    key={msg.id}
                    className={`flex gap-3 max-w-[85%] animate-[fadeIn_0.3s_ease-out] ${isAff ? "self-start flex-row" : "self-end flex-row-reverse"
                      }`}
                  >
                    {/* Avatar */}
                    <div className={`p-2.5 h-10 w-10 shrink-0 rounded-xl flex items-center justify-center shadow-md border ${isAff
                        ? "bg-cyan-500/10 border-cyan-500/20 text-cyan-400"
                        : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                      }`}>
                      {isAff ? <AffirmativeIcon /> : <NegativeIcon />}
                    </div>

                    {/* Speech Content Card */}
                    <div className={`flex flex-col ${isAff ? "items-start" : "items-end"}`}>
                      <div className="flex items-center gap-2 mb-1.5">
                        {isNeg && currentSpeaker === msg.role && (
                          <span className="px-1.5 py-0.5 rounded text-[8px] bg-rose-500/20 text-rose-300 font-bold uppercase animate-pulse border border-rose-500/20">Streaming</span>
                        )}
                        <span className={`text-[10px] font-extrabold tracking-wider uppercase font-display ${isAff ? "text-cyan-400" : "text-rose-400"
                          }`}>
                          {msg.role}
                        </span>
                        {isAff && currentSpeaker === msg.role && (
                          <span className="px-1.5 py-0.5 rounded text-[8px] bg-cyan-500/20 text-cyan-300 font-bold uppercase animate-pulse border border-cyan-500/20">Streaming</span>
                        )}
                      </div>
                      <div className={`p-4 rounded-2xl text-slate-200 text-sm md:text-base leading-relaxed border ${isAff
                          ? "rounded-tl-none bg-slate-900/40 border-cyan-500/10 hover:border-cyan-500/20"
                          : "rounded-tr-none bg-slate-900/40 border-rose-500/10 hover:border-rose-500/20 text-left"
                        } ${currentSpeaker === msg.role ? (isAff ? "glow-cyan" : "glow-rose") : ""}`}>
                        {msg.content === "" ? (
                          <div className="flex items-center gap-1.5 py-1.5 px-1">
                            <span className={`w-1.5 h-1.5 rounded-full typing-dot ${isAff ? "bg-cyan-400" : "bg-rose-400"}`} />
                            <span className={`w-1.5 h-1.5 rounded-full typing-dot ${isAff ? "bg-cyan-400" : "bg-rose-400"}`} />
                            <span className={`w-1.5 h-1.5 rounded-full typing-dot ${isAff ? "bg-cyan-400" : "bg-rose-400"}`} />
                          </div>
                        ) : (
                          <div className="space-y-1">{renderMarkdown(msg.content)}</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Active streaming text indicator at very bottom */}
            {isDebating && currentSpeaker && (
              <div className="flex items-center justify-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-4 py-2 border-t border-slate-900 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
                <span>AI {currentSpeaker} is compiling speech arguments...</span>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/40 py-5 text-center text-slate-600 text-xs font-semibold tracking-wide uppercase">
        <span>Formal AI Debate Arena &bull; Next.js 16 &bull; Tailwind CSS v4</span>
      </footer>
    </div>
  );
}