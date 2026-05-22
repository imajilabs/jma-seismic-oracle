// app.js — landing page controller + globe rendering.

import Globe from 'https://esm.sh/globe.gl@2.32.1';
import {
  ATTESTATIONS,
  JP_CITIES,
  SHINDO_RANK, SHINDO_LABEL, SHINDO_COLORS, SHINDO_NAME,
  // impactedCities + feltRadiusKm are imported only for the disabled
  // IMPACT LAYER below — see applyData(). They're left in the imports so
  // a downstream fork can re-enable arcs with a single uncomment.
  impactedCities, feltRadiusKm,
  EXPLORER_TX, EXPLORER_OBJ,
} from './data.js';
import { fetchAllAttestations, startPolling } from './sui.js';

// Always escape chain-supplied strings before interpolation into innerHTML.
// The legitimate oracle only emits well-formed values, but this is defence in
// depth against a malicious package later reusing the same struct shape.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

// ───── state ─────────────────────────────────────────────────────────────────
let WORLD;                  // globe.gl instance
let EVENTS = [...ATTESTATIONS];
let ACTIVE_SERIAL = null;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

// True for any device with a primary touch input. Used to skip auto-rotation
// (which fights the user's finger) and to make tap targets behave well.
const IS_TOUCH = window.matchMedia('(hover: none) and (pointer: coarse)').matches
              || (navigator.maxTouchPoints || 0) > 0;
// Anything narrower than 900px uses the phone bottom-sheet layout (covers
// every phone in portrait+landscape and iPad portrait).
const isPhone = () => window.matchMedia('(max-width: 900px)').matches;

// ───── formatting helpers ────────────────────────────────────────────────────
const fmtJstFromMs = (ms) => {
  const d = new Date(ms);
  const z = (n) => String(n).padStart(2,'0');
  // JST = UTC+9
  const j = new Date(ms + 9*3600_000);
  return `${j.getUTCFullYear()}-${z(j.getUTCMonth()+1)}-${z(j.getUTCDate()) } ${z(j.getUTCHours())}:${z(j.getUTCMinutes())}:${z(j.getUTCSeconds())} JST`;
};
const shindoColor = (s) => SHINDO_COLORS[SHINDO_RANK(s)];
const regionName  = ({ lat, lng }) => {
  // Coarse Japanese region tag from coords — good enough for UI labelling.
  if (lat >= 41.4)                  return 'Hokkaido';
  if (lat >= 38.0)                  return 'Tohoku';
  if (lat >= 35.0 && lng <= 139.5)  return 'Chubu';
  if (lat >= 35.0)                  return 'Kanto';
  if (lat >= 33.5 && lng <= 136.5)  return 'Chugoku';
  if (lat >= 33.5)                  return 'Kansai';
  if (lat >= 31.5)                  return 'Kyushu';
  return 'Nansei';
};

