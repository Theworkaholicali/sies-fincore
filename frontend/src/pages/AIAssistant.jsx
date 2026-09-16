import { useState, useRef, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { useApi } from "@/hooks/useApi";
import api from "@/lib/api";
import { PageHeader, Panel } from "@/components/kit";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sparkles, Send, Loader2, ShieldCheck, User } from "lucide-react";

export default function AIAssistant() {
  const { fy } = useOutletContext();
  const { data: sug } = useApi("/ai/suggestions", {}, []);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef();

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const ask = async (question) => {
    const q = (question || input).trim();
    if (!q || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: q }]);
    setLoading(true);
    try {
      const r = await api.post("/ai/ask", { question: q, financial_year: fy });

const answer = r?.data?.answer ?? r?.answer ?? "The assistant returned no answer.";
const responseYear = r?.data?.financial_year ?? r?.financial_year ?? fy;

setMessages((m) => [
  ...m,
  { role: "assistant", text: answer, fy: responseYear }
]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", text: e.response?.data?.detail || "The assistant could not complete the request.", error: true }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader title="AI Finance Assistant" subtitle="Ask about institutional finances. The assistant is read only and answers only from verified financial data." />

      <div className="flex items-center gap-2 mb-4 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
        <ShieldCheck className="h-4 w-4 text-positive" />
        Read only. The assistant cannot modify, approve, post or delete any financial record.
      </div>

      <Panel className="min-h-[420px] flex flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto scrollbar-thin max-h-[52vh] pr-1">
          {messages.length === 0 && (
            <div className="py-8 text-center">
              <div className="inline-flex rounded-xl bg-brand/10 p-3 mb-3">
                <Sparkles className="h-6 w-6 text-brand" />
              </div>
              <p className="text-sm font-semibold">Ask about institutional finances</p>
              <p className="text-sm text-muted-foreground mt-1">Try one of the suggested queries below.</p>
              <div className="mt-5 flex flex-wrap gap-2 justify-center">
                {(sug?.suggestions || []).map((s, i) => (
                  <button
                    key={i}
                    data-testid={`ai-suggestion-${i}`}
                    onClick={() => ask(s)}
                    className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-left hover:border-brand/50 hover:text-brand transition-colors max-w-xs"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
              {m.role === "assistant" && (
                <div className="rounded-lg bg-brand/10 p-2 h-8 w-8 shrink-0 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-brand" />
                </div>
              )}
              <div className={`rounded-xl px-4 py-2.5 text-sm max-w-[80%] whitespace-pre-wrap ${m.role === "user" ? "bg-brand text-white" : m.error ? "bg-negative-soft border border-negative/20 text-negative" : "bg-muted"}`}>
                {m.text}
                {m.fy && <p className="text-[10px] opacity-60 mt-1.5">Financial year {m.fy}</p>}
              </div>
              {m.role === "user" && (
                <div className="rounded-lg bg-muted p-2 h-8 w-8 shrink-0 flex items-center justify-center">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="rounded-lg bg-brand/10 p-2 h-8 w-8 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-brand" />
              </div>
              <div className="rounded-xl bg-muted px-4 py-2.5 text-sm flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Reviewing verified financial data
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form onSubmit={(e) => { e.preventDefault(); ask(); }} className="mt-4 flex items-center gap-2 border-t border-border pt-4">
          <Input
            data-testid="ai-assistant-query-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question about institutional finances"
            className="flex-1"
          />
          <Button type="submit" data-testid="ai-assistant-submit-button" disabled={loading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </Panel>
    </div>
  );
}
