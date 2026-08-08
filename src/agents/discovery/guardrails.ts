import type { SalesTurnOutput } from "./schemas";

/**
 * Ported from
 * sales-agent/src/ecommerce_sales_flow/sales_advisor/guardrails.py.
 *
 * `Output.object({ schema })` only guarantees the *shape* of the model's
 * reply; it says nothing about whether the labels inside it are real,
 * whether the shortlist actually shrank, or whether a rejected product
 * snuck back in. validateTurn checks that content-level contract — same
 * rules as the Python original, no framework-specific workaround needed
 * here (the original's retry loop existed to route around a CrewAI
 * async/guardrail bug that doesn't exist in this port; see agent.ts for
 * the TS retry loop, which still exists because these are domain rules an
 * LLM call can't self-enforce, not because of any TS-side bug).
 */

export type ValidationResult = { ok: true } | { ok: false; error: string };

export interface ValidateTurnInput {
  data: SalesTurnOutput;
  /**
   * Every label this conversation has ever returned from the catalog tool
   * — the TS equivalent of Python's `catalog.known_labels`. Note: the
   * Python version took a whole `Catalog` object but only ever read this
   * one derived set off it; this port takes the narrower, already-derived
   * set directly; the tool's per-conversation label registry (P1, P2, ...)
   * lives in Phase 2's state model / Phase 3's catalog tool wiring, not
   * here.
   */
  knownLabels: ReadonlySet<string>;
  candidateCap: number;
  previousCandidateLabels: readonly string[];
  rejectedProductLabels: readonly string[];
}

const ok: ValidationResult = { ok: true };

/**
 * TODO(phase-3): the "tool result line" / "id=<value>" phrasing below
 * mirrors CrewAI's text-formatted tool output convention from the Python
 * original. The AI SDK's typed `execute()` (Phase 3) may return structured
 * data instead of a formatted text line — once that shape is decided,
 * revisit this wording so it matches how labels are actually presented to
 * the model, rather than assuming the old phrasing still applies verbatim.
 */
export function validateTurn({
  data,
  knownLabels,
  candidateCap,
  previousCandidateLabels,
  rejectedProductLabels,
}: ValidateTurnInput): ValidationResult {
  const previousSet = new Set(previousCandidateLabels.map(String));
  const rejectedSet = new Set(rejectedProductLabels.map(String));

  const touchedLabels = new Set(
    [...data.updated_candidate_labels, ...data.recommended_product_labels].map(String),
  );
  const unknown = [...touchedLabels].filter((label) => !knownLabels.has(label));
  if (unknown.length > 0) {
    return {
      ok: false,
      error:
        `Unknown product label(s) ${JSON.stringify(unknown.sort())} — these are not labels ` +
        "this conversation has ever returned from the catalog search tool. You most likely " +
        "used a product NAME, or made up a label, instead of copying the real label the tool " +
        "returned. Use that exact value in updated_candidate_labels/recommended_product_labels, " +
        "never a product's name.",
    };
  }

  if (data.updated_candidate_labels.length > candidateCap) {
    return {
      ok: false,
      error:
        `updated_candidate_labels has ${data.updated_candidate_labels.length} entries; ` +
        `the shortlist cap is ${candidateCap}. Narrow it further.`,
    };
  }

  if (
    previousSet.size > 0 &&
    !data.updated_candidate_labels.every((label) => previousSet.has(String(label)))
  ) {
    return {
      ok: false,
      error:
        "updated_candidate_labels must only contain labels from the previous shortlist " +
        `(${JSON.stringify([...previousSet].sort())}) — the shortlist can only shrink, never grow.`,
    };
  }

  const recommendedSet = new Set(data.recommended_product_labels.map(String));
  const recommendedAndRejected = [...recommendedSet].filter((label) => rejectedSet.has(label));
  if (rejectedSet.size > 0 && recommendedAndRejected.length > 0) {
    return {
      ok: false,
      error:
        `Product label(s) ${JSON.stringify(recommendedAndRejected.sort())} were already ` +
        "rejected by the shopper this conversation — do not recommend them again.",
    };
  }

  if (data.is_final && data.recommended_product_labels.length === 0) {
    return {
      ok: false,
      error:
        "is_final is true but recommended_product_labels is empty — include at least one " +
        "product label you are recommending.",
    };
  }

  return ok;
}