// ───── globe setup ───────────────────────────────────────────────────────────
async function bootGlobe() {
  const el = document.getElementById('globe');

  // country polygons (low-res, free)
  const countries = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
    .then(r => r.json())
    .then(topo => topojsonFeature(topo, topo.objects.countries));

  WORLD = Globe({ rendererConfig: { antialias: true, alpha: true } })(el)
    .backgroundColor('rgba(0,0,0,0)')
    .showGlobe(true)
    .showAtmosphere(true)
    .atmosphereColor('#6b8aff')
    .atmosphereAltitude(0.22)
    // country polygons
    .polygonsData(countries.features)
    .polygonCapColor(()    => 'rgba(20, 32, 60, 0.65)')
    .polygonSideColor(()   => 'rgba(20, 32, 60, 0.4)')
    .polygonStrokeColor(() => 'rgba(120, 150, 220, 0.35)')
    .polygonAltitude(0.005)
    // initial camera: centred over Japan
    .pointOfView({ lat: 36, lng: 138, altitude: 2.2 }, 0);

  // Darken the default globe sphere so country polygons read against deep space.
  try {
    const mat = WORLD.globeMaterial();
    if (mat) {
      mat.color = new (mat.color.constructor)('#070d1c');
      mat.emissive = new (mat.color.constructor)('#0a1224');
      mat.emissiveIntensity = 0.5;
      mat.shininess = 0.7;
      if (mat.map) { mat.map.dispose?.(); mat.map = null; }
      mat.needsUpdate = true;
    }
  } catch (e) { console.warn('material override failed', e); }

  // gentle auto-rotation. On touch devices we leave it off — the rotate-on-idle
  // fights the user's finger and feels unstable on phones.
  const controls = WORLD.controls();
  controls.autoRotate = !IS_TOUCH;
  controls.autoRotateSpeed = 0.25;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  // OrbitControls already handles single-finger rotate + two-finger pinch/pan.
  // Make sure the pinch zoom and one-finger rotate gestures are both bound.
  if (controls.touches) {
    controls.touches.ONE = 0; // ROTATE
    controls.touches.TWO = 2; // DOLLY_PAN
  }
  const stopRotate = () => { controls.autoRotate = false; };
  ['pointerdown','wheel','touchstart'].forEach(ev =>
    el.addEventListener(ev, stopRotate, { passive: true, once: true }));

  // resize handling — re-measure on every viewport change incl. orientation
  // change, mobile chrome show/hide, and software-keyboard toggles.
  // rAF-throttled: resize events on mobile (visualViewport in particular) can
  // fire 60×/sec while the URL bar collapses, which would re-layout the WebGL
  // canvas just as often.
  let resizeRaf = 0;
  const resize = () => {
    if (resizeRaf) return;
    resizeRaf = requestAnimationFrame(() => {
      WORLD.width(window.innerWidth).height(window.innerHeight);
      resizeRaf = 0;
    });
  };
  WORLD.width(window.innerWidth).height(window.innerHeight);
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('orientationchange', () => setTimeout(resize, 200));
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', resize, { passive: true });
  }

  applyData();
}

// ───── topojson → geojson (inline mini-impl, avoids extra dep) ───────────────
// Adapted from topojson-client; only the pieces we need.
function topojsonFeature(topo, o) {
  const feats = o.geometries.map(g => geom(topo, g));
  return { type: 'FeatureCollection', features: feats };
}
function geom(topo, g) {
  const transform = topo.transform;
  const arcs = topo.arcs;
  const out = { type: 'Feature', properties: g.properties || {}, geometry: null };
  switch (g.type) {
    case 'Polygon':      out.geometry = { type:'Polygon',      coordinates: g.arcs.map(r => ring(r, arcs, transform)) }; break;
    case 'MultiPolygon': out.geometry = { type:'MultiPolygon', coordinates: g.arcs.map(p => p.map(r => ring(r, arcs, transform))) }; break;
    default:             out.geometry = null;
  }
  return out;
}
function ring(arcsIdx, arcs, t) {
  const coords = [];
  for (let i = 0; i < arcsIdx.length; i++) {
    let idx = arcsIdx[i], reverse = false;
    if (idx < 0) { idx = ~idx; reverse = true; }
    const arc = arcs[idx];
    const pts = decodeArc(arc, t);
    const seq = reverse ? pts.slice().reverse() : pts;
    if (i > 0) seq.shift();
    coords.push(...seq);
  }
  return coords;
}
function decodeArc(arc, t) {
  if (!t) return arc.map(p => [p[0], p[1]]);
  let x = 0, y = 0;
  return arc.map(p => {
    x += p[0]; y += p[1];
    return [ x * t.scale[0] + t.translate[0], y * t.scale[1] + t.translate[1] ];
  });
}

// ───── data → layers ─────────────────────────────────────────────────────────
function buildRings() {
  // Each epicenter gets a pair of rings (slow outer shockwave + fast inner
  // pulse). On phones / reduced-motion we render just the outer ring at a
  // gentler cadence to halve the GPU work per frame.
  const phone   = isPhone();
  const calm    = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const single  = phone || calm;
  const rows = [];
  EVENTS.forEach(att => {
    const c = shindoColor(att.max_shindo);
    const rank = SHINDO_RANK(att.max_shindo);
    const mag  = att.hypocenter.magnitude;
    const outerR = 5 + mag * 1.8 + rank * 1.4;
    const innerR = 2.5 + mag * 0.6 + rank * 0.45;
    rows.push({
      lat: att.hypocenter.lat, lng: att.hypocenter.lng,
      maxR: outerR,
      propagationSpeed: (calm ? 0.6 : 1.6) + rank * 0.12,
      repeatPeriod: (calm ? 5200 : 3200) - rank * 140,
      color: c, _att: att,
    });
    if (!single) {
      rows.push({
        lat: att.hypocenter.lat, lng: att.hypocenter.lng,
        maxR: innerR,
        propagationSpeed: 3.4 + rank * 0.18,
        repeatPeriod: 1400 - rank * 80,
        color: c, _att: att,
      });
    }
  });
  return rows;
}

