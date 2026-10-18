"""Ładuje surowe CSV do DuckDB (data/tm.duckdb). Bez czyszczenia — czyszczenie to osobny krok (clean.sql)."""
import duckdb, glob
con = duckdb.connect('data/tm.duckdb')
R = 'data/raw'
con.execute(f"CREATE OR REPLACE TABLE raw_users AS SELECT * FROM read_csv_auto('{R}/users.csv', all_varchar=false)")
con.execute(f"CREATE OR REPLACE TABLE raw_sessions AS SELECT *, filename AS src FROM read_csv('{R}/sessions_*.csv', filename=true, types={{'user_id':'BIGINT','utm_source':'VARCHAR','utm_medium':'VARCHAR','utm_campaign':'VARCHAR'}})")
con.execute(f"CREATE OR REPLACE TABLE raw_events AS SELECT *, filename AS src FROM read_csv('{R}/events_*.csv', filename=true)")
con.execute(f"CREATE OR REPLACE TABLE raw_orders AS SELECT * FROM read_csv('{R}/orders.csv', types={{'promo_code':'VARCHAR','rating':'INTEGER','started_at':'TIMESTAMP'}})")
con.execute(f"CREATE OR REPLACE TABLE raw_go AS SELECT * FROM read_csv('{R}/go_memberships.csv', types={{'order_id':'BIGINT'}})")
con.execute(f"CREATE OR REPLACE TABLE raw_spend AS SELECT * FROM read_csv_auto('{R}/marketing_spend.csv')")
for t in ['raw_users','raw_sessions','raw_events','raw_orders','raw_go','raw_spend']:
    print(t, con.execute(f"select count(*) from {t}").fetchone()[0])
    print(con.execute(f"describe {t}").fetchall())
