export type GraphQLErrorEntry = {
  message: string;
  path?: Array<string | number>;
  extensions?: Record<string, unknown>;
};

const FIELD_ACCESS_DENIED_PATTERN =
  /Access denied for (\w+) field|not approved to access the (\w+)|Required access:\s*(\w+)/i;

export function isGraphQLFieldAccessDenied(
  errors: GraphQLErrorEntry[],
  field: string,
): boolean {
  const fieldLower = field.toLowerCase();
  return errors.some((error) => {
    if (error.path?.[0] === field) return true;
    const match = error.message.match(FIELD_ACCESS_DENIED_PATTERN);
    if (!match) return false;
    const mentioned = (match[1] ?? match[2] ?? match[3] ?? "").toLowerCase();
    return mentioned === fieldLower || mentioned.replace(/s$/, "") === fieldLower.replace(/s$/, "");
  });
}

export function graphQLErrorSummary(errors: GraphQLErrorEntry[]): string {
  return errors.map((error) => error.message).join("; ");
}

export function isDiscountAccessDeniedMessage(message: string): boolean {
  return /discountNodes|read_discounts/i.test(message);
}