function buildPoints() {
  // Epicenter markers only. The impacted-city dot layer below is part of
  // the disabled IMPACT LAYER (see applyData() — out of scope for the
  // parent oracle repo). Left in source as a comment for downstream forks.
  const pts = [];
  EVENTS.forEach(att => {
    pts.push({
      lat: att.hypocenter.lat, lng: att.hypocenter.lng,
      size: 0.18 + att.hypocenter.magnitude * 0.05,
      color: shindoColor(att.max_shindo),
      kind: 'epi', _att: att,
    });
    // ── IMPACT LAYER (disabled) — impacted-city dots ────────────────────
    // const seenCities = pts._seen ?? (pts._seen = new Set());
    // impactedCities(att, { maxCount: 16 }).forEach(city => {
    //   const k = `${city.lat.toFixed(3)},${city.lng.toFixed(3)}`;
    //   if (seenCities.has(k)) return;
    //   seenCities.add(k);
    //   pts.push({
    //     lat: city.lat, lng: city.lng,
    //     size: 0.18 + Math.max(0, city.predictedRank) * 0.05,
    //     color: shindoColor(att.max_shindo),
    //     kind: 'city', _city: city, _att: att,
    //   });
    // });
    // ────────────────────────────────────────────────────────────────────
  });
  return pts;
}

// IMPACT LAYER — disabled; preserved for reference + downstream forks.
// buildArcs() composes the epicenter→city arc layer from impactedCities().
// Not currently called (see applyData()), but kept in source so re-enabling
// is a one-line uncomment.
function buildArcs() {
  const maxArcs = isPhone() ? 8 : 16;
  const arcs = [];
  EVENTS.forEach(att => {
    const c = shindoColor(att.max_shindo);
    const cities = impactedCities(att, { maxCount: maxArcs });
    cities.forEach(city => {
      const tail = `${c}22`; // ~13% alpha hex8
      arcs.push({
        startLat: att.hypocenter.lat,
        startLng: att.hypocenter.lng,
        endLat:   city.lat,
        endLng:   city.lng,
        color:    [c, tail],
        stroke:   0.35 + Math.max(0, city.predictedRank) * 0.14 + att.hypocenter.magnitude * 0.04,
        altitude: 0.06 + att.hypocenter.magnitude * 0.045 + Math.max(0, city.predictedRank) * 0.025,
        _att:     att,
        _city:    city,
      });
    });
  });
  return arcs;
}

function buildLabels() {
  // A few major hub labels, faintly visible. Coordinates are sourced from
  // JP_CITIES so we have one source of truth for city positions.
  const hubs = new Set(['Tokyo','Osaka','Sapporo','Fukuoka','Sendai','Naha']);
  return JP_CITIES
    .filter(c => hubs.has(c.name))
    .map(c => ({ lat: c.lat, lng: c.lng, text: c.name }));
}

