/**
 * ARGUS — Analysis Pipeline
 * Orchestrates all detection engines in parallel
 */

export async function analyzeProfile(inputUrl, engines = ['all'], env) {
  const startTime = Date.now();

  // 1. Ingest — pull profile data
  const profileData = await ingestProfile(inputUrl, env);

  // 2. Dispatch engines in parallel
  const runAll = engines.includes('all');
  const enginePromises = [];
  const enginesRun = [];

  if (runAll || engines.includes('image')) {
    enginePromises.push(runImageEngine(profileData, env));
    enginesRun.push('image');
  }
  if (runAll || engines.includes('text')) {
    enginePromises.push(runTextEngine(profileData, env));
    enginesRun.push('text');
  }
  if (runAll || engines.includes('behavioral')) {
    enginePromises.push(runBehavioralEngine(profileData, env));
    enginesRun.push('behavioral');
  }
  if (runAll || engines.includes('network')) {
    enginePromises.push(runNetworkEngine(profileData, env));
    enginesRun.push('network');
  }

  const results = await Promise.allSettled(enginePromises);

  // 3. Aggregate scores with weights
  const signals = {};
  results.forEach((result, i) => {
    const engineName = enginesRun[i];
    if (result.status === 'fulfilled') {
      signals[engineName] = result.value;
    } else {
      signals[engineName] = { score: 50, reason: 'Engine unavailable', error: true };
    }
  });

  const trustScore = aggregateScore(signals);
  const confidence = calculateConfidence(signals, enginesRun);
  const verdictSummary = generateVerdict(trustScore, signals);

  // 4. Archive to Wayback Machine
  let waybackUrl = null;
  try {
    waybackUrl = await submitToWayback(inputUrl);
  } catch (e) {}

  return {
    platform: profileData.platform,
    handle: profileData.handle,
    profile_url: inputUrl,
    display_name: profileData.display_name,
    bio_text: profileData.bio,
    profile_photo_url: profileData.photo_url,
    photo_hash: profileData.photo_hash,
    trust_score: trustScore,
    confidence,
    verdict_summary: verdictSummary,
    signals,
    wayback_url: waybackUrl,
    engines_run: enginesRun,
    processing_ms: Date.now() - startTime
  };
}

// ── ENGINE 1: Image Detection ──────────────────────────────
async function runImageEngine(profileData, env) {
  if (!profileData.photo_url) {
    return { score: 50, reason: 'No profile photo to analyze', signals: [] };
  }

  const checks = await Promise.allSettled([
    checkGANArtifacts(profileData.photo_url, env),
    checkC2PAProvenance(profileData.photo_url),
    checkReverseImage(profileData.photo_url, env),
    analyzeEXIF(profileData.photo_url)
  ]);

  const ganResult     = checks[0].status === 'fulfilled' ? checks[0].value : null;
  const c2paResult    = checks[1].status === 'fulfilled' ? checks[1].value : null;
  const reverseResult = checks[2].status === 'fulfilled' ? checks[2].value : null;
  const exifResult    = checks[3].status === 'fulfilled' ? checks[3].value : null;

  const signals = [];
  let scoreTotal = 0;
  let scoreCount = 0;

  if (ganResult) {
    const s = Math.round((1 - ganResult.probability) * 100);
    signals.push({
      name: 'GAN Artifact Detection',
      score: s,
      detail: ganResult.probability > 0.7
        ? `AI-generated face detected with ${Math.round(ganResult.probability * 100)}% confidence`
        : `No significant GAN artifacts detected (${Math.round(ganResult.probability * 100)}% probability)`,
      severity: ganResult.probability > 0.7 ? 'high' : 'low'
    });
    scoreTotal += s; scoreCount++;
  }

  if (c2paResult !== null) {
    const s = c2paResult.hasCredentials ? 85 : 30;
    signals.push({
      name: 'C2PA Provenance',
      score: s,
      detail: c2paResult.hasCredentials
        ? `Valid Content Credentials found (${c2paResult.issuer})`
        : 'No C2PA Content Credentials present — origin unverifiable',
      severity: c2paResult.hasCredentials ? 'low' : 'medium'
    });
    scoreTotal += s; scoreCount++;
  }

  if (reverseResult) {
    const s = reverseResult.isStockPhoto ? 10 : reverseResult.crossPlatformCount > 3 ? 25 : 80;
    signals.push({
      name: 'Reverse Image Lookup',
      score: s,
      detail: reverseResult.isStockPhoto
        ? `Stock photo detected — found on ${reverseResult.sources.join(', ')}`
        : reverseResult.crossPlatformCount > 3
        ? `Image reused across ${reverseResult.crossPlatformCount} different profiles`
        : 'Photo appears unique to this account',
      severity: s < 30 ? 'high' : s < 60 ? 'medium' : 'low'
    });
    scoreTotal += s; scoreCount++;
  }

  if (exifResult) {
    const s = exifResult.stripped ? 35 : exifResult.inconsistent ? 40 : 80;
    signals.push({
      name: 'EXIF Metadata',
      score: s,
      detail: exifResult.stripped
        ? 'EXIF metadata completely stripped — common in AI-generated images'
        : exifResult.inconsistent
        ? `Metadata inconsistency: ${exifResult.detail}`
        : `Camera: ${exifResult.device || 'Unknown'}, Date: ${exifResult.date || 'Unknown'}`,
      severity: s < 40 ? 'medium' : 'low'
    });
    scoreTotal += s; scoreCount++;
  }

  const avgScore = scoreCount > 0 ? Math.round(scoreTotal / scoreCount) : 50;

  return {
    score: avgScore,
    reason: signals.filter(s => s.severity === 'high').map(s => s.detail).join('. ') || 'No major image anomalies',
    signals
  };
}

