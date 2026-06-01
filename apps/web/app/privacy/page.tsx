export default function PrivacyPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#F6F7F9',
        color: '#1f2a1b',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        padding: '32px 20px 64px',
      }}
    >
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <section
          style={{
            background: '#FFFFFF',
            border: '1px solid #e7ede2',
            borderRadius: 20,
            padding: 28,
            boxShadow: '0 8px 24px rgba(0,0,0,0.04)',
            marginBottom: 18,
          }}
        >
          <h1 style={{ fontSize: 34, margin: '0 0 12px' }}>
            Privacy Policy
          </h1>
          <p style={{ margin: '0 0 14px', color: '#66715f' }}>
            Last updated: March 2026
          </p>

          <p style={{ margin: '0 0 14px' }}>
            Pallinky helps people create and share real-life plans. This policy
            explains what data we collect, how we use it, and your rights.
          </p>
        </section>

        {/* DATA WE COLLECT */}
        <section
          style={{
            background: '#FFFFFF',
            border: '1px solid #e7ede2',
            borderRadius: 20,
            padding: 28,
            marginBottom: 18,
          }}
        >
          <h2 style={{ margin: '0 0 12px' }}>Data we collect</h2>

          <ul style={{ paddingLeft: 20, lineHeight: 1.6 }}>
            <li>
              <strong>Account information:</strong> email address used to log in
            </li>
            <li>
              <strong>Event data:</strong> event titles, descriptions, dates,
              locations, invite lists, RSVPs
            </li>
            <li>
              <strong>Usage data:</strong> basic interaction data to improve the
              app
            </li>
            <li>
              <strong>Device data:</strong> device type and app version for
              reliability and debugging
            </li>
          </ul>
        </section>

        {/* HOW WE USE DATA */}
        <section
          style={{
            background: '#FFFFFF',
            border: '1px solid #e7ede2',
            borderRadius: 20,
            padding: 28,
            marginBottom: 18,
          }}
        >
          <h2 style={{ margin: '0 0 12px' }}>How we use data</h2>

          <ul style={{ paddingLeft: 20, lineHeight: 1.6 }}>
            <li>To create and manage events</li>
            <li>To send invites and track RSVPs</li>
            <li>To improve app performance and reliability</li>
            <li>To provide support and respond to issues</li>
          </ul>
        </section>

        {/* CONTACTS */}
        <section
          style={{
            background: '#FFFFFF',
            border: '1px solid #e7ede2',
            borderRadius: 20,
            padding: 28,
            marginBottom: 18,
          }}
        >
          <h2 style={{ margin: '0 0 12px' }}>Contacts</h2>

          <p style={{ margin: '0 0 14px' }}>
            Pallinky does not import your phone contacts. You can invite people
            by sharing a personal invite link through apps like WhatsApp,
            Messages, or email.
          </p>
        </section>

        {/* SHARING */}
        <section
          style={{
            background: '#FFFFFF',
            border: '1px solid #e7ede2',
            borderRadius: 20,
            padding: 28,
            marginBottom: 18,
          }}
        >
          <h2 style={{ margin: '0 0 12px' }}>Data sharing</h2>

          <p style={{ margin: '0 0 14px' }}>
            We do not sell your data.
          </p>

          <p style={{ margin: '0 0 14px' }}>
            We may use trusted service providers (such as hosting and database
            services) to operate Pallinky. These providers process data only as
            needed to deliver the service.
          </p>
        </section>

        {/* RETENTION */}
        <section
          style={{
            background: '#FFFFFF',
            border: '1px solid #e7ede2',
            borderRadius: 20,
            padding: 28,
            marginBottom: 18,
          }}
        >
          <h2 style={{ margin: '0 0 12px' }}>Data retention</h2>

          <p style={{ margin: '0 0 14px' }}>
            We retain your data only as long as necessary to provide the service.
            You can request deletion of your data at any time.
          </p>
        </section>

        {/* RIGHTS */}
        <section
          style={{
            background: '#FFFFFF',
            border: '1px solid #e7ede2',
            borderRadius: 20,
            padding: 28,
            marginBottom: 18,
          }}
        >
          <h2 style={{ margin: '0 0 12px' }}>Your rights</h2>

          <ul style={{ paddingLeft: 20, lineHeight: 1.6 }}>
            <li>Request access to your data</li>
            <li>Request deletion of your data</li>
            <li>Withdraw permissions (such as contacts) at any time</li>
          </ul>
        </section>

        {/* CONTACT */}
        <section
          style={{
            background: '#FFFFFF',
            border: '1px solid #e7ede2',
            borderRadius: 20,
            padding: 28,
            marginBottom: 18,
          }}
        >
          <h2 style={{ margin: '0 0 12px' }}>Contact</h2>

          <p>
            For any privacy-related questions or requests, contact:
          </p>

          <p style={{ fontWeight: 600 }}>
            uitnod84@gmail.com
          </p>
        </section>

        <div
          style={{
            textAlign: 'center',
            color: '#66715f',
            fontSize: 14,
            marginTop: 16,
          }}
        >
          © 2026 Pallinky
        </div>
      </div>
    </main>
  );
}
