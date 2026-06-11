update worldcup_users
set pin_hash = encode(digest('1551', 'sha256'), 'hex')
where username = '퇴계원_수현';
