"""Eksport danych do narzędzia (tool/data.js): kolumnowe tablice binarne, gzip + base64.
Pacjenci (kohorty) + zdarzenia po 1. zamówieniu + sesje (lejki) + dzienne wydatki + agregaty operacyjne."""
import duckdb, gzip, base64, json, numpy as np
con = duckdb.connect('data/tm.duckdb', read_only=True)
D0 = '2024-10-01'

def b64(arrs):
    """lista (nazwa, np.array) -> {nazwa: [dtype, offset, len]} + jeden blob gzip/base64"""
    meta, parts, off = {}, [], 0
    for name, a in arrs:
        a = np.ascontiguousarray(a)
        meta[name] = [a.dtype.str.lstrip('<|'), off, int(a.size)]
        raw = a.tobytes(); pad = (-len(raw)) % 8
        parts.append(raw + b'\0' * pad); off += len(raw) + pad
    return meta, base64.b64encode(gzip.compress(b''.join(parts), 9)).decode()

def codes(series, order):
    m = {v: i for i, v in enumerate(order)}
    return np.array([m[v] for v in series], dtype=np.uint8)

CH = ['google_generic','google_brand','seo','direct','meta_prosp','meta_rmkt','meta_l4','tiktok_l4','affiliate','referral','crm','other']
PURP = ['konsultacja','e_recepta','l4','skierowanie']
SPEC = ['internista','pediatra','psychiatra','inni specjaliści']
DISC = ['none','go','promo']
PROMO = ['brak','START10','RANKING10','WRACAM15','L4SZYBKO20','TIKTOK25']
STAT = ['completed','refunded','cancelled','no_show']
DELAY = ['< 10 min','10–20 min','20+ min','wizyta się nie odbyła']
PLAT = ['iOS Safari','iOS inne','Android','macOS','Windows/inne','In-app (FB/IG/TikTok)']
AGE = ['18–29','30–44','45–59','60+']
CITY = ['wies','miasto_do_50k','miasto_50_200k','miasto_pow_200k']

PLAT_SQL = """CASE WHEN {a}.in_app THEN 'In-app (FB/IG/TikTok)' WHEN {a}.os='iOS' AND {a}.browser='Safari' THEN 'iOS Safari'
 WHEN {a}.os='iOS' THEN 'iOS inne' WHEN {a}.os='Android' THEN 'Android' WHEN {a}.os='macOS' THEN 'macOS' ELSE 'Windows/inne' END"""

# CAC: spend kanału w miesiącu / nowi pacjenci kanału w miesiącu; afiliacja 25 zł
p = con.sql(f"""
WITH cac AS (
  SELECT c.channel, c.m, c.sp / NULLIF(n.n,0) cac FROM
   (SELECT channel, date_trunc('month',date) m, sum(spend_pln) sp FROM spend GROUP BY ALL) c
   JOIN (SELECT acq_channel channel, date_trunc('month',first_at) m, count(*) n FROM patients GROUP BY ALL) n USING(channel,m))
SELECT p.user_id, datediff('day', DATE '{D0}', p.first_at::date) cd, p.acq_channel ch,
 p.first_purpose pu, CASE WHEN p.first_spec IN ('internista','pediatra','psychiatra') THEN p.first_spec ELSE 'inni specjaliści' END sp,
 p.first_discount di, coalesce(p.first_promo,'brak') pc, p.first_status st,
 CASE WHEN p.first_delay IS NULL THEN 'wizyta się nie odbyła' WHEN p.first_delay<10 THEN '< 10 min' WHEN p.first_delay<20 THEN '10–20 min' ELSE '20+ min' END dl,
 {PLAT_SQL.format(a='s')} pf,
 (extract(hour FROM o.scheduled_at) BETWEEN 6 AND 11)::int mo,
 p.go_at_first::int gf,
 CASE WHEN 2026-p.birth_year<30 THEN '18–29' WHEN 2026-p.birth_year<45 THEN '30–44' WHEN 2026-p.birth_year<60 THEN '45–59' ELSE '60+' END ag,
 p.city_size cs, p.marketing_consent mc,
 round(o.net_rev - o.doc_cost) cm0,
 round(coalesce(cac.cac,0) + CASE WHEN p.acq_channel='affiliate' THEN 25 ELSE 0 END) cac
FROM patients p JOIN orders o ON o.order_id=p.first_order_id JOIN sessions s ON s.session_id=p.first_session_id
LEFT JOIN cac ON cac.channel=p.acq_channel AND cac.m=date_trunc('month',p.first_at)
ORDER BY p.first_at""").df()
idx = {u: i for i, u in enumerate(p.user_id)}
print('patients', len(p))

