"use client";

import {
  AlertTriangle,
  ArrowUpRight,
  ClipboardCheck,
  CreditCard,
  FileText,
  Gauge,
  MailCheck,
  ScanLine,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { PayPalCardCheckout } from "@/components/paypal-card-checkout";
import { trackMeta } from "@/components/meta-pixel";

const coverage: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: FileText,
    title: "Title & ownership",
    text: "Available title, brand, ownership, lien, and theft records for the VIN.",
  },
  {
    icon: AlertTriangle,
    title: "Accident signals",
    text: "Available junk, salvage, insurance, and damage-related history records.",
  },
  {
    icon: Gauge,
    title: "Mileage timeline",
    text: "Available odometer and history entries organized for easier review.",
  },
  {
    icon: Wrench,
    title: "Value & recalls",
    text: "Available market value estimates, equipment details, and safety recalls.",
  },
];

const steps = [
  {
    icon: ScanLine,
    title: "Enter the VIN",
    text: "Find the 17-character VIN on the dashboard or driver's door jamb.",
  },
  {
    icon: ClipboardCheck,
    title: "See your free preview",
    text: "Confirm the vehicle year, make, and model before deciding to buy.",
  },
  {
    icon: MailCheck,
    title: "Open your report",
    text: "After checkout, your available-records report opens in this browser. No email delivery.",
  },
];

const sampleInsights: { icon: LucideIcon; label: string; value: string; note: string }[] = [
  { icon: FileText, label: "Title history", value: "Records organized", note: "Review available title and ownership entries" },
  { icon: AlertTriangle, label: "Damage signals", value: "Easy to identify", note: "See available salvage and damage-related signals" },
  { icon: Gauge, label: "Mileage timeline", value: "Readings by date", note: "Compare available odometer entries over time" },
  { icon: ClipboardCheck, label: "Sales & auctions", value: "Listings together", note: "Review available sale and auction history" },
];

const faqs = [
  [
    "Where is my report after checkout?",
    "After a successful payment, your report opens automatically. Use Open my report in the same browser for 24 hours. If a provider fails, retry the records without paying again.",
  ],
  [
    "Can I test before purchasing?",
    "Yes. Enter your VIN to see a free preview of the vehicle year, make, model, and trim when available. No card or payment is required to try it.",
  ],
  [
    "How does it work?",
    "Enter your 17-character VIN and review the free vehicle preview. We check record availability and show the exact report price before checkout. If records disappear before PayPal captures payment, the transaction is stopped.",
  ],
  [
    "How much does the report cost?",
    "The vehicle identity preview is free. When report data is available, the price ranges from $6.99 to $9.99 depending on how much useful data is returned. Your exact price is always displayed before checkout.",
  ],
  [
    "Do the blurred sections mean an accident was found?",
    "No. Blurred sections illustrate report categories, not confirmed records for your car. We only describe an accident, auction event, or other finding as present when the data provider confirms it.",
  ],
  [
    "Can I pay by card?",
    "Yes, when PayPal makes card checkout available for your account and location. Shipping is not requested. PayPal may still require billing details needed to approve the card.",
  ],
  [
    "Where can I find my VIN?",
    "Look on the dashboard near the windshield, the driver’s door jamb, or the vehicle registration. Enter all 17 characters; VINs do not contain the letters I, O, or Q.",
  ],
  [
    "Is every vehicle guaranteed to have records?",
    "No. Coverage depends on the VIN and the sources available for that vehicle. A clean result does not guarantee a vehicle has never been damaged.",
  ],
  [
    "Can I use a report for any vehicle?",
    "VIN decoding and history coverage vary. Only records returned for the requested VIN are displayed.",
  ],
];

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://vehicle-history-service.vercel.app/#website",
      url: "https://vehicle-history-service.vercel.app/",
      name: "Autoscope",
      description: "Free VIN preview and available vehicle history records.",
      inLanguage: "en-US",
    },
    {
      "@type": "Service",
      "@id": "https://vehicle-history-service.vercel.app/#service",
      name: "Autoscope Vehicle History Report",
      serviceType: "VIN check and vehicle history report",
      provider: { "@type": "Organization", name: "Autoscope" },
      areaServed: [
        { "@type": "Country", name: "United States" },
        { "@type": "Country", name: "Canada" },
      ],
      description: "Enter a 17-character VIN for a free vehicle preview and check which history records are available before checkout.",
    },
    {
      "@type": "FAQPage",
      mainEntity: faqs.map(([question, answer]) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer },
      })),
    },
  ],
};

