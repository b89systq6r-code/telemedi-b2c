"""Skan dzienny: anomalie w sesjach i krokach lejka (mediana kroczaca 15 dni) + lejek tygodniowy."""
import duckdb,pandas as pd
pd.set_option('display.width',250)
con=duckdb.connect('data/tm.duckdb',read_only=True)
d=con.sql("""
with s as (select (started_at_utc at time zone 'UTC' at time zone 'Europe/Warsaw')::date d, count(*) sess from raw_sessions group by 1),
e as (select (r.started_at_utc at time zone 'UTC' at time zone 'Europe/Warsaw')::date d,
  sum((event_name='service_selected')::int) ss, sum((event_name='slot_selected')::int) sl, sum((event_name='account_completed')::int) ac,
  sum((event_name='payment_started')::int) pst, sum((event_name='payment_succeeded')::int) psu
  from raw_events join raw_sessions r using(session_id) group by 1)
select * from s left join e using(d) order by d""").df()
d['d']=pd.to_datetime(d.d); d=d[d.d>='2024-10-01'].reset_index(drop=True)
for c in ['sess','ss','sl','ac','pst','psu']:
    r=d[c].rolling(15,center=True,min_periods=5).median(); z=(d[c]-r)/r
    out=d[z.abs()>0.4]
    if len(out): print('ANOMALIA',c); print(out[['d',c]].assign(med=r[out.index].round()).to_string())
d['wk']=d.d.dt.to_period('W').dt.start_time
w=d.groupby('wk')[['sess','ss','sl','ac','pst','psu']].sum()
w['ss/sess']=w.ss/w.sess; w['sl/ss']=w.sl/w.ss; w['ac/sl']=w.ac/w.sl; w['pst/ac']=w.pst/w.ac; w['psu/pst']=w.psu/w.pst; w['psu/sess']=w.psu/w.sess
print(w.round(3).to_string())
