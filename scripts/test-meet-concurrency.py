"""Run against the isolated database created by test-meet-db.py, never production."""
import os, subprocess, time

def sql(query, check=True):
    result=subprocess.run(['psql','-X','-At','-v','ON_ERROR_STOP=1','-c',query],capture_output=True,text=True)
    if check and result.returncode: raise AssertionError(result.stderr)
    return result

def actor(query):
    return "SET ROLE authenticated; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001'; "+query

assert os.environ.get('PGHOST','').startswith('/private/tmp/') or os.environ.get('PGHOST','').startswith('/tmp/'), 'isolated socket required'
assert os.environ.get('PGDATABASE')=='postgres'
created=sql(actor("SELECT public.meet_save('Concurrent','','10000000-0000-0000-0000-000000000002','group',now(),45,ARRAY['00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000006']::uuid[])"))
c=created.stdout.strip().splitlines()[-1]
# A locks the conference and takes the final available seat. B starts while A holds the lock.
a=subprocess.Popen(['psql','-X','-At','-v','ON_ERROR_STOP=1','-c',f"BEGIN; INSERT INTO public.conference_participants(conference_id,user_id) VALUES('{c}','00000000-0000-0000-0000-000000000007'); SELECT pg_sleep(1); COMMIT;"],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
time.sleep(.2)
b=sql(f"INSERT INTO public.conference_participants(conference_id,user_id) VALUES('{c}','00000000-0000-0000-0000-000000000008')",False)
_,err=a.communicate();assert a.returncode==0,err
assert b.returncode!=0 and 'MEET_LIMIT' in b.stderr,b.stderr
assert sql(f"SELECT count(*) FROM public.conference_participants WHERE conference_id='{c}'").stdout.strip()=='4'
print('PASS concurrent additions cannot create a fifth student')
# Two clients edit the same revision, while A holds the row lock until COMMIT.
q=f"SELECT public.meet_transition('{c}',1,'active');"
a=subprocess.Popen(['psql','-X','-At','-v','ON_ERROR_STOP=1','-c',actor('BEGIN; '+q+' SELECT pg_sleep(1); COMMIT;')],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
time.sleep(.2)
b=sql(actor(f"SELECT public.meet_transition('{c}',1,'cancelled')"),False)
_,err=a.communicate();assert a.returncode==0,err
assert b.returncode!=0 and 'MEET_CONFLICT' in b.stderr,b.stderr
assert sql(f"SELECT status FROM public.video_conferences WHERE id='{c}'").stdout.strip()=='active'
print('PASS concurrent status changes reject the stale writer')
