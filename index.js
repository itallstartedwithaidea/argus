/**
 * ARGUS — Main API Worker
 * Cloudflare Worker handling all API routes
 * argus.googleadsagent.ai/api/*
 */

import { analyzeProfile } from './pipeline/analyze';
import { generateSlug, generateId } from './lib/utils';
import { rateLimiter } from './lib/rate-limit';
import { generatePage } from './lib/page-generator';
import { notifyAdmin } from './lib/notify';
import { archiveEvidence } from './lib/evidence';
import { triggerIndexing } from './lib/seo';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS headers for extension + public API
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // ── Public API ─────────────────────────────────────

      // POST /api/analyze — submit any URL for analysis
      if (path === '/api/analyze' && method === 'POST') {
        return await handleAnalyze(request, env, corsHeaders);
      }

      // POST /api/submit — community submission (goes to approval queue)
      if (path === '/api/submit' && method === 'POST') {
        return await handleSubmit(request, env, corsHeaders);
      }

      // GET /api/score — quick score lookup for browser extension
      if (path === '/api/score' && method === 'GET') {
        return await handleScore(request, env, corsHeaders);
      }

      // POST /api/dispute — submit a dispute/opt-out
      if (path === '/api/dispute' && method === 'POST') {
        return await handleDispute(request, env, corsHeaders);
      }

      // POST /api/report — community flag
      if (path === '/api/report' && method === 'POST') {
        return await handleReport(request, env, corsHeaders);
      }

      // GET /api/profile/:platform/:handle — public profile data
      if (path.startsWith('/api/profile/') && method === 'GET') {
        return await handleGetProfile(request, env, corsHeaders, path);
      }

      // GET /api/network/:clusterId — public network data
      if (path.startsWith('/api/network/') && method === 'GET') {
        return await handleGetNetwork(request, env, corsHeaders, path);
      }

      // ── Admin API (requires secret key) ───────────────

      // GET /api/admin/queue — pending submissions
      if (path === '/api/admin/queue' && method === 'GET') {
        return await handleAdminQueue(request, env, corsHeaders);
      }

      // POST /api/admin/approve — approve a submission
      if (path === '/api/admin/approve' && method === 'POST') {
        return await handleAdminApprove(request, env, corsHeaders);
      }

      // POST /api/admin/reject — reject a submission
      if (path === '/api/admin/reject' && method === 'POST') {
        return await handleAdminReject(request, env, corsHeaders);
      }

      // POST /api/admin/dispute/resolve — resolve a dispute
      if (path === '/api/admin/dispute/resolve' && method === 'POST') {
        return await handleDisputeResolve(request, env, corsHeaders);
      }

      // GET /api/admin/disputes — pending disputes
      if (path === '/api/admin/disputes' && method === 'GET') {
        return await handleAdminDisputes(request, env, corsHeaders);
      }

      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (err) {
      console.error('Worker error:', err);
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  },

  // ── Queue Consumer ──────────────────────────────────────
  async queue(batch, env) {
    for (const message of batch.messages) {
      try {
        if (message.body.type === 'analyze') {
          await processAnalysisJob(message.body, env);
        }
        if (message.body.type === 'notify') {
          await processNotifyJob(message.body, env);
        }
        message.ack();
      } catch (err) {
        console.error('Queue error:', err);
        message.retry();
      }
    }
  }
};

