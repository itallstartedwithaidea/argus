import { notFound } from 'next/navigation';

// Fetch from Cloudflare Worker API at build/request time
async function getProfile(slug) {
  const res = await fetch(
    `${process.env.API_URL}/api/profile-by-slug/${slug}`,
    { next: { revalidate: 3600 } }
  );
  if (!res.ok) return null;
  return res.json();
}

export async function generateMetadata({ params }) {
  const profile = await getProfile(params.slug);
  if (!profile) return {};
  return {
    title: `${profile.display_name || profile.handle} — Flagged Profile Analysis | Argus`,
    description: `Argus authenticity analysis for ${profile.handle} on ${profile.platform}. Trust Score: ${profile.trust_score}/100. ${profile.verdict_summary?.slice(0, 120)}`,
    robots: 'index, follow'
  };
}

export default async function ProfilePage({ params }) {
  const profile = await getProfile(params.slug);
  if (!profile || profile.status === 'removed') notFound();

  const signals = typeof profile.signals === 'string'
    ? JSON.parse(profile.signals)
    : profile.signals || {};

  const disputeCount = profile.dispute_count || 0;
  const communityCount = profile.community_report_count || 0;
  const analysisDate = new Date(profile.published_at || profile.created_at);

  function getRiskColor(score) {
    if (score <= 25) return '#dc2626';
    if (score <= 40) return '#ea580c';
    if (score <= 60) return '#d97706';
    return '#16a34a';
  }

  function getRiskLabel(score) {
    if (score <= 25) return 'CRITICAL RISK';
    if (score <= 40) return 'HIGH RISK';
    if (score <= 60) return 'MEDIUM RISK';
    return 'LOW RISK';
  }

  function getScoreBar(score) {
    const pct = score;
    const color = getRiskColor(score);
    return (
      <div style={{ background: '#1a2e45', borderRadius: 4, height: 8, width: '100%', marginTop: 6 }}>
        <div style={{ background: color, width: `${pct}%`, height: '100%', borderRadius: 4 }} />
      </div>
    );
  }

  const riskColor = getRiskColor(profile.trust_score);

  return (
    <div style={{ background: '#0D1B2A', minHeight: '100vh', fontFamily: 'Arial, sans-serif', color: '#e2e8f0' }}>

      {/* Top nav */}
      <nav style={{ background: '#0a1628', borderBottom: '1px solid #1B4F72', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <a href="/" style={{ fontSize: 20, fontWeight: 900, color: '#fff', textDecoration: 'none', letterSpacing: 1 }}>
          👁️ ARGUS
        </a>
        <div style={{ fontSize: 13, color: '#64748b' }}>by googleadsagent.ai</div>
      </nav>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px' }}>

        {/* Legal disclaimer banner */}
        <div style={{ background: '#1a2e45', border: '1px solid #1B4F72', borderRadius: 10, padding: '14px 20px', marginBottom: 32, fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>
          <strong style={{ color: '#cbd5e1' }}>This is algorithmic analysis, not an editorial verdict.</strong> Scores reflect automated pattern matching against known synthetic account signals. This analysis expresses an opinion based on disclosed methodology. You decide. <a href="/methodology" style={{ color: '#38bdf8' }}>View full methodology →</a>
        </div>

        {/* Header card */}
        <div style={{ background: '#111f35', border: `1px solid ${riskColor}`, borderRadius: 16, padding: 32, marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ fontSize: 13, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                {profile.platform} · Analyzed {analysisDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
              <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0, marginBottom: 4 }}>
                {profile.display_name || profile.handle}
              </h1>
              <a href={profile.profile_url} target="_blank" rel="noopener noreferrer"
                style={{ color: '#38bdf8', fontSize: 14 }}>
                {profile.profile_url}
              </a>
            </div>

            {/* Big score */}
            <div style={{ textAlign: 'center', background: '#0D1B2A', borderRadius: 12, padding: '20px 28px', border: `2px solid ${riskColor}` }}>
              <div style={{ fontSize: 56, fontWeight: 900, color: riskColor, lineHeight: 1 }}>{profile.trust_score}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>TRUST SCORE / 100</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: riskColor, marginTop: 6 }}>⚠️ {getRiskLabel(profile.trust_score)}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Confidence: {profile.confidence}%</div>
            </div>
          </div>

          {/* Verdict */}
          <div style={{ marginTop: 24, padding: '16px 20px', background: '#0D1B2A', borderRadius: 10, borderLeft: `4px solid ${riskColor}` }}>
            <div style={{ fontWeight: 700, marginBottom: 6, color: '#cbd5e1' }}>Analysis Summary</div>
            <div style={{ color: '#94a3b8', lineHeight: 1.7 }}>{profile.verdict_summary}</div>
          </div>

          {/* Evidence links */}
          <div style={{ marginTop: 20, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {profile.wayback_url && (
              <a href={profile.wayback_url} target="_blank" rel="noopener noreferrer"
                style={{ background: '#1a2e45', color: '#94a3b8', padding: '6px 14px', borderRadius: 6, fontSize: 12, textDecoration: 'none', border: '1px solid #1B4F72' }}>
                🕐 Archived Snapshot
              </a>
            )}
            {profile.evidence_r2_key && (
              <a href={`/api/evidence/${profile.id}`}
                style={{ background: '#1a2e45', color: '#94a3b8', padding: '6px 14px', borderRadius: 6, fontSize: 12, textDecoration: 'none', border: '1px solid #1B4F72' }}>
                📦 Download Evidence JSON
              </a>
            )}
            <span style={{ background: '#1a2e45', color: '#94a3b8', padding: '6px 14px', borderRadius: 6, fontSize: 12, border: '1px solid #1B4F72' }}>
              🤖 Model v{profile.model_version}
            </span>
          </div>
        </div>

        {/* Signal breakdown */}
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 20, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: 1 }}>
            Signal Breakdown
          </h2>

          {Object.entries(signals).map(([engine, result]) => {
            if (!result) return null;
            const engineSignals = result.signals || [];
            const engineColor = getRiskColor(result.score);
            return (
              <div key={engine} style={{ background: '#111f35', borderRadius: 12, marginBottom: 16, overflow: 'hidden', border: '1px solid #1a2e45' }}>
                {/* Engine header */}
                <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1a2e45' }}>
                  <div>
                    <div style={{ fontWeight: 700, textTransform: 'capitalize', fontSize: 16 }}>{engine} Analysis</div>
                    <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 2 }}>{result.reason}</div>
                  </div>
                  <div style={{ textAlign: 'center', minWidth: 70 }}>
                    <div style={{ fontSize: 32, fontWeight: 900, color: engineColor }}>{result.score}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>/ 100</div>
                  </div>
                </div>

                {/* Individual signals */}
                {engineSignals.length > 0 && (
                  <div style={{ padding: '16px 20px' }}>
                    {engineSignals.map((sig, i) => (
                      <div key={i} style={{ marginBottom: i < engineSignals.length - 1 ? 16 : 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#cbd5e1' }}>
                            {sig.severity === 'high' ? '🔴' : sig.severity === 'medium' ? '🟡' : '🟢'} {sig.name}
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: getRiskColor(sig.score) }}>{sig.score}/100</div>
                        </div>
                        {getScoreBar(sig.score)}
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>{sig.detail}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Community reports */}
        <div style={{ background: '#111f35', borderRadius: 12, padding: 24, marginBottom: 32, border: '1px solid #1a2e45' }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1, color: '#94a3b8' }}>Community Reports</h2>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>Independent reports from other users</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: communityCount > 5 ? '#dc2626' : '#94a3b8' }}>
            {communityCount}
          </div>
          <div style={{ fontSize: 13, color: '#64748b' }}>independent community flags</div>
          <button
            onClick={() => window.location.href = `/report?profile_id=${profile.id}`}
            style={{ marginTop: 16, background: 'transparent', border: '1px solid #1B4F72', color: '#94a3b8', padding: '8px 16px', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}
          >
            Flag this profile yourself
          </button>
        </div>

        {/* Methodology */}
        <div style={{ background: '#111f35', borderRadius: 12, padding: 24, marginBottom: 32, border: '1px solid #1a2e45' }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1, color: '#94a3b8' }}>Methodology & False Positive Rate</h2>
          <div style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.7, marginBottom: 12 }}>
            Scores are generated by the open-source TruthLayer detection pipeline. All scoring logic is publicly auditable on GitHub.
            At a confidence level of {profile.confidence}%, this score has an estimated false positive rate of approximately{' '}
            {profile.confidence > 85 ? '4-5%' : profile.confidence > 70 ? '8-10%' : '12-15%'}.
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <a href="https://github.com/itallstartedwithaidea/truthlayer" target="_blank" rel="noopener noreferrer"
              style={{ color: '#38bdf8', fontSize: 13, textDecoration: 'none' }}>
              📖 View full methodology on GitHub →
            </a>
            <a href="/methodology" style={{ color: '#38bdf8', fontSize: 13, textDecoration: 'none' }}>
              📋 Scoring documentation →
            </a>
          </div>
        </div>

        {/* Dispute / Opt-out */}
        <div style={{ background: '#0a1628', borderRadius: 12, padding: 32, border: '2px solid #1B4F72' }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Is This Your Profile?</h2>
          <div style={{ color: '#94a3b8', marginBottom: 8, lineHeight: 1.6 }}>
            If you believe this analysis is incorrect, you can submit a dispute. Disputes are reviewed within{' '}
            <strong style={{ color: '#cbd5e1' }}>14 business days</strong>. You will be notified by email of the outcome.
          </div>
          <div style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>
            Supporting evidence strengthens your dispute. Government ID, employer confirmation, or cross-platform presence 
            predating account creation are the strongest forms of evidence.
          </div>

          {disputeCount > 0 && (
            <div style={{ background: '#1a2e45', borderRadius: 8, padding: '10px 16px', marginBottom: 20, fontSize: 13, color: '#94a3b8' }}>
              {disputeCount} dispute{disputeCount > 1 ? 's' : ''} previously submitted for this profile.
            </div>
          )}

          <a
            href={`/dispute?profile_id=${profile.id}&platform=${profile.platform}&handle=${profile.handle}`}
            style={{ display: 'inline-block', background: '#1B4F72', color: '#fff', padding: '12px 28px', borderRadius: 8, fontSize: 15, fontWeight: 700, textDecoration: 'none' }}
          >
            Submit a Dispute / Opt-Out Request
          </a>
        </div>

      </div>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid #1a2e45', padding: '32px 24px', textAlign: 'center', color: '#475569', fontSize: 13, marginTop: 40 }}>
        <div style={{ marginBottom: 8 }}>
          ARGUS by <a href="https://googleadsagent.ai" style={{ color: '#38bdf8' }}>googleadsagent.ai</a> — 
          Algorithmic authenticity analysis. Not an editorial verdict. You decide.
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 24, flexWrap: 'wrap' }}>
          <a href="/methodology" style={{ color: '#475569', textDecoration: 'none' }}>Methodology</a>
          <a href="/about" style={{ color: '#475569', textDecoration: 'none' }}>About</a>
          <a href="/submit" style={{ color: '#475569', textDecoration: 'none' }}>Submit a Profile</a>
          <a href="https://github.com/itallstartedwithaidea/truthlayer" style={{ color: '#475569', textDecoration: 'none' }}>GitHub</a>
          <a href="/privacy" style={{ color: '#475569', textDecoration: 'none' }}>Privacy</a>
        </div>
      </footer>
    </div>
  );
}
