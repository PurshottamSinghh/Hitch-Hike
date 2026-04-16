"use client";

/**
 * Loading skeleton cards shown while "searching" for drivers.
 */
export default function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-3 animate-fadeInUp">
      <p className="text-xs font-medium text-indigo-400 tracking-wide uppercase">
        Searching drivers nearby…
      </p>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-2xl p-4 bg-[var(--color-bg-card)] border border-white/[0.04]"
          style={{ animationDelay: `${i * 0.15}s` }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="skeleton w-10 h-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-4 w-24 rounded-md" />
              <div className="skeleton h-3 w-16 rounded-md" />
            </div>
            <div className="skeleton h-8 w-20 rounded-lg" />
          </div>
          <div className="flex gap-2">
            <div className="skeleton h-6 w-16 rounded-full" />
            <div className="skeleton h-6 w-20 rounded-full" />
            <div className="skeleton h-6 w-14 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
