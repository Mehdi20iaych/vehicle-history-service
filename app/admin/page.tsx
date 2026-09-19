import { cookies } from "next/headers";
import { analyticsSummary, validAdminToken } from "@/lib/site-analytics";

export const dynamic = "force-dynamic";

function Card({
  label,
  value,
  note,
}: {
  label: string;
  value: string | number;
  note?: string;
}) {
  return (
    <article className="admin-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </article>
  );
}

function formatDuration(value: unknown) {
  const seconds = Math.max(0, Number(value) || 0);
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes ? `${minutes}m ${remainder}s` : `${remainder}s`;
}

function eventLabel(event: string) {
  return ({
    page_view: "Page viewed",
    time_spent: "Time recorded",
    preview_available: "Preview available",
    preview_unavailable: "Preview unavailable",
    checkout_started: "Checkout started",
    purchase: "Payment completed",
  } as Record<string, string>)[event] || event;
}

function eventDetail(row: any) {
  if (row.event_type === "time_spent") return `${formatDuration(row.duration_seconds)} on ${row.path || "/"}`;
  if (row.event_type === "page_view") return `Viewed ${row.path || "/"}`;
  if (row.event_type === "purchase") return `Paid $${Number(row.amount || 0).toFixed(2)} ${row.currency || "USD"}`;
  if (row.event_type === "checkout_started") return `Started a $${Number(row.amount || 0).toFixed(2)} checkout`;
  const records = Number(row.metadata?.recordCount || 0);
  if (row.event_type === "preview_available") return records ? `${records} records available` : "Report records available";
  if (row.event_type === "preview_unavailable") return "No usable report records returned";
  return "—";
}

