"""Disposable PostgreSQL test harness. Requires PostgreSQL binaries; no remote access."""
import os, pathlib, re, shutil, subprocess, tempfile
root=pathlib.Path(__file__).resolve().parents[1]
bindir=pathlib.Path(os.environ.get('MEET_PG_BIN','/opt/homebrew/opt/postgresql@18/bin'))
with tempfile.TemporaryDirectory(prefix='vetoschool-meet-',dir='/private/tmp') as temp:
    base=pathlib.Path(temp); env={**os.environ,'PATH':str(bindir)+os.pathsep+os.environ['PATH'],'PGHOST':temp,'PGPORT':'55439','PGUSER':'postgres','PGDATABASE':'postgres'}
    def run(args,**kw): return subprocess.run(args,env=env,cwd=root,check=True,**kw)
    run([str(bindir/'initdb'),'-D',str(base/'data'),'-A','trust','-U','postgres'],stdout=subprocess.DEVNULL)
    run([str(bindir/'pg_ctl'),'-D',str(base/'data'),'-l',str(base/'postgres.log'),'-o',f"-p 55439 -k {temp} -h ''",'start'],stdout=subprocess.DEVNULL)
    try:
        helper=base/'helpers.sql'
        with helper.open('w') as out:
            for f in ['20260503234850_d1ff30b3-52d2-46bd-af76-af3104b2c724.sql','20260723070000_teacher_system.sql']:
                s=(root/'supabase/migrations'/f).read_text()
                for name in ['is_admin','is_teacher','teacher_id_for_user','teacher_can_access_student']:
                    match=re.search(r'CREATE OR REPLACE FUNCTION private\.'+name+r'\(.*?\n\$\$;',s,re.S)
                    if match:out.write(match[0]+'\n')
        for file in ['supabase/tests/meet_bootstrap.sql',str(helper),'supabase/migrations/20261013120000_vetoschool_meet.sql','supabase/tests/meet_permissions.sql','supabase/tests/meet_extra.sql','supabase/migrations/20261013153000_vetoschool_meet_media.sql','supabase/tests/meet_media_permissions.sql']:
            run(['psql','-X','-v','ON_ERROR_STOP=1','-f',file],stdout=subprocess.DEVNULL)
        run(['python3','scripts/test-meet-concurrency.py'])
    finally:
        run([str(bindir/'pg_ctl'),'-D',str(base/'data'),'-m','fast','stop'],stdout=subprocess.DEVNULL)