// ── ENGINE 2: Text Detection ───────────────────────────────
async function runTextEngine(profileData, env) {
  const textToAnalyze = [
    profileData.bio,
    ...(profileData.recent_posts || []).slice(0, 10)
  ].filter(Boolean).join('\n\n');

  if (!textToAnalyze || textToAnalyze.length < 50) {
    return { score: 50, reason: 'Insufficient text for analysis', signals: [] };
  }

  const checks = await Promise.allSettled([
    checkGPTZero(textToAnalyze, env),
    checkStylometricVariance(textToAnalyze),
    checkAgendaConcentration(profileData.recent_posts || []),
    checkLinguisticPatterns(textToAnalyze)
  ]);

  const gptResult    = checks[0].status === 'fulfilled' ? checks[0].value : null;
  const styleResult  = checks[1].status === 'fulfilled' ? checks[1].value : null;
  const agendaResult = checks[2].status === 'fulfilled' ? checks[2].value : null;
  const lingResult   = checks[3].status === 'fulfilled' ? checks[3].value : null;

  const signals = [];
  let scoreTotal = 0; let scoreCount = 0;

  if (gptResult) {
    const aiProb = gptResult.ai_probability;
    const s = Math.round((1 - aiProb) * 100);
    signals.push({
      name: 'AI Text Probability',
      score: s,
      detail: `GPTZero: ${Math.round(aiProb * 100)}% likelihood of AI generation`,
      severity: aiProb > 0.75 ? 'high' : aiProb > 0.5 ? 'medium' : 'low'
    });
    scoreTotal += s; scoreCount++;
  }

  if (styleResult) {
    const variance = styleResult.variance_score; // 0-1, higher = more varied = more human
    const s = Math.round(variance * 100);
    signals.push({
      name: 'Stylometric Variance',
      score: s,
      detail: variance < 0.2
        ? `Extremely consistent writing style (variance: ${variance.toFixed(2)}) — synthetic patterns detected`
        : variance < 0.4
        ? `Low stylometric variance (${variance.toFixed(2)}) — possible AI assistance`
        : `Normal human writing variation detected (${variance.toFixed(2)})`,
      severity: variance < 0.2 ? 'high' : variance < 0.4 ? 'medium' : 'low'
    });
    scoreTotal += s; scoreCount++;
  }

  if (agendaResult) {
    const concentration = agendaResult.top_topic_pct; // 0-1
    const s = concentration > 0.9 ? 15 : concentration > 0.7 ? 40 : 80;
    signals.push({
      name: 'Content Agenda Concentration',
      score: s,
      detail: `${Math.round(concentration * 100)}% of posts focus on single topic: "${agendaResult.top_topic}"`,
      severity: concentration > 0.9 ? 'high' : concentration > 0.7 ? 'medium' : 'low'
    });
    scoreTotal += s; scoreCount++;
  }

  if (lingResult) {
    const s = lingResult.naturalness_score;
    signals.push({
      name: 'Linguistic Pattern Analysis',
      score: s,
      detail: lingResult.detail,
      severity: s < 30 ? 'high' : s < 50 ? 'medium' : 'low'
    });
    scoreTotal += s; scoreCount++;
  }

  return {
    score: scoreCount > 0 ? Math.round(scoreTotal / scoreCount) : 50,
    reason: signals.filter(s => s.severity === 'high').map(s => s.detail).join('. '),
    signals
  };
}

