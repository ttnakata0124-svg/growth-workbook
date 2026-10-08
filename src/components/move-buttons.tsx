// 並べ替え用の ↑↓ ボタン（Server Action を受け取る）
export function MoveButtons({ id, action, first, last }: { id: string; action: (f: FormData) => Promise<void>; first: boolean; last: boolean }) {
  return (
    <div className="flex shrink-0 gap-1">
      {(["up", "down"] as const).map((dir) => (
        <form key={dir} action={action}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="dir" value={dir} />
          <button
            className="btn btn-outline btn-sm h-9 w-9 px-0"
            disabled={dir === "up" ? first : last}
            aria-label={dir === "up" ? "上へ移動" : "下へ移動"}
          >
            {dir === "up" ? "↑" : "↓"}
          </button>
        </form>
      ))}
    </div>
  );
}

export function PublishBadge({ published }: { published: boolean }) {
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${published ? "bg-green-50 text-green-800" : "bg-gray-100 text-gray-600"}`}>
      {published ? "公開中" : "非公開"}
    </span>
  );
}
