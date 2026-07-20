const SAFE_INTERNAL_HREF_PATTERN =
  /^\/(?!\/)[A-Za-z0-9/_?&=#.+,~@!$'()*;-]*$/;

/**
 * Blog CTAs are navigation only. Product destinations must use the central
 * identifier-based affiliate resolver, never an AI/admin supplied URL.
 */
export function isSafeInternalBlogHref(value: string): boolean {
  return (
    value.length <= 500 &&
    SAFE_INTERNAL_HREF_PATTERN.test(value) &&
    !/[\u0000-\u001f\u007f\\]/.test(value)
  );
}

export function safeInternalBlogHref(value: string | null | undefined): string {
  return value && isSafeInternalBlogHref(value) ? value : "/";
}
