"""scripts/seed-data.json から supabase/seed.sql を生成する。

固定IDと ON CONFLICT (id) DO NOTHING を使うため、何度実行しても重複せず、
管理画面で編集した内容も上書きしない。
使い方: python3 scripts/build-seed.py
"""
import json
import pathlib

root = pathlib.Path(__file__).resolve().parent.parent
data = json.loads((root / "scripts/seed-data.json").read_text(encoding="utf-8"))


def q(v: str) -> str:
    return "'" + v.replace("'", "''") + "'"


course = data["course"]
lines = [
    "-- 自動生成ファイル: scripts/build-seed.py で再生成してください。",
    "-- 再実行しても重複しません（固定ID + ON CONFLICT DO NOTHING）。",
    "",
    "insert into public.courses (id, title, description, is_published, sort_order) values",
    f"  ({q(course['id'])}, {q(course['title'])}, {q(course['description'])}, true, {course['sort_order']})",
    "on conflict (id) do nothing;",
    "",
]
total = 0
for ch in data["chapters"]:
    n = ch["number"]
    ch_id = f"00000000-0000-4000-8001-{n:012d}"
    lines += [
        "insert into public.chapters (id, course_id, chapter_number, title, sort_order, is_published) values",
        f"  ({q(ch_id)}, {q(course['id'])}, {n}, {q(ch['title'])}, {n}, true)",
        "on conflict (id) do nothing;",
    ]
    qs = ch["questions"] + [{"type": "commitment", "prompt": data["commitment_prompt"]}]
    rows = []
    for i, item in enumerate(qs, start=1):
        q_id = f"00000000-0000-4000-8002-{n:06d}{i:06d}"
        cfg = json.dumps(item.get("config", {}), ensure_ascii=False)
        rows.append(
            f"  ({q(q_id)}, {q(ch_id)}, {i}, {q(item['type'])}, {q(item['prompt'])}, "
            f"{q(item.get('description', ''))}, {q(cfg)}::jsonb)"
        )
    total += len(qs)
    lines += [
        "insert into public.questions (id, chapter_id, sort_order, question_type, prompt, description, config) values",
        ",\n".join(rows),
        "on conflict (id) do nothing;",
        "",
    ]

(root / "supabase/seed.sql").write_text("\n".join(lines), encoding="utf-8")
print(f"wrote supabase/seed.sql: {len(data['chapters'])} chapters, {total} questions")
