//app/web/support/page.tsx

export default function SupportPage() {
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
      <div
        style={{
          maxWidth: 820,
          margin: '0 auto',
        }}
      >
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
          <div
            style={{
              display: 'inline-block',
              padding: '6px 10px',
              borderRadius: 999,
              background: '#eef4e8',
              color: '#43691b',
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 12,
            }}
          >
            Pallinky Support
          </div>

          <h1
            style={{
              fontSize: 34,
              lineHeight: 1.1,
              margin: '0 0 12px',
            }}
          >
            Need help with Pallinky?
          </h1>

          <p style={{ margin: '0 0 14px', lineHeight: 1.55 }}>
            Pallinky helps people create plans, share one simple link, and keep
            track of RSVPs without group chat chaos.
          </p>

          <p style={{ margin: '0 0 14px', lineHeight: 1.55 }}>
            If something is not working, email us at{' '}
            <a
              href="mailto:uitnod84@gmail.com"
              style={{ color: '#43691b', fontWeight: 600, textDecoration: 'none' }}
            >
              uitnod84@gmail.com
            </a>
            .
          </p>

          <p style={{ margin: 0, fontSize: 14, color: '#66715f' }}>
            Replace this email address if you want to use a different support
            inbox before publishing.
          </p>
        </section>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 16,
            marginBottom: 18,
          }}
        >
          <section
            style={{
              background: '#FFFFFF',
              border: '1px solid #e7ede2',
              borderRadius: 20,
              padding: 28,
              boxShadow: '0 8px 24px rgba(0,0,0,0.04)',
            }}
          >
            <h2 style={{ fontSize: 22, margin: '0 0 12px' }}>Common issues</h2>
            <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.6 }}>
              <li>
                <strong>Invite link will not open:</strong> update to the latest
                version of Pallinky, then try the link again.
              </li>
              <li>
                <strong>I did not get my login email:</strong> check spam or
                promotions folders and make sure you entered the right email
                address.
              </li>
              <li>
                <strong>RSVP is not updating:</strong> close and reopen the app,
                then try again.
              </li>
              <li>
                <strong>Event details look wrong:</strong> ask the host to resend
                the event link or refresh the page.
              </li>
            </ul>
          </section>

          <section
            style={{
              background: '#FFFFFF',
              border: '1px solid #e7ede2',
              borderRadius: 20,
              padding: 28,
              boxShadow: '0 8px 24px rgba(0,0,0,0.04)',
            }}
          >
            <h2 style={{ fontSize: 22, margin: '0 0 12px' }}>
              What to include in your message
            </h2>
            <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.6 }}>
              <li>Your device type and operating system</li>
              <li>A short description of the problem</li>
              <li>The email address linked to your account, if relevant</li>
              <li>A screenshot, if available</li>
              <li>
                The event link or event name, if the issue is event-specific
              </li>
            </ul>
          </section>
        </div>

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
          <h2 style={{ fontSize: 22, margin: '0 0 12px' }}>Contact</h2>
          <p style={{ margin: '0 0 14px', lineHeight: 1.55 }}>
            Email:{' '}
            <a
              href="mailto:uitnod84@gmail.com"
              style={{ color: '#43691b', fontWeight: 600, textDecoration: 'none' }}
            >
              uitnod84@gmail.com
            </a>
          </p>
          <p style={{ margin: 0, color: '#66715f' }}>
            We aim to respond as quickly as possible.
          </p>
        </section>

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
          <h2 style={{ fontSize: 22, margin: '0 0 12px' }}>Privacy</h2>
          <p style={{ margin: '0 0 14px', lineHeight: 1.55 }}>
            For information about how Pallinky handles your data, view the{' '}
            <a
              href="https://pallinky.com/privacy"
              style={{ color: '#43691b', fontWeight: 600, textDecoration: 'none' }}
            >
              Privacy Policy
            </a>
            .
          </p>
          <p style={{ margin: 0, fontSize: 14, color: '#66715f' }}>
            Replace this privacy link if your final URL is different.
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