"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface DayData {
  _id: string;
  count: number;
  high: number;
  low: number;
  none: number;
}

interface TopQuestion {
  _id: string;
  count: number;
  confidence: "high" | "low" | "none";
}

interface CategoryData {
  _id: string;
  count: number;
}

interface HourData {
  _id: number;
  count: number;
}

interface Unanswered {
  _id: string;
  question: string;
  createdAt: string;
}

interface AnalyticsData {
  total: number;
  allTime: number;
  answerRate: number;
  confidence: { high: number; low: number; none: number };
  perDay: DayData[];
  topQuestions: TopQuestion[];
  categoryBreakdown: CategoryData[];
  unanswered: Unanswered[];
  hourly: HourData[];
  range: string;
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("7");

  useEffect(() => {
    fetchAnalytics();
  }, [range]);

  const fetchAnalytics = async () => {
    setLoading(true);
    const res = await fetch(`/api/analytics?range=${range}`);
    const d = await res.json();
    setData(d);
    setLoading(false);
  };

  const exportCSV = () => {
    if (!data) return;

    const rows = [
      ["Metric", "Value"],
      ["Total Questions", data.total],
      ["Answer Rate", `${data.answerRate}%`],
      ["High Confidence", data.confidence.high],
      ["Low Confidence", data.confidence.low],
      ["Unanswered", data.confidence.none],
      [],
      ["Date", "Total", "High", "Low", "None"],
      ...data.perDay.map((d) => [d._id, d.count, d.high, d.low, d.none]),
      [],
      ["Top Questions", "Count", "Confidence"],
      ...data.topQuestions.map((q) => [q._id, q.count, q.confidence]),
    ];

    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-${range}days.csv`;
    a.click();
  };

  const confidenceColors = {
    high: {
      text: "text-emerald-400",
      bg: "bg-emerald-400",
      light: "bg-emerald-400/10",
      border: "border-emerald-400/20",
    },
    low: {
      text: "text-amber-400",
      bg: "bg-amber-400",
      light: "bg-amber-400/10",
      border: "border-amber-400/20",
    },
    none: {
      text: "text-red-400",
      bg: "bg-red-400",
      light: "bg-red-400/10",
      border: "border-red-400/20",
    },
  };

  const categoryColors = [
    "bg-violet-500",
    "bg-pink-500",
    "bg-cyan-500",
    "bg-amber-500",
    "bg-emerald-500",
    "bg-blue-500",
    "bg-orange-500",
    "bg-rose-500",
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  const maxPerDay = Math.max(...data.perDay.map((d) => d.count), 1);
  const maxHourly = Math.max(...data.hourly.map((h) => h.count), 1);
  const maxCategory = Math.max(
    ...data.categoryBreakdown.map((c) => c.count),
    1,
  );

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Gradient blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-violet-600/15 rounded-full blur-3xl" />
        <div className="absolute top-20 right-20 w-72 h-72 bg-pink-600/10 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/5 px-8 py-4 flex items-center justify-between backdrop-blur-sm bg-[#0a0a0f]/80 sticky top-0">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="text-white/25 hover:text-white/60 transition text-sm flex items-center gap-1.5"
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
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Admin
          </Link>
          <span className="text-white/10">/</span>
          <span className="text-sm font-medium">CLariva Analytics</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Date range filter */}
          <div className="flex items-center gap-1 bg-white/5 border border-white/8 rounded-xl p-1">
            {[
              { label: "7D", value: "7" },
              { label: "14D", value: "14" },
              { label: "30D", value: "30" },
              { label: "90D", value: "90" },
            ].map((r) => (
              <button
                key={r.value}
                onClick={() => setRange(r.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  range === r.value
                    ? "bg-violet-600 text-white"
                    : "text-white/30 hover:text-white/60"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <button
            onClick={exportCSV}
            className="flex items-center gap-2 text-xs bg-white/5 hover:bg-white/8 border border-white/8 px-4 py-2 rounded-xl transition text-white/40 hover:text-white/70"
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
            Export CSV
          </button>
        </div>
      </header>

      <div className="relative z-10 max-w-6xl mx-auto px-8 py-8 space-y-6">
        {/* Top stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              label: "Questions",
              value: data.total,
              sub: `${data.allTime} all time`,
              color: "text-white",
              icon: (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                />
              ),
              gradient: "from-violet-500/20 to-transparent",
            },
            {
              label: "Answer Rate",
              value: `${data.answerRate}%`,
              sub: `${data.confidence.high} answered`,
              color: "text-emerald-400",
              icon: (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              ),
              gradient: "from-emerald-500/20 to-transparent",
            },
            {
              label: "Low Confidence",
              value: data.confidence.low,
              sub: "partial matches",
              color: "text-amber-400",
              icon: (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              ),
              gradient: "from-amber-500/20 to-transparent",
            },
            {
              label: "Unanswered",
              value: data.confidence.none,
              sub: "not in knowledge base",
              color: "text-red-400",
              icon: (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              ),
              gradient: "from-red-500/20 to-transparent",
            },
          ].map((stat, i) => (
            <div
              key={i}
              className={`bg-white/[0.03] border border-white/5 rounded-2xl p-5 relative overflow-hidden`}
            >
              <div
                className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-50`}
              />
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-white/30 text-xs">{stat.label}</p>
                  <svg
                    className={`w-4 h-4 ${stat.color} opacity-50`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    {stat.icon}
                  </svg>
                </div>
                <p className={`text-3xl font-bold ${stat.color}`}>
                  {stat.value}
                </p>
                <p className="text-white/20 text-xs mt-1">{stat.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Questions per day chart */}
        <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-sm font-semibold text-white/80">
                Questions Over Time
              </h2>
              <p className="text-xs text-white/25 mt-0.5">Last {range} days</p>
            </div>
            <div className="flex items-center gap-4 text-[11px]">
              {[
                { label: "High", color: "bg-emerald-400" },
                { label: "Low", color: "bg-amber-400" },
                { label: "None", color: "bg-red-400" },
              ].map((l) => (
                <div key={l.label} className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${l.color}`} />
                  <span className="text-white/30">{l.label}</span>
                </div>
              ))}
            </div>
          </div>

          {data.perDay.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-white/15 text-sm">
              No data for this period
            </div>
          ) : (
            <div className="flex items-end gap-1.5 h-40">
              {data.perDay.map((day, i) => (
                <div
                  key={i}
                  className="flex-1 flex flex-col items-center gap-1 group"
                >
                  <div
                    className="relative w-full flex flex-col-reverse gap-0.5"
                    style={{ height: "120px" }}
                  >
                    {/* Stacked bar */}
                    {[
                      { value: day.high, color: "bg-emerald-500" },
                      { value: day.low, color: "bg-amber-500" },
                      { value: day.none, color: "bg-red-500" },
                    ].map(
                      (bar, j) =>
                        bar.value > 0 && (
                          <div
                            key={j}
                            className={`w-full ${bar.color} rounded-sm transition-all duration-500 opacity-80 hover:opacity-100`}
                            style={{
                              height: `${(bar.value / maxPerDay) * 120}px`,
                              minHeight: "3px",
                            }}
                          />
                        ),
                    )}

                    {/* Tooltip */}
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#1a1a2e] border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white/70 whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none z-10">
                      {day.count} questions
                    </div>
                  </div>
                  <span className="text-[9px] text-white/20 rotate-45 origin-left mt-1">
                    {new Date(day._id).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Confidence breakdown */}
          <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-white/80 mb-5">
              Confidence Breakdown
            </h2>
            <div className="space-y-4">
              {[
                {
                  label: "High Confidence",
                  value: data.confidence.high,
                  key: "high" as const,
                },
                {
                  label: "Low Confidence",
                  value: data.confidence.low,
                  key: "low" as const,
                },
                {
                  label: "Not Answered",
                  value: data.confidence.none,
                  key: "none" as const,
                },
              ].map((item) => (
                <div key={item.key} className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${confidenceColors[item.key].bg}`}
                      />
                      <span className="text-xs text-white/50">
                        {item.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-medium ${confidenceColors[item.key].text}`}
                      >
                        {data.total > 0
                          ? Math.round((item.value / data.total) * 100)
                          : 0}
                        %
                      </span>
                      <span className="text-xs text-white/20">
                        {item.value}
                      </span>
                    </div>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${confidenceColors[item.key].bg} rounded-full transition-all duration-700`}
                      style={{
                        width:
                          data.total > 0
                            ? `${(item.value / data.total) * 100}%`
                            : "0%",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Donut-style summary */}
            <div
              className={`mt-5 p-4 rounded-xl border ${
                data.answerRate >= 70
                  ? "bg-emerald-400/5 border-emerald-400/15"
                  : data.answerRate >= 40
                    ? "bg-amber-400/5 border-amber-400/15"
                    : "bg-red-400/5 border-red-400/15"
              }`}
            >
              <p
                className={`text-2xl font-bold ${
                  data.answerRate >= 70
                    ? "text-emerald-400"
                    : data.answerRate >= 40
                      ? "text-amber-400"
                      : "text-red-400"
                }`}
              >
                {data.answerRate}%
              </p>
              <p className="text-xs text-white/25 mt-0.5">
                {data.answerRate >= 70
                  ? "Great answer rate! Knowledge base is well covered."
                  : data.answerRate >= 40
                    ? "Average answer rate. Add more FAQs to improve."
                    : "Low answer rate. Your knowledge base needs more entries."}
              </p>
            </div>
          </div>

          {/* Category breakdown */}
          <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-white/80 mb-5">
              Category Breakdown
            </h2>
            {data.categoryBreakdown.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-white/15 text-sm">
                No category data yet
              </div>
            ) : (
              <div className="space-y-3">
                {data.categoryBreakdown.map((cat, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${categoryColors[i % categoryColors.length]}`}
                        />
                        <span className="text-xs text-white/50">
                          {cat._id || "Unknown"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-white/30">
                          {Math.round((cat.count / maxCategory) * 100)}%
                        </span>
                        <span className="text-xs text-white/20">
                          {cat.count}
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${categoryColors[i % categoryColors.length]} rounded-full transition-all duration-700 opacity-70`}
                        style={{ width: `${(cat.count / maxCategory) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Peak hours */}
          <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-white/80 mb-2">
              Peak Hours
            </h2>
            <p className="text-xs text-white/25 mb-5">
              When users ask the most questions
            </p>
            {data.hourly.length === 0 ? (
              <div className="flex items-center justify-center h-24 text-white/15 text-sm">
                No hourly data yet
              </div>
            ) : (
              <div className="flex items-end gap-1 h-20">
                {Array.from({ length: 24 }, (_, hour) => {
                  const found = data.hourly.find((h) => h._id === hour);
                  const count = found?.count || 0;
                  return (
                    <div
                      key={hour}
                      className="flex-1 flex flex-col items-center gap-1 group"
                    >
                      <div
                        className="w-full bg-violet-500/60 hover:bg-violet-500 rounded-sm transition-all duration-300"
                        style={{
                          height: `${(count / maxHourly) * 64}px`,
                          minHeight: count > 0 ? "3px" : "0px",
                        }}
                      />
                      {hour % 6 === 0 && (
                        <span className="text-[8px] text-white/15">
                          {hour}h
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Top questions */}
          <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-white/80 mb-5">
              Most Asked Questions
            </h2>
            {data.topQuestions.length === 0 ? (
              <div className="flex items-center justify-center h-24 text-white/15 text-sm">
                No data yet
              </div>
            ) : (
              <div className="space-y-3">
                {data.topQuestions.map((q, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="text-xs text-white/15 shrink-0 w-4 mt-0.5">
                      {i + 1}.
                    </span>
                    <p className="text-xs text-white/50 flex-1 leading-relaxed line-clamp-2">
                      {q._id}
                    </p>
                    <div className="flex items-center gap-2 shrink-0">
                      <div
                        className={`w-1.5 h-1.5 rounded-full ${confidenceColors[q.confidence].bg}`}
                      />
                      <span className="text-xs text-white/20">{q.count}x</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Unanswered questions */}
        {data.unanswered.length > 0 && (
          <div className="bg-white/[0.03] border border-red-500/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-sm font-semibold text-white/80">
                  Unanswered Questions
                </h2>
                <p className="text-xs text-red-400/60 mt-0.5">
                  Add these to your knowledge base to improve answer rate
                </p>
              </div>
              <Link
                href="/admin"
                className="text-xs bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 px-3 py-1.5 rounded-lg transition"
              >
                Add to KB →
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {data.unanswered.map((q, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2.5 bg-red-500/5 border border-red-500/10 rounded-xl px-3 py-2.5"
                >
                  <div className="w-1 h-1 rounded-full bg-red-400 mt-1.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-white/50 leading-relaxed">
                      {q.question}
                    </p>
                    <p className="text-[10px] text-white/15 mt-1">
                      {new Date(q.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