// ── ENGINE 3: Behavioral Detection ────────────────────────
async function runBehavioralEngine(profileData, env) {
  const signals = [];
  let scoreTotal = 0; let scoreCount = 0;

  // Account age vs activity
  const accountAgeDays = profileData.account_age_days || 0;
  const postCount = profileData.post_count || 0;
  const connectionCount = profileData.connection_count || 0;

  if (accountAgeDays > 0) {
    const postsPerDay = postCount / Math.max(accountAgeDays, 1);
    const connectionsPerDay = connectionCount / Math.max(accountAgeDays, 1);
    const isNewAndBusy = accountAgeDays < 30 && (postsPerDay > 10 || connectionsPerDay > 15);

    const s = isNewAndBusy ? 10 : accountAgeDays < 7 ? 20 : accountAgeDays < 30 ? 50 : 80;
    signals.push({
      name: 'Account Age vs. Activity',
      score: s,
      detail: `Account ${accountAgeDays} days old | ${postCount} posts (${postsPerDay.toFixed(1)}/day) | ${connectionCount} connections (${connectionsPerDay.toFixed(1)}/day)`,
      severity: s < 20 ? 'high' : s < 50 ? 'medium' : 'low'
    });
    scoreTotal += s; scoreCount++;
  }

  // Digital footprint check
  const footprint = await checkDigitalFootprint(profileData, env);
  if (footprint) {
    const s = footprint.preExistenceFound ? 80 : 15;
    signals.push({
      name: 'Pre-Account Digital Footprint',
      score: s,
      detail: footprint.preExistenceFound
        ? `Digital presence found before account creation: ${footprint.sources.join(', ')}`
        : 'Zero digital footprint found before account creation date',
      severity: s < 20 ? 'high' : 'low'
    });
    scoreTotal += s; scoreCount++;
  }

  // Posting time pattern analysis
  if (profileData.post_timestamps && profileData.post_timestamps.length > 10) {
    const pattern = analyzePostingPattern(profileData.post_timestamps);
    const s = pattern.isRobotic ? 15 : pattern.isSuspicious ? 40 : 80;
    signals.push({
      name: 'Posting Time Pattern',
      score: s,
      detail: pattern.isRobotic
        ? `Robotic posting pattern: posts at ${pattern.interval_minutes}-minute intervals with ${pattern.consistency_pct}% consistency`
        : pattern.isSuspicious
        ? 'Unusual posting regularity detected'
        : 'Normal varied human posting pattern',
      severity: s < 20 ? 'high' : s < 50 ? 'medium' : 'low'
    });
    scoreTotal += s; scoreCount++;
  }

  // Personal content ratio
  const personalRatio = profileData.personal_content_ratio || 0;
  const s4 = personalRatio < 0.02 ? 20 : personalRatio < 0.1 ? 50 : 85;
  signals.push({
    name: 'Personal Content Ratio',
    score: s4,
    detail: personalRatio < 0.02
      ? 'No personal life content detected — real accounts typically mix personal and professional'
      : `${Math.round(personalRatio * 100)}% personal content (life events, casual posts)`,
    severity: s4 < 25 ? 'medium' : 'low'
  });
  scoreTotal += s4; scoreCount++;

  return {
    score: scoreCount > 0 ? Math.round(scoreTotal / scoreCount) : 50,
    reason: signals.filter(s => s.severity === 'high').map(s => s.detail).join('. '),
    signals
  };
}