// ── Handler: Analyze ───────────────────────────────────────
async function handleAnalyze(request, env, corsHeaders) {
  // Rate limiting — 10 requests per IP per hour on public tier
  const ip = request.headers.get('CF-Connecting-IP');
  const allowed = await rateLimiter(env.RATE_LIMITER, ip, 10, 3600);
  if (!allowed) {
    return json({ error: 'Rate limit exceeded. Try again later.' }, 429, corsHeaders);
  }

  const body = await request.json();
  const { url: inputUrl, engines = ['all'], notify_email } = body;

  if (!inputUrl) {
    return json({ error: 'url is required' }, 400, corsHeaders);
  }

  // Check cache first
  const cacheKey = `score:${inputUrl}`;
  const cached = await env.SCORE_CACHE.get(cacheKey, 'json');
  if (cached) {
    return json({ ...cached, cached: true }, 200, corsHeaders);
  }

  // Create submission record
  const submissionId = generateId();
  await env.DB.prepare(`
    INSERT INTO submissions (id, input_url, input_type, submitter_ip, submitted_by, status, notify_email)
    VALUES (?, ?, 'profile', ?, 'api', 'queued', ?)
  `).bind(submissionId, inputUrl, ip, notify_email || null).run();

  // Queue for async processing
  await env.ANALYSIS_QUEUE.send({
    type: 'analyze',
    submissionId,
    inputUrl,
    engines,
    notifyEmail: notify_email
  });

  return json({
    status: 'queued',
    submission_id: submissionId,
    message: 'Analysis queued. Check back in 10-15 seconds.',
    poll_url: `/api/submission/${submissionId}`
  }, 202, corsHeaders);
}

// ── Handler: Community Submit ───────────────────────────────
async function handleSubmit(request, env, corsHeaders) {
  const ip = request.headers.get('CF-Connecting-IP');
  const allowed = await rateLimiter(env.RATE_LIMITER, `submit:${ip}`, 5, 3600);
  if (!allowed) {
    return json({ error: 'Too many submissions. Limit is 5 per hour.' }, 429, corsHeaders);
  }

  const body = await request.json();
  const { url: inputUrl, reason, submitter_email, notify_on_publish } = body;

  if (!inputUrl) return json({ error: 'url is required' }, 400, corsHeaders);

  const submissionId = generateId();
  await env.DB.prepare(`
    INSERT INTO submissions 
    (id, input_url, input_type, submitter_ip, submitter_email, submitted_by, status, admin_status, notify_email)
    VALUES (?, ?, 'profile', ?, ?, 'community', 'queued', 'pending', ?)
  `).bind(
    submissionId, inputUrl, ip,
    submitter_email || null,
    notify_on_publish ? submitter_email : null
  ).run();

  // Queue analysis — result goes to admin approval queue
  await env.ANALYSIS_QUEUE.send({
    type: 'analyze',
    submissionId,
    inputUrl,
    engines: ['all'],
    requiresAdminApproval: true,
    submissionReason: reason
  });

  // Notify admin
  await env.NOTIFY_QUEUE.send({
    type: 'notify',
    to: env.ADMIN_EMAIL,
    subject: 'New Argus Submission',
    body: `New community submission: ${inputUrl}\nReason: ${reason || 'Not provided'}\nReview at: ${env.APP_URL}/admin`
  });

  return json({
    status: 'submitted',
    submission_id: submissionId,
    message: 'Your submission has been received and queued for analysis. Our team will review before publishing.'
  }, 202, corsHeaders);
}

// ── Handler: Quick Score (for browser extension) ────────────
async function handleScore(request, env, corsHeaders) {
  const url = new URL(request.url);
  const profileUrl = url.searchParams.get('url');
  const platform = url.searchParams.get('platform');
  const handle = url.searchParams.get('handle');

  if (!profileUrl && !(platform && handle)) {
    return json({ error: 'url or platform+handle required' }, 400, corsHeaders);
  }

  // Check cache
  const cacheKey = handle
    ? `score:${platform}:${handle}`
    : `score:${profileUrl}`;

  const cached = await env.SCORE_CACHE.get(cacheKey, 'json');
  if (cached) return json(cached, 200, corsHeaders);

  // Check D1
  let profile;
  if (handle && platform) {
    profile = await env.DB.prepare(
      `SELECT id, trust_score, confidence, risk_level, verdict_summary, signals, slug, status
       FROM profiles WHERE platform = ? AND handle = ? AND status = 'approved'`
    ).bind(platform, handle).first();
  }

  if (!profile) {
    // Auto-queue for analysis via extension
    const ip = request.headers.get('CF-Connecting-IP');
    const targetUrl = profileUrl || `https://${platform}.com/in/${handle}`;
    const submissionId = generateId();

    await env.DB.prepare(`
      INSERT OR IGNORE INTO submissions (id, input_url, input_type, submitter_ip, submitted_by, status)
      VALUES (?, ?, 'profile', ?, 'extension', 'queued')
    `).bind(submissionId, targetUrl, ip).run();

    await env.ANALYSIS_QUEUE.send({
      type: 'analyze',
      submissionId,
      inputUrl: targetUrl,
      engines: ['all'],
      requiresAdminApproval: true
    });

    return json({ status: 'not_analyzed', message: 'Queued for analysis' }, 202, corsHeaders);
  }

  const result = {
    trust_score: profile.trust_score,
    confidence: profile.confidence,
    risk_level: profile.risk_level,
    verdict_summary: profile.verdict_summary,
    signals: JSON.parse(profile.signals || '{}'),
    page_url: profile.slug ? `${env.APP_URL}/profiles/${profile.slug}` : null,
    status: profile.status
  };

  // Cache for 1 hour
  await env.SCORE_CACHE.put(cacheKey, JSON.stringify(result), { expirationTtl: 3600 });

  return json(result, 200, corsHeaders);
}