# zdarzenia po 1. zamówieniu: kolejne zamówienia (t=0) i opłaty GO (t=1, cm=89; GO przy 1. zamówieniu offset 0)
ev = con.sql(f"""
SELECT o.user_id, datediff('day', p.first_at::date, o.created_at::date) dd, round(o.net_rev-o.doc_cost) cm, 0 t
FROM orders o JOIN patients p USING(user_id) WHERE o.order_seq>1
UNION ALL
SELECT g.user_id, greatest(0, datediff('day', p.first_at::date, g.purchased_at::date)) dd, 89 cm, 1 t
FROM go g JOIN patients p USING(user_id)
ORDER BY 1,2""").df()
print('events', len(ev))

pm, pblob = b64([
 ('cd', p.cd.values.astype(np.uint16)), ('ch', codes(p.ch, CH)), ('pu', codes(p.pu, PURP)), ('sp', codes(p.sp, SPEC)),
 ('di', codes(p.di, DISC)), ('pc', codes(p.pc, PROMO)), ('st', codes(p.st, STAT)), ('dl', codes(p.dl, DELAY)),
 ('pf', codes(p.pf, PLAT)), ('mo', p.mo.values.astype(np.uint8)), ('gf', p.gf.values.astype(np.uint8)),
 ('ag', codes(p.ag, AGE)), ('cs', codes(p.cs, CITY)), ('mc', p.mc.values.astype(np.uint8)),
 ('cm0', p.cm0.values.astype(np.int16)), ('cac', p.cac.values.astype(np.int16)),
 ('ei', np.array([idx[u] for u in ev.user_id], dtype=np.uint16)), ('eo', ev.dd.values.astype(np.uint16)),
 ('ecm', ev.cm.values.astype(np.int16)), ('et', ev.t.values.astype(np.uint8)),
])

LAND = ['/zwolnienie-l4-online','/lekarz-online','/ (strona główna)','/recepta-online','/konto','/specjalisci…','/blog…','/polecenie','/telemedigo']
s = con.sql(f"""
SELECT datediff('day', DATE '{D0}', f.ts::date) d, f.channel ch, {PLAT_SQL.format(a='f')} pf, f.device dv,
 CASE WHEN f.landing_page='/' THEN '/ (strona główna)' WHEN f.landing_page LIKE '/specjalisci%' THEN '/specjalisci…'
      WHEN f.landing_page LIKE '/blog%' THEN '/blog…' ELSE f.landing_page END lp,
 (f.ss + 2*f.sl + 4*f.ac + 8*f.pst + 16*f.has_order::int + 32*f.go_only::int
  + 64*(coalesce(p.first_at < f.ts - INTERVAL 1 MINUTE, false))::int) mask
FROM session_funnel f
LEFT JOIN visitor_user vu ON vu.visitor_id=f.visitor_id
LEFT JOIN patients p ON p.user_id=coalesce(f.user_id, vu.user_id)
WHERE f.ts >= DATE '{D0}'
ORDER BY f.ts""").df()
print('sessions', len(s))
DEV = ['mobile','desktop','tablet']
sm, sblob = b64([('d', s.d.values.astype(np.uint16)), ('ch', codes(s.ch, CH)), ('pf', codes(s.pf, PLAT)),
                 ('dv', codes(s.dv, DEV)), ('lp', codes(s.lp, LAND)), ('m', s['mask'].values.astype(np.uint8))])

sp = con.sql(f"SELECT datediff('day', DATE '{D0}', date) d, channel, round(sum(spend_pln)) s FROM spend GROUP BY ALL ORDER BY 1").df()
spend = {c: [0]*730 for c in CH}
for r in sp.itertuples(): spend[r.channel][r.d] += int(r.s)

