"use client";

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="max-w-lg">
      <h1 className="font-heading text-3xl">The desk hit a snag</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      <button type="button" className="mt-4 text-sm underline" onClick={() => reset()}>
        Try again
      </button>
    </div>
  );
}
