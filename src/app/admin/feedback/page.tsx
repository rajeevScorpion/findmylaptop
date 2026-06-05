import { createAdminClient } from "@/lib/supabase/admin";
import { ThumbsUp, ThumbsDown, MessageSquare } from "lucide-react";
import { FeedbackPanel, type FeedbackRow } from "@/components/admin/FeedbackPanel";

export default async function AdminFeedbackPage() {
  const supabase = createAdminClient();

  const { data: rows } = await supabase
    .from("session_feedback")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  const feedback = (rows ?? []) as FeedbackRow[];

  const total = feedback.length;
  const positive = feedback.filter((f) => f.rating).length;
  const negative = total - positive;
  const pct = total > 0 ? Math.round((positive / total) * 100) : null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">Chat Feedback</h1>
        <p className="text-sm text-muted-foreground">User ratings for Chip conversations</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-card rounded-xl border p-4 flex items-center gap-3">
          <MessageSquare className="w-5 h-5 text-primary shrink-0" />
          <div>
            <p className="text-2xl font-bold text-foreground">{total}</p>
            <p className="text-xs text-muted-foreground">Total ratings</p>
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
