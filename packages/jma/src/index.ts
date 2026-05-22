/**
 * @imajilabs/jma-seismic-oracle — typed SDK for JMA (Japan Meteorological Agency) earthquake feeds.
 *
 * Used by:
 *   - the oracle signer (production trigger ingestion + attestation signing)
 *   - the jma-seismic-oracle dev API (services/jma-ingest)
 *   - any external consumer of the jma_seismic_oracle on-chain trigger feed
 *
 * Designed to be pure-functional where possible: parsing is synchronous and
 * side-effect free, network functions are isolated and easy to mock at the
 * boundary. Content integrity is delegated to Walrus's deterministic blob-id
 * encoding — no separate hashing layer.
 */

export * from "./types.ts";
export * from "./shindo.ts";
export { BandBcs, ShindoBcs, serializeShindo } from "./shindo-bcs.ts";
export {
  JMA_DATA_BASE,
  REPORT_ID_PATTERN,
  asReportId,
  isReportId,
  reportIdToUrl,
  urlToReportId,
  reportKindFromId,
} from "./ids.ts";
export { parseJmaCoordinate } from "./coordinate.ts";
export { classifyTitle } from "./classify.ts";
export {
  JMA_FEED_REGULAR,
  JMA_FEED_LONG,
  fetchFeed,
  parseFeed,
  type FetchFeedResult,
} from "./feed.ts";
export {
  fetchReportById,
  fetchReportByUrl,
  fetchReportByBlobId,
  parseReport,
  type FetchReportResult,
} from "./report.ts";
export {
  BlobNotFoundError,
  InMemoryBlobSource,
  type BlobSource,
} from "./blob-source.ts";
export {
  AggregatorBlobSource,
  type AggregatorBlobSourceOptions,
} from "./aggregator.ts";
export {
  BlobIdMismatchError,
  assertBlobId,
  computeBlobId,
  createWalrusExt,
  type CreateWalrusExtOptions,
  type WalrusExt,
  type WalrusNetwork,
} from "./walrus.ts";