function applyData() {
  if (!WORLD) return;

  WORLD
    .ringsData(buildRings())
      .ringColor('color')
      .ringMaxRadius('maxR')
      .ringPropagationSpeed('propagationSpeed')
      .ringRepeatPeriod('repeatPeriod')
      .ringAltitude(0.003)
    .pointsData(buildPoints())
      .pointLat('lat').pointLng('lng')
      .pointAltitude(0.012)
      .pointRadius('size')
      .pointColor('color')
      .pointResolution(16)
      // IMPACT LAYER (disabled): with city dots re-enabled, the original
      // dispatcher was: d => d.kind === 'epi' ? epicenterTooltip(d._att) : cityTooltip(d._city, d._att)
      .pointLabel(d => epicenterTooltip(d._att))
      .onPointClick(d => focusAttestation(d._att))
    // ── IMPACT LAYER (disabled) ────────────────────────────────────────────
    // The impact-arc fan-out from each epicenter to nearby cities is
    // intentionally not wired up here: the parent oracle repo's
    // CONTRIBUTING.md (`imajilabs/jma-seismic-oracle`) places city-impact
    // logic out of scope. The helpers (`buildArcs`, `impactedCities`,
    // `feltRadiusKm`) are still exported and usable in a downstream
    // consumer. To restore the arcs in a fork, re-enable this block:
    //
    //   .arcsData(buildArcs())
    //     .arcColor('color').arcStroke('stroke')
    //     .arcAltitudeAutoScale(0).arcAltitude('altitude')
    //     .arcDashLength(0.55).arcDashGap(0.45)
    //     .arcDashAnimateTime(d => (isPhone() ? 5200 : 3200) - SHINDO_RANK(d._att.max_shindo) * 220)
    //     .arcDashInitialGap(() => Math.random())
    //     .arcLabel(d => arcTooltip(d))
    // ───────────────────────────────────────────────────────────────────────
    .labelsData(buildLabels())
      .labelLat('lat').labelLng('lng').labelText('text')
      .labelSize(0.32)
      .labelColor(() => 'rgba(180, 195, 220, 0.55)')
      .labelDotRadius(0)
      .labelResolution(2)
      .labelAltitude(0.01);
}

function epicenterTooltip(att) {
  const s = att.max_shindo;
  const c = shindoColor(s);
  return `
    <div style="
      font-family: 'Inter', sans-serif;
      background: rgba(8,14,28,0.92);
      backdrop-filter: blur(20px);
      border: 1px solid ${c};
      border-radius: 10px;
      padding: 10px 14px;
      color: #f3f5fa;
      box-shadow: 0 0 20px ${c}55;
      min-width: 200px;">
      <div style="font-size:9px;letter-spacing:.15em;text-transform:uppercase;color:#5b6478;margin-bottom:6px">
        Attestation #${esc(att.serial)} · ${esc(regionName(att.hypocenter))}
      </div>
      <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:6px">
        <span style="font-family:'JetBrains Mono',monospace;font-size:20px;color:${c}">M ${att.hypocenter.magnitude.toFixed(1)}</span>
        <span style="font-size:10px;color:#97a1b4">depth ${att.hypocenter.depth_km.toFixed(0)} km</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px;font-size:11px;color:#97a1b4">
        <span style="
          padding:2px 8px;border-radius:4px;
          background:${c}22;color:${c};border:1px solid ${c}66;
          font-family:'JetBrains Mono',monospace;font-weight:600">
          shindo ${SHINDO_LABEL(s)}
        </span>
        ${SHINDO_NAME[SHINDO_RANK(s)]}
      </div>
    </div>
  `;
}

// Tooltips for the disabled IMPACT LAYER — kept callable so a fork can drop
// them straight back into onPointClick / arcLabel without rewriting them.
function cityTooltip(city, att) {
  const c = shindoColor(att.max_shindo);
  return `
    <div style="
      font-family: 'Inter', sans-serif;
      background: rgba(8,14,28,0.92);
      backdrop-filter: blur(12px);
      border: 1px solid ${c}66;
      border-radius: 8px;
      padding: 8px 12px;
      color: #f3f5fa;
      font-size: 12px;
      min-width: 140px">
      <div style="font-weight:500">${city.name}</div>
      <div style="color:#97a1b4;font-family:'JetBrains Mono',monospace;font-size:11px;margin-top:3px">
        ${city.distKm.toFixed(0)} km · est. shindo ${Math.max(0, city.predictedRank).toFixed(1)}
      </div>
    </div>
  `;
}

function arcTooltip(d) {
  return `
    <div style="
      font-family: 'JetBrains Mono', monospace;
      background: rgba(8,14,28,0.92);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255,255,255,0.16);
      border-radius: 6px;
      padding: 6px 10px;
      color: #f3f5fa;
      font-size: 11px">
      ${d._city.name}
      <span style="color:#5b6478"> · ${d._city.distKm.toFixed(0)} km · est. shindo ${d._city.predictedRank.toFixed(1)}</span>
    </div>
  `;
}

