export default function TermsPage() {
  const C = { midnight: '#0d1b2a', offwhite: '#F2EFE9' }

  return (
    <div style={{ backgroundColor: C.midnight, minHeight: '100vh', color: C.offwhite }}>
      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '3rem 1.5rem 6rem' }}>
        <a href="/" style={{ color: 'rgba(242,239,233,0.35)', fontSize: '0.875rem', textDecoration: 'none', display: 'inline-block', marginBottom: '2.5rem' }}>
          ← Back to Nativ
        </a>
        <h1 style={{ fontFamily: "'Satoshi', sans-serif", fontWeight: 700, fontSize: '2rem', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
          Terms of Service
        </h1>
        <p style={{ color: 'rgba(242,239,233,0.35)', fontSize: '0.875rem', marginBottom: '2.5rem' }}>
          Last updated: July 2026
        </p>

        <div style={{ lineHeight: '1.75', color: 'rgba(242,239,233,0.75)', fontSize: '0.9375rem' }}>

          <Section title="1. Acceptance of terms">
            By creating an account or using the Nativ platform, you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the platform.
          </Section>

          <Section title="2. Description of service">
            Nativ provides a software-as-a-service platform that allows restaurants to manage reservations, communicate with guests, and configure booking experiences. The service is provided on a subscription basis.
          </Section>

          <Section title="3. Account registration">
            You must provide accurate and complete information when creating an account. You are responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account.
          </Section>

          <Section title="4. Subscription and billing">
            <ul>
              <li>Nativ offers subscription plans billed monthly or annually.</li>
              <li>A free trial period may be offered. At the end of the trial, a paid subscription is required to continue using the service.</li>
              <li>Payments are processed by Stripe. By subscribing, you authorize Nativ to charge your payment method on a recurring basis.</li>
              <li>Subscriptions may be cancelled at any time. Cancellation takes effect at the end of the current billing period.</li>
              <li>Nativ reserves the right to change pricing with 30 days' notice.</li>
            </ul>
          </Section>

          <Section title="5. Acceptable use">
            <p>You agree not to use Nativ to:</p>
            <ul>
              <li>Violate any applicable law or regulation</li>
              <li>Collect or store personal data without appropriate consent</li>
              <li>Send unsolicited communications to guests</li>
              <li>Attempt to gain unauthorized access to any part of the service</li>
              <li>Interfere with or disrupt the integrity or performance of the service</li>
            </ul>
          </Section>

          <Section title="6. Guest data">
            As a restaurant operator using Nativ, you are the data controller for the personal information of your guests. You are responsible for ensuring that your use of guest data complies with applicable data protection laws, including obtaining any necessary consents.
          </Section>

          <Section title="7. Intellectual property">
            Nativ and its associated trademarks, logos, and software are owned by Nativ and its licensors. You are granted a limited, non-exclusive, non-transferable license to use the platform solely for its intended purpose.
          </Section>

          <Section title="8. Limitation of liability">
            To the maximum extent permitted by law, Nativ shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the service, including but not limited to loss of revenue, loss of data, or business interruption.
          </Section>

          <Section title="9. Disclaimers">
            The service is provided "as is" and "as available" without warranties of any kind, express or implied. Nativ does not warrant that the service will be uninterrupted, error-free, or completely secure.
          </Section>

          <Section title="10. Termination">
            Nativ reserves the right to suspend or terminate accounts that violate these terms, are involved in fraudulent activity, or present a risk to other users or the platform.
          </Section>

          <Section title="11. Governing law">
            These terms are governed by and construed in accordance with applicable law. Any disputes shall be resolved in the courts of competent jurisdiction.
          </Section>

          <Section title="12. Changes to these terms">
            We may update these Terms of Service. Continued use of the platform after changes are posted constitutes acceptance of the updated terms.
          </Section>

          <Section title="13. Contact">
            For questions about these terms, contact us at <strong>hello@nativ.business</strong>.
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
