import duckdb,sys
con=duckdb.connect('data/tm.duckdb')
for s in sys.stdin.read().split(';;'):
    s=s.strip()
    if s: print('>>',s.splitlines()[0][:90]); r=con.sql(s); print(r.df().to_string(max_rows=300) if r is not None else "ok"); print()