// ───── UI render ─────────────────────────────────────────────────────────────
function renderStats() {
  const total = EVENTS.length;
  const maxMag = Math.max(0, ...EVENTS.map(e => e.hypocenter.magnitude));
  const last   = EVENTS.reduce((a, e) => e.attested_at_ms > (a?.attested_at_ms ?? 0) ? e : a, null);
  const setText = (sel, v) => { const el = document.querySelector(sel); if (el) el.textContent = v; };
  setText('#stat-total', total);
  setText('#stat-total-m', total);
  setText('#stat-mag',    maxMag ? `M ${maxMag.toFixed(1)}` : '—');
  setText('#stat-mag-m',  maxMag ? `M ${maxMag.toFixed(1)}` : '—');
  setText('#stat-shindo', last ? SHINDO_LABEL(last.max_shindo) : '—');
  setText('#stat-shindo-m', last ? SHINDO_LABEL(last.max_shindo) : '—');

  // sheet "peek" summary: terse one-liner showing the latest case
  const sum = document.querySelector('#sheet-summary');
  if (sum) {
    if (last) {
      const c = shindoColor(last.max_shindo);
      sum.style.color = c;
      sum.textContent = `M ${last.hypocenter.magnitude.toFixed(1)} · shindo ${SHINDO_LABEL(last.max_shindo)} · ${regionName(last.hypocenter)}`;
    } else {
      sum.textContent = 'no attestations yet';
    }
  }
}

function renderEventList() {
  const list = $('#event-list');
  list.innerHTML = '';
  const sorted = [...EVENTS].sort((a, b) => b.attested_at_ms - a.attested_at_ms);
  for (const att of sorted) {
    const c = shindoColor(att.max_shindo);
    // <button> instead of <div> so keyboard users (Tab + Enter/Space) can
    // activate a case the same way mouse users can.
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'event-row';
    row.setAttribute('aria-label',
      `Attestation ${att.serial}, ${regionName(att.hypocenter)}, magnitude ${att.hypocenter.magnitude.toFixed(1)}, shindo ${SHINDO_LABEL(att.max_shindo)}`);
    if (att.serial === ACTIVE_SERIAL) row.classList.add('active');
    row.innerHTML = `
      <div class="shindo-chip" style="--c:${esc(c)}">${esc(SHINDO_LABEL(att.max_shindo))}</div>
      <div class="event-meta">
        <div class="event-title">#${esc(att.serial)} · ${esc(regionName(att.hypocenter))}</div>
        <div class="event-sub">${esc(fmtJstFromMs(att.occurred_at_ms))}</div>
      </div>
      <div class="event-mag">M ${att.hypocenter.magnitude.toFixed(1)}<small>${att.hypocenter.depth_km.toFixed(0)} km</small></div>
    `;
    row.addEventListener('click', () => focusAttestation(att));
    list.appendChild(row);
  }
  $('#event-count').textContent = EVENTS.length;
}

