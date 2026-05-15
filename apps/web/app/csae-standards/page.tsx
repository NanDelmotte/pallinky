import Link from 'next/link';

export const metadata = {
  title: 'CSAE Standards | Pallinky',
  description:
    'Pallinky standards against child sexual abuse and exploitation (CSAE).',
};

export default function CSAEStandardsPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background:
          'linear-gradient(180deg, #f8fbf3 0%, #eef5e5 50%, #e7f0db 100%)',
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
        <h1
          style={{
            margin: 0,
            fontSize: 'clamp(2rem, 5vw, 3rem)',
            lineHeight: 1.05,
            fontWeight: 800,
            color: '#1f2a12',
            letterSpacing: '-0.03em',
          }}
        >
          Child Safety Standards
        </h1>

        <p
          style={{
            marginTop: '16px',
            fontSize: '1.05rem',
            lineHeight: 1.7,
            color: '#4f5d43',
          }}
        >
          Pallinky has zero tolerance for child sexual abuse and exploitation
          (CSAE), including child sexual abuse material (CSAM), grooming,
          sexual extortion, trafficking, or any behavior that exploits or
          endangers minors.
        </p>

        <section style={{ marginTop: '32px' }}>
          <h2 style={{ color: '#1f2a12', fontSize: '1.3rem' }}>
            Our standards
          </h2>
          <ul
            style={{
              marginTop: '12px',
              paddingLeft: '20px',
              color: '#4f5d43',
              lineHeight: 1.8,
            }}
          >
            <li>
              Users may not post, share, request, store, promote, or distribute
              content that sexually exploits or endangers children.
            </li>
            <li>
              Users may not use Pallinky to groom minors, solicit sexual
              content involving minors, or facilitate abusive or exploitative
              conduct.
            </li>
            <li>
              Any content or behavior suggesting child exploitation is strictly
              prohibited and may result in immediate account action.
            </li>
            <li>
              Where appropriate, Pallinky may remove content, suspend or
              terminate accounts, and report relevant material or activity to
              law enforcement or appropriate child protection organizations.
            </li>
          </ul>
        </section>

        <section style={{ marginTop: '28px' }}>
          <h2 style={{ color: '#1f2a12', fontSize: '1.3rem' }}>
            Reporting
          </h2>
          <p style={{ color: '#4f5d43', lineHeight: 1.8 }}>
            If you believe content or behavior on Pallinky may violate these
            standards, contact us immediately at{' '}
            <a
              href="mailto:safety@pallinky.com"
              style={{ color: '#43691b', fontWeight: 600 }}
            >
              safety@pallinky.com
            </a>
            . Please include any relevant details so we can review the report
            promptly.
          </p>
        </section>

        <section style={{ marginTop: '28px' }}>
          <h2 style={{ color: '#1f2a12', fontSize: '1.3rem' }}>
            Enforcement
          </h2>
          <p style={{ color: '#4f5d43', lineHeight: 1.8 }}>
            Pallinky reviews credible reports of child safety violations and
            takes action as needed, which may include removing content,
            restricting features, suspending accounts, terminating access, and
            escalating reports to relevant authorities.
          </p>
        </section>

        <section style={{ marginTop: '28px' }}>
          <h2 style={{ color: '#1f2a12', fontSize: '1.3rem' }}>
            Contact
          </h2>
          <p style={{ color: '#4f5d43', lineHeight: 1.8 }}>
            For child safety concerns, contact{' '}
            <a
              href="mailto:uitnod84@gmail.com"
              style={{ color: '#43691b', fontWeight: 600 }}
            >
              uitnod84@gmail.com
            </a>
            .
          </p>
        </section>

        <div
          style={{
            marginTop: '36px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <Link
            href="/"
            style={{
              color: '#43691b',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            Home
          </Link>
          <Link
            href="/privacy"
            style={{
              color: '#43691b',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            Privacy
          </Link>
          <Link
            href="/support"
            style={{
              color: '#43691b',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            Support
          </Link>
        </div>
      </div>
    </main>
  );
}