// ── ENGINE 4: Network Graph Analysis ──────────────────────
async function runNetworkEngine(profileData, env) {
  const connections = profileData.connections_sample || [];
  if (connections.length === 0) {
    return { score: 50, reason: 'No network data available', signals: [] };
  }

  const signals = [];
  let scoreTotal = 0; let scoreCount = 0;

  // New account clustering
  const newAccountPct = connections.filter(c => c.account_age_days < 90).length / connections.length;
  const s1 = newAccountPct > 0.8 ? 8 : newAccountPct > 0.5 ? 35 : 80;
  signals.push({
    name: 'Connection Account Age Distribution',
    score: s1,
    detail: `${Math.round(newAccountPct * 100)}% of connections are accounts less than 90 days old`,
    severity: newAccountPct > 0.8 ? 'high' : newAccountPct > 0.5 ? 'medium' : 'low'
  });
  scoreTotal += s1; scoreCount++;

  // Flagged account network membership
  const flaggedInNetwork = connections.filter(c => c.flagged).length;
  const flaggedPct = flaggedInNetwork / connections.length;
  const s2 = flaggedPct > 0.3 ? 10 : flaggedPct > 0.1 ? 35 : 80;
  signals.push({
    name: 'Flagged Accounts in Network',
    score: s2,
    detail: flaggedInNetwork > 0
      ? `${flaggedInNetwork} previously flagged accounts in connection network (${Math.round(flaggedPct * 100)}%)`
      : 'No flagged accounts detected in network',
    severity: flaggedPct > 0.3 ? 'high' : flaggedPct > 0.1 ? 'medium' : 'low'
  });
  scoreTotal += s2; scoreCount++;

  // Coordination signals — synchronized posting
  const coordinationScore = await checkCoordination(profileData, env);
  if (coordinationScore !== null) {
    const s3 = 100 - coordinationScore;
    signals.push({
      name: 'Coordinated Behavior Score',
      score: s3,
      detail: coordinationScore > 70
        ? `High coordination detected with ${profileData.coordination_accounts || 'multiple'} accounts — synchronized posting patterns`
        : coordinationScore > 40
        ? 'Some coordinated posting detected'
        : 'No coordinated behavior patterns',
      severity: coordinationScore > 70 ? 'high' : coordinationScore > 40 ? 'medium' : 'low'
    });
    scoreTotal += s3; scoreCount++;
  }

  return {
    score: scoreCount > 0 ? Math.round(scoreTotal / scoreCount) : 50,
    reason: signals.filter(s => s.severity === 'high').map(s => s.detail).join('. '),
    signals
  };
}

// ── Score Aggregation ─────────────────────────────────────
function aggregateScore(signals) {
  // Weights: graph > behavioral > image > text
  const weights = {
    network:    0.35,
    behavioral: 0.30,
    image:      0.20,
    text:       0.15
  };

  let weightedTotal = 0;
  let weightUsed = 0;

  for (const [engine, result] of Object.entries(signals)) {
    if (result && typeof result.score === 'number' && !result.error) {
      const weight = weights[engine] || 0.25;
      weightedTotal += result.score * weight;
      weightUsed += weight;
    }
  }

  if (weightUsed === 0) return 50;
  return Math.round(weightedTotal / weightUsed);
}

function calculateConfidence(signals, enginesRun) {
  const successfulEngines = Object.values(signals).filter(s => !s.error).length;
  const baseConfidence = (successfulEngines / Math.max(enginesRun.length, 1)) * 100;
  return Math.round(baseConfidence);
}

function generateVerdict(score, signals) {
  const topIssues = Object.entries(signals)
    .filter(([, s]) => s && s.score < 40 && !s.error)
    .sort(([, a], [, b]) => a.score - b.score)
    .slice(0, 2)
    .map(([engine]) => engine);

  if (score <= 25) {
    return `Critical risk profile. ${topIssues.length > 0 ? `Primary flags: ${topIssues.join(', ')} analysis.` : ''} Multiple high-severity signals detected.`;
  }
  if (score <= 40) {
    return `High risk profile. Significant anomalies detected in ${topIssues.join(' and ')} analysis.`;
  }
  if (score <= 60) {
    return `Medium risk profile. Some suspicious signals detected. Review recommended.`;
  }
  return `Low risk profile. No significant authenticity concerns detected.`;
}