// ── Handler: Dispute Submission ─────────────────────────────
async function handleDispute(request, env, corsHeaders) {
  const body = await request.json();
  const {
    profile_id, platform, handle,
    claimant_name, claimant_email,
    dispute_type, reason
  } = body;

  if (!claimant_name || !claimant_email || !dispute_type || !reason) {
    return json({ error: 'Missing required fields' }, 400, corsHeaders);
  }

  // Find profile
  let targetProfileId = profile_id;
  if (!targetProfileId && platform && handle) {
    const p = await env.DB.prepare(
      'SELECT id FROM profiles WHERE platform = ? AND handle = ?'
    ).bind(platform, handle).first();
    targetProfileId = p?.id;
  }

  if (!targetProfileId) {
    return json({ error: 'Profile not found' }, 404, corsHeaders);
  }

  const disputeId = generateId();
  await env.DB.prepare(`
    INSERT INTO disputes (id, profile_id, claimant_name, claimant_email, dispute_type, reason, status)
    VALUES (?, ?, ?, ?, ?, ?, 'pending')
  `).bind(disputeId, targetProfileId, claimant_name, claimant_email, dispute_type, reason).run();

  // Notify admin
  await env.NOTIFY_QUEUE.send({
    type: 'notify',
    to: env.ADMIN_EMAIL,
    subject: `Argus Dispute Submitted — ${dispute_type}`,
    body: `Dispute from ${claimant_name} (${claimant_email})\nType: ${dispute_type}\nReason: ${reason}\nProfile ID: ${targetProfileId}\nReview at: ${env.APP_URL}/admin/disputes`
  });

  return json({
    status: 'received',
    dispute_id: disputeId,
    message: `Your dispute has been received. We will review within ${env.DISPUTE_REVIEW_DAYS} business days and contact you at ${claimant_email}.`
  }, 201, corsHeaders);
}

// ── Handler: Admin Queue ────────────────────────────────────
async function handleAdminQueue(request, env, corsHeaders) {
  if (!isAdmin(request, env)) {
    return json({ error: 'Unauthorized' }, 401, corsHeaders);
  }

  const submissions = await env.DB.prepare(`
    SELECT s.*, p.trust_score, p.risk_level, p.verdict_summary, p.signals
    FROM submissions s
    LEFT JOIN profiles p ON s.profile_id = p.id
    WHERE s.admin_status = 'pending' AND s.status = 'complete'
    ORDER BY s.created_at DESC
    LIMIT 50
  `).all();

  return json({ submissions: submissions.results }, 200, corsHeaders);
}

