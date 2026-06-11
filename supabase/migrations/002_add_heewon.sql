insert into worldcup_users (username, display_name, pin_hash, color, is_admin, "group") values
  ('지구_희원', '이희원', encode(digest('8911', 'sha256'), 'hex'), '#65A30D', false, '지구')
on conflict (username) do nothing;
