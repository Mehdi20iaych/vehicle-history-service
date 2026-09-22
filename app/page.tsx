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
import { PayPalCardCheckout, preloadPayPalCheckout } from "@/components/paypal-card-checkout";
import { trackMeta } from "@/components/meta-pixel";

const coverage: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: FileText,
    title: "Title notes",
    text: "We group title brands, liens, theft notes, and ownership entries when the sources return them.",
  },
  {
    icon: AlertTriangle,
    title: "Damage clues",
    text: "Salvage, junk, insurance, auction, and damage-related entries are separated so they are easier to question.",
  },
  {
    icon: Gauge,
    title: "Mileage trail",
    text: "Odometer readings are shown by date when available, which helps you spot jumps or missing periods.",
  },
  {
    icon: Wrench,
    title: "Useful extras",
    text: "Recalls, equipment, sale listings, and value estimates stay in the report instead of being scattered around.",
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
    title: "Check the match",
    text: "Make sure the returned year, make, model, and trim look like the car in front of you.",
  },
  {
    icon: MailCheck,
    title: "Open your report",
    text: "After checkout, the report opens in this browser. Keep the tab open or print a copy.",
  },
];

const sampleInsights: { icon: LucideIcon; label: string; value: string; note: string }[] = [
  { icon: FileText, label: "Title history", value: "Grouped by source", note: "Title and ownership entries stay readable" },
  { icon: AlertTriangle, label: "Damage signals", value: "Flagged clearly", note: "Damage-related notes are not hidden in paragraphs" },
  { icon: Gauge, label: "Mileage timeline", value: "Dates included", note: "Compare available readings over time" },
  { icon: ClipboardCheck, label: "Sales & auctions", value: "Past listings", note: "Useful when a seller story feels incomplete" },
];

