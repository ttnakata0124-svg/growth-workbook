import { STATUS_LABELS, type ChapterStatus } from "@/lib/types";

const styles: Record<ChapterStatus, string> = {
  not_started: "bg-gray-100 text-gray-600",
  in_progress: "bg-gold-soft text-[#8a6a22]",
  completed: "bg-navy text-white",
};

export function StatusBadge({ status }: { status: ChapterStatus }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${styles[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-gold" style={{ width: `${percent}%` }} />
    </div>
  );
}
