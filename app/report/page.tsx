'use client'

import { useEffect, useRef, useState } from 'react'
import styles from './report.module.css'
import type { RecordSection } from '@/lib/vehicle-records'
import { trackMeta } from '@/components/meta-pixel'

type Report = { vin: string; orderId: string; price?: string; sections: RecordSection[] }
export default function ReportPage() {
  const [report, setReport] = useState<Report | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)
  const purchaseTracked = useRef(false)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    fetch('/api/report', { cache: 'no-store', signal: controller.signal }).then(async response => {
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Unable to load report')
      setReport(result)
      if (!purchaseTracked.current && result.price) {
        purchaseTracked.current = true
        trackMeta('Purchase', { value: Number(result.price), currency: 'USD', content_name: 'Vehicle report' })
      }
    }).catch(error => { if (!controller.signal.aborted) setError(error.message) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [attempt])
  const hasRecords = report?.sections.some(section => section.records.length > 0)
  return <main className={styles.page}>
    <a href="/">← Autoscope</a>
    <h1>Available vehicle records</h1>
    <p style={{ background: '#fff1cc', padding: 20, borderRadius: 12, margin: '24px 0' }}><strong>Coverage notice</strong><br />Only records returned for the requested VIN are shown. Coverage varies by source, and missing records do not establish a clean history.</p>
    {loading && <p role="status">Loading available records…</p>}
    {error && <p role="alert">{error}</p>}
    {report && <>{!loading && !hasRecords && <aside className={styles.empty}><h2>No history records available</h2><p>Your payment was confirmed, but the sources returned no usable history. This is not a completed history report.</p><p><strong>Do not pay again.</strong> Retry below.</p></aside>}<p>Requested VIN: <strong>{report.vin}</strong></p><p>PayPal order: {report.orderId}</p><p>Report access lasts 24 hours in this browser. Save or print a copy for your records.</p>
      {report.sections.map(section => <section key={section.title} style={{ margin: '28px 0', padding: 24, border: '1px solid #ddd', borderRadius: 16 }}><h2>{section.title}</h2><p>{section.status}</p>{section.records.map((record, i) => <dl key={i} style={{ borderTop: '1px solid #ddd', paddingTop: 16, marginTop: 16 }}>{record.map((field, j) => <div key={j} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16, padding: '6px 0', overflowWrap: 'anywhere' }}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl>)}</section>)}
      <p><strong>Coverage limits:</strong> This is not a complete history report. Accident, title, theft, ownership, and service checks are not independently verified. Missing records never mean “no accidents” or “clean title.”</p></>}
    <div style={{ display: 'flex', gap: 16, marginTop: 24 }}><button className="button button-dark" disabled={loading} onClick={() => setAttempt(value => value + 1)}>Retry records — no payment</button>{report && hasRecords && <button className="button button-dark" onClick={() => window.print()}>Print / save PDF</button>}</div>
  </main>
}
