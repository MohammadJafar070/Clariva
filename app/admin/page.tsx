"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { IEntry } from "@/lib/models/entry";
import ClarivaLogo from "../components/ClarivaLogo";

interface Conversation {
  _id: string;
  question: string;
  answer: string;
  confidence: "high" | "low" | "none";
  createdAt: string;
}
interface EditForm {
  _id: string;
  question: string;
  answer: string;
  category: string;
}

export default function AdminPage() {
  const [entries, setEntries] = useState<IEntry[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"knowledge" | "conversations">(
    "knowledge",
  );
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);
  const [editingEntry, setEditingEntry] = useState<EditForm | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    question: "",
    answer: "",
    category: "General",
  });

  const categories = [
    "General",
    "Refunds",
    "Shipping",
    "Account",
    "Billing",
    "Technical",
    "Auto-generated",
  ];

  useEffect(() => {
    fetchEntries();
    fetchConversations();
  }, []);

  const fetchEntries = async () => {
    const res = await fetch("/api/knowledge", { cache: "no-store" });
    const data = await res.json();
    setEntries(data);
  };

  const fetchConversations = async () => {
    const res = await fetch("/api/conversations", { cache: "no-store" });
    const data = await res.json();
    setConversations(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/knowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setForm({ question: "", answer: "", category: "General" });
      await fetchEntries();
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this entry?")) return;
    const res = await fetch(`/api/knowledge/${id}`, { method: "DELETE" });
    if (res.ok) {
      setEntries((prev) => prev.filter((e) => e._id.toString() !== id));
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry) return;
    setLoading(true);

    const res = await fetch(`/api/knowledge/${editingEntry._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: editingEntry.question,
        answer: editingEntry.answer,
        category: editingEntry.category,
      }),
    });

    if (res.ok) {
      const updated = await res.json();
      setEntries((prev) =>
        prev.map((e) => (e._id.toString() === editingEntry._id ? updated : e)),
      );
      setEditingEntry(null);
    }
    setLoading(false);
  };

  // CSV Import
  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);

    const text = await file.text();
    const lines = text.split("\n").filter(Boolean);

    // Skip header row
    const rows = lines.slice(1);
    let successCount = 0;

    for (const row of rows) {
      // Handle CSV with commas inside quotes
      const cols = row.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
      const question = cols[0]?.replace(/"/g, "").trim();
      const answer = cols[1]?.replace(/"/g, "").trim();
      const category = cols[2]?.replace(/"/g, "").trim() || "General";

      if (question && answer) {
        const res = await fetch("/api/knowledge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question, answer, category }),
        });
        if (res.ok) successCount++;
      }
    }

    await fetchEntries();
    setImporting(false);
    alert(`✅ Imported ${successCount} entries successfully!`);

    // Reset file input
    if (fileRef.current) fileRef.current.value = "";
  };

  // Download CSV template
  const downloadTemplate = () => {
    const csv = `question,answer,category
"What is your refund policy?","We offer a 30-day money back guarantee.","Refunds"
"How long does shipping take?","Standard shipping takes 5-7 business days.","Shipping"`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "knowledge-base-template.csv";
    a.click();
  };

  // Export entries as CSV
  const exportCSV = () => {
    const header = "question,answer,category";
    const rows = entries.map(
      (e) => `"${e.question}","${e.answer}","${e.category}"`,
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "knowledge-base.csv";
    a.click();
  };

  const confidenceConfig = {
    high: { color: "text-emerald-400", bg: "bg-emerald-400/10", label: "High" },
    low: { color: "text-amber-400", bg: "bg-amber-400/10", label: "Low" },
    none: { color: "text-red-400", bg: "bg-red-400/10", label: "None" },
  };

  // Filter + search entries
  const filteredEntries = entries.filter((e) => {
    const matchesFilter = filter === "All" || e.category === filter;
    const matchesSearch =
      search === "" ||
      e.question.toLowerCase().includes(search.toLowerCase()) ||
      e.answer.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex">
      {/* Gradient blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-violet-600/15 rounded-full blur-3xl" />
        <div className="absolute top-20 right-20 w-72 h-72 bg-pink-600/10 rounded-full blur-3xl" />
      </div>

      {/* Edit Modal */}
      {editingEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#13131f] border border-white/10 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-sm text-white/80">
                Edit Entry
              </h2>
              <button
                onClick={() => setEditingEntry(null)}
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <label className="text-xs text-white/25 mb-1.5 block">
                  Category
                </label>
                <select
                  value={editingEntry.category}
                  onChange={(e) =>
                    setEditingEntry({
                      ...editingEntry,
                      category: e.target.value,
                    })
                  }
                  className="w-full bg-white/5 border border-white/8 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-500/50 transition"
                >
                  {categories.map((c) => (
                    <option key={c} value={c} className="bg-[#1a1a24]">
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-white/25 mb-1.5 block">
                  Question
                </label>
                <input
                  type="text"
                  value={editingEntry.question}
                  onChange={(e) =>
                    setEditingEntry({
                      ...editingEntry,
                      question: e.target.value,
                    })
                  }
                  className="w-full bg-white/5 border border-white/8 text-white placeholder-white/15 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-500/50 transition"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-white/25 mb-1.5 block">
                  Answer
                </label>
                <textarea
                  value={editingEntry.answer}
                  onChange={(e) =>
                    setEditingEntry({ ...editingEntry, answer: e.target.value })
                  }
                  className="w-full bg-white/5 border border-white/8 text-white placeholder-white/15 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-500/50 transition h-32 resize-none"
                  required
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingEntry(null)}
                  className="flex-1 bg-white/5 hover:bg-white/8 text-white/50 py-2.5 rounded-xl text-sm font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 disabled:opacity-40 text-white py-2.5 rounded-xl text-sm font-medium transition shadow-lg shadow-violet-500/20"
                >
                  {loading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside className="relative z-10 w-64 shrink-0 border-r border-white/5 flex flex-col bg-white/[0.02] h-screen sticky top-0">
        <div className="px-5 py-5 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <ClarivaLogo size={32} />
            <span className="font-semibold text-sm bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">
              Clariva
            </span>
          </div>
        </div>

        <div className="px-4 py-4">
          <Link
            href="/chat"
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
          </Link>
        </div>

        <nav className="px-3 space-y-1">
          {[
            {
              key: "knowledge",
              label: "Knowledge Base",
              count: entries.length,
              countColor: "bg-violet-500/20 text-violet-400",
            },
            {
              key: "conversations",
              label: "Conversations",
              count: conversations.length,
              countColor: "bg-pink-500/20 text-pink-400",
            },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() =>
                setActiveTab(item.key as "knowledge" | "conversations")
              }
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                activeTab === item.key
                  ? "bg-white/8 text-white border border-white/8"
                  : "text-white/40 hover:text-white/70 hover:bg-white/5"
              }`}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {item.key === "knowledge" ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                  />
                )}
              </svg>
              {item.label}
              <span
                className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-md ${item.countColor}`}
              >
                {item.count}
              </span>
            </button>
          ))}
        </nav>

        <div className="mt-auto px-3 py-4 border-t border-white/5 space-y-1">
          <Link
            href="/admin/analytics"
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs text-white/25 hover:text-white/50 hover:bg-white/5 transition-all"
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
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            Analytics
          </Link>
        </div>
      </aside>

      {/* Main */}
      <div className="relative z-10 flex-1 flex flex-col min-h-screen overflow-y-auto">
        {/* Header */}
        <header className="sticky top-0 z-20 border-b border-white/5 px-8 py-4 backdrop-blur-sm bg-[#0a0a0f]/80 flex items-center justify-between">
          <div>
            <h1 className="font-semibold text-sm">
              {activeTab === "knowledge" ? "Knowledge Base" : "Conversations"}
            </h1>
            <p className="text-xs text-white/25 mt-0.5">
              {activeTab === "knowledge"
                ? `${filteredEntries.length} of ${entries.length} entries`
                : `${conversations.length} total conversations`}
            </p>
          </div>

          {/* Header actions */}
          {activeTab === "knowledge" && (
            <div className="flex items-center gap-2">
              <button
                onClick={exportCSV}
                className="text-xs text-white/30 hover:text-white/60 bg-white/5 hover:bg-white/8 border border-white/5 px-3 py-2 rounded-lg transition flex items-center gap-1.5"
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
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                Export
              </button>
              <button
                onClick={downloadTemplate}
                className="text-xs text-white/30 hover:text-white/60 bg-white/5 hover:bg-white/8 border border-white/5 px-3 py-2 rounded-lg transition flex items-center gap-1.5"
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
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Template
              </button>
              <label className="text-xs text-white/30 hover:text-white/60 bg-white/5 hover:bg-white/8 border border-white/5 px-3 py-2 rounded-lg transition flex items-center gap-1.5 cursor-pointer">
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
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                  />
                </svg>
                {importing ? "Importing..." : "Import CSV"}
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleCSVImport}
                />
              </label>
            </div>
          )}
        </header>

        <div className="p-8 flex-1">
          {/* Knowledge Base Tab */}
          {activeTab === "knowledge" && (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
              {/* Form */}
              <div className="lg:col-span-2">
                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 sticky top-24">
                  <h2 className="font-semibold text-sm mb-5 text-white/70">
                    Add New Entry
                  </h2>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="text-xs text-white/25 mb-1.5 block">
                        Category
                      </label>
                      <select
                        value={form.category}
                        onChange={(e) =>
                          setForm({ ...form, category: e.target.value })
                        }
                        className="w-full bg-white/5 border border-white/8 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-500/50 transition"
                      >
                        {categories
                          .filter((c) => c !== "Auto-generated")
                          .map((c) => (
                            <option key={c} value={c} className="bg-[#1a1a24]">
                              {c}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-white/25 mb-1.5 block">
                        Question
                      </label>
                      <input
                        type="text"
                        value={form.question}
                        onChange={(e) =>
                          setForm({ ...form, question: e.target.value })
                        }
                        className="w-full bg-white/5 border border-white/8 text-white placeholder-white/15 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-500/50 transition"
                        placeholder="e.g. What is your refund policy?"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs text-white/25 mb-1.5 block">
                        Answer
                      </label>
                      <textarea
                        value={form.answer}
                        onChange={(e) =>
                          setForm({ ...form, answer: e.target.value })
                        }
                        className="w-full bg-white/5 border border-white/8 text-white placeholder-white/15 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-500/50 transition h-32 resize-none"
                        placeholder="e.g. We offer a 30-day money back guarantee..."
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 disabled:opacity-40 text-white py-2.5 rounded-xl text-sm font-medium transition shadow-lg shadow-violet-500/20"
                    >
                      {loading ? "Adding..." : "Add Entry"}
                    </button>
                  </form>
                </div>
              </div>

              {/* Entries */}
              <div className="lg:col-span-3 space-y-4">
                {/* Search bar */}
                <div className="relative">
                  <svg
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search entries..."
                    className="w-full bg-white/5 border border-white/8 text-white placeholder-white/15 rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:border-violet-500/50 transition"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50 transition"
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
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Filter pills */}
                <div className="flex gap-2 flex-wrap">
                  {["All", ...categories].map((c) => (
                    <button
                      key={c}
                      onClick={() => setFilter(c)}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                        filter === c
                          ? "bg-violet-600 border-violet-600 text-white"
                          : "bg-white/5 border-white/8 text-white/30 hover:text-white/60"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>

                {/* Entries list */}
                {filteredEntries.length === 0 ? (
                  <div className="text-center py-16 text-white/15 text-sm border border-white/5 rounded-2xl">
                    {search
                      ? `No entries matching "${search}"`
                      : "No entries yet. Add your first FAQ."}
                  </div>
                ) : (
                  filteredEntries.map((entry) => (
                    <div
                      key={entry._id.toString()}
                      className="group bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 hover:border-white/8 rounded-2xl p-5 transition-all"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <span className="inline-block text-[11px] bg-violet-500/15 text-violet-400 px-2 py-0.5 rounded-full font-medium border border-violet-500/20">
                            {entry.category}
                          </span>
                          <p className="text-sm font-medium text-white/80 leading-snug">
                            {entry.question}
                          </p>
                          <p className="text-xs text-white/25 leading-relaxed line-clamp-2">
                            {entry.answer}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                          <button
                            onClick={() =>
                              setEditingEntry({
                                _id: entry._id.toString(),
                                question: entry.question,
                                answer: entry.answer,
                                category: entry.category,
                              })
                            }
                            className="p-1.5 rounded-lg text-white/20 hover:text-violet-400 hover:bg-violet-400/10 transition"
                            title="Edit"
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
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(entry._id.toString())}
                            className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-400/10 transition"
                            title="Delete"
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
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Conversations Tab */}
          {activeTab === "conversations" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-3">
                {conversations.length === 0 ? (
                  <div className="text-center py-16 text-white/15 text-sm border border-white/5 rounded-2xl">
                    No conversations yet.
                  </div>
                ) : (
                  conversations.map((conv) => (
                    <button
                      key={conv._id}
                      onClick={() => setSelectedConversation(conv)}
                      className={`w-full text-left bg-white/[0.02] hover:bg-white/[0.04] border rounded-2xl p-5 transition-all ${
                        selectedConversation?._id === conv._id
                          ? "border-violet-500/30 bg-violet-500/5"
                          : "border-white/5 hover:border-white/8"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <p className="text-sm font-medium text-white/80 leading-snug line-clamp-1">
                          {conv.question}
                        </p>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 font-medium ${confidenceConfig[conv.confidence].bg} ${confidenceConfig[conv.confidence].color}`}
                        >
                          {confidenceConfig[conv.confidence].label}
                        </span>
                      </div>
                      <p className="text-xs text-white/25 line-clamp-2 leading-relaxed">
                        {conv.answer}
                      </p>
                      <p className="text-[11px] text-white/15 mt-2">
                        {new Date(conv.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </button>
                  ))
                )}
              </div>

              <div className="sticky top-24">
                {selectedConversation ? (
                  <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 space-y-5">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-sm font-semibold text-white/80">
                        Conversation Detail
                      </h3>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${confidenceConfig[selectedConversation.confidence].bg} ${confidenceConfig[selectedConversation.confidence].color}`}
                      >
                        {
                          confidenceConfig[selectedConversation.confidence]
                            .label
                        }{" "}
                        confidence
                      </span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-white/25 uppercase tracking-widest">
                        Question
                      </p>
                      <p className="text-sm text-white/80 leading-relaxed bg-white/[0.03] rounded-xl px-4 py-3 border border-white/5">
                        {selectedConversation.question}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-white/25 uppercase tracking-widest">
                        Answer
                      </p>
                      <p className="text-sm text-white/50 leading-relaxed bg-white/[0.03] rounded-xl px-4 py-3 border border-white/5">
                        {selectedConversation.answer}
                      </p>
                    </div>
                    <p className="text-[11px] text-white/15">
                      {new Date(selectedConversation.createdAt).toLocaleString(
                        "en-IN",
                      )}
                    </p>
                  </div>
                ) : (
                  <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 flex flex-col items-center justify-center text-center min-h-48 space-y-2">
                    <svg
                      className="w-8 h-8 text-white/10"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                      />
                    </svg>
                    <p className="text-white/15 text-sm">
                      Select a conversation to view details
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
