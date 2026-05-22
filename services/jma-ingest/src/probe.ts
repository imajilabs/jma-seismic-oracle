import {
  fetchFeed,
  fetchReportById,
  fetchReportByUrl,
  isReportId,
  JMA_FEED_LONG,
  JMA_FEED_REGULAR,
  type ReportKind,
} from "@imajilabs/jma-seismic-oracle";

const args = process.argv.slice(2);
const cmd = args[0] ?? "feed";

async function cmdFeed() {
  const long = args.includes("--long");
  const kind = (args.find((a) => a.startsWith("--kind="))?.split("=")[1] ?? null) as
    | ReportKind
    | null;
  const url = long ? JMA_FEED_LONG : JMA_FEED_REGULAR;
  console.error(`# fetching ${url}`);
  const { entries } = await fetchFeed(url);
  const filtered = kind ? entries.filter((e) => e.reportKind === kind) : entries;
  console.error(`# entries: ${filtered.length}/${entries.length}`);
  for (const e of filtered) {
    console.log(
      `${e.updated}\t${e.reportKind}\t${e.reportId ?? "-"}\t${e.title}`,
    );
  }
}

async function cmdReport() {
  const arg = args[1];
  if (!arg) {
    console.error("usage: probe report <reportId|url>");
    process.exit(2);
  }
  const result = isReportId(arg)
    ? await fetchReportById(arg)
    : await fetchReportByUrl(arg);
  console.log(JSON.stringify({ rawXmlSize: result.rawXml.length, parsed: result.parsed }, null, 2));
}

async function cmdLatest() {
  const kind = (args[1] ?? "VXSE53") as ReportKind;
  const long = args.includes("--long");
  const url = long ? JMA_FEED_LONG : JMA_FEED_REGULAR;
  const { entries } = await fetchFeed(url);
  const match = entries.find((e) => e.reportKind === kind);
  if (!match || !match.reportId) {
    console.error(`# no ${kind} found in feed ${url}`);
    process.exit(1);
  }
  console.error(`# fetching latest ${kind}: ${match.reportId}`);
  const { parsed } = await fetchReportById(match.reportId);
  console.log(JSON.stringify(parsed, null, 2));
}

async function main() {
  switch (cmd) {
    case "feed":
      await cmdFeed();
      break;
    case "report":
      await cmdReport();
      break;
    case "latest":
      await cmdLatest();
      break;
    default:
      console.error(`unknown command: ${cmd}`);
      console.error("usage:");
      console.error("  probe feed [--long] [--kind=VXSE53|VXSE54|...]");
      console.error("  probe latest [VXSE53|VXSE54|...] [--long]");
      console.error("  probe report <reportId|url>");
      process.exit(2);
  }
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