function countryName(code: string) {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) || code;
  } catch {
    return code;
  }
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const token = (await cookies()).get("autoscope_admin")?.value;
  if (!validAdminToken(token))
    return (
      <main className="admin-login">
        <form action="/api/admin/login" method="post">
          <p>AUTOSCOPE</p>
          <h1>Analytics login</h1>
          <label>
            Admin password
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </label>
          <button>Open dashboard</button>
        </form>
      </main>
    );
  const params = await searchParams;
  const rawExcluded = params.exclude;
  const excludedCountries = (Array.isArray(rawExcluded)
    ? rawExcluded
    : rawExcluded
      ? [rawExcluded]
      : params.filtered === "1"
        ? []
        : ["MA"]
  ).filter((country) => /^[A-Za-z]{2,3}$/.test(country));
  const data = await analyticsSummary(30, excludedCountries);
  if (!data)
    return (
      <main className="admin-login">
        <div>
          <h1>Database not connected</h1>
          <p>Connect Neon and redeploy the project.</p>
        </div>
      </main>
    );
  const t = data.totals;
  const conversion = Number(t.checkouts)
    ? `${((Number(t.purchases) / Number(t.checkouts)) * 100).toFixed(1)}%`
    : "0%";
  const maxViews = Math.max(
    1,
    ...data.daily.map((row: any) => Number(row.views)),
  );
  return (
    <main className="admin-shell">
      <header>
        <div>
          <p>AUTOSCOPE / ADMIN</p>
          <h1>Business analytics</h1>
        </div>
        <span>Last 30 days</span>
      </header>
      <section className="admin-filter">
        <div>
          <h2>Country filter</h2>
          <p>Select any countries you want removed from every statistic and activity table.</p>
        </div>
        <form method="get">
          <input type="hidden" name="filtered" value="1" />
          <div className="country-options">
            {data.allCountries.map((row: any) => (
              <label key={row.country}>
                <input
                  type="checkbox"
                  name="exclude"
                  value={row.country}
                  defaultChecked={data.excludedCountries.includes(row.country)}
                />
                <span>{countryName(row.country)} <small>{row.country}</small></span>
              </label>
            ))}
          </div>
          <div className="admin-filter-actions">
            <button type="submit">Apply filter</button>
            <a href="/admin?filtered=1">Clear all</a>
          </div>
        </form>
        {data.excludedCountries.length > 0 && (
          <p className="filter-status">Excluded: {data.excludedCountries.map(countryName).join(", ")}</p>
        )}
      </section>
      <section className="admin-grid">
        <Card label="Unique visitors" value={t.visitors} />
        <Card label="Page views" value={t.views} />
        <Card label="Available previews" value={t.previews} />
        <Card label="Checkout starts" value={t.checkouts} />
        <Card label="Abandoned" value={t.abandoned} />
        <Card label="Paid reports" value={t.purchases} />
        <Card label="Revenue" value={`$${Number(t.revenue).toFixed(2)}`} />
        <Card label="Checkout conversion" value={conversion} />
        <Card
          label="Average time"
          value={`${Math.round(Number(t.avg_seconds))}s`}
        />
      </section>
      <section className="admin-panel">
        <h2>Daily activity</h2>
        <div className="admin-chart">
          {data.daily.map((row: any) => (
            <div key={row.day} title={`${row.day}: ${row.views} views`}>
              <i
                style={{
                  height: `${Math.max(3, (Number(row.views) / maxViews) * 150)}px`,
                }}
              />
              <small>{String(row.day).slice(5)}</small>
            </div>
          ))}
        </div>
      </section>
      <section className="admin-two">
        <div className="admin-panel">
          <h2>Top countries</h2>
          <table>
            <thead>
              <tr>
                <th>Country</th>
                <th>Visitors</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {data.countries.map((row: any) => (
                <tr key={row.country}>
                  <td>{row.country}</td>
                  <td>{row.visitors}</td>
                  <td>${Number(row.revenue).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="admin-panel">
          <h2>Traffic sources</h2>
          <table>
            <thead>
              <tr>
                <th>Source</th>
                <th>Visits</th>
              </tr>
            </thead>
            <tbody>
              {data.sources.map((row: any) => (
                <tr key={row.source}>
                  <td className="truncate">{row.source}</td>
                  <td>{row.visits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <h2>Visitor journeys</h2>
            <p>Anonymous individual activity and engagement for the last 30 days.</p>
          </div>
          <span>{data.visitors.length} recent visitors</span>
        </div>
        <div className="admin-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Visitor</th><th>Country</th><th>Active time</th><th>Views</th><th>Previews</th><th>Checkouts</th><th>Paid</th><th>Spent</th><th>Last action</th><th>Last seen</th>
              </tr>
            </thead>
            <tbody>
              {data.visitors.map((row: any) => (
                <tr key={row.visitor_id}>
                  <td><code title={row.visitor_id}>{String(row.visitor_id).slice(0, 8)}</code></td>
                  <td>{row.country}</td><td>{formatDuration(row.time_seconds)}</td><td>{row.views}</td><td>{row.previews}</td><td>{row.checkouts}</td><td>{row.purchases}</td><td>${Number(row.spent).toFixed(2)}</td><td><span className="admin-event">{eventLabel(row.last_action)}</span></td><td>{new Date(row.last_seen).toLocaleString("en-US")}</td>
                </tr>
              ))}
              {!data.visitors.length && <tr><td colSpan={10}>No visitor activity has been recorded yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div><h2>Recent individual actions</h2><p>Every tracked step, newest first.</p></div>
        </div>
        <div className="admin-table-scroll">
          <table>
            <thead><tr><th>Visitor</th><th>Action</th><th>What happened</th><th>Country</th><th>Time</th></tr></thead>
            <tbody>
              {data.activity.map((row: any, index: number) => (
                <tr key={`${row.visitor_id}-${row.created_at}-${index}`}>
                  <td><code title={row.visitor_id}>{String(row.visitor_id).slice(0, 8)}</code></td>
                  <td><span className="admin-event">{eventLabel(row.event_type)}</span></td>
                  <td>{eventDetail(row)}</td><td>{row.country}</td><td>{new Date(row.created_at).toLocaleString("en-US")}</td>
                </tr>
              ))}
              {!data.activity.length && <tr><td colSpan={5}>No actions have been recorded yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      <section className="admin-panel">
        <h2>Recent checkout activity</h2>
        <table>
          <thead>
            <tr>
              <th>Event</th>
              <th>Country</th>
              <th>Amount</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {data.recent.map((row: any, i: number) => (
              <tr key={i}>
                <td>
                  {row.event_type === "purchase" ? "Paid" : "Checkout started"}
                </td>
                <td>{row.country}</td>
                <td>
                  {row.amount ? `$${Number(row.amount).toFixed(2)}` : "—"}
                </td>
                <td>{new Date(row.created_at).toLocaleString("en-US")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
