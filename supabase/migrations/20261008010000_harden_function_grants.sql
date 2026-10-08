-- Supabase のセキュリティアドバイザー指摘への対応。
-- 1) 未ログイン(anon)からは どの関数も呼べないようにする
-- 2) トリガー専用関数は API(RPC) から直接呼べないようにする（トリガーとしては従来どおり動く）
-- 3) touch_updated_at の search_path を固定する

alter function public.touch_updated_at() set search_path = '';

revoke execute on all functions in schema public from public, anon;
alter default privileges in schema public revoke execute on functions from public, anon;

revoke execute on function public.handle_new_user() from authenticated;
revoke execute on function public.guard_profile_update() from authenticated;
revoke execute on function public.prepare_answer() from authenticated;
revoke execute on function public.touch_attempt_activity() from authenticated;
revoke execute on function public.touch_updated_at() from authenticated;

-- RLS ポリシーと画面から使う関数はログイン済みユーザーのみ
grant execute on function public.is_admin() to authenticated;
grant execute on function public.chapter_is_live(uuid) to authenticated;
grant execute on function public.has_attempt_in_course(uuid) to authenticated;
grant execute on function public.has_attempt_in_chapter(uuid) to authenticated;
grant execute on function public.has_answered_question(uuid) to authenticated;
grant execute on function public.start_attempt(uuid) to authenticated;
grant execute on function public.complete_attempt(uuid) to authenticated;
grant execute on function public.discard_empty_attempt(uuid) to authenticated;
grant execute on function public.chapter_progress(uuid) to authenticated;
grant execute on function public.admin_progress() to authenticated;
