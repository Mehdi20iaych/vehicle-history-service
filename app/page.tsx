'use client'

import { AlertTriangle, ClipboardCheck, FileText, Gauge, MailCheck, ScanLine, Wrench, type LucideIcon } from 'lucide-react'
import { FormEvent, useState } from 'react'

const coverage: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: FileText, title: 'Title & ownership', text: 'Title brands, ownership changes, and registration events when available.' },
  { icon: AlertTriangle, title: 'Accident signals', text: 'Reported damage, salvage, total loss, and insurance events.' },
  { icon: Gauge, title: 'Mileage timeline', text: 'Odometer readings checked for suspicious gaps or rollbacks.' },
  { icon: Wrench, title: 'Service history', text: 'Maintenance and inspection records from participating sources.' },
]

const steps = [
  { icon: ScanLine, title: 'Enter the VIN', text: "Find the 17-character VIN on the dashboard or driver's door jamb." },
  { icon: ClipboardCheck, title: 'Validate & checkout', text: 'We check the VIN format before sending you to secure checkout.' },
  { icon: MailCheck, title: 'Get the full picture', text: 'Your digital report arrives with the records available for that vehicle.' },
]

const faqs = [
  ['How fast will I get my report?', 'Most reports are ready within a few minutes after checkout and VIN verification.'],
  ['Is every vehicle guaranteed to have records?', 'No. Coverage depends on the VIN and the sources available for that vehicle. A clean result does not guarantee a vehicle has never been damaged.'],
  ['Can I use a report for any vehicle?', 'Yes. Use a 17-character VIN for cars, trucks, SUVs, and motorcycles sold in the United States.'],
]

function isVin(value: string) {
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(value.replace(/\s/g, '').toUpperCase())
}

