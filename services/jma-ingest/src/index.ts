import { Hono } from "hono";
import {
  fetchFeed,
  fetchReportById,
  isReportId,
  JMA_FEED_LONG,
  JMA_FEED_REGULAR,
  REPORT_ID_PATTERN,
  type ReportKind,
} from "@imajilabs/jma-seismic-oracle";

const app = new Hono();

app.get("/", (c) =>
  c.json({
    name: "jma-seismic-oracle-ingest",
    version: "0.1.0",
    routes: [
      "GET /health",
      "GET /feed?long=0|1&kind=VXSE53|VXSE54|...",
      "GET /report/:reportId   (e.g. 20260426224826_0_VXSE53_010000)",
      "GET /trigger/:eventId   (returns canonical attestation payload)",
    ],
  }),
);

app.get("/health", (c) => c.json({ ok: true, t: Date.now() }));

app.get("/feed", async (c) => {
  const long = c.req.query("long") === "1" || c.req.query("long") === "true";
  const kindFilter = c.req.query("kind") as ReportKind | undefined;
  const url = long ? JMA_FEED_LONG : JMA_FEED_REGULAR;
  try {
    const { entries } = await fetchFeed(url);
    const filtered = kindFilter ? entries.filter((e) => e.reportKind === kindFilter) : entries;
    return c.json({
      source: url,
      count: filtered.length,
      entries: filtered,
    });
  } catch (err) {
    return c.json({ error: String(err) }, 502);
  }
});

app.get("/report/:reportId", async (c) => {
  const reportId = c.req.param("reportId");
  if (!isReportId(reportId)) {
    return c.json({ error: "invalid reportId format", expected: REPORT_ID_PATTERN.source }, 400);
  }
  try {
    const { parsed, rawXml } = await fetchReportById(reportId);
    return c.json({ reportId, rawXmlSize: rawXml.length, parsed });
  } catch (err) {
    return c.json({ error: String(err) }, 502);
  }
});

// Build a canonical trigger attestation payload for a JMA event id.
// v0: walks recent feed for matching VXSE53 (and VXSE54 if present), parses both,
// emits the canonical payload that would later be signed by the oracle signer.
app.get("/trigger/:eventId", async (c) => {
  const eventId = c.req.param("eventId");
  try {
    const [regular, long] = await Promise.all([
      fetchFeed(JMA_FEED_REGULAR),
      fetchFeed(JMA_FEED_LONG).catch(() => ({ rawXml: "", entries: [] })),
    ]);
    const candidates = [...regular.entries, ...long.entries].filter(
      (e) => (e.reportKind === "VXSE53" || e.reportKind === "VXSE54") && e.reportId != null,
    );

    let vxse53: Awaited<ReturnType<typeof fetchReportById>>["parsed"] | null = null;
    let vxse54: Awaited<ReturnType<typeof fetchReportById>>["parsed"] | null = null;

    for (const entry of candidates) {
      try {
        const { parsed } = await fetchReportById(entry.reportId!);
        if (parsed.reportKind === "VXSE53" && parsed.meta.eventId === eventId && !vxse53) {
          vxse53 = parsed;
        } else if (parsed.reportKind === "VXSE54" && parsed.meta.eventId === eventId && !vxse54) {
          vxse54 = parsed;
        }
        if (vxse53 && vxse54) break;
      } catch {
        // skip individual fetch failures
      }
    }

    if (!vxse53 && !vxse54) {
      return c.json(
        {
          eventId,
          error: "no matching VXSE53 or VXSE54 found in current feed window",
          hint: "JMA Atom feed only retains recent events; older events require historical archive",
        },
        404,
      );
    }

    return c.json({
      eventId,
      attestationPayload: {
        jmaEventId: eventId,
        serial:
          vxse53?.reportKind === "VXSE53"
            ? vxse53.meta.serial
            : vxse54?.reportKind === "VXSE54"
            ? vxse54.meta.serial
            : null,
        occurredAt:
          (vxse53?.reportKind === "VXSE53" && vxse53.originDateTime) ||
          (vxse54?.reportKind === "VXSE54" && vxse54.originDateTime) ||
          null,
        hypocenter:
          (vxse53?.reportKind === "VXSE53" && vxse53.hypocenter) ||
          (vxse54?.reportKind === "VXSE54" && vxse54.hypocenter) ||
          null,
        maxShindo:
          (vxse53?.reportKind === "VXSE53" && vxse53.maxShindo) ||
          (vxse54?.reportKind === "VXSE54" && vxse54.maxShindo) ||
          null,
        maxShindoScaled:
          (vxse53?.reportKind === "VXSE53" && vxse53.maxShindoScaled) ||
          (vxse54?.reportKind === "VXSE54" && vxse54.maxShindoScaled) ||
          null,
      },
      sources: { vxse53, vxse54 },
    });
  } catch (err) {
    return c.json({ error: String(err) }, 502);
  }
});

const port = Number(process.env.PORT ?? 8080);
console.log(`jma-seismic-oracle-ingest listening on :${port}`);

export default {
  port,
  fetch: app.fetch,
};