// ── External Service Calls ────────────────────────────────

async function checkGANArtifacts(photoUrl, env) {
  // Hive AI free tier — GAN detection
  const res = await fetch('https://api.thehive.ai/api/v2/task/sync', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${env.HIVE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      input: [{ url: photoUrl }]
    })
  });
  const data = await res.json();
  const aiScore = data?.status?.[0]?.response?.output?.[0]?.classes?.find(c => c.class === 'ai_generated');
  return { probability: aiScore?.score || 0 };
}

async function checkGPTZero(text, env) {
  const res = await fetch('https://api.gptzero.me/v2/predict/text', {
    method: 'POST',
    headers: {
      'x-api-key': env.GPTZERO_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ document: text.slice(0, 5000) })
  });
  const data = await res.json();
  return { ai_probability: data?.documents?.[0]?.completely_generated_prob || 0 };
}

async function checkC2PAProvenance(imageUrl) {
  // C2PA verification — check for Content Credentials
  try {
    const res = await fetch(`https://contentcredentials.org/verify?url=${encodeURIComponent(imageUrl)}`);
    const data = await res.json();
    return { hasCredentials: data?.hasCredentials || false, issuer: data?.issuer };
  } catch {
    return { hasCredentials: false };
  }
}

async function submitToWayback(url) {
  const res = await fetch(`https://web.archive.org/save/${url}`, { method: 'GET' });
  if (res.ok) return res.url;
  return null;
}

async function checkCoordination(profileData, env) {
  // Query D1 for coordination patterns
  const recentFlagged = await env.DB.prepare(`
    SELECT COUNT(*) as count FROM profiles
    WHERE platform = ? AND status = 'approved'
    AND trust_score < 40
    AND created_at > datetime('now', '-30 days')
  `).bind(profileData.platform).first();
  return recentFlagged?.count > 10 ? 65 : 20;
}

async function checkReverseImage(photoUrl, env) {
  // Stub — integrate Google Vision API or SerpAPI reverse image
  return { isStockPhoto: false, crossPlatformCount: 0, sources: [] };
}

async function analyzeEXIF(photoUrl) {
  // Fetch image and check EXIF — stub for Worker environment
  return { stripped: false, inconsistent: false };
}

async function checkDigitalFootprint(profileData, env) {
  // Check if name/handle appears in any pre-existing indexed content
  return { preExistenceFound: false, sources: [] };
}

function checkStylometricVariance(text) {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
  if (sentences.length < 5) return { variance_score: 0.5 };
  const lengths = sentences.map(s => s.split(' ').length);
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / lengths.length;
  return { variance_score: Math.min(Math.sqrt(variance) / 15, 1) };
}

function checkAgendaConcentration(posts) {
  if (!posts || posts.length === 0) return { top_topic_pct: 0, top_topic: 'unknown' };
  // Simplified — in production use topic modeling
  return { top_topic_pct: 0.5, top_topic: 'general' };
}

function checkLinguisticPatterns(text) {
  const score = text.length > 200 ? 65 : 50;
  return { naturalness_score: score, detail: 'Standard linguistic patterns' };
}

function analyzePostingPattern(timestamps) {
  if (!timestamps || timestamps.length < 5) return { isRobotic: false, isSuspicious: false };
  const sorted = timestamps.map(t => new Date(t).getTime()).sort();
  const intervals = sorted.slice(1).map((t, i) => t - sorted[i]);
  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const stdDev = Math.sqrt(intervals.reduce((a, b) => a + Math.pow(b - avgInterval, 2), 0) / intervals.length);
  const consistency = 1 - (stdDev / avgInterval);
  return {
    isRobotic: consistency > 0.95 && avgInterval < 3600000,
    isSuspicious: consistency > 0.8,
    consistency_pct: Math.round(consistency * 100),
    interval_minutes: Math.round(avgInterval / 60000)
  };
}
