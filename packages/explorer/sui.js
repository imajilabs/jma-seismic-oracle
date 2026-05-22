// sui.js — minimal Sui JSON-RPC client for the seismic oracle.
//
// Pulls TriggerAttested events from the package, then hydrates each one with
// the corresponding TriggerAttestation shared object (which carries the full
// hypocenter + source XML hash that isn't in the event payload itself).

import { ORACLE_PACKAGE, TRIGGER_EVENT, SUI_RPC, SHINDO_RANK } from './data.js';

async function rpc(method, params) {
  const res = await fetch(SUI_RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`${method} → HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`${method} → ${json.error.message}`);
  return json.result;
}

const eventIdToString = (arr) =>
  Array.isArray(arr) ? String.fromCharCode(...arr) : String(arr);

const decodeHypocenter = (h) => {
  const f = h.fields ?? h;
  const lat = Number(f.latitude_e7)  / 1e7 * (f.negative_lat ? -1 : 1);
  const lng = Number(f.longitude_e7) / 1e7 * (f.negative_lon ? -1 : 1);
  return {
    lat, lng,
    depth_km:  Number(f.depth_m) / 1000,
    magnitude: Number(f.magnitude_e2) / 100,
  };
};

const decodeShindo = (s) => {
  const f = s.fields ?? s;
  // band is Option<Band>; we get either null, "lower", "upper", or {fields:{...}}
  let band = null;
  if (f.band && typeof f.band === 'object') {
    band = f.band.variant?.toLowerCase?.() ?? null;
  } else if (typeof f.band === 'string') {
    band = f.band.toLowerCase();
  }
  return { level: Number(f.level), band };
};

const bytesToHex = (arr) =>
  Array.isArray(arr) ? arr.map(b => b.toString(16).padStart(2,'0')).join('') : String(arr);

/** Fetch every TriggerAttested event ever emitted by the oracle, hydrated. */
export async function fetchAllAttestations({ pageLimit = 8 } = {}) {
  const events = [];
  let cursor = null;
  for (let i = 0; i < pageLimit; i++) {
    const page = await rpc('suix_queryEvents', [
      { MoveEventType: TRIGGER_EVENT }, cursor, 50, true /* descending */,
    ]);
    events.push(...(page.data ?? []));
    if (!page.hasNextPage || !page.nextCursor) break;
    cursor = page.nextCursor;
  }

  // Hydrate every event in parallel — sequential awaits would turn N events
  // into N serial round-trips. Promise.all collapses that to one wall-clock
  // round-trip on the slowest object.
  const out = await Promise.all(events.map(async (ev) => {
    const pj = ev.parsedJson ?? {};
    const attestationId = pj.attestation_id;
    let hypocenter = null, xmlHash = null;
    try {
      const obj = await rpc('sui_getObject', [attestationId, { showContent: true }]);
      const fields = obj?.data?.content?.fields ?? {};
      if (fields.hypocenter)      hypocenter = decodeHypocenter(fields.hypocenter);
      if (fields.source_xml_hash) xmlHash    = bytesToHex(fields.source_xml_hash);
    } catch (e) {
      console.warn('hydrate failed for', attestationId, e);
    }
    return {
      serial:         Number(pj.serial),
      attestation_id: attestationId,
      tx_digest:      ev.id?.txDigest,
      event_id:       eventIdToString(pj.event_id),
      occurred_at_ms: Number(pj.occurred_at_ms),
      attested_at_ms: Number(pj.attested_at_ms),
      max_shindo:     decodeShindo(pj.max_shindo),
      hypocenter,
      source_xml_hash: xmlHash,
    };
  }));
  // Drop anything we couldn't hydrate (no point plotting without coords).
  return out.filter(a => a.hypocenter);
}

/** Poll the chain on an interval; calls onNew(attestations[]) with the diff. */
export function startPolling(seedSerials, onNew, intervalMs = 20_000) {
  const known = new Set(seedSerials);
  let stopped = false;
  const tick = async () => {
    if (stopped) return;
    try {
      const all = await fetchAllAttestations();
      const fresh = all.filter(a => !known.has(a.serial));
      if (fresh.length) {
        fresh.forEach(a => known.add(a.serial));
        onNew(fresh);
      }
    } catch (e) {
      console.warn('poll failed', e);
    }
    if (!stopped) setTimeout(tick, intervalMs);
  };
  setTimeout(tick, intervalMs);
  return () => { stopped = true; };
}
