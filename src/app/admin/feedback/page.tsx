import { createAdminClient } from "@/lib/supabase/admin";
import { ThumbsUp, ThumbsDown, MessageSquare } from "lucide-react";
import { FeedbackPanel, type FeedbackRow } from "@/components/admin/FeedbackPanel";

export default async function AdminFeedbackPage() {
  const supabase = createAdminClient();

  // Every conversation lives in chat_sessions; ratings (when given) live in
  // session_feedback. Merge them so admin sees all sessions, rated or not.
  const [{ data: sessions }, { data: ratings }] = await Promise.all([
    supabase
      .from("chat_sessions")
      .select("session_id, domain, transcript, recommended_slugs, message_count, created_at, last_message_at")
      .not("transcript", "is", null)
      .order("last_message_at", { ascending: false })
      .limit(200),
    supabase.from("session_feedback").select("session_id, rating, comment"),
  ]);

  const ratingBySession = new Map(
    (ratings ?? []).map((r) => [r.session_id, r])
  );

  const feedback: FeedbackRow[] = (sessions ?? []).map((s) => {
    const r = ratingBySession.get(s.session_id);
    const transcript = (s.transcript ?? null) as FeedbackRow["transcript"];
    return {
      id: s.session_id,
      session_id: s.session_id,
      domain: (s.domain ?? "design") as FeedbackRow["domain"],
      rating: r ? r.rating : null,
      comment: r ? r.comment : null,
      transcript,
      recommended_slugs: s.recommended_slugs ?? [],
      message_count: transcript?.length ?? s.message_count,
      created_at: s.last_message_at ?? s.created_at,
    };
  });

  const total = feedback.length;
  const positive = feedback.filter((f) => f.rating === true).length;
  const negative = feedback.filter((f) => f.rating === false).length;
  const rated = positive + negative;
  const pct = rated > 0 ? Math.round((positive / rated) * 100) : null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">Chat Conversations</h1>
        <p className="text-sm text-muted-foreground">Every Chip session, with ratings where given</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-card rounded-xl border p-4 flex items-center gap-3">
          <MessageSquare className="w-5 h-5 text-primary shrink-0" />
          <div>
            <p className="text-2xl font-bold text-foreground">{total}</p>
            <p className="text-xs text-muted-foreground">Total conversations</p>
          </div>
        </div>
        <div className="glass-card rounded-xl border p-4 flex items-center gap-3">
          <ThumbsUp className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <p className="text-2xl font-bold text-foreground">{positive}</p>
            <p className="text-xs text-muted-foreground">
              Positive{pct !== null ? ` (${pct}%)` : ""}
            </p>
          </div>
        </div>
        <div className="glass-card rounded-xl border p-4 flex items-center gap-3">
          <ThumbsDown className="w-5 h-5 text-red-400 shrink-0" />
          <div>
            <p className="text-2xl font-bold text-foreground">{negative}</p>
            <p className="text-xs text-muted-foreground">Negative</p>
          </div>
        </div>
      </div>

      {/* Two-column panel */}
      <FeedbackPanel feedback={feedback} />
    </div>
  );
}
