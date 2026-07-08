export default function PrivacyPage() {
  const C = { midnight: '#0d1b2a', offwhite: '#F2EFE9', border: 'rgba(255,255,255,0.07)' }

  return (
    <div style={{ backgroundColor: C.midnight, minHeight: '100vh', color: C.offwhite }}>
      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '3rem 1.5rem 6rem' }}>
        <a href="/" style={{ color: 'rgba(242,239,233,0.35)', fontSize: '0.875rem', textDecoration: 'none', display: 'inline-block', marginBottom: '2.5rem' }}>
          ← Back to Nativ
        </a>
        <h1 style={{ fontFamily: "'Satoshi', sans-serif", fontWeight: 700, fontSize: '2rem', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
          Privacy Policy
        </h1>
        <p style={{ color: 'rgba(242,239,233,0.35)', fontSize: '0.875rem', marginBottom: '2.5rem' }}>
          Last updated: July 2026
        </p>

        <div style={{ lineHeight: '1.75', color: 'rgba(242,239,233,0.75)', fontSize: '0.9375rem' }}>

          <Section title="1. Who we are">
            Nativ is a reservation management platform for restaurants. This Privacy Policy explains how we collect, use, and protect the personal information of both restaurant operators (our clients) and their guests (end users who make reservations).
          </Section>

          <Section title="2. Information we collect">
            <p>When a guest makes a reservation through a Nativ-powered page, we collect:</p>
            <ul>
              <li>Full name, email address, and phone number</li>
              <li>Reservation details (date, time, party size, occasion, notes)</li>
              <li>Payment information for deposits (processed by Stripe — we do not store card data)</li>
            </ul>
            <p>When a restaurant operator registers an account, we collect:</p>
            <ul>
              <li>Email address and password (hashed)</li>
              <li>Restaurant name, address, and contact information</li>
              <li>Billing information (processed by Stripe)</li>
            </ul>
          </Section>

          <Section title="3. How we use your information">
            <p>We use guest information solely to:</p>
            <ul>
              <li>Create and manage reservation records</li>
              <li>Send booking confirmation and reminder emails</li>
              <li>Allow the restaurant to contact guests about their reservation</li>
              <li>Enable the restaurant to maintain a guest history for service purposes</li>
            </ul>
            <p>We do not sell, rent, or share guest information with third parties for marketing purposes.</p>
          </Section>

          <Section title="4. Third-party services">
            <p>We use the following third-party services to operate the platform:</p>
            <ul>
              <li><strong>Supabase</strong> — database and authentication</li>
              <li><strong>Stripe</strong> — payment processing for deposits and subscriptions</li>
              <li><strong>Resend</strong> — transactional email delivery</li>
              <li><strong>Vercel</strong> — hosting and infrastructure</li>
            </ul>
            <p>Each of these providers has their own privacy policy and processes data according to applicable laws.</p>
          </Section>

          <Section title="5. Data retention">
            Guest data is retained for as long as the restaurant account is active. Restaurant operators may request deletion of specific guest records from within the platform. When a restaurant account is permanently closed, associated guest data is deleted within 30 days.
          </Section>

          <Section title="6. Your rights">
            <p>Depending on your location, you may have the right to:</p>
            <ul>
              <li>Access the personal information we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Object to or restrict how we process your data</li>
            </ul>
            <p>To exercise any of these rights, contact us at <strong>privacy@nativ.business</strong>.</p>
          </Section>

          <Section title="7. Security">
            We use industry-standard security measures including encryption in transit (HTTPS/TLS) and at rest. Access to personal data is restricted to authorized personnel only.
          </Section>

          <Section title="8. Cookies">
            We use only essential session cookies required for authentication. We do not use tracking or advertising cookies.
          </Section>

          <Section title="9. SMS / text messaging">
            <p>If you provide your phone number when making a reservation, you consent to receive transactional text messages (reservation confirmations and reminders) from the restaurant you booked with, sent through our platform. Message frequency varies based on your reservation activity. Message and data rates may apply.</p>
            <ul>
              <li>Reply <strong>STOP</strong> at any time to opt out of text messages.</li>
              <li>Reply <strong>HELP</strong> for assistance.</li>
            </ul>
            <p><strong>No mobile information will be shared with third parties or affiliates for marketing or promotional purposes.</strong> All the above categories exclude text messaging originator opt-in data and consent; this information will not be shared with any third parties.</p>
          </Section>

          <Section title="10. Changes to this policy">
            We may update this Privacy Policy from time to time. Continued use of the platform after changes are posted constitutes acceptance of the updated policy.
          </Section>

          <Section title="11. Contact">
            For privacy-related questions, contact us at <strong>privacy@nativ.business</strong>.
          </Section>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '2rem', paddingBottom: '2rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <h2 style={{ fontFamily: "'Satoshi', sans-serif", fontWeight: 700, fontSize: '1.0625rem', color: '#F2EFE9', marginBottom: '0.75rem' }}>
        {title}
      </h2>
      <div style={{ color: 'rgba(242,239,233,0.65)' }}>{children}</div>
    </div>
  )
}
