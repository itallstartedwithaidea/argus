'use client';
import { useState, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'https://argus.googleadsagent.ai';
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY || '';

export default function AdminDashboard() {
  const [queue, setQueue] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [tab, setTab] = useState('queue');
  const [selected, setSelected] = useState(null);
  const [adminKey, setAdminKey] = useState('');
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (authed) {
      fetchQueue();
      fetchDisputes();
    }
  }, [authed]);

  async function fetchQueue() {
    const res = await fetch(`${API}/api/admin/queue`, {
      headers: { 'X-Admin-Key': adminKey }
    });
    const data = await res.json();
    setQueue(data.submissions || []);
  }

  async function fetchDisputes() {
    const res = await fetch(`${API}/api/admin/disputes`, {
      headers: { 'X-Admin-Key': adminKey }
    });
    const data = await res.json();
    setDisputes(data.disputes || []);
  }

  async function approve(submissionId) {
    setLoading(true);
    const res = await fetch(`${API}/api/admin/approve`, {
      method: 'POST',
      headers: { 'X-Admin-Key': adminKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ submission_id: submissionId, admin_notes: note })
    });
    const data = await res.json();
    if (data.page_url) {
      alert(`✅ Published: ${data.page_url}`);
      setSelected(null);
      setNote('');
      fetchQueue();
    }
    setLoading(false);
  }

  async function reject(submissionId) {
    setLoading(true);
    await fetch(`${API}/api/admin/reject`, {
      method: 'POST',
      headers: { 'X-Admin-Key': adminKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ submission_id: submissionId, reason: note })
    });
    setSelected(null);
    setNote('');
    fetchQueue();
    setLoading(false);
  }

  async function resolveDispute(disputeId, resolution) {
    setLoading(true);
    await fetch(`${API}/api/admin/dispute/resolve`, {
      method: 'POST',
      headers: { 'X-Admin-Key': adminKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ dispute_id: disputeId, resolution, resolution_note: note })
    });
    setSelected(null);
    setNote('');
    fetchDisputes();
    setLoading(false);
  }

  function getRiskColor(score) {
    if (score <= 25) return '#dc2626';
    if (score <= 40) return '#ea580c';
    if (score <= 60) return '#d97706';
    return '#16a34a';
  }

  function getRiskLabel(score) {
    if (score <= 25) return 'CRITICAL';
    if (score <= 40) return 'HIGH';
    if (score <= 60) return 'MEDIUM';
    return 'LOW';
  }

  if (!authed) {
    return (
      <div style={{ minHeight: '100vh', background: '#0D1B2A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ background: '#1a2e45', borderRadius: 12, padding: 40, width: 380, border: '1px solid #1B4F72' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginBottom: 8 }}>ARGUS</div>
          <div style={{ color: '#64748b', marginBottom: 32 }}>Admin Dashboard</div>
          <input
            type="password"
            placeholder="Admin Key"
            value={adminKey}
            onChange={e => setAdminKey(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && setAuthed(true)}
            style={{ width: '100%', padding: '12px 16px', borderRadius: 8, border: '1px solid #1B4F72', background: '#0D1B2A', color: '#fff', fontSize: 14, boxSizing: 'border-box', marginBottom: 16 }}
          />
          <button
            onClick={() => setAuthed(true)}
            style={{ width: '100%', padding: '12px', background: '#1B4F72', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
          >
            Enter
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0D1B2A', fontFamily: 'Arial, sans-serif', color: '#fff' }}>
      {/* Header */}
      <div style={{ background: '#0a1628', borderBottom: '1px solid #1B4F72', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>ARGUS</div>
          <div style={{ color: '#64748b', fontSize: 14 }}>Admin Dashboard</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ background: '#1B4F72', borderRadius: 20, padding: '4px 12px', fontSize: 13 }}>{queue.length} pending</span>
          <span style={{ background: disputes.length > 0 ? '#7c1d1d' : '#1a3a2a', borderRadius: 20, padding: '4px 12px', fontSize: 13 }}>{disputes.length} disputes</span>
        </div>
      </div>

      <div style={{ display: 'flex', height: 'calc(100vh - 65px)' }}>
        {/* Sidebar */}
        <div style={{ width: 240, background: '#0a1628', borderRight: '1px solid #1B4F72', padding: 16 }}>
          {[
            { id: 'queue', label: '⏳ Approval Queue', count: queue.length },
            { id: 'disputes', label: '⚖️ Disputes', count: disputes.length },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setSelected(null); }}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 8, border: 'none',
                background: tab === t.id ? '#1B4F72' : 'transparent',
                color: tab === t.id ? '#fff' : '#94a3b8',
                fontSize: 14, cursor: 'pointer', textAlign: 'left', marginBottom: 4,
                display: 'flex', justifyContent: 'space-between'
              }}
            >
              {t.label}
              {t.count > 0 && <span style={{ background: '#dc2626', borderRadius: 10, padding: '1px 7px', fontSize: 11 }}>{t.count}</span>}
            </button>
          ))}
        </div>

        {/* Main content */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* List panel */}
          <div style={{ width: 380, borderRight: '1px solid #1B4F72', overflowY: 'auto' }}>
            {tab === 'queue' && queue.map(item => (
              <div
                key={item.id}
                onClick={() => setSelected(item)}
                style={{
                  padding: '16px 20px', borderBottom: '1px solid #1a2e45',
                  cursor: 'pointer', background: selected?.id === item.id ? '#1a2e45' : 'transparent',
                  transition: 'background 0.15s'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#e2e8f0' }}>{item.input_url?.split('/').slice(-2).join('/')}</div>
                  {item.trust_score != null && (
                    <span style={{ background: getRiskColor(item.trust_score), borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                      {getRiskLabel(item.trust_score)} {item.trust_score}
                    </span>
                  )}
                </div>
                <div style={{ color: '#64748b', fontSize: 12 }}>{item.submitted_by} · {new Date(item.created_at).toLocaleDateString()}</div>
                {item.verdict_summary && (
                  <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 4, lineClamp: 2 }}>{item.verdict_summary?.slice(0, 100)}...</div>
                )}
              </div>
            ))}

            {tab === 'disputes' && disputes.map(item => (
              <div
                key={item.id}
                onClick={() => setSelected(item)}
                style={{
                  padding: '16px 20px', borderBottom: '1px solid #1a2e45',
                  cursor: 'pointer', background: selected?.id === item.id ? '#1a2e45' : 'transparent'
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 14, color: '#e2e8f0', marginBottom: 4 }}>{item.claimant_name}</div>
                <div style={{ color: '#94a3b8', fontSize: 12 }}>{item.dispute_type} · {new Date(item.created_at).toLocaleDateString()}</div>
                <div style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>{item.reason?.slice(0, 80)}...</div>
              </div>
            ))}

            {((tab === 'queue' && queue.length === 0) || (tab === 'disputes' && disputes.length === 0)) && (
              <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                {tab === 'queue' ? '✅ Queue is empty' : '✅ No pending disputes'}
              </div>
            )}
          </div>

          {/* Detail panel */}
          {selected ? (
            <div style={{ flex: 1, overflowY: 'auto', padding: 32 }}>
              {tab === 'queue' && (
                <>
                  <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>{selected.input_url}</div>
                  <div style={{ color: '#64748b', marginBottom: 24, fontSize: 14 }}>
                    Submitted {new Date(selected.created_at).toLocaleString()} by {selected.submitted_by}
                  </div>

                  {selected.trust_score != null && (
                    <div style={{ background: '#1a2e45', borderRadius: 12, padding: 24, marginBottom: 24, border: `1px solid ${getRiskColor(selected.trust_score)}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                        <div style={{ fontSize: 48, fontWeight: 900, color: getRiskColor(selected.trust_score) }}>{selected.trust_score}</div>
                        <div>
                          <div style={{ fontSize: 20, fontWeight: 700, color: getRiskColor(selected.trust_score) }}>{getRiskLabel(selected.trust_score)} RISK</div>
                          <div style={{ color: '#64748b', fontSize: 13 }}>Trust Score / 100</div>
                        </div>
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: 14 }}>{selected.verdict_summary}</div>
                    </div>
                  )}

                  {selected.signals && (() => {
                    try {
                      const signals = typeof selected.signals === 'string' ? JSON.parse(selected.signals) : selected.signals;
                      return (
                        <div style={{ marginBottom: 24 }}>
                          <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 14, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>Signal Breakdown</div>
                          {Object.entries(signals).map(([engine, result]) => result && (
                            <div key={engine} style={{ background: '#1a2e45', borderRadius: 8, padding: 16, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <div style={{ fontWeight: 600, textTransform: 'capitalize', marginBottom: 4 }}>{engine}</div>
                                <div style={{ color: '#94a3b8', fontSize: 13 }}>{result.reason}</div>
                              </div>
                              <div style={{ fontSize: 24, fontWeight: 800, color: getRiskColor(result.score), minWidth: 50, textAlign: 'right' }}>{result.score}</div>
                            </div>
                          ))}
                        </div>
                      );
                    } catch { return null; }
                  })()}

                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', marginBottom: 8, color: '#94a3b8', fontSize: 13 }}>Admin Notes (optional)</label>
                    <textarea
                      value={note}
                      onChange={e => setNote(e.target.value)}
                      placeholder="Add context or reasoning..."
                      rows={3}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #1B4F72', background: '#0D1B2A', color: '#fff', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 12 }}>
                    <button
                      onClick={() => approve(selected.id)}
                      disabled={loading}
                      style={{ flex: 1, padding: '14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
                    >
                      {loading ? 'Publishing...' : '⚠️ Approve & Publish'}
                    </button>
                    <button
                      onClick={() => reject(selected.id)}
                      disabled={loading}
                      style={{ flex: 1, padding: '14px', background: '#1a3a2a', color: '#4ade80', border: '1px solid #166534', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
                    >
                      Reject
                    </button>
                  </div>
                </>
              )}

              {tab === 'disputes' && (
                <>
                  <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>{selected.claimant_name}</div>
                  <div style={{ color: '#64748b', marginBottom: 24 }}>{selected.claimant_email} · {selected.dispute_type}</div>

                  <div style={{ background: '#1a2e45', borderRadius: 12, padding: 24, marginBottom: 24 }}>
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>Dispute Reason</div>
                    <div style={{ color: '#94a3b8', lineHeight: 1.6 }}>{selected.reason}</div>
                  </div>

                  {selected.evidence_notes && (
                    <div style={{ background: '#1a2e45', borderRadius: 12, padding: 24, marginBottom: 24 }}>
                      <div style={{ fontWeight: 700, marginBottom: 8 }}>Evidence Provided</div>
                      <div style={{ color: '#94a3b8' }}>{selected.evidence_notes}</div>
                    </div>
                  )}

                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', marginBottom: 8, color: '#94a3b8', fontSize: 13 }}>Resolution Note (sent to claimant)</label>
                    <textarea
                      value={note}
                      onChange={e => setNote(e.target.value)}
                      placeholder="Explain your decision..."
                      rows={4}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #1B4F72', background: '#0D1B2A', color: '#fff', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 12 }}>
                    <button
                      onClick={() => resolveDispute(selected.id, 'approved')}
                      disabled={loading}
                      style={{ flex: 1, padding: '14px', background: '#1a3a2a', color: '#4ade80', border: '1px solid #166534', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
                    >
                      ✅ Approve Dispute (Remove Page)
                    </button>
                    <button
                      onClick={() => resolveDispute(selected.id, 'rejected')}
                      disabled={loading}
                      style={{ flex: 1, padding: '14px', background: '#7c1d1d', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
                    >
                      ✗ Reject Dispute
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>
              Select an item to review
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
