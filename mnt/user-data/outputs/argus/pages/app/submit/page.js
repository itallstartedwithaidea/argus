'use client';
import { useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'https://argus.googleadsagent.ai';

export default function SubmitPage() {
  const [url, setUrl] = useState('');
  const [reason, setReason] = useState('');
  const [email, setEmail] = useState('');
  const [notify, setNotify] = useState(true);
  const [step, setStep] = useState('form'); // form | submitting | done | error
  const [submissionId, setSubmissionId] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (!url.trim()) { setError('Please enter a profile URL'); return; }
    setStep('submitting');
    setError('');

    try {
      const res = await fetch(`${API}/api/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          reason: reason.trim(),
          submitter_email: email.trim() || undefined,
          notify_on_publish: notify && !!email.trim()
        })
      });

      const data = await res.json();
      if (data.submission_id) {
        setSubmissionId(data.submission_id);
        setStep('done');
      } else {
        setError(data.error || 'Submission failed');
        setStep('form');
      }
    } catch (e) {
      setError('Network error. Please try again.');
      setStep('form');
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '12px 16px',
    borderRadius: 8,
    border: '1px solid #1B4F72',
    background: '#0a1628',
    color: '#e2e8f0',
    fontSize: 15,
    boxSizing: 'border-box',
    outline: 'none'
  };

  return (
    <div style={{ background: '#0D1B2A', minHeight: '100vh', fontFamily: 'Arial, sans-serif', color: '#e2e8f0' }}>

      <nav style={{ background: '#0a1628', borderBottom: '1px solid #1B4F72', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <a href="/" style={{ fontSize: 20, fontWeight: 900, color: '#fff', textDecoration: 'none' }}>👁️ ARGUS</a>
        <div style={{ fontSize: 13, color: '#64748b' }}>by googleadsagent.ai</div>
      </nav>

      <div style={{ maxWidth: 620, margin: '0 auto', padding: '60px 24px' }}>

        {step === 'done' ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 60, marginBottom: 16 }}>✅</div>
            <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 12 }}>Submission Received</h1>
            <p style={{ color: '#94a3b8', lineHeight: 1.7, marginBottom: 24 }}>
              Your submission is queued for analysis. Our team will review the results before anything is published.
              This typically takes 24–48 hours.
            </p>
            {email && notify && (
              <p style={{ color: '#64748b', fontSize: 14, marginBottom: 32 }}>
                We'll email <strong style={{ color: '#94a3b8' }}>{email}</strong> when a decision is made.
              </p>
            )}
            <div style={{ background: '#1a2e45', borderRadius: 8, padding: '12px 20px', display: 'inline-block', marginBottom: 32, color: '#64748b', fontSize: 13 }}>
              Reference ID: <strong style={{ color: '#94a3b8' }}>{submissionId}</strong>
            </div>
            <br />
            <a href="/submit"
              style={{ background: '#1B4F72', color: '#fff', padding: '12px 28px', borderRadius: 8, textDecoration: 'none', fontWeight: 700 }}>
              Submit Another
            </a>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 40 }}>
              <h1 style={{ fontSize: 32, fontWeight: 900, marginBottom: 8 }}>Submit a Profile for Analysis</h1>
              <p style={{ color: '#94a3b8', lineHeight: 1.7 }}>
                Paste any social media profile URL. Our system will run a full authenticity analysis.
                All submissions are reviewed by a human before anything is published.
              </p>
            </div>

            <div style={{ background: '#1a2e45', borderRadius: 10, padding: '14px 20px', marginBottom: 32, fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>
              <strong style={{ color: '#cbd5e1' }}>How it works:</strong> We analyze the profile using open-source detection models,
              then a human reviews the results. If published, the page will clearly state this is algorithmic analysis —
              not a verdict. The profile owner can always dispute the findings.
            </div>

            {error && (
              <div style={{ background: '#7c1d1d', borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: 14, color: '#fca5a5' }}>
                {error}
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#cbd5e1' }}>
                Profile URL *
              </label>
              <input
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://linkedin.com/in/username"
                style={inputStyle}
              />
              <div style={{ color: '#64748b', fontSize: 12, marginTop: 6 }}>
                Supports: LinkedIn, Reddit, Instagram, X/Twitter, Facebook
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#cbd5e1' }}>
                Why are you flagging this? (optional)
              </label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="e.g. This account reached out claiming to be a recruiter but had no verifiable history..."
                rows={4}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#cbd5e1' }}>
                Your email (optional)
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={inputStyle}
              />
            </div>

            {email && (
              <div style={{ marginBottom: 28, display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="checkbox"
                  id="notify"
                  checked={notify}
                  onChange={e => setNotify(e.target.checked)}
                  style={{ width: 18, height: 18, cursor: 'pointer' }}
                />
                <label htmlFor="notify" style={{ color: '#94a3b8', fontSize: 14, cursor: 'pointer' }}>
                  Notify me when this submission is reviewed and published
                </label>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={step === 'submitting'}
              style={{
                width: '100%', padding: '14px', background: step === 'submitting' ? '#1a2e45' : '#1B4F72',
                color: '#fff', border: 'none', borderRadius: 8, fontSize: 16, fontWeight: 700, cursor: 'pointer'
              }}
            >
              {step === 'submitting' ? '⏳ Submitting...' : 'Submit for Analysis'}
            </button>

            <div style={{ marginTop: 24, color: '#475569', fontSize: 13, lineHeight: 1.6, textAlign: 'center' }}>
              By submitting, you confirm you are not attempting to target someone maliciously.
              Abusive submissions will be discarded.{' '}
              <a href="/methodology" style={{ color: '#64748b' }}>View our methodology.</a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
