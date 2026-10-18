"""Warstwa czysta: decyzje z audytu (notes/WORKLOG.md) zapisane w kodzie.
Założenia:
 A1. Duplikaty orders (10-24 VI 2026) -> dedup po order_id.
 A2. 22 konta QA (kto kiedykolwiek użył TEST-QA) -> wykluczone w całości.
 A3. Wszystkie daty biznesowe w czasie polskim; sesje/zdarzenia konwertowane z UTC.
 A4. Źródło pozyskania pacjenta = last non-direct touch w 30 dniach przed 1. opłaconym zamówieniem,
     po wszystkich visitor_id powiązanych z kontem (visitor_id -> user_id z sesji zalogowanych).
     Jeśli brak nie-bezpośredniego touchpointu -> 'direct'.
 A5. Koszt lekarza wg README (25 internista / 200 psychiatra / 100 reszta) za completed+refunded.
 A6. Marża kontrybucyjna 1 = przychód netto (amount_paid - refund) + GO - koszt lekarza.
     CAC: spend kampanii CPC przypisany do pacjentów pozyskanych tą kampanią; afiliacja 25 zł / pierwsze zamówienie.
"""
import duckdb
con = duckdb.connect('data/tm.duckdb')
X = con.execute

X("""CREATE OR REPLACE TABLE qa_users AS
SELECT DISTINCT user_id FROM raw_orders WHERE promo_code='TEST-QA'""")

X("""CREATE OR REPLACE MACRO channel(src, med, camp) AS
CASE
 WHEN med IS NULL THEN 'direct'
 WHEN camp='gs_brand' THEN 'google_brand'
 WHEN med='cpc' THEN 'google_generic'
 WHEN camp='meta_prosp_l4_szybko' THEN 'meta_l4'
 WHEN camp='meta_rmkt_koszyk' THEN 'meta_rmkt'
 WHEN src='meta' THEN 'meta_prosp'
 WHEN src='tiktok' THEN 'tiktok_l4'
 WHEN med='organic' THEN 'seo'
 WHEN med='affiliate' THEN 'affiliate'
 WHEN med IN ('email','sms') THEN 'crm'
 WHEN med='referral' THEN 'referral'
 ELSE 'other' END""")

X("""CREATE OR REPLACE TABLE sessions AS
SELECT s.session_id, s.visitor_id, s.user_id,
  (s.started_at_utc AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Warsaw') AS ts,
  s.utm_source, s.utm_medium, s.utm_campaign, channel(s.utm_source,s.utm_medium,s.utm_campaign) AS channel,
  s.device, s.os, s.browser,
  s.browser IN ('Instagram','Facebook','TikTok') AS in_app,
  s.landing_page
FROM raw_sessions s
WHERE coalesce(s.user_id,-1) NOT IN (SELECT user_id FROM qa_users)
  AND s.visitor_id NOT IN (SELECT DISTINCT visitor_id FROM raw_sessions WHERE user_id IN (SELECT user_id FROM qa_users))""")

X("""CREATE OR REPLACE TABLE go AS
SELECT * FROM raw_go WHERE user_id NOT IN (SELECT user_id FROM qa_users)""")

X("""CREATE OR REPLACE TABLE orders AS
WITH o AS (SELECT DISTINCT * FROM raw_orders WHERE user_id NOT IN (SELECT user_id FROM qa_users))
SELECT o.*,
  o.status IN ('completed','refunded') AS held,
  o.amount_paid - o.refund_amount AS net_rev,
  CASE WHEN o.status IN ('completed','refunded') THEN
     CASE o.specialization WHEN 'internista' THEN 25 WHEN 'psychiatra' THEN 200 ELSE 100 END ELSE 0 END AS doc_cost,
  epoch(o.started_at - o.scheduled_at)/60.0 AS delay_min,
  row_number() OVER (PARTITION BY o.user_id ORDER BY o.created_at, o.order_id) AS order_seq
FROM o""")
assert con.execute("select count(*)=count(distinct order_id) from orders").fetchone()[0]

# lejek per sesja; zakup samego GO oznaczony osobno
X("""CREATE OR REPLACE TABLE session_funnel AS
SELECT s.*,
  coalesce(max((e.event_name='service_selected')::int),0) ss,
  coalesce(max((e.event_name='slot_selected')::int),0) sl,
  coalesce(max((e.event_name='account_completed')::int),0) ac,
  coalesce(max((e.event_name='payment_started')::int),0) pst,
  coalesce(max((e.event_name='payment_succeeded')::int),0) psu,
  s.session_id IN (SELECT session_id FROM orders) AS has_order,
  s.session_id IN (SELECT session_id FROM go WHERE order_id IS NULL) AS go_only
FROM sessions s LEFT JOIN raw_events e USING(session_id) GROUP BY ALL""")

