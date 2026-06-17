# 06 — Public Blog Rendering Spec

## Objective

Create SEO-friendly public blog pages with a modern, polished visual system suitable for laptop buying guides.

## Required public routes

Adapt routes to existing codebase, but preferred:

```text
/blog
/blog/[slug]
```

Optional later:

```text
/blog/category/[slug]
/blog/tag/[slug]
```

## Feature flag behavior

- If `blog_enabled=false`: blog admin and public blog disabled.
- If `blog_public_enabled=false`: public blog routes should not expose posts.
- If a post is not `published`: public URL should 404 or redirect safely.

## Blog index page

`/blog` should include:

- Page title: Laptop Buying Guides
- Short intro
- Search/filter if easy
- Category filter
- Featured posts
- Recent posts
- CTA to LaptopFinder quiz

Suggested intro:

```text
Simple laptop buying guides for Indian students, parents, and professionals. Understand specs, compare budgets, and find the right laptop without confusion.
```

## Blog post page layout

Desktop:

```text
Hero
Main content container
Left/main: article
Right: sticky TOC
End: FAQs + related posts + CTA
```

Mobile:

```text
Hero
Collapsible TOC
Article
FAQs
CTA
Related posts
```

## Required visual components

### Hero card

Content:

- Title
- Excerpt
- Audience tags
- Last updated
- Reading time
- Optional category

### TOC card

- Generated from H2/H3 headings
- Anchor links
- Sticky on desktop
- Collapsible on mobile

### Quick answer card

Use near top of buying guides.

### Spec requirement cards

Example cards:

- Minimum specs
- Recommended specs
- Avoid if possible
- Best long-term choice

### Tip cards

Variants:

```text
parent_tip
student_tip
pro_tip
warning
info
quick_answer
```

### FAQ block

Render visibly on page if FAQ schema is generated.

### CTA block

Example:

```text
Still confused? Use LaptopFinder to get a personalized laptop shortlist in 2 minutes.
```

Link to the main LaptopFinder flow.

## Modern bullet list styling

Use existing CSS/Tailwind system.

Do not overdo animation. Keep pages fast and readable.

Possible styling:

- check icons for positive lists
- alert icons for warnings
- subtle background cards
- spacing and line height optimized for mobile reading

## Icons

Use existing icon package if available. If none exists, add a lightweight open icon library only after checking bundle impact.

Preferred if already present:

- Lucide React
- Heroicons

Do not add heavy icon libraries unnecessarily.

## Multicolumn layouts

Use responsive grids for:

- specs
- pros/cons
- budget tiers
- related posts
- product cards

Example:

```text
grid-cols-1 md:grid-cols-2 lg:grid-cols-3
```

But follow the existing styling system.

## Product blocks

MVP renderer should support placeholder safely:

```text
This section can show LaptopFinder product recommendations when product cards are enabled.
```

When product card feature is disabled, hide gracefully.

## Related posts

Show related posts based on:

- category
- tags
- primary keyword similarity if easy
- latest posts fallback

## Performance

- Avoid loading editor code on public pages.
- Render public content server-side/static where possible.
- Keep images optimized.
- Avoid client-heavy blog rendering unless needed.
- Do not ship OpenAI SDK to browser.

## Accessibility

- Proper heading hierarchy
- Anchor links accessible
- Sufficient contrast
- Keyboard navigable TOC
- Buttons and links clearly labeled
- FAQ accordion accessible if used
