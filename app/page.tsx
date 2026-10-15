export default function Home() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0a0a0c', color: 'white' }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '3rem', fontWeight: 'bold', color: '#00d2ff' }}>DALTA ESPORTS</h1>
        <p style={{ marginTop: '1rem', fontSize: '1.25rem', color: '#ccc' }}>
          Tournament Management System
        </p>
        <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <a
            href="/auth/login"
            style={{ padding: '0.75rem 1.5rem', background: '#00d2ff', color: '#000', textDecoration: 'none', borderRadius: '8px', fontWeight: 'bold' }}
          >
            Login
          </a>
          <a
            href="/auth/register"
            style={{ padding: '0.75rem 1.5rem', border: '2px solid #00d2ff', color: '#00d2ff', textDecoration: 'none', borderRadius: '8px', fontWeight: 'bold' }}
          >
            Register
          </a>
        </div>
      </div>
    </div>
  )
}