function renderDetail(att) {
  const c = shindoColor(att.max_shindo);
  const rank = SHINDO_RANK(att.max_shindo);
  // ── IMPACT LAYER (disabled) — felt-radius + impacted-city count ──────────
  // const radius = feltRadiusKm(att);
  // const cities = impactedCities(att, { maxCount: 6 });
  // ─────────────────────────────────────────────────────────────────────────
  $('#detail').classList.add('open');
  $('#detail').innerHTML = `
    <button class="panel-close" id="detail-close" aria-label="Close" type="button">×</button>
    <div class="panel-title"><span class="dot" style="background:${c};box-shadow:0 0 8px ${c}"></span> Attestation #${att.serial}</div>
    <h2>${regionName(att.hypocenter)} · M ${att.hypocenter.magnitude.toFixed(1)}</h2>
    <div class="sub">${fmtJstFromMs(att.occurred_at_ms)}</div>

    <dl class="kv">
      <dt>Magnitude</dt><dd>M ${att.hypocenter.magnitude.toFixed(2)}</dd>
      <dt>Depth</dt><dd>${att.hypocenter.depth_km.toFixed(1)} km</dd>
      <dt>Coords</dt><dd>${att.hypocenter.lat.toFixed(4)}°N, ${att.hypocenter.lng.toFixed(4)}°E</dd>
      <dt>Max shindo</dt>
      <dd class="shindo-pill">
        <span style="color:${c};font-family:'JetBrains Mono',monospace;font-weight:600">${SHINDO_LABEL(att.max_shindo)}</span>
        <span style="color:#97a1b4;font-size:11px">${SHINDO_NAME[rank]}</span>
        <div class="shindo-bar" style="width:100%">
          ${SHINDO_COLORS.map((_, i) =>
            `<span style="background:${i<=rank ? SHINDO_COLORS[i] : 'var(--line)'}"></span>`).join('')}
        </div>
      </dd>
      <!-- IMPACT LAYER (disabled) — radius felt row -->
      <!-- <dt>Radius felt</dt><dd>~\${radius.toFixed(0)} km · \${cities.length} cities</dd> -->
    </dl>

    <dl class="kv">
      <dt>Event id</dt><dd>${esc(att.event_id)}</dd>
      <dt>Occurred</dt><dd>${att.occurred_at_ms}</dd>
      <dt>Attested</dt><dd>${att.attested_at_ms} <span style="color:#5b6478">(+${att.attested_at_ms - att.occurred_at_ms}ms)</span></dd>
      <dt>Serial</dt><dd>${att.serial}</dd>
    </dl>

    <dl class="kv">
      <dt>Attestation</dt><dd>${esc(att.attestation_id.slice(0,18))}…${esc(att.attestation_id.slice(-8))}</dd>
      ${att.tx_digest ? `<dt>Tx digest</dt><dd>${esc(att.tx_digest)}</dd>` : ''}
      ${att.source_xml_hash ? `<dt>XML hash</dt><dd>${esc(att.source_xml_hash.slice(0,16))}…${esc(att.source_xml_hash.slice(-8))}</dd>` : ''}
    </dl>

    ${att.tx_digest ? `<a class="chain" href="${esc(EXPLORER_TX(att.tx_digest))}" target="_blank" rel="noopener">View on SuiVision ↗</a>` : ''}
    <a class="chain" style="margin-left:8px" href="${esc(EXPLORER_OBJ(att.attestation_id))}" target="_blank" rel="noopener">Object ↗</a>
  `;
  $('#detail-close').addEventListener('click', () => {
    $('#detail').classList.remove('open');
    ACTIVE_SERIAL = null;
    renderEventList();
  });
}

function renderLegend() {
  const el = $('#legend-scale');
  el.innerHTML = SHINDO_COLORS.map(c => `<span style="background:${c}"></span>`).join('');
}

function focusAttestation(att) {
  ACTIVE_SERIAL = att.serial;
  renderEventList();
  renderDetail(att);
  updateVStamp(att);
  flashSeismo(att);
  if (WORLD) {
    // Stop the idle auto-rotation so the cinematic fly-to actually lands and
    // stays on the epicenter (otherwise the spin keeps dragging the camera).
    const ctl = WORLD.controls();
    if (ctl) ctl.autoRotate = false;
    // Keep enough altitude that the globe still reads as a sphere.
    const altitude = Math.max(1.4, 2.1 - att.hypocenter.magnitude * 0.08);
    WORLD.pointOfView({
      lat: att.hypocenter.lat - 4,    // tilt down so the detail panel doesn't sit on top
      lng: att.hypocenter.lng + 8,
      altitude,
    }, 1400);
  }
}

