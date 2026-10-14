-- Removes everything created by `scripts/demo-data.sh load`:
-- demo users (@demo.wct.my), their requests (and each request's candidates,
-- actions, revisions, comments, attachments), and the demo departments when
-- no real user or request uses them. Real data is never touched.
\set ON_ERROR_STOP on
BEGIN;

CREATE TEMP TABLE demo_users ON COMMIT DROP AS
  SELECT id FROM users WHERE email LIKE '%@demo.wct.my';

-- Requests raised by demo users (children cascade).
DELETE FROM training_requests WHERE requester_id IN (SELECT id FROM demo_users);

-- Anything demo users did on real requests (normally nothing: they cannot sign in).
DELETE FROM request_actions   WHERE actor_id       IN (SELECT id FROM demo_users);
DELETE FROM comments          WHERE author_id      IN (SELECT id FROM demo_users);
DELETE FROM attachments       WHERE uploaded_by_id IN (SELECT id FROM demo_users);
DELETE FROM request_revisions WHERE created_by_id  IN (SELECT id FROM demo_users);
DELETE FROM admin_audit_logs  WHERE actor_id       IN (SELECT id FROM demo_users);

-- Users (role assignments and BU-admin links cascade; HOD links become empty).
DELETE FROM users WHERE id IN (SELECT id FROM demo_users);

-- Demo departments, only if nothing real refers to them.
DELETE FROM departments d
 WHERE d.name IN ('Land – Project Management','Land – Sales & Marketing','E&C – Engineering',
                  'E&C – QS & Contracts','Malls – Operations','Malls – Leasing','Group HR & Admin')
   AND d.hod_user_id IS NULL
   AND NOT EXISTS (SELECT 1 FROM users u WHERE u.department_id = d.id)
   AND NOT EXISTS (SELECT 1 FROM training_requests r WHERE r.department_id = d.id);

-- Reference numbers continue from the highest real one.
UPDATE ref_counters rc
   SET last_no = COALESCE((SELECT max(split_part(r.ref_no, '-', 3)::int)
                             FROM training_requests r
                            WHERE r.ref_no LIKE 'TRQ-' || rc.year || '-%'), 0);

COMMIT;
SELECT (SELECT count(*) FROM users WHERE email LIKE '%@demo.wct.my') AS demo_users_left,
       (SELECT count(*) FROM training_requests) AS requests_left;
