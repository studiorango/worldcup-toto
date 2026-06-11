-- worldcup_match_results 테이블이 없으면 생성
create table if not exists worldcup_match_results (
  id uuid primary key default gen_random_uuid(),
  match_id text unique not null,
  home_score integer not null,
  away_score integer not null,
  result text not null,       -- '홈 승' | '무승부' | '원정 승'
  score text not null,        -- '2:1' 형식
  over_under text not null,   -- '오버' | '언더'
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 기존 테이블에 over_under 컬럼 추가 (이미 있으면 무시)
alter table worldcup_match_results add column if not exists over_under text;

-- worldcup_bets 에 is_correct 컬럼 추가 (이미 있으면 무시)
alter table worldcup_bets add column if not exists is_correct boolean;

-- RLS
alter table worldcup_match_results enable row level security;
create policy if not exists "anyone can read results"
  on worldcup_match_results for select using (true);
create policy if not exists "service role can upsert results"
  on worldcup_match_results for all using (auth.role() = 'service_role');
