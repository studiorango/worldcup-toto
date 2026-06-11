-- pgcrypto 확장 (SHA-256 해싱)
create extension if not exists pgcrypto;

-- group 컬럼 추가
alter table worldcup_users add column if not exists "group" text not null default '퇴계원';

-- 기존 퇴계원 유저 명시적 표기
update worldcup_users set "group" = '퇴계원' where username in ('민제', '병운', '경민');

-- 지구 그룹 18명 추가
insert into worldcup_users (username, display_name, pin_hash, color, is_admin, "group") values
  ('지구_민제',   '김민제', encode(digest('7840', 'sha256'), 'hex'), '#3B82F6', false, '지구'),
  ('지구_석훈',   '강석훈', encode(digest('6546', 'sha256'), 'hex'), '#EF4444', false, '지구'),
  ('지구_경민',   '이경민', encode(digest('8917', 'sha256'), 'hex'), '#10B981', false, '지구'),
  ('지구_혁주',   '권혁주', encode(digest('1560', 'sha256'), 'hex'), '#F59E0B', false, '지구'),
  ('지구_인용',   '박인용', encode(digest('8580', 'sha256'), 'hex'), '#8B5CF6', false, '지구'),
  ('지구_미희',   '손미희', encode(digest('4417', 'sha256'), 'hex'), '#EC4899', false, '지구'),
  ('지구_서진',   '윤서진', encode(digest('6189', 'sha256'), 'hex'), '#06B6D4', false, '지구'),
  ('지구_정하',   '신정하', encode(digest('7717', 'sha256'), 'hex'), '#84CC16', false, '지구'),
  ('지구_영준',   '조영준', encode(digest('5917', 'sha256'), 'hex'), '#F97316', false, '지구'),
  ('지구_예슬',   '김예슬', encode(digest('6882', 'sha256'), 'hex'), '#14B8A6', false, '지구'),
  ('지구_지윤',   '우지윤', encode(digest('3530', 'sha256'), 'hex'), '#A855F7', false, '지구'),
  ('지구_유인',   '신유인', encode(digest('3680', 'sha256'), 'hex'), '#F43F5E', false, '지구'),
  ('지구_은하',   '이은하', encode(digest('4810', 'sha256'), 'hex'), '#0EA5E9', false, '지구'),
  ('지구_해영',   '정해영', encode(digest('5275', 'sha256'), 'hex'), '#D97706', false, '지구'),
  ('지구_정흠',   '조정흠', encode(digest('8611', 'sha256'), 'hex'), '#059669', false, '지구'),
  ('지구_재휘',   '한재휘', encode(digest('7109', 'sha256'), 'hex'), '#7C3AED', false, '지구'),
  ('지구_혜조',   '한혜조', encode(digest('3316', 'sha256'), 'hex'), '#DB2777', false, '지구'),
  ('지구_혜림',   '서혜림', encode(digest('2014', 'sha256'), 'hex'), '#0284C7', false, '지구'),
  ('지구_희원',   '이희원', encode(digest('8911', 'sha256'), 'hex'), '#65A30D', false, '지구')
on conflict (username) do nothing;
