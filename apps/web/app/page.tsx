import Link from 'next/link';

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background:
          'linear-gradient(180deg, #f8fbf3 0%, #eef5e5 50%, #e7f0db 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '720px',
          background: '#ffffff',
          borderRadius: '28px',
          padding: '40px 28px',
          boxShadow: '0 20px 60px rgba(67, 105, 27, 0.12)',
          border: '1px solid rgba(67, 105, 27, 0.12)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '72px',
            height: '72px',
            margin: '0 auto 20px',
            borderRadius: '20px',
            background: '#43691b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            fontSize: '30px',
            fontWeight: 700,
            boxShadow: '0 10px 30px rgba(67, 105, 27, 0.22)',
          }}
        >
          P
        </div>

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
          Pallinky
        </h1>

        <p
          style={{
            margin: '16px auto 0',
            maxWidth: '520px',
            fontSize: '1.08rem',
            lineHeight: 1.6,
            color: '#4f5d43',
          }}
        >
          Organize real-life plans without messy group chats. Create an event,
          share your link, and see who’s coming.
        </p>

        <div
          style={{
            display: 'grid',
            gap: '14px',
            marginTop: '32px',
          }}
        > 

          <a
            href="https://apps.apple.com/app/pallinky/id6760797135"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '56px',
              padding: '0 20px',
              borderRadius: '16px',
              background: '#43691b',
              color: '#ffffff',
              textDecoration: 'none',
              fontWeight: 700,
              fontSize: '1rem',
              boxShadow: '0 10px 24px rgba(67, 105, 27, 0.18)',
            }}
          >
            Download on the App Store
          </a>

          <a
            href="https://pallinky.com/pallinky.apk"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '56px',
              padding: '0 20px',
              borderRadius: '16px',
              background: '#eff5e7',
              color: '#2c3a1d',
              textDecoration: 'none',
              fontWeight: 700,
              fontSize: '1rem',
              border: '1px solid rgba(67, 105, 27, 0.16)',
            }}
          >
            Get it on Google Play
          </a>
        </div>

        <div
          style={{
            marginTop: '28px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            justifyContent: 'center',
          }}
        >
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

          <span style={{ color: '#a0ad92' }}>•</span>

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