export default function Page() {
  const [vin, setVin] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setStatus('')
    const normalizedVin = vin.replace(/\\s/g, '').toUpperCase()
    if (!isVin(normalizedVin)) {
      setError('Enter a valid 17-character VIN (letters I, O, and Q are not used).')
      return
    }
    if (email && !/^\\S+@\\S+\\.\\S+$/.test(email)) {
      setError('Enter a valid email address or leave it blank.')
      return
    }
    setLoading(true)
    setStatus('Checking the VIN…')
    try {
      const response = await fetch('/api/vehicle/validate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vin: normalizedVin }) })
      const result = await response.json()
      if (!response.ok || !result.valid) throw new Error(result.message || 'We could not validate that VIN.')
      const checkout = new URL(result.checkoutUrl)
      checkout.searchParams.set('vin', normalizedVin)
      if (email) checkout.searchParams.set('email', email)
      const passthrough = btoa(JSON.stringify({ vin: normalizedVin, email })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
      checkout.searchParams.set('passthrough', passthrough)
      window.location.href = checkout.toString()
    } catch (requestError) {
      setLoading(false)
      setStatus('')
      setError(requestError instanceof Error ? requestError.message : 'Something went wrong. Please try again.')
    }
  }

  return (
    <main className="site-shell">
      <nav className="nav container" aria-label="Main navigation">
        <a className="wordmark" href="#top">AUTOSCOPE<span>.</span></a>
        <div className="nav-links"><a href="#coverage">What&apos;s inside</a><a href="#faq">FAQ</a><a className="nav-cta" href="#start">Get my report <span>↗</span></a></div>
      </nav>

      <section className="hero container" id="top">
        <div className="hero-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> Know before you buy</p>
          <h1>The history behind<br /><em>the vehicle.</em></h1>
          <p className="hero-lede">A clear, independent vehicle history report that helps you buy with confidence — not assumptions.</p>
          <div className="hero-actions"><a className="button button-dark" href="#start">Check a VIN <span>↗</span></a><a className="text-link" href="#sample">See a sample report <span>↓</span></a></div>
          <p className="microcopy">Secure checkout · Report delivered digitally · $24.99 per VIN</p>
        </div>
        <div className="hero-art">
          <img src="/vehicle-hero.png" alt="Auto diagnostician inspecting a modern sedan with a handheld diagnostic scanner in a workshop" />
          <div className="hero-art-overlay" />
          <div className="art-label"><strong>VIN REPORT</strong><span>Clearer decisions start here.</span></div>
        </div>
      </section>

      <section className="trust-strip"><div className="container trust-inner"><span>Built for the moments that matter</span><span>01 / Independent</span><span>02 / Transparent</span><span>03 / Buyer-first</span></div></section>

      <section className="section container" id="coverage">
        <div className="section-heading"><p className="eyebrow">What you&apos;ll find</p><h2>More than a<br /><em>clean title.</em></h2><p>One report, organized around the details that can change a buying decision.</p></div>
        <div className="coverage-grid">{coverage.map((item) => { const Icon = item.icon; return <article className="coverage-card" key={item.title}><span className="card-icon" aria-hidden="true"><Icon size={21} strokeWidth={2.2} /></span><h3>{item.title}</h3><p>{item.text}</p><span className="card-arrow" aria-hidden="true">↗</span></article> })}</div>
        <p className="disclaimer">Record availability varies by vehicle and source. Autoscope does not guarantee a complete history.</p>
      </section>

      <section className="dark-section" id="sample"><div className="container sample-layout"><div className="sample-copy"><p className="eyebrow eyebrow-light">A closer look</p><h2>Read the story.<br /><em>Not the fine print.</em></h2><p>Every report is structured to get you to the signal faster, with plain-language summaries alongside the source details.</p><a className="button button-light" href="#start">Start with a VIN <span>↗</span></a></div><div className="report-sheet"><div className="report-top"><span>AUTOSCOPE / VEHICLE REPORT</span><span>01 — 06</span></div><p className="report-kicker">Vehicle overview</p><h3>2019 Honda<br />CR-V EX-L</h3><div className="report-meta"><span><b>VIN</b> 2HKRW2H8XKH</span><span><b>STATUS</b> Clear title</span></div><div className="report-score"><span>History confidence</span><strong>92</strong><small>/ 100</small></div><div className="report-bars"><i /><i /><i /><i /><i /></div><p className="report-note">No salvage, flood, or total loss records found in available data.</p></div></div></section>

      <section className="section steps-section container"><p className="eyebrow">Simple by design</p><h2>Three steps to<br /><em>know more.</em></h2><div className="steps">{steps.map((item) => { const Icon = item.icon; return <div key={item.title}><span className="step-icon" aria-hidden="true"><Icon size={23} strokeWidth={2.1} /></span><h3>{item.title}</h3><p>{item.text}</p></div> })}</div></section>

      <section className="start-section" id="start"><div className="container start-layout"><div><p className="eyebrow">Start your search</p><h2>Make the next<br /><em>decision informed.</em></h2><p className="start-copy">Enter a VIN to validate it before checkout. Email is optional and only helps us route your report.</p></div><form className="vin-form" onSubmit={handleSubmit} noValidate><label htmlFor="vin">Vehicle identification number <span>Required</span></label><input id="vin" value={vin} onChange={(event) => setVin(event.target.value)} placeholder="e.g. 1HGCM82633A004352" maxLength={19} autoCapitalize="characters" /><label htmlFor="email">Email address <span>Optional</span></label><input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /><button className="button button-dark form-button" disabled={loading}>{loading ? 'Validating…' : 'Validate & continue'} <span>↗</span></button>{error && <p className="form-message error" role="alert">{error}</p>}{status && <p className="form-message" role="status">{status}</p>}<p className="form-terms">By continuing, you agree to receive your report digitally. Checkout is handled securely by Gumroad. Your VIN is attached to the order so payment can be matched automatically.</p></form></div></section>

      <section className="faq-section container" id="faq"><div className="faq-intro"><p className="eyebrow">Good to know</p><h2>Questions,<br /><em>answered.</em></h2></div><div className="faq-list">{faqs.map(([question, answer]) => <details key={question}><summary>{question}<span>+</span></summary><p>{answer}</p></details>)}</div></section>

      <footer className="footer"><div className="container footer-inner"><a className="wordmark" href="#top">AUTOSCOPE<span>.</span></a><p>Vehicle history, made clearer.</p><p>© 2026 Autoscope. Information is provided as available and is not a guarantee of vehicle condition.</p></div></footer>
    </main>
  )
}
