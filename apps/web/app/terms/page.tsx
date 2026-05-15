import Link from 'next/link';

export const metadata = {
  title: 'Terms of Use | Pallinky',
  description: 'Pallinky Terms of Use and user safety rules.',
};

export default function TermsPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #f8fbf3 0%, #eef5e5 50%, #e7f0db 100%)',
        padding: '32px 20px',
      }}
    >
      <div
        style={{
          maxWidth: '820px',
          margin: '0 auto',
          background: '#ffffff',
          borderRadius: '28px',
          padding: '40px 28px',
          boxShadow: '0 20px 60px rgba(67, 105, 27, 0.12)',
          border: '1px solid rgba(67, 105, 27, 0.12)',
        }}
      >
        <h1 style={{ margin: 0, fontSize: 'clamp(2rem, 5vw, 3rem)', lineHeight: 1.05, fontWeight: 800, color: '#1f2a12' }}>
          Terms of Use
        </h1>

        <p style={{ marginTop: '16px', fontSize: '1.05rem', lineHeight: 1.7, color: '#4f5d43' }}>
          By using Pallinky, you agree to these terms. If you do not agree, do not use the app.
        </p>

        <section style={{ marginTop: '32px' }}>
          <h2 style={{ color: '#1f2a12', fontSize: '1.3rem' }}>User conduct</h2>
          <p style={{ color: '#4f5d43', lineHeight: 1.8 }}>
            Pallinky has no tolerance for objectionable content or abusive users. You may not use Pallinky to harass, threaten, abuse, spam, impersonate, exploit, or harm others.
          </p>
          <ul style={{ marginTop: '12px', paddingLeft: '20px', color: '#4f5d43', lineHeight: 1.8 }}>
            <li>No harassment, bullying, hate speech, threats, or abusive behavior.</li>
            <li>No offensive, illegal, sexually exploitative, violent, or harmful content.</li>
            <li>No spam, scams, unwanted contact, or misuse of invitations or messaging.</li>
            <li>No content or behavior that exploits or endangers minors.</li>
          </ul>
        </section>

        <section style={{ marginTop: '28px' }}>
          <h2 style={{ color: '#1f2a12', fontSize: '1.3rem' }}>User-generated content</h2>
          <p style={{ color: '#4f5d43', lineHeight: 1.8 }}>
            You are responsible for the content you create, send, upload, or share through Pallinky, including events, messages, profile information, images, notes, and invitations.
          </p>
        </section>

        <section style={{ marginTop: '28px' }}>
          <h2 style={{ color: '#1f2a12', fontSize: '1.3rem' }}>Reporting and blocking</h2>
          <p style={{ color: '#4f5d43', lineHeight: 1.8 }}>
            Users can report objectionable content or abusive behavior and can block other users. Blocking removes the blocked user’s content from the blocker’s view where applicable and prevents normal direct interaction.
          </p>
        </section>

        <section style={{ marginTop: '28px' }}>
          <h2 style={{ color: '#1f2a12', fontSize: '1.3rem' }}>Moderation and enforcement</h2>
          <p style={{ color: '#4f5d43', lineHeight: 1.8 }}>
            Pallinky may review reports and take action within 24 hours where appropriate. We may remove content, restrict features, suspend accounts, terminate access, or report unlawful activity to appropriate authorities.
          </p>
        </section>

        <section style={{ marginTop: '28px' }}>
          <h2 style={{ color: '#1f2a12', fontSize: '1.3rem' }}>Account termination</h2>
          <p style={{ color: '#4f5d43', lineHeight: 1.8 }}>
            We may suspend or terminate accounts that violate these terms, create safety risks, abuse other users, or misuse Pallinky.
          </p>
        </section>

        <section style={{ marginTop: '28px' }}>
          <h2 style={{ color: '#1f2a12', fontSize: '1.3rem' }}>Contact</h2>
          <p style={{ color: '#4f5d43', lineHeight: 1.8 }}>
            For safety or support concerns, contact{' '}
            <a href="mailto:safety@pallinky.com" style={{ color: '#43691b', fontWeight: 600 }}>
              safety@pallinky.com
            </a>
            .
          </p>
        </section>
<section style={{ marginTop: '28px' }}>
  <h2 style={{ color: '#1f2a12', fontSize: '1.3rem' }}>Disclaimer</h2>
  <p style={{ color: '#4f5d43', lineHeight: 1.8 }}>
    Pallinky is provided “as is” without warranties of any kind. We do not guarantee availability, accuracy, or reliability of the service. You use the app at your own risk.
  </p>
</section>
<section style={{ marginTop: '28px' }}>
  <h2 style={{ color: '#1f2a12', fontSize: '1.3rem' }}>Eligibility</h2>
  <p style={{ color: '#4f5d43', lineHeight: 1.8 }}>
    You must be at least 16 years old to use Pallinky.
  </p>
</section>
        <div style={{ marginTop: '36px', display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
          <Link href="/" style={{ color: '#43691b', textDecoration: 'none', fontWeight: 600 }}>
            Home
          </Link>
          <Link href="/privacy" style={{ color: '#43691b', textDecoration: 'none', fontWeight: 600 }}>
            Privacy
          </Link>
          <Link href="/csae" style={{ color: '#43691b', textDecoration: 'none', fontWeight: 600 }}>
            Child Safety Standards
          </Link>
          <Link href="/support" style={{ color: '#43691b', textDecoration: 'none', fontWeight: 600 }}>
            Support
          </Link>
        </div>
      </div>
    </main>
  );
}