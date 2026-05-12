"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import ClarivaLogo from "../components/ClarivaLogo";

interface Source {
  question: string;
  answer: string;
  category: string;
  score: number;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  confidence?: "high" | "low" | "none";
  answerMode?: "knowledge_base" | "hybrid" | "general";
  suggestions?: string[];
}

interface Session {
  _id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loadingStatus, setLoadingStatus] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [autoSaved, setAutoSaved] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [feedbacks, setFeedbacks] = useState<Record<number, "good" | "bad">>(
    {},
  );
  const [isListening, setIsListening] = useState(false);

  const handleFeedback = async (
    msg: Message,
    index: number,
    feedback: "good" | "bad",
  ) => {
    setFeedbacks((prev) => ({ ...prev, [index]: feedback }));
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: messages[index - 1]?.content || "",
        answer: msg.content,
        feedback,
      }),
    });
  };

  const copyToClipboard = async (text: string, index: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchSessions = async () => {
    const res = await fetch("/api/sessions");
    const data = await res.json();
    setSessions(data);
  };

  const startNewChat = () => {
    setMessages([]);
    setCurrentSessionId(null);
    setStarted(false);
    setInput("");
  };

  const loadSession = async (sessionId: string) => {
    const res = await fetch(`/api/sessions/${sessionId}`);
    const data = await res.json();
    setMessages(data.messages);
    setCurrentSessionId(sessionId);
    setStarted(true);
  };

  const deleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
    setSessions((prev) => prev.filter((s) => s._id !== sessionId));
    if (currentSessionId === sessionId) {
      startNewChat();
    }
  };

  const saveSession = async (
    updatedMessages: Message[],
    sessionId: string | null,
  ) => {
    const firstUserMsg = updatedMessages.find((m) => m.role === "user");
    const title = firstUserMsg
      ? firstUserMsg.content.slice(0, 40) +
        (firstUserMsg.content.length > 40 ? "..." : "")
      : "New Chat";

    if (sessionId) {
      await fetch(`/api/sessions/${sessionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedMessages, title }),
      });
    } else {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, messages: updatedMessages }),
      });
      const data = await res.json();
      setCurrentSessionId(data._id);
      await fetchSessions();
      return data._id;
    }
    await fetchSessions();
    return sessionId;
  };

  const handleSend = async (
    e: React.FormEvent | null,
    overrideInput?: string,
  ) => {
    if (e) e.preventDefault();
    const question = (overrideInput || input).trim();
    if (!question || loading) return;

    setStarted(true);
    setInput("");
    setLoading(true);
    setLoadingStatus("Searching knowledge base...");

    const history = messages
      .filter((m) => m.content.trim() !== "")
      .map((m) => ({ role: m.role, content: m.content }));

    const newMessages: Message[] = [
      ...messages,
      { role: "user", content: question },
      { role: "assistant", content: "", sources: [] },
    ];

    setMessages(newMessages);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history }),
      });
      setLoadingStatus("Generating answer...");
      if (res.status === 429) {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content:
              "⚠️ Too many requests. Please wait a moment before asking again.",
          };
          return updated;
        });
        setLoading(false);
        return;
      }

      if (!res.body) return;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalMessages = [...newMessages];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);

            if (parsed.type === "sources") {
              setLoadingStatus("Streaming response...");
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  sources: parsed.data,
                  confidence: parsed.confidence,
                  answerMode: parsed.answerMode,
                };
                finalMessages = updated;
                return updated;
              });
            } else if (parsed.type === "text") {
              setLoadingStatus("");
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  content: updated[updated.length - 1].content + parsed.data,
                };
                finalMessages = updated;
                return updated;
              });
            } else if (parsed.type === "auto_saved") {
              setAutoSaved(parsed.data.question);
              setTimeout(() => setAutoSaved(null), 4000);
            } else if (parsed.type === "suggestions") {
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  suggestions: parsed.data,
                };
                return updated;
              });
            }
          } catch {}
        }
      }

      await saveSession(finalMessages, currentSessionId);
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          content: "Something went wrong. Please try again.",
        };
        return updated;
      });
    } finally {
      setLoading(false);
      setLoadingStatus("");
    }
  };

  const suggestions = [
    "What is your refund policy?",
    "How long does shipping take?",
    "How do I track my order?",
    "What payment methods do you accept?",
  ];

  const answerModeConfig = {
    knowledge_base: {
      color: "text-emerald-400",
      bg: "bg-emerald-400/10",
      border: "border-emerald-400/20",
      label: "Knowledge Base",
    },
    hybrid: {
      color: "text-amber-400",
      bg: "bg-amber-400/10",
      border: "border-amber-400/20",
      label: "KB + AI",
    },
    general: {
      color: "text-blue-400",
      bg: "bg-blue-400/10",
      border: "border-blue-400/20",
      label: "AI General",
    },
  };

  const groupSessionsByDate = (sessions: Session[]) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const groups: { label: string; items: Session[] }[] = [
      { label: "Today", items: [] },
      { label: "Yesterday", items: [] },
      { label: "Previous", items: [] },
    ];

    const safeSessions = Array.isArray(sessions) ? sessions : [];

    safeSessions.forEach((s) => {
      const date = new Date(s.updatedAt);

      if (date.toDateString() === today.toDateString()) {
        groups[0].items.push(s);
      } else if (date.toDateString() === yesterday.toDateString()) {
        groups[1].items.push(s);
      } else {
        groups[2].items.push(s);
      }
    });

    return groups.filter((g) => g.items.length > 0);
  };

  const startVoiceInput = () => {
    if (
      !("webkitSpeechRecognition" in window || "SpeechRecognition" in window)
    ) {
      alert("Voice input not supported in this browser. Try Chrome.");
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
    };

    recognition.onerror = () => setIsListening(false);
    recognition.start();
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex">
      {/* Gradient blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl" />
        <div className="absolute -top-20 right-20 w-72 h-72 bg-pink-600/15 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-1/3 w-80 h-80 bg-cyan-600/10 rounded-full blur-3xl" />
      </div>

      {/* Sidebar */}
      {sidebarOpen && (
        <aside className="relative z-10 w-64 shrink-0 flex flex-col bg-white/[0.02] border-r border-white/5 h-screen sticky top-0">
          {/* Logo + collapse */}
          <div className="flex items-center justify-between px-4 py-4 border-b border-white/5">
            <div className="flex items-center gap-2">
              <ClarivaLogo size={28} />
              <span className="text-sm font-semibold bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">
                Clariva
              </span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-white/20 hover:text-white/50 transition p-1 rounded-lg hover:bg-white/5"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                />
              </svg>
            </button>
          </div>

          {/* New chat button */}
          <div className="px-3 py-3">
            <button
              onClick={startNewChat}
              className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white text-xs font-medium px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-violet-500/20"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              New Chat
            </button>
          </div>

          {/* Chat history */}
          <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-4">
            {sessions.length === 0 ? (
              <p className="text-center text-white/15 text-xs py-8">
                No conversations yet
              </p>
            ) : (
              groupSessionsByDate(sessions).map((group) => (
                <div key={group.label}>
                  <p className="text-[10px] text-white/20 uppercase tracking-widest font-medium px-2 mb-1.5">
                    {group.label}
                  </p>
                  <div className="space-y-0.5">
                    {group.items.map((session) => (
                      <div
                        key={session._id}
                        onClick={() => loadSession(session._id)}
                        className={`group w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-left transition-all cursor-pointer ${
                          currentSessionId === session._id
                            ? "bg-white/8 text-white/80"
                            : "text-white/30 hover:text-white/60 hover:bg-white/5"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <svg
                            className="w-3.5 h-3.5 shrink-0 opacity-50"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                            />
                          </svg>

                          <span className="text-[12px] truncate">
                            {session.title}
                          </span>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSession(e, session._id);
                          }}
                          className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 transition-all shrink-0 p-0.5 rounded"
                        >
                          <svg
                            className="w-3 h-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Bottom */}
          <div className="px-3 py-3 border-t border-white/5">
            <Link
              href="/admin"
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-white/25 hover:text-white/50 hover:bg-white/5 transition-all"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              Admin Panel
            </Link>
          </div>
        </aside>
      )}

      {/* Main chat */}
      <div className="relative z-10 flex-1 flex flex-col min-h-screen">
        {/* Header */}
        <header className="flex items-center gap-3 px-6 py-4 border-b border-white/5 backdrop-blur-sm">
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-white/20 hover:text-white/50 transition p-1.5 rounded-lg hover:bg-white/5"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 5l7 7-7 7M5 5l7 7-7 7"
                />
              </svg>
            </button>
          )}
          {!sidebarOpen && (
            <button
              onClick={startNewChat}
              className="text-white/20 hover:text-white/50 transition p-1.5 rounded-lg hover:bg-white/5"
              title="New Chat"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </button>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <p className="text-white/30 text-xs">Always online</p>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full px-6">
          {/* Hero */}
          {!started && (
            <div className="flex-1 flex flex-col items-center justify-center py-16 space-y-8">
              <div className="text-center space-y-3">
                <div className="mx-auto">
                  <ClarivaLogo size={64} />
                </div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
                  Ask Clariva anything
                </h1>
                <p className="text-white/30 text-sm">
                  Intelligent answers from our knowledge base + AI
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 w-full max-w-lg">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(null, s)}
                    className="text-left text-xs text-white/50 hover:text-white/90 bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 hover:border-violet-500/30 px-4 py-3 rounded-xl transition-all duration-200 leading-relaxed"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {started && (
            <div className="flex-1 overflow-y-auto py-8 space-y-8">
              {messages.map((msg, i) => (
                <div key={i}>
                  {msg.role === "user" ? (
                    <div className="flex justify-end">
                      <div className="max-w-[80%] bg-gradient-to-br from-violet-600 to-violet-700 px-4 py-3 rounded-2xl rounded-tr-sm text-sm leading-relaxed shadow-lg shadow-violet-500/20">
                        {msg.content}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {msg.content && (
                        <div className="flex items-center gap-2">
                          {msg.answerMode && (
                            <div
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium ${answerModeConfig[msg.answerMode].bg} ${answerModeConfig[msg.answerMode].border} ${answerModeConfig[msg.answerMode].color}`}
                            >
                              <div
                                className={`w-1 h-1 rounded-full ${answerModeConfig[msg.answerMode].color.replace("text-", "bg-")}`}
                              />
                              {answerModeConfig[msg.answerMode].label}
                            </div>
                          )}
                          <button
                            onClick={() => copyToClipboard(msg.content, i)}
                            className="flex items-center gap-1 text-[11px] text-white/20 hover:text-white/50 transition px-2 py-1 rounded-lg hover:bg-white/5"
                          >
                            {copiedIndex === i ? (
                              <>
                                <svg
                                  className="w-3 h-3 text-emerald-400"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                                <span className="text-emerald-400">
                                  Copied!
                                </span>
                              </>
                            ) : (
                              <>
                                <svg
                                  className="w-3 h-3"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                  />
                                </svg>
                                Copy
                              </>
                            )}
                          </button>
                          {!loading && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleFeedback(msg, i, "good")}
                                className={`p-1.5 rounded-lg transition ${feedbacks[i] === "good" ? "text-emerald-400 bg-emerald-400/10" : "text-white/15 hover:text-white/40 hover:bg-white/5"}`}
                              >
                                <svg
                                  className="w-3.5 h-3.5"
                                  fill={
                                    feedbacks[i] === "good"
                                      ? "currentColor"
                                      : "none"
                                  }
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"
                                  />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleFeedback(msg, i, "bad")}
                                className={`p-1.5 rounded-lg transition ${feedbacks[i] === "bad" ? "text-red-400 bg-red-400/10" : "text-white/15 hover:text-white/40 hover:bg-white/5"}`}
                              >
                                <svg
                                  className="w-3.5 h-3.5"
                                  fill={
                                    feedbacks[i] === "bad"
                                      ? "currentColor"
                                      : "none"
                                  }
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5"
                                  />
                                </svg>
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Answer text with markdown */}
                      <div className="text-sm leading-relaxed text-white/85 prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            p: ({ children }) => (
                              <p className="mb-2 last:mb-0 text-white/85 leading-relaxed">
                                {children}
                              </p>
                            ),
                            strong: ({ children }) => (
                              <strong className="text-white font-semibold">
                                {children}
                              </strong>
                            ),
                            ul: ({ children }) => (
                              <ul className="list-disc list-inside space-y-1 mb-2 text-white/70">
                                {children}
                              </ul>
                            ),
                            ol: ({ children }) => (
                              <ol className="list-decimal list-inside space-y-1 mb-2 text-white/70">
                                {children}
                              </ol>
                            ),
                            li: ({ children }) => (
                              <li className="text-white/70 text-sm">
                                {children}
                              </li>
                            ),
                            code: ({ children }) => (
                              <code className="bg-white/10 text-violet-300 px-1.5 py-0.5 rounded text-xs font-mono">
                                {children}
                              </code>
                            ),
                            pre: ({ children }) => (
                              <pre className="bg-white/5 border border-white/10 rounded-xl p-4 overflow-x-auto mb-2 text-xs font-mono text-white/70">
                                {children}
                              </pre>
                            ),
                            h1: ({ children }) => (
                              <h1 className="text-base font-bold text-white mb-2">
                                {children}
                              </h1>
                            ),
                            h2: ({ children }) => (
                              <h2 className="text-sm font-bold text-white mb-2">
                                {children}
                              </h2>
                            ),
                            h3: ({ children }) => (
                              <h3 className="text-sm font-semibold text-white/90 mb-1">
                                {children}
                              </h3>
                            ),
                            a: ({ href, children }) => (
                              <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-violet-400 hover:text-violet-300 underline transition"
                              >
                                {children}
                              </a>
                            ),
                            blockquote: ({ children }) => (
                              <blockquote className="border-l-2 border-violet-500/50 pl-3 text-white/50 italic mb-2">
                                {children}
                              </blockquote>
                            ),
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>

                      {/* Sources */}
                      {msg.sources && msg.sources.length > 0 && (
                        <details className="group">
                          <summary className="text-[11px] text-white/20 hover:text-white/50 cursor-pointer list-none flex items-center gap-1.5 transition">
                            <svg
                              className="w-3 h-3 transition-transform group-open:rotate-90"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5l7 7-7 7"
                              />
                            </svg>
                            {msg.sources.length} source
                            {msg.sources.length > 1 ? "s" : ""}
                          </summary>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {msg.sources.map((source, j) => (
                              <div
                                key={j}
                                className="flex items-center gap-1.5 bg-white/[0.03] border border-white/5 rounded-lg px-3 py-1.5"
                              >
                                <div className="w-1 h-1 rounded-full bg-violet-400 shrink-0" />
                                <span className="text-[11px] text-white/40">
                                  {source.question}
                                </span>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}

                      {/* Suggestions */}
                      {msg.suggestions && msg.suggestions.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {msg.suggestions.map((s, j) => (
                            <button
                              key={j}
                              onClick={() => handleSend(null, s)}
                              className="text-[11px] text-violet-400 hover:text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 hover:border-violet-500/30 px-3 py-1.5 rounded-xl transition-all"
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      )}

                      {i < messages.length - 1 && (
                        <div className="border-b border-white/5 mt-4" />
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Loading indicator — ONLY HERE, after all messages */}
              {loading && messages[messages.length - 1]?.content === "" && (
                <div className="flex gap-3 justify-start">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shrink-0">
                    <svg
                      className="w-3.5 h-3.5 text-white"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
                    </svg>
                  </div>
                  <div className="bg-white/5 border border-white/5 rounded-2xl rounded-tl-sm px-4 py-3 space-y-1.5">
                    <div className="flex gap-1 items-center">
                      <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 bg-pink-400 rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce [animation-delay:300ms]" />
                    </div>
                    {loadingStatus && (
                      <p className="text-[11px] text-white/25 animate-pulse">
                        {loadingStatus}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          )}

          {/* Auto saved */}
          {autoSaved && (
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2.5 text-xs text-emerald-400 mb-3">
              <svg
                className="w-3.5 h-3.5 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Auto-saved: <span className="font-medium">"{autoSaved}"</span>
            </div>
          )}

          {/* Input */}
          <div className="py-5">
            <form onSubmit={handleSend} className="flex gap-2 items-center">
              <div className="flex-1 relative">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask anything..."
                  disabled={loading}
                  className="w-full bg-white/[0.05] border border-white/10 hover:border-white/15 focus:border-violet-500/50 text-white placeholder-white/20 rounded-2xl px-5 py-4 pr-14 text-sm outline-none transition-all disabled:opacity-40"
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-gradient-to-br from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl flex items-center justify-center transition-all shadow-lg shadow-violet-500/25"
                >
                  <svg
                    className="w-3.5 h-3.5 text-white "
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                </button>
              </div>

              <button
                type="button"
                onClick={startVoiceInput}
                disabled={loading}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shrink-0 ${
                  isListening
                    ? "bg-red-500/20 border border-red-500/40 text-red-400 animate-pulse"
                    : "bg-white/5 border border-white/10 text-white/30 hover:text-white/60 hover:bg-white/8"
                }`}
                title={isListening ? "Listening..." : "Voice input"}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                  />
                </svg>
              </button>
            </form>
            <p className="text-center text-white/15 text-[11px] mt-3">
              Clariva · Intelligent knowledge assistant
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
