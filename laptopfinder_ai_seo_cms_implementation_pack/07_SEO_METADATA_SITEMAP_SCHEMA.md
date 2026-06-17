# 07 — SEO Metadata, Sitemap, and Schema

## Objective

Every published blog post should be search-engine friendly.

## Required SEO fields

For each post:

```text
title
slug
excerpt
meta_title
meta_description
canonical_url
og_title
og_description
og_image_url
primary_keyword
secondary_keywords
published_at
updated_at
author
category
tags
```

## Metadata rules

### Title

- Unique
- Human readable
- Include primary keyword naturally
- Avoid keyword stuffing

### Meta title

Recommended length:

```text
45–60 characters where practical
```

### Meta description

Recommended length:

```text
140–160 characters where practical
```

This is not a hard technical requirement, but useful for CTR.

### Slug

Good:

```text
best-laptop-for-btech-cse-students-under-60000
```

Bad:

```text
post-123
best-best-best-laptop-india-buy-now
```

## Canonical URL

Generate canonical based on site base URL and slug.

Do not let admin enter malformed canonical unless there is a clear advanced reason.

## Open Graph

Generate:

```text
og:title
og:description
og:url
og:type=article
og:image
```

Use existing metadata patterns if present.

## Structured data

Add JSON-LD only for visible content.

### Article schema

Use for every published blog post.

Fields:

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Post title",
  "description": "Post excerpt/meta description",
  "datePublished": "...",
  "dateModified": "...",
  "author": {
    "@type": "Organization",
    "name": "LaptopFinder"
  },
  "publisher": {
    "@type": "Organization",
    "name": "LaptopFinder"
  }
}
```

Adapt if actual author profiles exist.

### FAQ schema

Only include if FAQs are visible on the page.

Do not add hidden FAQs only for SEO.

### Breadcrumb schema

Example:

```text
Home > Blog > Post Title
```

### Product schema

Do not add product/review/rating schema unless product data is real, visible, and grounded in the database.

Never generate fake ratings or fake reviews.

## Sitemap

If the project already has sitemap support, extend it.

Include:

```text
/blog
/blog/[slug]
```

Only include posts where:

```text
status = published
blog_enabled = true
blog_public_enabled = true
blog_auto_sitemap_enabled = true
```

Do not include:

```text
draft
review
ai_generated
archived
admin preview URLs
```

## Robots

Ensure public blog pages are indexable when enabled.

If public blog disabled, avoid exposing indexable empty/disabled pages.

## Internal linking

AI should suggest internal links, but renderer/admin must validate:

- link exists
- link is internal or safe external
- anchor text is not spammy

Minimum target:

- 2–5 internal links per long article
- CTA link to LaptopFinder quiz/tool
- related posts section

## SEO score checklist

Admin panel can show a practical SEO checklist:

```text
Primary keyword in title
Primary keyword in intro
Meta title present
Meta description present
Slug present
At least 3 H2 headings
TOC generated
FAQ included
CTA included
Internal links included
Last updated date visible
Schema valid
```

Do not make SEO score block publishing. Use it as a guide.

## Last updated

Show visible `Last updated` date on recommendations and buying guides.

Example:

```text
Last updated: June 2026. Prices and availability may change.
```

## Important content quality rule

Avoid creating thin content pages only for keywords. Each published page should be genuinely helpful for Indian laptop buyers.