// ── Handler: Admin Approve ──────────────────────────────────
async function handleAdminApprove(request, env, corsHeaders) {
  if (!isAdmin(request, env)) {
    return json({ error: 'Unauthorized' }, 401, corsHeaders);
  }

  const { submission_id, admin_notes } = await request.json();

  // Get submission
  const sub = await env.DB.prepare(
    'SELECT * FROM submissions WHERE id = ?'
  ).bind(submission_id).first();

  if (!sub || !sub.profile_id) {
    return json({ error: 'Submission or profile not found' }, 404, corsHeaders);
  }

  // Generate slug
  const profile = await env.DB.prepare(
    'SELECT * FROM profiles WHERE id = ?'
  ).bind(sub.profile_id).first();

  const slug = generateSlug(profile.platform, profile.handle);
  const now = new Date().toISOString();

  // Publish profile
  await env.DB.prepare(`
    UPDATE profiles SET status = 'approved', published_at = ?, slug = ?,
    admin_notes = ?, updated_at = ?
    WHERE id = ?
  `).bind(now, slug, admin_notes || null, now, sub.profile_id).run();

  // Update submission
  await env.DB.prepare(`
    UPDATE submissions SET admin_status = 'approved', admin_reviewed_at = ?, admin_notes = ?
    WHERE id = ?
  `).bind(now, admin_notes || null, submission_id).run();

  // Trigger Google indexing
  const pageUrl = `${env.APP_URL}/profiles/${slug}`;
  await triggerIndexing(pageUrl, env);

  // Notify submitter if email provided
  if (sub.notify_email) {
    await env.NOTIFY_QUEUE.send({
      type: 'notify',
      to: sub.notify_email,
      subject: 'Your Argus submission has been published',
      body: `The profile you submitted has been reviewed and published.\nView it here: ${pageUrl}`
    });
  }

  return json({
    status: 'approved',
    page_url: pageUrl,
    slug
  }, 200, corsHeaders);
}

// ── Handler: Admin Reject ───────────────────────────────────
async function handleAdminReject(request, env, corsHeaders) {
  if (!isAdmin(request, env)) {
    return json({ error: 'Unauthorized' }, 401, corsHeaders);
  }

  const { submission_id, reason } = await request.json();
  const now = new Date().toISOString();

  await env.DB.prepare(`
    UPDATE submissions SET admin_status = 'rejected', admin_reviewed_at = ?, admin_notes = ?
    WHERE id = ?
  `).bind(now, reason || null, submission_id).run();

  return json({ status: 'rejected' }, 200, corsHeaders);
}

// ── Handler: Dispute Resolve ────────────────────────────────
async function handleDisputeResolve(request, env, corsHeaders) {
  if (!isAdmin(request, env)) {
    return json({ error: 'Unauthorized' }, 401, corsHeaders);
  }

  const { dispute_id, resolution, resolution_note } = await request.json();
  const now = new Date().toISOString();

  const dispute = await env.DB.prepare(
    'SELECT * FROM disputes WHERE id = ?'
  ).bind(dispute_id).first();

  if (!dispute) return json({ error: 'Dispute not found' }, 404, corsHeaders);

  await env.DB.prepare(`
    UPDATE disputes SET status = ?, resolved_at = ?, resolved_by = 'admin', resolution_note = ?
    WHERE id = ?
  `).bind(resolution, now, resolution_note, dispute_id).run();

  // If approved — update profile status
  if (resolution === 'approved') {
    await env.DB.prepare(`
      UPDATE profiles SET status = 'removed', updated_at = ?
      WHERE id = ?
    `).bind(now, dispute.profile_id).run();

    // Clear cache for this profile
    const profile = await env.DB.prepare(
      'SELECT platform, handle FROM profiles WHERE id = ?'
    ).bind(dispute.profile_id).first();

    if (profile) {
      await env.SCORE_CACHE.delete(`score:${profile.platform}:${profile.handle}`);
    }
  }

  // Notify claimant
  const approved = resolution === 'approved';
  await env.NOTIFY_QUEUE.send({
    type: 'notify',
    to: dispute.claimant_email,
    subject: `Your Argus Dispute Has Been ${approved ? 'Approved' : 'Reviewed'}`,
    body: approved
      ? `Your dispute has been approved. The profile page has been removed from our public registry. A dispute-resolved notice has been added for transparency.`
      : `Your dispute has been reviewed. ${resolution_note || 'Insufficient evidence was provided to remove the analysis.'} You may appeal by replying to this email.`
  });

  return json({ status: 'resolved', resolution }, 200, corsHeaders);
}

