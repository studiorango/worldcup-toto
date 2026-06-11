-- 퇴계원 김민제 비밀번호 변경 (1000 → 7840)
update worldcup_users
set pin_hash = encode(digest('7840', 'sha256'), 'hex')
where username = '민제' and "group" = '퇴계원';

-- 퇴계원 신규 멤버 추가
insert into worldcup_users (username, display_name, pin_hash, color, is_admin, "group") values
  ('퇴계원_모경', '김모경', encode(digest('1202', 'sha256'), 'hex'), '#EF4444', false, '퇴계원'),
  ('퇴계원_병직', '김병직', encode(digest('9049', 'sha256'), 'hex'), '#F97316', false, '퇴계원'),
  ('퇴계원_대한', '원대한', encode(digest('0585', 'sha256'), 'hex'), '#EAB308', false, '퇴계원'),
  ('퇴계원_수현', '신수현', encode(digest('0000', 'sha256'), 'hex'), '#22C55E', false, '퇴계원'),
  ('퇴계원_영식', '이영식', encode(digest('0213', 'sha256'), 'hex'), '#14B8A6', false, '퇴계원'),
  ('퇴계원_관호', '이관호', encode(digest('7556', 'sha256'), 'hex'), '#3B82F6', false, '퇴계원'),
  ('퇴계원_충민', '한충민', encode(digest('1074', 'sha256'), 'hex'), '#8B5CF6', false, '퇴계원'),
  ('퇴계원_석인', '홍석인', encode(digest('6900', 'sha256'), 'hex'), '#EC4899', false, '퇴계원'),
  ('퇴계원_세현', '황세현', encode(digest('3284', 'sha256'), 'hex'), '#06B6D4', false, '퇴계원'),
  ('퇴계원_현준', '김현준', encode(digest('0515', 'sha256'), 'hex'), '#84CC16', false, '퇴계원'),
  ('퇴계원_헌표', '홍헌표', encode(digest('8879', 'sha256'), 'hex'), '#F43F5E', false, '퇴계원'),
  ('퇴계원_창민', '최창민', encode(digest('7030', 'sha256'), 'hex'), '#A855F7', false, '퇴계원')
on conflict (username) do nothing;