const faqs = [
  [
    "Where is my report after checkout?",
    "After a successful payment or coupon, the report opens automatically in the same browser. Access lasts 24 hours, so save or print it if you need a copy.",
  ],
  [
    "Can I test before purchasing?",
    "Yes. Enter your VIN to see a free preview of the vehicle year, make, model, and trim when available. No card or payment is required to try it.",
  ],
  [
    "How does it work?",
    "Enter the 17-character VIN, check the free vehicle match, then unlock the report only if useful records are available. The price is shown before checkout.",
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
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const [coupon, setCoupon] = useState("");
  const [couponStatus, setCouponStatus] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [showStickyReport, setShowStickyReport] = useState(true);
  const [contactEmail, setContactEmail] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [contactStatus, setContactStatus] = useState("");
  const [contactSending, setContactSending] = useState(false);

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
    setQuoteId(null);
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
      setQuoteId(
        canCheckout && typeof availability.quoteId === "string"
          ? availability.quoteId
          : null,
      );
      if (canCheckout && typeof availability.quoteId === "string") {
        preloadPayPalCheckout().catch(() => {});
      }
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

  async function applyCoupon() {
    setCouponStatus("");
    setError("");
    if (!recordsAvailable || !quoteId) {
      setCouponStatus("Check a VIN with available report data before using a coupon.");
      return;
    }
    if (!coupon.trim()) {
      setCouponStatus("Enter a coupon code.");
      return;
    }
    setCouponLoading(true);
    try {
      const response = await fetch("/api/coupon/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vin: vin.replace(/\s/g, "").toUpperCase(),
          quoteId,
          coupon,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Coupon could not be applied.");
      }
      setCouponStatus("Coupon accepted. Opening your free report...");
      window.location.assign(result.reportUrl || "/report");
    } catch (couponError) {
      setCouponStatus(
        couponError instanceof Error
          ? couponError.message
          : "Coupon could not be applied.",
      );
    } finally {
      setCouponLoading(false);
    }
  }

  async function submitContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setContactStatus("");
    setContactSending(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: contactEmail,
          message: contactMessage,
          website: form.get("website"),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Your message could not be sent.");
      setContactEmail("");
      setContactMessage("");
      setContactStatus("Thank you. Your message has been sent.");
    } catch (contactError) {
      setContactStatus(contactError instanceof Error ? contactError.message : "Your message could not be sent.");
    } finally {
      setContactSending(false);
    }
  }

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
          <a href="#contact">Contact us</a>
          <a className="nav-cta" href="#start">
            Get my report <ArrowUpRight className="action-icon" aria-hidden="true" />
          </a>
        </div>
      </nav>

      <section className="hero container" id="top">
        <div className="hero-copy">
          <p className="trial-badge">Free VIN preview first. Pay only if records are found.</p>
          <h1>
            Run the VIN
            <br />
            <em>before you meet.</em>
          </h1>
          <p className="hero-lede">
            Autoscope is a small VIN report checkout for used-car buyers. Start
            with the free vehicle match, then unlock the available records only
            if the sources return enough useful history.
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
            No card for the preview. No charge when history is unavailable.
          </p>
          <ol className="hero-journey">
            <li>Enter VIN</li>
            <li>Check the match</li>
            <li>Unlock if useful</li>
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
            <span>For the questions you ask before buying.</span>
          </div>
        </div>
      </section>

      <section className="trust-strip">
        <div className="container trust-inner">
          <span>Made for quick checks before a viewing</span>
          <span>No card for preview</span>
          <span>Price shown before checkout</span>
          <span>24-hour report access</span>
        </div>
      </section>

      <section className="section container" id="coverage">
        <div className="section-heading">
          <p className="eyebrow">What you&apos;ll find</p>
          <h2>
            The parts buyers<br />
            <em>usually ask about.</em>
          </h2>
          <p>
            Not every VIN has records. When it does, the report is organized
            around the checks that matter in a used-car conversation.
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
              A report you can skim
              <br />
              <em>while talking to a seller.</em>
            </h2>
            <p>
              The report is not dressed up as a score or magic verdict. It is a
              practical list of available records, source by source, so you know
              what to ask next.
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
                <strong>2019 Honda CR-V</strong>
              </div>
              <span className="sample-badge">SAMPLE</span>
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
              <span>Dates</span><span>Sources</span><span>Seller questions</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section steps-section container">
        <p className="eyebrow">How it actually goes</p>
        <h2>
          No account.
          <br />
          <em>No long form.</em>
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
              Autoscope uses it to identify the vehicle and check whether useful
              history records are available before you pay. The free preview can
              confirm the year, make, model, and trim when the provider returns
              them.
            </p>
            <p>
              An unlocked report may include available title and salvage
              signals, odometer entries, recalls, market value, specifications,
              and sale or auction records. Coverage differs by vehicle and data
              source, so the page shows availability and the exact price before
              checkout.
            </p>
            <a className="text-link" href="#start">Run a free VIN preview</a>
          </div>
        </div>
      </section>

      <section className="start-section" id="start">
        <div className="container start-layout">
          <div>
            <p className="eyebrow">Start here</p>
            <h2>
              Check the VIN.
              <br />
              <em>Then decide.</em>
            </h2>
            <p className="start-copy">
              Enter a VIN and we&apos;ll show the year, make, and model for free.
              If useful records are available, you will see the exact price
              before PayPal or card checkout. Coupons can unlock the report
              without payment.
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
                setQuoteId(null);
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
                      text: "Check whether the sources mention damage or salvage.",
                    },
                    {
                      title: "Auction & sale history",
                      text: "Compare old sale notes with the current listing.",
                    },
                    {
                      title: "Title & mileage records",
                      text: "Look for title brands and odometer entries by date.",
                    },
                  ].map((item) => (
                    <div className="teaser-row" key={item.title}>
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.text}</p>
                      </div>
                      <span className="teaser-lock" aria-label="Locked section">
                        Locked
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
                ) : showPaymentOptions && reportPrice && quoteId ? (
                  <>
                    <div className="coupon-box">
                      <label htmlFor="coupon-code">
                        Coupon code <span>Optional</span>
                      </label>
                      <div className="coupon-row">
                        <input
                          id="coupon-code"
                          value={coupon}
                          onChange={(event) => {
                            setCoupon(event.target.value.toUpperCase());
                            setCouponStatus("");
                          }}
                          placeholder="AUTO-FREE-XXXXXX"
                          autoCapitalize="characters"
                          disabled={couponLoading}
                        />
                        <button
                          type="button"
                          className="button button-dark"
                          onClick={applyCoupon}
                          disabled={couponLoading}
                        >
                          {couponLoading ? "Applying..." : "Apply"}
                        </button>
                      </div>
                      {couponStatus && (
                        <p className="form-message" role="status">
                          {couponStatus}
                        </p>
                      )}
                    </div>
                    <PayPalCardCheckout
                      vin={vin.replace(/\s/g, "").toUpperCase()}
                      email={email}
                      price={reportPrice}
                      quoteId={quoteId}
                      onComplete={paymentCompleted}
                      onError={paymentFailed}
                    />
                  </>
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
                  Have a coupon? Open checkout, enter the code, and the report
                  unlocks without PayPal or card details.
                </p>
              </div>
            )}
            <p className="form-terms">
              The preview identifies the vehicle. The paid report only appears
              when record data is available, and the price is verified again at
              checkout.
            </p>
          </form>
        </div>
      </section>

      <section className="faq-section container" id="faq">
        <div className="faq-intro">
          <p className="eyebrow">Plain answers</p>
          <h2>
            Before you pay,
            <br />
            <em>read this.</em>
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

      <section className="contact-section" id="contact">
        <div className="container contact-layout">
          <div>
            <p className="eyebrow">Contact us</p>
            <h2>Need help with<br /><em>your report?</em></h2>
            <p>Send us a message and include the email address where you would like to receive a reply. We aim to reply in under 1 hour.</p>
          </div>
          <form className="contact-form" onSubmit={submitContact}>
            <label htmlFor="contact-email">Email address</label>
            <input
              id="contact-email"
              type="email"
              value={contactEmail}
              onChange={(event) => setContactEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              maxLength={254}
              required
            />
            <label htmlFor="contact-message">Message</label>
            <textarea
              id="contact-message"
              value={contactMessage}
              onChange={(event) => setContactMessage(event.target.value)}
              placeholder="How can we help?"
              minLength={10}
              maxLength={2000}
              rows={5}
              required
            />
            <input className="contact-honeypot" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
            <button className="button button-dark" disabled={contactSending}>
              {contactSending ? "Sending…" : "Send message"}
              <ArrowUpRight className="action-icon" aria-hidden="true" />
            </button>
            {contactStatus && <p className="contact-status" role="status">{contactStatus}</p>}
          </form>
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
