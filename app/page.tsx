"use client";
import { useState } from "react";

type Message = {
  id: string;
  role: "Proponent" | "Critic" | "Judge";
  content: string;
};

// System Prompts
const PROPONENT_PROMPT = "You are the Proponent. You advocate fiercely for flexible, modern robotics and AI integration. Keep responses under 3 sentences to keep the debate punchy.";
const CRITIC_PROMPT = "You are the Critic. You advocate for traditional, rugged industrial engineering methods and maintain skepticism of AI hype. Keep responses under 3 sentences.";
const JUDGE_PROMPT = "You are an expert, neutral Judge. Evaluate the transcript based on logical consistency, directness of rebuttals, and engineering validity. Start your response with 'WINNER: [Proponent or Critic]' followed by a breakdown. Do not declare a tie.";

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

export default function DebateArena() {
  const [topic, setTopic] = useState("For a factory floor, is it more efficient to use versatile cobots like the UR3, or traditional, purpose-built fixed automation machinery?");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isDebating, setIsDebating] = useState(false);

  // Helper function to handle the streaming fetch
  const fetchStream = async (payload: any, role: Message["role"]) => {
    // Add a placeholder message to the UI
    const messageId = Date.now().toString();
    setMessages((prev) => [...prev, { id: messageId, role, content: "" }]);

    const res = await fetch("/api/debate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.body) return "";

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = "";

    // Read the stream chunk by chunk
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      fullResponse += chunk;

      // Update the UI instantly
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, content: fullResponse } : msg
        )
      );
    }
    
    return fullResponse;
  };

  const startDebate = async () => {
    setIsDebating(true);
    setMessages([]);
    
    // We will build the memory arrays just like the terminal script
    const memoryA: {role: string, content: string}[] = [{ role: "user", content: `Start the debate. Make your opening statement on: ${topic}` }];
    const memoryB: {role: string, content: string}[] = [];
    const fullTranscript: string[] = [];

    // ROUND 1: Proponent
    const replyA = await fetchStream({
      model: "gpt-4o-mini",
      systemPrompt: PROPONENT_PROMPT,
      messages: memoryA,
      isJudge: false
    }, "Proponent");
    
    memoryA.push({ role: "assistant", content: replyA });
    memoryB.push({ role: "user", content: replyA });
    fullTranscript.push(`Proponent: ${replyA}`);

    await delay(3000); // Protect API rate limit

    // ROUND 1: Critic
    const replyB = await fetchStream({
      model: "gpt-4o-mini",
      systemPrompt: CRITIC_PROMPT,
      messages: memoryB,
      isJudge: false
    }, "Critic");

    fullTranscript.push(`Critic: ${replyB}`);

    await delay(3000); // Protect API rate limit

    // THE JUDGE
    await fetchStream({
      model: "gpt-4o", // The heavy model
      systemPrompt: JUDGE_PROMPT,
      messages: [{ role: "user", content: `Here is the transcript for the topic: "${topic}"\n\n${fullTranscript.join("\n\n")}` }],
      isJudge: true
    }, "Judge");

    setIsDebating(false);
  };

  return (
    <div className="min-h-screen bg-base-200 p-8 flex flex-col items-center">
      <h1 className="text-4xl font-bold mb-8 text-base-content">AI Multi-Agent Debate Arena</h1>
      
      <div className="w-full max-w-4xl flex gap-4 mb-8">
        <input 
          type="text" 
          className="input input-bordered flex-1"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        />
        <button 
          className="btn btn-primary" 
          onClick={startDebate}
          disabled={isDebating}
        >
          {isDebating ? <span className="loading loading-spinner"></span> : "Start Streaming"}
        </button>
      </div>

      <div className="w-full max-w-4xl bg-base-100 p-6 rounded-box shadow-xl min-h-[600px] flex flex-col gap-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`chat ${msg.role === "Proponent" ? "chat-start" : msg.role === "Critic" ? "chat-end" : "chat-center mt-8"}`}>
            <div className="chat-header mb-1 opacity-70 font-bold">
              {msg.role}
            </div>
            <div className={`chat-bubble whitespace-pre-wrap ${
              msg.role === "Proponent" ? "chat-bubble-info" : 
              msg.role === "Critic" ? "chat-bubble-warning text-warning-content" : 
              "chat-bubble-secondary w-full max-w-3xl"
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}