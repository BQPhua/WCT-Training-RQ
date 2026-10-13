import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main" className="grid min-h-dvh place-items-center bg-ground px-6 text-center">
      <div>
        <p className="text-sm font-semibold tabular text-brand-text">404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">We couldn&apos;t find that</h1>
        <p className="mt-2 max-w-sm text-sm text-muted">The page or request doesn&apos;t exist, or you don&apos;t have access to it.</p>
        <Button asChild variant="primary" className="mt-6">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    </main>
  );
}