function isVin(value: string) {
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(value.replace(/\s/g, "").toUpperCase());
}

type VehiclePreview = {
  year: string | null;
  make: string | null;
  model: string | null;
  trim: string | null;
};

export default function Page() {
  const [vin, setVin] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [paymentNotice, setPaymentNotice] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [vehiclePreview, setVehiclePreview] = useState<VehiclePreview | null>(
    null,
  );
  const [showPaymentOptions, setShowPaymentOptions] = useState(false);
  const [recordsAvailable, setRecordsAvailable] = useState(false);
  const [reportPrice, setReportPrice] = useState<string | null>(null);
  const [showStickyReport, setShowStickyReport] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");

    if (payment === "success") {
      setPaymentNotice({
        type: "success",
        text: "Return to /report in your checkout browser to check report access.",
      });
    } else if (payment === "cancelled") {
      setPaymentNotice({
        type: "error",
        text: "Payment was cancelled. You have not been charged.",
      });
    } else if (payment === "failed") {
      setPaymentNotice({
        type: "error",
        text: "PayPal could not complete the payment. Please try again.",
      });
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("");
    const normalizedVin = vin.replace(/\s/g, "").toUpperCase();
    if (!isVin(normalizedVin)) {
      setError(
        "Enter a valid 17-character VIN (letters I, O, and Q are not used).",
      );
      return;
    }
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      setError("Enter a valid email address or leave it blank.");
      return;
    }
    setRecordsAvailable(false);
    setReportPrice(null);
    setLoading(true);
    setStatus("Checking the VIN…");
    try {
      const response = await fetch("/api/vehicle/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vin: normalizedVin }),
      });
      const result = await response.json();
      if (!response.ok || !result.valid)
        throw new Error(result.message || "We could not validate that VIN.");
      setVehiclePreview(
        result.vehicle || { year: null, make: null, model: null, trim: null },
      );
      setShowPaymentOptions(false);
      setStatus("Vehicle preview ready. Checking history availability…");
      const availabilityResponse = await fetch("/api/vehicle/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vin: normalizedVin }),
      });
      const availability = await availabilityResponse.json();
      const canCheckout =
        availabilityResponse.ok && availability.available === true;
      trackMeta("ViewContent", {
        content_name: "VIN Preview",
        content_category: "Vehicle report",
        value:
          canCheckout && typeof availability.price === "string"
            ? Number(availability.price)
            : 0,
        currency: "USD",
      });
      setRecordsAvailable(canCheckout);
      setReportPrice(
        canCheckout && typeof availability.price === "string"
          ? availability.price
          : null,
      );
      setStatus(
        canCheckout
          ? "Report data is available. Your exact price is shown below."
          : "No usable history records are available right now. Checkout is disabled — you will not be charged.",
      );
      setLoading(false);
    } catch (requestError) {
      setLoading(false);
      setStatus("");
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Something went wrong. Please try again.",
      );
    }
  }

  const paymentCompleted = useCallback((_orderId: string) => {
    setShowPaymentOptions(false);
    setStatus("");
    window.location.assign("/report");
  }, []);

  const paymentFailed = useCallback((message: string) => {
    setStatus("");
    setError(message);
  }, []);

  return (
    <main className="site-shell">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
      <nav className="nav container" aria-label="Main navigation">
        <a className="wordmark" href="#top">
          AUTOSCOPE<span>.</span>
        </a>
        <div className="nav-links">
          <a href="#coverage">What&apos;s inside</a>
          <a href="#faq">FAQ</a>
          <a className="nav-cta" href="#start">
            Get my report <ArrowUpRight className="action-icon" aria-hidden="true" />
          </a>
        </div>
      </nav>

      <section className="hero container" id="top">
        <div className="hero-copy">
          <p className="trial-badge">FREE VIN CHECK PREVIEW · NO CARD REQUIRED</p>
          <h1>
            Check the vehicle
            <br />
            <em>before purchasing.</em>
          </h1>
          <p className="hero-lede">
            Start with a free VIN check to preview the vehicle&apos;s year, make,
            and model. Then see the exact price for the vehicle history records
            available for that VIN.
          </p>
          <div className="hero-actions">
            <a className="button button-dark" href="#start">
              Check your VIN free <ArrowUpRight className="action-icon" aria-hidden="true" />
            </a>
            <a className="text-link" href="#sample">
              See a sample report <span>↓</span>
            </a>
          </div>
          <p className="microcopy">
            No payment to preview. No obligation to purchase.
          </p>
          <ol className="hero-journey">
            <li>Enter VIN</li>
            <li>Preview free</li>
            <li>Choose to unlock</li>
          </ol>
        </div>
        <div className="hero-art">
          <img
            src="https://raw.githubusercontent.com/Mehdi20iaych/vehicle-history-service/main/public/vehicle-hero.png"
            alt="Auto diagnostician inspecting a modern sedan with a handheld diagnostic scanner in a workshop"
          />
          <div className="hero-art-overlay" />
          <div className="art-label">
            <strong>VIN REPORT</strong>
            <span>Clearer decisions start here.</span>
          </div>
        </div>
      </section>

      <section className="trust-strip">
        <div className="container trust-inner">
          <span>Built for the moments that matter</span>
          <span>01 / Independent</span>
          <span>02 / Transparent</span>
          <span>03 / Buyer-first</span>
        </div>
      </section>

      <section className="section container" id="coverage">
        <div className="section-heading">
          <p className="eyebrow">What you&apos;ll find</p>
          <h2>
            More than a<br />
            <em>clean title.</em>
          </h2>
          <p>
            One report, organized around the details that can change a buying
            decision.
          </p>
        </div>
        <div className="coverage-grid">
          {coverage.map((item) => {
            const Icon = item.icon;
            return (
              <article className="coverage-card" key={item.title}>
                <span className="card-icon" aria-hidden="true">
                  <Icon size={21} strokeWidth={2.2} />
                </span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
                <span className="card-arrow" aria-hidden="true">
                  <ArrowUpRight />
                </span>
              </article>
            );
          })}
        </div>
        <p className="disclaimer">
          Record availability varies by vehicle and source. Autoscope does not
          guarantee a complete history.
        </p>
      </section>

      <section className="dark-section" id="sample">
        <div className="container sample-layout">
          <div className="sample-copy">
            <p className="eyebrow eyebrow-light">Report preview</p>
            <h2>
              See what matters.
              <br />
              <em>Before you buy.</em>
            </h2>
            <p>
              Your report turns available vehicle records into a clear,
              easy-to-scan history so you can spot the details worth asking
              about before making a decision.
            </p>
            <div className="sample-price-note">
              <strong>$6.99–$9.99</strong>
              <span>The exact price depends on the amount of data available for your VIN.</span>
            </div>
            <a className="button button-light" href="#start">
              Preview my vehicle free <ArrowUpRight className="action-icon" aria-hidden="true" />
            </a>
          </div>
          <div className="sample-report-card">
            <div className="sample-report-head">
              <div>
                <span>AUTOSCOPE REPORT</span>
                <strong>2019 Honda CR-V EX-L</strong>
              </div>
              <span className="sample-badge">EXAMPLE REPORT</span>
            </div>
            <div className="sample-vehicle-meta">
              <span><b>VIN</b> 2HKRW2H8XKH••••••</span>
              <span><b>REPORT</b> Available records</span>
            </div>
            <div className="sample-insights">
              {sampleInsights.map((item) => {
                const Icon = item.icon;
                return (
                  <article key={item.label}>
                    <span className="sample-insight-icon"><Icon size={18} aria-hidden="true" /></span>
                    <div><small>{item.label}</small><strong>{item.value}</strong><p>{item.note}</p></div>
                    <ArrowUpRight size={17} aria-hidden="true" />
                  </article>
                );
              })}
            </div>
            <div className="sample-report-footer">
              <span>Clear categories</span><span>Source details</span><span>Downloadable PDF</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section steps-section container">
        <p className="eyebrow">Simple by design</p>
        <h2>
          Three steps to
          <br />
          <em>know more.</em>
        </h2>
        <div className="steps">
          {steps.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title}>
                <span className="step-icon" aria-hidden="true">
                  <Icon size={23} strokeWidth={2.1} />
                </span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="seo-section" aria-labelledby="vin-history-heading">
        <div className="container seo-layout">
          <div>
            <p className="eyebrow">VIN CHECK FOR USED-CAR BUYERS</p>
            <h2 id="vin-history-heading">Check a used car&apos;s history by VIN</h2>
          </div>
          <div className="seo-copy">
            <p>
              A vehicle identification number is a unique 17-character code.
              Autoscope uses it to identify the vehicle and check which records
              are available before you pay. The free preview can confirm the
              year, make, model, and trim when the provider returns them.
            </p>
            <p>
              An unlocked report may include available title and salvage
              signals, odometer entries, recalls, market value, specifications,
              and sale or auction records. Coverage differs by vehicle and data
              source, so every preview shows availability and the exact price
              before checkout.
            </p>
            <a className="text-link" href="#start">Run a free VIN preview</a>
          </div>
        </div>
      </section>

      <section className="start-section" id="start">
        <div className="container start-layout">
          <div>
            <p className="eyebrow">Try it free first</p>
            <h2>
              See the vehicle.
              <br />
              <em>Then decide.</em>
            </h2>
            <p className="start-copy">
              Enter a VIN and we&apos;ll show the year, make, and model for
              free. You only pay if you want to unlock the available-records
              report. Reports cost between $6.99 and $9.99 depending on the
              amount of data available for that vehicle.
            </p>
          </div>
          <form className="vin-form" onSubmit={handleSubmit} noValidate>
            <p className="free-check">
              <span>✓</span> Free vehicle preview — no payment required
            </p>
            <div className="payment-protection">
              <strong>Payment protection</strong>
              <span>
                Checkout is shown only when records are available. If records
                become unavailable before PayPal captures payment, the
                transaction is stopped automatically.
              </span>
            </div>
            {paymentNotice && (
              <p
                className={
                  paymentNotice.type === "error"
                    ? "form-message error"
                    : "form-message"
                }
                role={paymentNotice.type === "error" ? "alert" : "status"}
              >
                {paymentNotice.text}
              </p>
            )}
            <label htmlFor="vin">
              Vehicle identification number <span>Required</span>
            </label>
            <input
              id="vin"
              disabled={loading}
              value={vin}
              onFocus={() => setShowStickyReport(false)}
              onChange={(event) => {
                setShowStickyReport(false);
                setVin(event.target.value);
                setRecordsAvailable(false);
                setReportPrice(null);
                setVehiclePreview(null);
                setShowPaymentOptions(false);
              }}
              placeholder="e.g. 1HGCM82633A004352"
              maxLength={19}
              autoCapitalize="characters"
            />
            <label htmlFor="email">
              Email address <span>Optional</span>
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
            <button
              className="button button-dark form-button"
              disabled={loading}
            >
              {loading ? "Checking vehicle…" : "See my free preview"}{" "}
              <ArrowUpRight className="action-icon" aria-hidden="true" />
            </button>
            {error && (
              <p className="form-message error" role="alert">
                {error}
              </p>
            )}
            {status && (
              <p className="form-message" role="status">
                {status}
              </p>
            )}
            {vehiclePreview && (
              <div className="vehicle-preview" role="status">
                <p className="preview-eyebrow">Free vehicle preview</p>
                <h3>
                  {[
                    vehiclePreview.year,
                    vehiclePreview.make,
                    vehiclePreview.model,
                  ]
                    .filter(Boolean)
                    .join(" ") || "Vehicle identified"}
                </h3>
                {vehiclePreview.trim && (
                  <p className="preview-trim">{vehiclePreview.trim}</p>
                )}
                <p className="preview-vin">
                  VIN: {vin.replace(/\s/g, "").toUpperCase()}
                </p>
                <div className="report-teaser">
                  <p className="teaser-heading">
                    What could change your buying decision?
                  </p>
                  {[
                    {
                      title: "Accident & damage history",
                      text: "What should you know before buying?",
                    },
                    {
                      title: "Auction & sale history",
                      text: "Could past listings tell a different story?",
                    },
                    {
                      title: "Title & mileage records",
                      text: "Does the vehicle’s history match its story?",
                    },
                  ].map((item) => (
                    <div className="teaser-row" key={item.title}>
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.text}</p>
                      </div>
                      <span className="teaser-lock" aria-label="Locked section">
                        🔒
                      </span>
                      <div className="teaser-skeleton" aria-hidden="true">
                        <i />
                        <i />
                        <i />
                      </div>
                    </div>
                  ))}
                  <p className="teaser-disclosure">
                    Illustrative locked sections — not confirmed findings for
                    this VIN. Records and coverage vary.
                  </p>
                </div>
                <div className="preview-lock">
                  <span>
                    {loading
                      ? "Checking report data"
                      : reportPrice
                        ? "Your report price"
                        : "Report availability"}
                  </span>
                  <strong>
                    {loading
                      ? "Please wait…"
                      : reportPrice
                        ? `$${reportPrice}`
                        : "Unavailable"}
                  </strong>
                </div>
                {loading ? (
                  <button
                    type="button"
                    className="button button-dark form-button"
                    disabled
                    aria-label="Pay button will be enabled when the report check finishes"
                  >
                    Pay <CreditCard className="action-icon" aria-hidden="true" />
                  </button>
                ) : !recordsAvailable ? (
                  <p className="form-message">
                    History unavailable. Keep your free vehicle preview; no
                    payment is needed.
                  </p>
                ) : showPaymentOptions && reportPrice ? (
                  <PayPalCardCheckout
                    vin={vin.replace(/\s/g, "").toUpperCase()}
                    email={email}
                    price={reportPrice}
                    onComplete={paymentCompleted}
                    onError={paymentFailed}
                  />
                ) : (
                  <button
                    type="button"
                    className="button button-dark form-button"
                    onClick={() => {
                      trackMeta("InitiateCheckout", {
                        value: Number(reportPrice),
                        currency: "USD",
                        content_name: "Vehicle report",
                      });
                      setShowPaymentOptions(true);
                    }}
                    disabled={loading}
                  >
                    Pay securely <CreditCard className="action-icon" aria-hidden="true" />
                  </button>
                )}
                <p className="unlock-note">
                  No shipping information is requested. PayPal may request
                  billing details required to approve a card.
                </p>
              </div>
            )}
            <p className="form-terms">
              The free preview confirms the vehicle. The exact price is
              displayed before checkout and verified again before payment.
              Checkout is handled securely by PayPal.
            </p>
          </form>
        </div>
      </section>

      <section className="faq-section container" id="faq">
        <div className="faq-intro">
          <p className="eyebrow">Good to know</p>
          <h2>
            Questions,
            <br />
            <em>answered.</em>
          </h2>
        </div>
        <div className="faq-list">
          {faqs.map(([question, answer]) => (
            <details key={question}>
              <summary>
                {question}
                <span>+</span>
              </summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="footer">
        <div className="container footer-inner">
          <a className="wordmark" href="#top">
            AUTOSCOPE<span>.</span>
          </a>
          <p>Vehicle history, made clearer.</p>
          <p>
            © 2026 Autoscope. Information is provided as available and is not a
            guarantee of vehicle condition.
          </p>
        </div>
      </footer>
      {showStickyReport && (
        <aside
          className="sticky-report"
          aria-label="Free vehicle preview shortcut"
        >
          <div>
            <strong>Test before purchasing</strong>
            <span>Free preview · Exact price after VIN check</span>
          </div>
          <a
            className="button button-dark"
            href="#start"
            onClick={() => setShowStickyReport(false)}
          >
            Get my report
            <ArrowUpRight className="action-icon" aria-hidden="true" />
          </a>
        </aside>
      )}
    </main>
  );
}
