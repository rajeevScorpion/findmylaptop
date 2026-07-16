# Clarifying Questions After Investigation

Do not ask vague questions before understanding the codebase. After investigation, ask only practical questions that affect implementation choices.

## Question format

For each question, provide:

- What was discovered.
- Why it matters.
- Recommended option.
- Alternative option.
- Risk if not clarified.

## Expected clarifying topics

1. **Blog publishing workflow**
   - Is there an existing blog/CMS system?
   - Should agent-generated blogs remain drafts by default?
   - Recommended: draft + admin approve for MVP.

2. **Affiliate API access**
   - Are Amazon Creators API and Flipkart Affiliate API credentials available?
   - Recommended: build pluggable source adapters and support manual import fallback.

3. **Product card price display**
   - Can prices be shown only when source freshness and policy requirements are satisfied?
   - Recommended: use “Check current price” CTA unless price is fresh and compliant.

4. **Chip learning data**
   - Can user interaction logs be stored?
   - What privacy/disclosure copy is needed?
   - Recommended: store pseudonymous interaction signals first, not sensitive personal data.

5. **Automation level**
   - Should agents auto-publish or only prepare drafts?
   - Recommended: start with review mode.

6. **Admin controls**
   - Which admin users can approve products, blogs, and monetized placements?
   - Recommended: use existing admin role if present; otherwise add a protected admin gate.

7. **Other online sources**
   - Which sources are priorities after Amazon and Flipkart?
   - Recommended: build adapter interface first, then add sources one by one.

## Do not ask

- Do not ask “Should I inspect the codebase?” — it is mandatory.
- Do not ask “Should I use APIs?” — investigate official/approved APIs first.
- Do not ask “Should I keep existing flows working?” — yes, this is mandatory.