# mapa visitor -> user
X("""CREATE OR REPLACE TABLE visitor_user AS
SELECT visitor_id, min(user_id) user_id, count(DISTINCT user_id) n_users
FROM sessions WHERE user_id IS NOT NULL GROUP BY 1""")

# pacjent = konto z >=1 opłaconym zamówieniem konsultacji (dowolny status)
X("""CREATE OR REPLACE TABLE patients AS
WITH f AS (SELECT user_id, min(created_at) first_at, arg_min(order_id, created_at) first_order_id, arg_min(session_id, created_at) first_session_id
           FROM orders GROUP BY 1),
touch AS (
  SELECT f.user_id, s.channel, s.utm_campaign, s.ts,
    row_number() OVER (PARTITION BY f.user_id ORDER BY (s.channel<>'direct') DESC, s.ts DESC) rn
  FROM f
  JOIN (SELECT s.*, coalesce(s.user_id, vu.user_id) uid FROM sessions s LEFT JOIN visitor_user vu USING(visitor_id)) s
    ON s.uid=f.user_id AND s.ts <= f.first_at + INTERVAL 1 MINUTE AND s.ts >= f.first_at - INTERVAL 30 DAY
)
SELECT f.*, f.first_at::date AS cohort_day, date_trunc('week', f.first_at)::date AS cohort_week, date_trunc('month', f.first_at)::date AS cohort_month,
  coalesce(t.channel,'direct') acq_channel, t.utm_campaign acq_campaign,
  fs.channel AS first_order_session_channel,
  fo.specialization first_spec, fo.visit_purpose first_purpose, fo.discount_type first_discount, fo.promo_code first_promo, fo.status first_status,
  fo.delay_min first_delay, fo.consultation_mode first_mode,
  fs.device first_device, fs.browser first_browser, fs.in_app first_in_app,
  u.birth_year, u.gender, u.region, u.city_size, u.marketing_consent, u.registered_at,
  EXISTS (SELECT 1 FROM go g WHERE g.user_id=f.user_id AND g.purchased_at <= f.first_at + INTERVAL 1 MINUTE) AS go_at_first
FROM f
LEFT JOIN touch t ON t.user_id=f.user_id AND t.rn=1
LEFT JOIN orders fo ON fo.order_id=f.first_order_id
LEFT JOIN sessions fs ON fs.session_id=f.first_session_id
LEFT JOIN raw_users u ON u.user_id=f.user_id""")

X("""CREATE OR REPLACE TABLE spend AS
SELECT date, utm_source, utm_medium, utm_campaign, channel(utm_source,utm_medium,utm_campaign) channel, impressions, clicks, spend_pln FROM raw_spend""")

for t in ['qa_users','sessions','orders','go','session_funnel','patients','spend']:
    print(t, con.execute(f"select count(*) from {t}").fetchone()[0])
print(con.sql("select acq_channel, count(*) n, round(avg((acq_channel=first_order_session_channel)::int),2) same_as_lasttouch from patients group by 1 order by 2 desc"))

# LTV/retencja per pacjent (okna od 1. zamówienia)
X("""CREATE OR REPLACE TABLE patient_ltv AS
SELECT p.user_id,
 count(o.order_id) FILTER (WHERE o.order_seq>1 AND o.created_at <= p.first_at + INTERVAL 30 DAY) r30,
 count(o.order_id) FILTER (WHERE o.order_seq>1 AND o.created_at <= p.first_at + INTERVAL 90 DAY) r90,
 count(o.order_id) FILTER (WHERE o.order_seq>1 AND o.created_at <= p.first_at + INTERVAL 180 DAY) r180,
 sum(o.net_rev - o.doc_cost) FILTER (WHERE o.created_at <= p.first_at + INTERVAL 90 DAY) cm90,
 sum(o.net_rev - o.doc_cost) FILTER (WHERE o.created_at <= p.first_at + INTERVAL 180 DAY) cm180,
 sum(o.net_rev - o.doc_cost) cm_all
FROM patients p JOIN orders o USING(user_id) GROUP BY 1""")
