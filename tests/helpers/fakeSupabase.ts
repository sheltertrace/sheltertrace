// A minimal in-memory stand-in for the slice of the supabase-js query builder
// that lib/volunteerAuth.ts actually uses (.select/.eq/.is/.gt/.gte/.ilike/
// .order/.limit/.maybeSingle/.insert/.update, and the {count:'exact',head:true}
// shape) — real behavior, not a call-recording mock, so tests exercise actual
// rate-limit counting, lockout thresholds, etc. rather than just "was called".
type Row = Record<string, unknown>;

function genId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

class FakeQuery implements PromiseLike<{ data: unknown; count: number | null; error: null }> {
  private filters: Array<(r: Row) => boolean> = [];
  private countMode = false;
  private headMode = false;
  private orderCol: string | null = null;
  private orderAsc = true;
  private limitN: number | null = null;
  private single: boolean | null = null;
  private op: { kind: "insert"; value: Row } | { kind: "update"; value: Row } | null = null;

  constructor(private rows: Row[]) {}

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    if (opts?.count) this.countMode = true;
    if (opts?.head) this.headMode = true;
    return this;
  }
  eq(col: string, val: unknown) { this.filters.push((r) => r[col] === val); return this; }
  ilike(col: string, val: unknown) { this.filters.push((r) => typeof r[col] === "string" && (r[col] as string).toLowerCase() === String(val).toLowerCase()); return this; }
  is(col: string, val: null) { this.filters.push((r) => (r[col] ?? null) === val); return this; }
  gt(col: string, val: string) { this.filters.push((r) => !!r[col] && new Date(r[col] as string) > new Date(val)); return this; }
  gte(col: string, val: string) { this.filters.push((r) => !!r[col] && new Date(r[col] as string) >= new Date(val)); return this; }
  order(col: string, opts?: { ascending?: boolean }) { this.orderCol = col; this.orderAsc = opts?.ascending !== false; return this; }
  limit(n: number) { this.limitN = n; return this; }
  maybeSingle() { this.single = true; return this; }
  insert(value: Row) { this.op = { kind: "insert", value }; return this; }
  update(value: Row) { this.op = { kind: "update", value }; return this; }

  private matched(): Row[] {
    return this.rows.filter((r) => this.filters.every((f) => f(r)));
  }

  private run(): { data: unknown; count: number | null; error: null } {
    if (this.op?.kind === "insert") {
      const row: Row = { id: genId(), created_at: new Date().toISOString(), attempts: 0, ...this.op.value };
      this.rows.push(row);
      return { data: row, count: null, error: null };
    }
    if (this.op?.kind === "update") {
      const targets = this.matched();
      targets.forEach((r) => Object.assign(r, (this.op as { value: Row }).value));
      return { data: targets, count: null, error: null };
    }
    let result = this.matched();
    const count = result.length;
    if (this.orderCol) {
      const col = this.orderCol;
      result = [...result].sort((a, b) => {
        const av = String(a[col]), bv = String(b[col]);
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return this.orderAsc ? cmp : -cmp;
      });
    }
    if (this.limitN != null) result = result.slice(0, this.limitN);
    if (this.headMode) return { data: null, count, error: null };
    if (this.single) return { data: result[0] ?? null, count: null, error: null };
    return { data: result, count: this.countMode ? count : null, error: null };
  }

  then<TResult1 = { data: unknown; count: number | null; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; count: number | null; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.run()).then(onfulfilled);
  }
}

export class FakeSupabase {
  tables = new Map<string, Row[]>();

  seed(table: string, rows: Row[]) {
    this.tables.set(table, rows.map((r) => ({ ...r })));
  }
  rows(table: string): Row[] {
    return this.tables.get(table) || [];
  }
  from(table: string) {
    if (!this.tables.has(table)) this.tables.set(table, []);
    return new FakeQuery(this.tables.get(table)!);
  }
}
