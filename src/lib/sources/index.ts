export { getSourceAdapter, getSourceHealth, listSourceAdapters } from "./registry";
export { normalizeProduct, getPriceFreshness, getPriceFreshUntil } from "./normalization";
export { assessCandidate, isPriceDisplayable } from "./scoring";
export {
  buildCandidateDedupeKey,
  compareProducts,
  findDuplicateMatches,
  toComparableProduct,
} from "./deduplication";
export type {
  CandidateAction,
  CandidateListQuery,
  CandidateReviewStatus,
  ComplianceStatus,
  IngestCandidateInput,
  NormalizedLaptop,
  ProductCandidateRow,
  SourceAdapter,
  SourceFetchRequest,
  SourceHealth,
  SourceProduct,
} from "./types";