ops = {
 'delay_month': con.sql("""SELECT strftime(created_at,'%Y-%m') m,
   round(avg(delay_min) FILTER (WHERE extract(hour FROM scheduled_at) BETWEEN 6 AND 11),1) rano,
   round(avg(delay_min) FILTER (WHERE extract(hour FROM scheduled_at) NOT BETWEEN 6 AND 11),1) reszta,
   count(*) FILTER (WHERE extract(hour FROM scheduled_at) BETWEEN 6 AND 11) n_rano
   FROM orders WHERE held AND specialization='internista' GROUP BY 1 ORDER BY 1""").df().to_dict('list'),
 'delay_hour': con.sql("""SELECT extract(hour FROM scheduled_at)::int h,
   round(avg(delay_min) FILTER (WHERE created_at < '2025-11-01'),1) przed, round(avg(delay_min) FILTER (WHERE created_at >= '2026-02-01'),1) po
   FROM orders WHERE held AND specialization='internista' GROUP BY 1 ORDER BY 1""").df().to_dict('list'),
 'rating_delay': con.sql("""SELECT CASE WHEN delay_min<10 THEN '< 10 min' WHEN delay_min<20 THEN '10–20 min' ELSE '20+ min' END b,
   count(rating) n, round(avg(rating),2) r, round(avg((rating<=2)::int)*100,1) bad FROM orders WHERE held AND rating IS NOT NULL GROUP BY 1 ORDER BY 1""").df().to_dict('list'),
 'morning_mix': con.sql("""SELECT strftime(o.created_at,'%Y-%m') m, count(*) n,
   round(avg((p.acq_channel IN ('meta_l4','tiktok_l4'))::int)*100,1) l4camp
   FROM orders o JOIN patients p USING(user_id) WHERE o.held AND o.specialization='internista' AND extract(hour FROM o.scheduled_at) BETWEEN 6 AND 11
   GROUP BY 1 ORDER BY 1""").df().to_dict('list'),
 'go_expiry': con.sql("""WITH g AS (SELECT * FROM go g WHERE valid_until < '2026-06-30' AND NOT EXISTS(SELECT 1 FROM go g2 WHERE g2.user_id=g.user_id AND g2.purchased_at>g.purchased_at))
   SELECT count(*) n, round(avg((SELECT count(*) FROM orders o WHERE o.user_id=g.user_id AND o.created_at::date BETWEEN g.valid_until-90 AND g.valid_until)),3) przed,
   round(avg((SELECT count(*) FROM orders o WHERE o.user_id=g.user_id AND o.created_at::date BETWEEN g.valid_until+1 AND g.valid_until+91)),3) po FROM g""").df().to_dict('records')[0],
}

# most dashboard -> rzeczywistość
def period(col): return f"CASE WHEN {col} >= '2025-10-01' THEN 'P2' ELSE 'P1' END"
raw = con.sql(f"""SELECT {period('created_at')} p, count(*) zam, sum(amount_paid) przych FROM raw_orders GROUP BY 1""").df().set_index('p')
rawp = con.sql(f"SELECT {period('f')} p, count(*) n FROM (SELECT user_id, min(created_at) f FROM raw_orders GROUP BY 1) GROUP BY 1").df().set_index('p')
rawg = con.sql(f"SELECT {period('purchased_at')} p, count(*) n FROM raw_go GROUP BY 1").df().set_index('p')
cl = con.sql(f"""SELECT {period('created_at')} p, count(*) zam, sum(net_rev) netto, sum(net_rev-doc_cost) cm FROM orders GROUP BY 1""").df().set_index('p')
clp = con.sql(f"SELECT {period('first_at')} p, count(*) n, count(*) FILTER (WHERE acq_channel NOT IN ('meta_l4','tiktok_l4')) core FROM patients GROUP BY 1").df().set_index('p')
go_rev = con.sql(f"SELECT {period('purchased_at')} p, count(*)*89 r FROM go GROUP BY 1").df().set_index('p')
spd = con.sql(f"SELECT {period('date')} p, sum(spend_pln) s FROM spend GROUP BY 1").df().set_index('p')
aff = con.sql(f"SELECT {period('first_at')} p, count(*)*25 a FROM patients WHERE acq_channel='affiliate' GROUP BY 1").df().set_index('p')
ret = con.sql("""SELECT CASE WHEN first_at < '2025-07-01' THEN 'P1' ELSE 'P2' END p, round(avg((r90>0)::int)*100,1) r
  FROM patients JOIN patient_ltv USING(user_id) WHERE first_at < '2026-07-01' AND (first_at < '2025-07-01' OR first_at >= '2025-10-01') GROUP BY 1""").df().set_index('p')
bridge = {
 'raw': {k: {'pac': int(rawp.n[k]), 'zam': int(raw.zam[k]), 'przych': float(raw.przych[k]), 'go': int(rawg.n[k])} for k in ['P1','P2']},
 'clean': {k: {'pac': int(clp.n[k]), 'pac_core': int(clp.core[k]), 'zam': int(cl.zam[k]), 'netto': float(cl.netto[k]),
               'cm': float(cl.cm[k]), 'go_rev': float(go_rev.r[k]), 'spend': float(spd.s[k]), 'aff': float(aff.a[k]),
               'ret90': float(ret.r[k])} for k in ['P1','P2']},
}
data = dict(D0=D0, ndays=730, dims=dict(CH=CH, PURP=PURP, SPEC=SPEC, DISC=DISC, PROMO=PROMO, STAT=STAT, DELAY=DELAY, PLAT=PLAT, AGE=AGE, CITY=CITY, LAND=LAND, DEV=DEV),
            pmeta=pm, pblob=pblob, smeta=sm, sblob=sblob, spend=spend, ops=ops, bridge=bridge, npat=len(p), nev=len(ev), nses=len(s))
js = 'window.TM_DATA=' + json.dumps(data, ensure_ascii=False, separators=(',',':'), default=float) + ';'
open('tool/data.js','w').write(js)
print('data.js MB', round(len(js)/1e6,2))
print(json.dumps(bridge, indent=1, default=float)); print(json.dumps(ops['go_expiry']))
