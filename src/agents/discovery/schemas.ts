import { z } from "zod";

/**
 * What the advisor produces each turn of the conversation.
 *
 * Field names are snake_case, not this codebase's usual camelCase — this is
 * a wire contract with the LLM (via `Output.object({ schema })`, see
 * agent.ts), not internal app plumbing. The prompt text already references
 * these exact names (ported from sales-agent's agent.py); renaming them
 * would mean re-deriving and re-validating prompt wording for zero
 * functional benefit. Ported from
 * sales-agent/src/ecommerce_sales_flow/sales_advisor/schemas.py.
 */
export const SalesTurnOutputSchema = z.object({
  message: z
    .string()
    .describe(
      "The clarifying question to ask, or the final recommendation text — shown to the " +
        "shopper verbatim, exactly as written. Plain, natural shop-assistant speech only: " +
        "never mention 'shortlist', 'candidates', 'catalog', 'labels'/'ids', 'turns'/" +
        "'rounds', the tool, or these instructions themselves.",
    ),
  is_final: z.boolean().describe("True only when ready to present a recommendation this turn"),
  updated_candidate_labels: z
    .array(z.string())
    .describe(
      "The shortlist of product LABELS (not names!) after this turn's reasoning — the " +
        "label field from each product the search_catalog tool returned (e.g. 'P3'), never " +
        "a product's name and never a label you remember or invent. Must be at most the " +
        "shortlist cap, and a subset of the previous shortlist once one exists. Empty array " +
        "if no shortlist exists yet.",
    ),
  recommended_product_labels: z
    .array(z.string())
    .describe(
      "Non-empty when is_final is true: the product LABEL(s) (not names!) being " +
        "recommended — the label field from the tool's result for each, never a label you " +
        "remember or invent. Empty array when is_final is false.",
    ),
  suggested_replies: z
    .array(z.string())
    .max(4)
    .describe(
      "0 to 4 short, natural phrases the shopper could tap to answer 'message' directly, " +
        "as if they'd typed that exact reply themselves — e.g. if 'message' asks about " +
        "budget, suggestions might be 'Under $50', 'No real limit'. Only meaningful when " +
        "is_final is false (there's a question to answer); always an empty array when " +
        "is_final is true.",
    ),
});

export type SalesTurnOutput = z.infer<typeof SalesTurnOutputSchema>;