// ───── seismograph trace + vertical stamp ────────────────────────────────────
// We draw a procedurally-generated wave whose dominant spike sits at the
// timeline position of the currently-focused attestation. On each focus we
// regenerate the path and briefly flash its stroke weight, so the page feels
// like a live instrument rather than a static landing.
function seismoPath({ spikeAt = 0.5, magnitude = 3 } = {}) {
  const W = 1200, MID = 18;
  const n = 240;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const x = (i / n) * W;
    const t = i / n;
    // Low-amplitude background noise
    let y = MID + Math.sin(t * 90 + 0.7) * 1.4
                 + Math.sin(t * 41 + 1.2) * 0.8
                 + Math.cos(t * 19) * 0.6;
    // Big spike at the event's timeline position, falling off Gaussian-style
    const d = (t - spikeAt) * 14;
    const env = Math.exp(-d * d);
    const amp = 2 + magnitude * 2.4;
    y += Math.sin(t * 380) * amp * env;
    pts.push(`${x.toFixed(1)} ${y.toFixed(2)}`);
  }
  return 'M ' + pts.join(' L ');
}
function updateSeismoForAtt(att) {
  const path = document.querySelector('#seismo-path');
  if (!path) return;
  // Place the spike at a deterministic position based on the serial — newer
  // serials show further to the right (newer in time).
  const total = Math.max(1, EVENTS.length);
  const idx = Math.max(0, EVENTS.findIndex(e => e.serial === att.serial));
  const spikeAt = total === 1 ? 0.6 : 0.1 + 0.8 * (idx / Math.max(1, total - 1));
  path.setAttribute('d', seismoPath({ spikeAt, magnitude: att.hypocenter.magnitude }));
  path.style.color = shindoColor(att.max_shindo);
}
function flashSeismo(att) {
  const el = document.querySelector('.seismo');
  if (!el) return;
  updateSeismoForAtt(att);
  el.classList.add('flash');
  clearTimeout(flashSeismo._t);
  flashSeismo._t = setTimeout(() => el.classList.remove('flash'), 900);
}
function updateVStamp(att) {
  const id = document.querySelector('.vstamp-id');
  if (!id) return;
  // Render as a JMA-style timestamp slice: YYYYMMDD · HHMMSS
  const eid = att.event_id || '';
  if (eid.length === 14) id.textContent = `${eid.slice(0,8)} · ${eid.slice(8)}`;
  else id.textContent = eid || '—';
}

function flashNew(atts) {
  const t = document.createElement('div');
  t.className = 'toast';
  const top = atts[0];
  t.innerHTML = `<b>+${atts.length} new attestation${atts.length>1?'s':''}</b><br>
    <span style="color:#97a1b4;font-family:'JetBrains Mono',monospace;font-size:11px">
      M ${top.hypocenter.magnitude.toFixed(1)} · shindo ${SHINDO_LABEL(top.max_shindo)} · ${regionName(top.hypocenter)}
    </span>`;
  document.body.appendChild(t);
  setTimeout(() => t.style.transition = 'opacity .5s', 10);
  setTimeout(() => { t.style.opacity = '0'; }, 4500);
  setTimeout(() => t.remove(), 5200);
}

// ───── live data wiring ──────────────────────────────────────────────────────
async function refreshFromChain() {
  $('#live-pill').innerHTML = `<span class="dot"></span> fetching from Sui testnet…`;
  try {
    const fresh = await fetchAllAttestations();
    if (fresh.length) {
      EVENTS = fresh;
      applyData();
      renderEventList();
      renderStats();
    }
    $('#live-pill').innerHTML = `<span class="dot"></span> live · sui testnet · polling 20s`;
  } catch (e) {
    console.warn('initial chain fetch failed', e);
    $('#live-pill').innerHTML = `<span class="dot" style="background:var(--bad);box-shadow:0 0 10px var(--bad)"></span> offline · using snapshot`;
  }
}

