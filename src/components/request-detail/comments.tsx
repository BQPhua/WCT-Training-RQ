"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { addCommentAction } from "@/app/(app)/requests/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { formatDateTimeMY } from "@/lib/format";

export function Comments({
  requestId,
  canComment,
  items,
}: {
  requestId: string;
  canComment: boolean;
  items: { id: string; body: string; createdAt: Date; author: { name: string } }[];
}) {
  const router = useRouter();
  const [body, setBody] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function post(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    const r = await addCommentAction(requestId, body);
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    setBody("");
    router.refresh();
  }

  return (
    <div>
      {items.length ? (
        <ul className="space-y-4">
          {items.map((c) => (
            <li key={c.id} className="flex gap-3">
              <Avatar name={c.author.name} />
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-semibold text-ink">{c.author.name}</span>
                  <span className="ml-2 text-xs tabular text-muted">{formatDateTimeMY(c.createdAt)}</span>
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={<MessageSquare />} title="No comments yet">
          Ask a question or add context. The requester and the current approver are notified.
        </EmptyState>
      )}
      {canComment && (
        <form onSubmit={post} className="mt-5 space-y-2 border-t border-line pt-5">
          <label htmlFor="comment" className="sr-only">
            Add a comment
          </label>
          <Textarea id="comment" value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} placeholder="Add a comment…" className="min-h-20" />
          <div className="flex justify-end">
            <Button type="submit" variant="primary" disabled={busy || !body.trim()}>
              {busy && <Loader2 className="animate-spin" />} Post comment
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