// ── Queue Processing ─────────────────────────────────────────
async function processAnalysisJob(job, env) {
  const { submissionId, inputUrl, engines, requiresAdminApproval, notifyEmail } = job;

  try {
    // Update submission status
    await env.DB.prepare(
      "UPDATE submissions SET status = 'processing' WHERE id = ?"
    ).bind(submissionId).run();

    // Run full analysis pipeline
    const analysis = await analyzeProfile(inputUrl, engines, env);

    // Store profile in D1
    const profileId = generateId();
    const platform = analysis.platform;
    const handle = analysis.handle;
    const riskLevel = getRiskLevel(analysis.trust_score);

    await env.DB.prepare(`
      INSERT OR REPLACE INTO profiles
      (id, platform, handle, profile_url, display_name, bio_text, profile_photo_url,
       trust_score, confidence, image_score, text_score, behavioral_score, network_score,
       risk_level, verdict_summary, signals, raw_analysis,
       wayback_url, photo_hash, status, model_version, engines_run, processing_ms)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      profileId, platform, handle, inputUrl,
      analysis.display_name, analysis.bio_text, analysis.profile_photo_url,
      analysis.trust_score, analysis.confidence,
      analysis.signals?.image?.score, analysis.signals?.text?.score,
      analysis.signals?.behavioral?.score, analysis.signals?.network?.score,
      riskLevel, analysis.verdict_summary,
      JSON.stringify(analysis.signals), JSON.stringify(analysis),
      analysis.wayback_url, analysis.photo_hash,
      requiresAdminApproval ? 'pending' : 'approved',
      env.MODEL_VERSION,
      JSON.stringify(analysis.engines_run), analysis.processing_ms
    ).run();

    // Archive evidence to R2
    await archiveEvidence(profileId, analysis, env);

    // Cache score
    await env.SCORE_CACHE.put(
      `score:${platform}:${handle}`,
      JSON.stringify({
        trust_score: analysis.trust_score,
        confidence: analysis.confidence,
        risk_level: riskLevel,
        verdict_summary: analysis.verdict_summary,
        signals: analysis.signals
      }),
      { expirationTtl: 3600 }
    );

    // Update submission
    await env.DB.prepare(`
      UPDATE submissions SET status = 'complete', profile_id = ?
      WHERE id = ?
    `).bind(profileId, submissionId).run();

    // Auto-publish if below threshold and no admin approval needed
    if (!requiresAdminApproval && analysis.trust_score <= parseInt(env.FLAG_THRESHOLD)) {
      const slug = generateSlug(platform, handle);
      await env.DB.prepare(`
        UPDATE profiles SET status = 'approved', published_at = ?, slug = ?
        WHERE id = ?
      `).bind(new Date().toISOString(), slug, profileId).run();

      await triggerIndexing(`${env.APP_URL}/profiles/${slug}`, env);
    }

    // Notify admin of new pending submission
    if (requiresAdminApproval && analysis.trust_score <= parseInt(env.FLAG_THRESHOLD)) {
      await env.NOTIFY_QUEUE.send({
        type: 'notify',
        to: env.ADMIN_EMAIL,
        subject: `⚠️ Argus: High Risk Profile Ready for Review`,
        body: `Profile: ${inputUrl}\nScore: ${analysis.trust_score}/100\nRisk: ${riskLevel}\nVerdict: ${analysis.verdict_summary}\n\nReview at: ${env.APP_URL}/admin`
      });
    }

  } catch (err) {
    console.error('Analysis job failed:', err);
    await env.DB.prepare(`
      UPDATE submissions SET status = 'failed', error_message = ?
      WHERE id = ?
    `).bind(err.message, submissionId).run();
    throw err;
  }
}

// ── Helpers ──────────────────────────────────────────────────
function isAdmin(request, env) {
  const key = request.headers.get('X-Admin-Key');
  return key === env.ADMIN_SECRET_KEY;
}

function getRiskLevel(score) {
  if (score <= 25) return 'critical';
  if (score <= 40) return 'high';
  if (score <= 60) return 'medium';
  return 'low';
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers }
  });
}