// ───── bottom-sheet drag (mobile) ────────────────────────────────────────────
// On phones the cases panel is a draggable bottom sheet with three snap points:
// peek (~132px), half (56vh), full (≈100vh). On tablet/desktop it's a normal
// floating panel — the handle is hidden via CSS and this logic is a no-op.
function wireSheet() {
  const sheet  = $('#sheet');
  const handle = $('#sheet-handle');
  const list   = $('#event-list');
  if (!sheet || !handle) return;

  const setState = (s) => sheet.setAttribute('data-state', s);
  const getState = () => sheet.getAttribute('data-state') || 'peek';
  let startY = 0, startH = 0, dragging = false;

  // tap (no drag) → cycle states
  const tapCycle = () => {
    const next = { peek: 'half', half: 'full', full: 'peek', default: 'peek' };
    setState(next[getState()] ?? 'peek');
  };

  // rAF batching: pointermove can fire 120-240×/sec on high-refresh displays;
  // we coalesce into one transform write per frame, which keeps INP under 16ms.
  let raf = 0, pendingTop = 0;
  const flush = () => {
    sheet.style.transform = `translateY(${pendingTop}px)`;
    raf = 0;
  };

  const onDown = (e) => {
    if (!isPhone()) return;
    dragging = true;
    sheet.setAttribute('data-dragging', 'true');
    startY = (e.touches ? e.touches[0].clientY : e.clientY);
    startH = sheet.getBoundingClientRect().top;
    handle.setPointerCapture?.(e.pointerId);
    e.preventDefault?.();
  };
  const onMove = (e) => {
    if (!dragging) return;
    const y = (e.touches ? e.touches[0].clientY : e.clientY);
    pendingTop = Math.max(0, startH + (y - startY));
    if (!raf) raf = requestAnimationFrame(flush);
  };
  const onUp = (e) => {
    if (!dragging) return;
    dragging = false;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    sheet.removeAttribute('data-dragging');
    sheet.style.transform = '';
    // snap to nearest threshold
    const top = sheet.getBoundingClientRect().top;
    const vh  = window.innerHeight;
    if (top > vh * 0.65)      setState('peek');
    else if (top > vh * 0.25) setState('half');
    else                      setState('full');
    // if it was effectively a click (tiny movement), cycle instead
    const moved = Math.abs((e.changedTouches?.[0]?.clientY ?? e.clientY) - startY);
    if (moved < 6) tapCycle();
  };

  // Use pointer events where supported; fall back to touch events otherwise.
  if ('PointerEvent' in window) {
    handle.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  } else {
    handle.addEventListener('touchstart', onDown, { passive: false });
    window.addEventListener('touchmove',  onMove, { passive: false });
    window.addEventListener('touchend',   onUp);
    handle.addEventListener('click', tapCycle);
  }

  // when the user scrolls the cases list to the very top and pulls further
  // down, collapse to half (feels native).
  let overscrollStart = 0;
  list.addEventListener('touchstart', (e) => {
    if (list.scrollTop === 0) overscrollStart = e.touches[0].clientY;
    else overscrollStart = 0;
  }, { passive: true });
  list.addEventListener('touchmove', (e) => {
    if (!overscrollStart) return;
    const dy = e.touches[0].clientY - overscrollStart;
    if (dy > 80 && getState() === 'full') { setState('half'); overscrollStart = 0; }
    else if (dy > 80 && getState() === 'half') { setState('peek'); overscrollStart = 0; }
  }, { passive: true });

  // re-evaluate state on viewport changes
  window.addEventListener('resize', () => {
    if (!isPhone()) sheet.setAttribute('data-state', 'default');
    else if (getState() === 'default') sheet.setAttribute('data-state', 'peek');
  });
  if (!isPhone()) sheet.setAttribute('data-state', 'default');
  else sheet.setAttribute('data-state', 'peek');
}

// Info button + hero modal toggling (mobile). On desktop the hero panel is
// always visible, so the button is hidden via CSS and these handlers no-op.
function wireInfoModal() {
  const hero = $('#hero');
  const openers = $$('.js-info');
  const closer  = $('#hero-close');
  if (!hero) return;
  openers.forEach(el => el.addEventListener('click', (e) => {
    if (!isPhone()) return;       // desktop: leave panel as-is
    e.preventDefault();
    hero.classList.add('open');
  }));
  closer?.addEventListener('click', () => hero.classList.remove('open'));
  // dismiss on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hero.classList.remove('open');
      $('#detail')?.classList.remove('open');
    }
  });
}

// ───── boot ──────────────────────────────────────────────────────────────────
(async function main() {
  renderLegend();
  renderStats();
  renderEventList();
  wireSheet();
  wireInfoModal();
  // Paint a quiet ambient seismograph trace before any focus so the line
  // doesn't sit flat — gives the bottom edge of the page a heartbeat.
  if (EVENTS[0]) { updateSeismoForAtt(EVENTS[0]); updateVStamp(EVENTS[0]); }
  await bootGlobe();
  refreshFromChain();
  startPolling(EVENTS.map(e => e.serial), (fresh) => {
    EVENTS = [...EVENTS, ...fresh];
    applyData();
    renderStats();
    renderEventList();
    flashNew(fresh);
  }, 20_000);

  // Auto-focus the first/only attestation, but only on desktop — on phones we
  // want the user to see the globe + sheet first, then tap a case.
  setTimeout(() => {
    if (EVENTS.length === 1 && !isPhone()) focusAttestation(EVENTS[0]);
  }, 1400);
})();
