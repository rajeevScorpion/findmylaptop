export const ADMIN_GUIDE_VERSION = "2026.07";

export type GuideAudience = "operator" | "power";

export interface GuideStep {
  title: string;
  instruction: string;
  result?: string;
  caution?: string;
}

export interface GuideRelationship {
  label: string;
  href: string;
  relationship: string;
}

export interface AdminScreenGuide {
  id: string;
  label: string;
  route: string;
  purpose: string;
  useWhen: string;
  prerequisites: string[];
  steps: GuideStep[];
  outputs: string[];
  relationships: GuideRelationship[];
  troubleshooting: Array<{ symptom: string; response: string }>;
  powerUser: {
    decisionPoints: string[];
    technicalPaths: string[];
  };
}

export interface WorkflowGuide {
  id: string;
  title: string;
  purpose: string;
  frequency: string;
  nodes: Array<{
    label: string;
    href: string;
    detail: string;
    gate?: string;
  }>;
  completion: string;
}

export const FIRST_TIME_SETUP = [
  {
    title: "Confirm access and staging",
    detail:
      "Sign in with an email listed in ADMIN_EMAILS and confirm you are working on dev.laptopfinder.cc before changing operational controls.",
    href: "/admin",
  },
  {
    title: "Review public site settings",
    detail:
      "Set the disclaimer and WhatsApp link, then leave unfinished domains and public blog features disabled.",
    href: "/admin/settings",
  },
  {
    title: "Build the taxonomy",
    detail:
      "Create the programmes and specialisations that laptops will use for matching and coverage reporting.",
    href: "/admin/taxonomy",
  },
  {
    title: "Prepare author personas",
    detail:
      "Create at least one active, clearly disclosed persona with blog-writing permission before generating agent drafts.",
    href: "/admin/personas",
  },
  {
    title: "Inspect safety controls",
    detail:
      "Keep Safe mode on, validate source health, review retention periods, and enable one agent capability at a time.",
    href: "/admin/growth-agents",
  },
  {
    title: "Test one complete path",
    detail:
      "Run one candidate or research topic through review to an unpublished draft before enabling a recurring schedule.",
    href: "/admin/growth-agents/research",
  },
] as const;

export const WORKFLOW_GUIDES: readonly WorkflowGuide[] = [
  {
    id: "catalog-pipeline",
    title: "Product catalog: source to public recommendation",
    purpose:
      "Turn verified product evidence into a public laptop recommendation without allowing an import or agent to publish directly.",
    frequency: "As new models appear or existing products materially change",
    nodes: [
      {
        label: "Growth Agents",
        href: "/admin/growth-agents",
        detail: "Confirm the product source is enabled and healthy. Product ingestion is separate from the editorial Research Agent switch.",
        gate: "Source gate",
      },
      {
        label: "Research Queue",
        href: "/admin/growth-agents/research",
        detail: "Import, normalize, inspect freshness, and approve only adequate evidence.",
        gate: "Human evidence review",
      },
      {
        label: "Laptops",
        href: "/admin/laptops",
        detail: "Complete taxonomy, recommendation text, cautions, imagery, price, and availability.",
        gate: "Unpublished catalog review",
      },
      {
        label: "Public finder and Chip",
        href: "/admin",
        detail: "Only the administrator's final Publish action makes the laptop eligible for public use.",
        gate: "Final publish decision",
      },
    ],
    completion:
      "The laptop is published, appears in the intended domain and course filters, and has a current safe outbound link.",
  },
  {
    id: "editorial-pipeline",
    title: "Editorial pipeline: research theme to published guide",
    purpose:
      "Create evidence-backed content while preserving persona disclosure, quality checks, and administrator review.",
    frequency: "Weekly planning with daily run monitoring",
    nodes: [
      {
        label: "Author Personas",
        href: "/admin/personas",
        detail: "Prepare an active voice, disclosure, topic fit, and permissions.",
        gate: "Identity and permission gate",
      },
      {
        label: "Research Calendar",
        href: "/admin/growth-agents/calendar",
        detail: "Define themes, audiences, evidence thresholds, novelty history, source rotation, limits, and schedule state.",
        gate: "Schedule, source, and novelty gate",
      },
      {
        label: "Agent Drafts",
        href: "/admin/growth-agents/blog",
        detail: "Convert a ready research packet into a quality-gated CMS draft.",
        gate: "Quality and fact-check gate",
      },
      {
        label: "Blog",
        href: "/admin/blog",
        detail: "Verify claims and links, edit the draft, preview it, then publish manually.",
        gate: "Final editorial approval",
      },
    ],
    completion:
      "The post has accurate citations, correct public attribution, safe internal/product links, complete SEO fields, and an explicit admin publish decision.",
  },
  {
    id: "incident-pipeline",
    title: "Operational incident: stop, inspect, recover",
    purpose:
      "Contain unexpected agent activity or unsafe output before diagnosing and resuming the smallest affected capability.",
    frequency: "Only when an error, unsafe output, or unexpected run is observed",
    nodes: [
      {
        label: "Emergency stop",
        href: "/admin/growth-agents",
        detail: "Stop new calendar research, Blog Agent work, and affiliate monetization, then separately disable Chip learning or any other tool involved in the incident.",
        gate: "Immediate containment",
      },
      {
        label: "Jobs and queues",
        href: "/admin/growth-agents",
        detail: "Record failed job type, time, status, and scrubbed error; inspect related queue artifacts.",
        gate: "Evidence collection",
      },
      {
        label: "Correct dependency",
        href: "/admin/settings",
        detail: "Repair the source, persona, flag, schedule, content, or environment dependency in staging.",
        gate: "Staging verification",
      },
      {
        label: "Controlled recovery",
        href: "/admin/growth-agents",
        detail: "Keep Safe mode on, clear the stop, and re-enable only the affected capability for one test run.",
        gate: "One-capability validation",
      },
    ],
    completion:
      "One staging test succeeds, no unexpected public change occurred, and the incident and recovery decision are documented.",
  },
];

export const DEPENDENCY_GROUPS = [
  {
    title: "Access and data",
    items: [
      "ADMIN_EMAILS membership is required for every admin route and mutation.",
      "Supabase stores catalog, editorial, agent, feedback, audit, and configuration records.",
      "Autonomous-agent migrations 024–033 must be applied in order by the operator responsible for the database.",
    ],
  },
  {
    title: "Catalog",
    items: [
      "Taxonomy supplies the programme and specialisation choices used by laptops and public filters.",
      "Only published laptops can become normal public recommendations.",
      "Research Queue approval creates an unpublished laptop; it never completes public publication.",
    ],
  },
  {
    title: "Editorial",
    items: [
      "Blog CMS must be enabled before Blog appears in navigation.",
      "Agent drafting needs a ready research packet and an active persona with blog-writing permission.",
      "Public blog visibility, structured data, sitemap inclusion, and product blocks have separate Settings flags.",
    ],
  },
  {
    title: "Automation and providers",
    items: [
      "Each implemented Growth Agent capability is checked by its privileged server operation, but the two stop switches do not currently cover every admin or Chip tool.",
      "Research needs an OpenAI key, approved domains, and enabled source/provider configuration.",
      "Scheduled execution needs a valid cron secret; API sources need valid server-side credentials.",
    ],
  },
  {
    title: "Safety and privacy",
    items: [
      "Generated work is always review-controlled in the current workflow; Safe mode additionally keeps affiliate monetization gated.",
      "Retention settings control deletion windows for transcripts, events, jobs, clicks, payloads, and audit records.",
      "Outbound links pass through the central redirect resolver and source allowlists.",
    ],
  },
] as const;

export const CURRENT_OPERATIONAL_BOUNDARIES = [
  {
    title: "Two kinds of research are separate",
    detail:
      "Research Queue ingests marketplace/manual product evidence and can create an unpublished laptop. Research Calendar performs editorial web research and creates evidence packets. Neither feeds the other.",
  },
  {
    title: "Stop controls have a defined scope",
    detail:
      "Global pause and Emergency stop gate Calendar research, Blog Agent work, and affiliate monetization. They do not stop Research Queue ingestion, public Chip chat, Chip learning, manual Blog AI assist, laptop extraction, or price refresh. Disable the relevant feature separately during an incident.",
  },
  {
    title: "Manual and scheduled Calendar runs differ",
    detail:
      "Run now ignores the calendar Enabled/Paused state but requires the chosen day enabled, Research Agent on, and both stop switches off. Scheduled runs also require the calendar enabled and unpaused.",
  },
  {
    title: "Research awareness comes from server history",
    detail:
      "Every research call is stateless. The server supplies non-rejected research packets and non-archived CMS posts from the selected history window, plus rejected packets from only the last 30 days, then independently applies deterministic novelty checks. More than 500 eligible items stops the run before web research instead of silently dropping history. This does not use embeddings or model memory.",
  },
  {
    title: "The percentage is not the only duplicate guard",
    detail:
      "The similarity cutoff controls the weighted comparison. An exact readable title fingerprint, an exact rich subject key, or the same canonical source with matching domain, subject/product, and intent can reject independently of that percentage.",
  },
  {
    title: "Novelty decisions are serialized",
    detail:
      "One platform-wide database lease covers history loading, topic selection, and packet persistence. A competing Research Calendar run retries, then sees the first run's saved topics. The lease is released before optional Blog drafting.",
  },
  {
    title: "Automatic publication is not implemented",
    detail:
      "Calendar mode is stored as intent, but no current agent path auto-publishes a blog post. Imports and generated posts remain unpublished. Price refresh can auto-unpublish unavailable laptops and can republish back-in-stock items only through its explicit republish flow.",
  },
  {
    title: "Initial API source activation needs a platform owner",
    detail:
      "The UI requires a persisted valid credential status before enabling an API source, while Probe health does not currently persist that status. Provider secrets and first-time validation are a technical configuration boundary.",
  },
  {
    title: "Some data is advisory, not automatically learned",
    detail:
      "Feedback and affiliate clicks do not retrain or rerank the platform automatically. Chip learning stores privacy-minimized structured memory for the anonymous session; operational changes still require a reviewed product decision.",
  },
] as const;

export const ADMIN_SCREEN_GUIDES: readonly AdminScreenGuide[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    route: "/admin",
    purpose:
      "Provide a quick operational picture of catalog size, publication state, course coverage, and recently changed laptops.",
    useWhen: "At the start of an admin session and after catalog or taxonomy changes.",
    prerequisites: ["Admin sign-in", "Laptop and taxonomy data"],
    steps: [
      {
        title: "Read the top-level counts",
        instruction: "Compare Total Laptops, Published, and Drafts. An unexpected change is a reason to inspect Laptops before doing more work.",
      },
      {
        title: "Check course coverage",
        instruction: "Review each enabled domain and identify programmes with zero or low published-laptop coverage.",
        result: "A short list of catalog gaps to address.",
      },
      {
        title: "Review recent changes",
        instruction: "Open recently updated laptops and confirm their publication status and content are expected.",
      },
      {
        title: "Choose the next action",
        instruction: "Use Add Laptop for a known product, or Research Queue when evidence still needs to be imported and reviewed.",
      },
    ],
    outputs: ["Catalog health snapshot", "Coverage gap list", "Links to recently changed laptops"],
    relationships: [
      { label: "Taxonomy", href: "/admin/taxonomy", relationship: "Defines the courses measured by coverage." },
      { label: "Laptops", href: "/admin/laptops", relationship: "Supplies publication counts and recommendations." },
    ],
    troubleshooting: [
      { symptom: "A course shows zero coverage.", response: "Confirm the course is active, then assign it to at least one suitable published laptop." },
      { symptom: "Counts look lower than expected.", response: "Open Laptops and check whether price refresh or an administrator unpublished items." },
    ],
    powerUser: {
      decisionPoints: ["Coverage is scoped by domain; do not treat identically named courses in different domains as one record."],
      technicalPaths: ["src/app/admin/page.tsx", "src/lib/taxonomy.ts"],
    },
  },
  {
    id: "laptops",
    label: "Laptops",
    route: "/admin/laptops",
    purpose:
      "Maintain the canonical laptop catalog and make the final decision about whether a product is eligible for public recommendation.",
    useWhen: "Adding, correcting, reviewing, featuring, publishing, or retiring a laptop.",
    prerequisites: ["Relevant taxonomy exists", "Reliable product evidence", "Current price/source link when available"],
    steps: [
      { title: "Find or create the record", instruction: "Search the catalog first to avoid duplicates. Use Add Laptop for a new record." },
      { title: "Choose the domain first", instruction: "Select Design, Technology, or Management before tagging. If the domain changes later, recheck every workload and course tag because old hidden values are not cleared automatically." },
      { title: "Choose an input method", instruction: "Use AI extraction for a supported Amazon URL or pasted product evidence, or enter fields manually when evidence is already organized.", caution: "Generated extraction is a starting point, not proof. Verify every important specification." },
      { title: "Complete core facts", instruction: "Verify name, brand, model, price, source URL, image, CPU, GPU, RAM, storage, display, weight, and operating system." },
      { title: "Connect the recommendation", instruction: "Choose domain, tier, workloads, programmes, recommendation text, cautions, upgrade notes, and four-year suitability." },
      { title: "Set priority and visibility", instruction: "Choose priority score and home-page feature state. Keep the record unpublished while anything is uncertain." },
      { title: "Save, inspect, then publish", instruction: "Save the record, inspect its preview/public presentation, and publish only after the complete recommendation is defensible and its domain is enabled.", result: "A reviewed catalog record eligible for the finder and Chip when published." },
    ],
    outputs: ["Canonical laptop record", "Finder/Chip recommendation input", "Optional Editor's Pick"],
    relationships: [
      { label: "Taxonomy", href: "/admin/taxonomy", relationship: "Provides programme assignments and public filter vocabulary." },
      { label: "Research Queue", href: "/admin/growth-agents/research", relationship: "Promotes approved evidence into an unpublished laptop." },
      { label: "Refresh Prices", href: "/admin/refresh-prices", relationship: "Updates availability and price snapshots." },
    ],
    troubleshooting: [
      { symptom: "A course is missing from the form.", response: "Add or reactivate it in Taxonomy for the selected domain." },
      { symptom: "The laptop does not appear publicly.", response: "Confirm it is published, belongs to an enabled domain, and matches the current public filters." },
      { symptom: "The price or availability is uncertain.", response: "Keep the item unpublished and use Refresh Prices or verify the source manually." },
      { symptom: "Price or Featured controls are missing on a phone.", response: "Price can be changed through Edit Laptop. Featuring currently requires a viewport at least 640px wide." },
    ],
    powerUser: {
      decisionPoints: ["Slug and derived price labels are server-controlled.", "Catalog writes use authenticated admin APIs and service-role database access."],
      technicalPaths: ["src/components/admin/LaptopForm.tsx", "src/lib/admin/catalog-write.ts", "src/app/api/admin/laptops/route.ts"],
    },
  },
  {
    id: "taxonomy",
    label: "Taxonomy",
    route: "/admin/taxonomy",
    purpose:
      "Manage the controlled programme and specialisation vocabulary used by the finder, laptop forms, and coverage reporting.",
    useWhen: "A programme changes, a new audience is introduced, or a laptop cannot be tagged correctly.",
    prerequisites: ["A clear domain and programme naming decision", "Awareness of existing laptop tags"],
    steps: [
      { title: "Choose the domain", instruction: "Work in Design, Technology, or Management. Similar names in different domains remain separate." },
      { title: "Add the programme", instruction: "Enter the programme and optional specialisation using language a visitor will understand." },
      { title: "Set order and visibility", instruction: "Use sort order to control presentation. Hide a record to remove it from new choices while preserving existing laptop tags." },
      { title: "Edit carefully", instruction: "Rename only when the meaning remains the same; otherwise create a new record and retag laptops." },
      { title: "Delete only when obsolete", instruction: "Delete permanently only after checking that no active laptop depends on the entry.", caution: "Hiding is safer than deletion because it preserves historical assignments." },
    ],
    outputs: ["Finder filter vocabulary", "Laptop recommendation choices", "Dashboard coverage structure"],
    relationships: [
      { label: "Laptops", href: "/admin/laptops", relationship: "Consume active taxonomy values as recommendation tags." },
      { label: "Dashboard", href: "/admin", relationship: "Reports published coverage for taxonomy entries." },
      { label: "Settings", href: "/admin/settings", relationship: "Controls whether Technology and Management are public." },
    ],
    troubleshooting: [
      { symptom: "A hidden programme still appears on an old laptop.", response: "This is intentional. Hiding stops new selection but preserves existing tags; edit the laptop to remove it." },
      { symptom: "A new domain is empty publicly.", response: "Populate taxonomy and suitable published laptops before enabling the domain in Settings." },
    ],
    powerUser: {
      decisionPoints: ["Taxonomy records are data, not code constants; preserve domain boundaries and stable meaning."],
      technicalPaths: ["src/components/admin/taxonomy/TaxonomyManager.tsx", "src/lib/admin/catalog-write.ts", "src/app/api/admin/taxonomy/courses/route.ts"],
    },
  },
  {
    id: "blog",
    label: "Blog",
    route: "/admin/blog",
    purpose:
      "Create, review, publish, archive, and optimize editorial content in the CMS.",
    useWhen: "Writing manually, polishing an Agent Draft, changing SEO, or managing publication state.",
    prerequisites: ["Blog CMS enabled in Settings", "Verified claims and sources", "Appropriate author persona"],
    steps: [
      { title: "Open or create a post", instruction: "Select an existing status row or choose New post. Agent-generated work also appears here after it passes its draft gate." },
      { title: "Set identity and intent", instruction: "Write a clear title and slug, choose the author persona, and confirm the intended audience and search intent." },
      { title: "Build the content", instruction: "Use structured blocks for headings, paragraphs, cards, callouts, FAQs, internal CTAs, and product groups." },
      { title: "Use AI assist selectively", instruction: "Generate an outline, draft, FAQ, or metadata only when AI Blog Writer is enabled. Treat output as editable material.", caution: "Do not publish generated claims, specifications, prices, or citations without verification." },
      { title: "Complete SEO and links", instruction: "Add the excerpt/description, canonical path as applicable, safe internal links, and only relevant product blocks." },
      { title: "Preview and publish", instruction: "Save as draft or review, inspect the rendered post and attribution, then publish manually when it meets editorial standards." },
    ],
    outputs: ["CMS draft or published guide", "Public author attribution", "Optional sitemap and structured data entry"],
    relationships: [
      { label: "Author Personas", href: "/admin/personas", relationship: "Supply public attribution and writing constraints." },
      { label: "Agent Drafts", href: "/admin/growth-agents/blog", relationship: "Create evidence-linked AI-generated CMS drafts." },
      { label: "Settings", href: "/admin/settings", relationship: "Controls CMS, public visibility, AI assist, product blocks, schema, and sitemap." },
    ],
    troubleshooting: [
      { symptom: "Blog is missing from navigation.", response: "Enable Blog CMS in Settings. Public Blog is a separate switch." },
      { symptom: "A generated draft is not public.", response: "This is expected. Open it in Blog, complete review, and publish manually." },
      { symptom: "A product block is absent publicly.", response: "Confirm Product blocks are enabled and the referenced laptop is appropriate and available." },
    ],
    powerUser: {
      decisionPoints: ["AI generation stores CMS-compatible structured blocks; renderer and schema changes must remain backward compatible.", "CTA links are restricted to safe internal paths."],
      technicalPaths: ["src/components/admin/blog/BlogPostForm.tsx", "src/lib/blog/schemas.ts", "src/components/blog/BlockRenderer.tsx"],
    },
  },
  {
    id: "author-personas",
    label: "Author Personas",
    route: "/admin/personas",
    purpose:
      "Define transparent public authorship, editorial expertise, writing behavior, selection rules, and content permissions.",
    useWhen: "Adding an editorial voice, changing attribution, or tuning which persona may write a topic.",
    prerequisites: ["A truthful public identity/disclosure", "Defined editorial scope", "Blog CMS for eventual use"],
    steps: [
      { title: "Create the public profile", instruction: "Set display name, stable slug, public role, author type, optional avatar, short bio, and required disclosure." },
      { title: "Describe topic fit", instruction: "Add expertise, audience, category, and software tags; use priority weight only to break otherwise reasonable selection ties." },
      { title: "Define the voice", instruction: "Write internal guidance, buying philosophy, dos, don'ts, and tone levels. Keep it specific enough to review." },
      { title: "Set AI permissions and affiliate policy", instruction: "Allow only intended AI-generation capabilities, set product-card limits, and provide the required affiliate disclosure. Manual CMS editing remains an administrator capability." },
      { title: "Preview before activation", instruction: "Generate a writing sample, check disclosure and tone, save a version, then mark the persona active when it is ready." },
      { title: "Retire safely", instruction: "Archive or soft-delete a persona that should stop receiving new work. Hard-delete only an unused non-fallback persona.", caution: "Existing posts retain their author snapshot even when the persona later changes." },
    ],
    outputs: ["Versioned author profile", "Blog Agent selection candidate", "Public author archive and disclosure"],
    relationships: [
      { label: "Agent Drafts", href: "/admin/growth-agents/blog", relationship: "Requires an active persona with blog-writing permission." },
      { label: "Blog", href: "/admin/blog", relationship: "Stores a persona snapshot with each attributed post." },
      { label: "Research Calendar", href: "/admin/growth-agents/calendar", relationship: "May prefer specific persona slugs for a theme." },
    ],
    troubleshooting: [
      { symptom: "A persona cannot be selected for a draft.", response: "Confirm it is active and has blog-writing permission." },
      { symptom: "Hard delete is disabled.", response: "The persona is the fallback or has post usage. Archive or soft-delete it instead." },
      { symptom: "An old post still shows the previous profile.", response: "That is intentional historical attribution through the stored version snapshot." },
      { symptom: "Scheduled research creates packets but no automatic draft.", response: "Seeded personas start with auto-scheduling off. Deliberately enable it on an eligible persona and raise automatic draft caps above zero." },
    ],
    powerUser: {
      decisionPoints: ["Persona slugs become effectively immutable after post usage.", "Each save increments a version and posts preserve attribution snapshots."],
      technicalPaths: ["src/lib/personas/service.ts", "src/lib/personas/schemas.ts", "src/components/admin/personas/PersonaForm.tsx"],
    },
  },
  {
    id: "growth-agents",
    label: "Growth Agents",
    route: "/admin/growth-agents",
    purpose:
      "Operate the central safety, capability, provider-source, retention, and durable-job controls for the implemented autonomous workflows.",
    useWhen: "Before enabling automation, during routine health checks, and first during an agent incident.",
    prerequisites: ["Migrations 024 onward", "Required provider credentials", "A staging test plan"],
    steps: [
      { title: "Read the execution banner", instruction: "Confirm whether execution is active, paused, or stopped and how many capabilities are enabled." },
      { title: "Keep Safe mode on", instruction: "Use Safe mode during normal staging/review operations. Generated work is already draft-only; Safe mode additionally keeps affiliate monetization gated." },
      { title: "Understand stop-control scope", instruction: "Global pause and Emergency stop gate Calendar research, Blog Agent work, and affiliate monetization. They do not disable product candidate ingestion, public Chip chat, Chip learning, manual Blog AI assist, laptop extraction, or price refresh." },
      { title: "Set retention deliberately", instruction: "Choose deletion windows that meet operational, privacy, and audit needs. Avoid extending raw or conversational data without a documented reason." },
      { title: "Validate sources", instruction: "An API source must have a persisted valid credential status before it can be enabled. The current health probe does not persist that status, so first-time API activation needs a platform owner. Public outbound-link presentation and monetization are a separate permission." },
      { title: "Enable one capability", instruction: "Turn on Research, Blogging, Chip learning, or Affiliate links individually, save, and run a small staging test before enabling another." },
      { title: "Review durable jobs", instruction: "Check job type, status, and time. Investigate repeated failure or retry patterns before continuing." },
    ],
    outputs: ["Effective runtime safety state", "Approved source state", "Retention policy", "Operational job history"],
    relationships: [
      { label: "Research Queue", href: "/admin/growth-agents/research", relationship: "Uses configured source adapters." },
      { label: "Research Calendar", href: "/admin/growth-agents/calendar", relationship: "Requires permitted research execution." },
      { label: "Agent Drafts", href: "/admin/growth-agents/blog", relationship: "Requires permitted blogging execution." },
    ],
    troubleshooting: [
      { symptom: "A source cannot be enabled.", response: "Provider secrets and a persisted valid credential status are required. This cannot currently be completed by a nontechnical admin from the UI alone; contact the platform owner." },
      { symptom: "Calendar or Blog Agent work does not run despite enabled capabilities.", response: "Check Emergency stop, Global pause, calendar/day state, caps, persona permissions, source health, and recent job errors." },
      { symptom: "Jobs repeatedly fail.", response: "Pause execution, capture the scrubbed error code and dependency state, correct it in staging, then retry once." },
    ],
    powerUser: {
      decisionPoints: ["Capability flags are enforced inside their privileged services, but kill-switch coverage must be reviewed when adding a new tool.", "Runtime setting reads fail closed when configuration cannot be loaded.", "Source freshness TTL is stored but product price freshness currently uses adapter-specific hard-coded windows."],
      technicalPaths: ["src/lib/growth-agents/settings.ts", "src/lib/growth-agents/jobs.ts", "src/app/api/admin/growth-agents"],
    },
  },
  {
    id: "research-queue",
    label: "Research Queue",
    route: "/admin/growth-agents/research",
    purpose:
      "Import product evidence through approved adapters, normalize it, score fit and risk, and promote reviewed candidates into unpublished laptop records.",
    useWhen: "Evaluating a product that is not yet a complete catalog record.",
    prerequisites: ["Migration 025", "Enabled healthy source", "Official product identifier, URL, or structured manual evidence"],
    steps: [
      { title: "Probe source health", instruction: "Confirm the chosen adapter is enabled, configured, and suitable for the input you have." },
      { title: "Add one candidate", instruction: "Choose Manual JSON or an available official API source, provide the product data/identifier, then select Normalize and queue." },
      { title: "Inspect evidence", instruction: "Review normalized specifications, exact-price freshness, source timestamps, confidence, fit tags, risks, and compliance state." },
      { title: "Choose a review result", instruction: "Approve, Needs edit, Mark stale, or Reject. Approval requires safe compliance, confidence of at least 50, brand or model, CPU, RAM capacity, storage capacity, and a product URL. Add a short admin note when the reason will matter later.", caution: "Blocked or incomplete evidence cannot be edited inline; correct and re-import it." },
      { title: "Complete the laptop", instruction: "Approval creates or links an unpublished laptop. A brand-new legacy laptop requires an Amazon URL; non-Amazon evidence can only attach to an existing deduplicated laptop. Open the result, fill recommendation context, verify facts, and make the separate publish decision." },
    ],
    outputs: ["Reviewed product candidate", "Audit trail", "Optional unpublished laptop"],
    relationships: [
      { label: "Growth Agents", href: "/admin/growth-agents", relationship: "Controls source enablement and public-link presentation/monetization; Research Agent stop flags do not gate this queue." },
      { label: "Laptops", href: "/admin/laptops", relationship: "Receives approved candidates as unpublished records." },
      { label: "Refresh Prices", href: "/admin/refresh-prices", relationship: "Maintains price and availability after catalog promotion." },
    ],
    troubleshooting: [
      { symptom: "Normalize and queue is disabled.", response: "The selected source is disabled or unhealthy. Fix it in Growth Agents or use valid manual evidence." },
      { symptom: "Price is marked stale or missing.", response: "Do not present it as current. Verify through an approved source and refresh the record." },
      { symptom: "Approval created a draft instead of a public item.", response: "That is the safety boundary. Complete final review in Laptops and publish separately." },
      { symptom: "A manual non-Amazon candidate cannot create a laptop.", response: "Use a verified Amazon URL for a new legacy laptop, or make sure the offer deduplicates to an existing laptop." },
    ],
    powerUser: {
      decisionPoints: ["Adapters must normalize unknown fields as unknown rather than inventing values.", "Dedupe and idempotency prevent repeated imports from creating uncontrolled duplicates."],
      technicalPaths: ["src/lib/sources", "src/lib/products/candidates.ts", "src/app/api/admin/growth-agents/candidates"],
    },
  },
  {
    id: "research-calendar",
    label: "Research Calendar",
    route: "/admin/growth-agents/calendar",
    purpose:
      "Plan recurring evidence-backed editorial research by day, audience, theme, content type, source rotation, novelty policy, threshold, and output limit.",
    useWhen: "Planning the editorial week, testing a research run, or diagnosing missing research packets.",
    prerequisites: ["Migrations 024–033 applied manually in order, including novelty migration 033 after 032", "Research capability and provider configuration", "Approved domains/sources", "Cron secret for scheduled runs"],
    steps: [
      { title: "Keep the schedule paused while editing", instruction: "Set name, timezone, Draft only mode, daily/weekly output caps, and novelty controls before enabling execution. Mode is currently stored intent; it does not activate publication behavior." },
      { title: "Set deterministic novelty", instruction: "Under Schedule control, keep the recommended 180-day Topic history window and 62% Topic similarity cutoff unless staging evidence supports a change. The allowed window is 90–365 days; lower percentages reject more weighted overlap. Exact-title, exact-subject-key, and same-source/domain/subject/intent anchors can still reject below that percentage." },
      { title: "Keep history complete", instruction: "The main window includes non-rejected packets and non-archived CMS posts; rejected packets remain comparison history for only 30 days. If more than 500 items are eligible in total, the run stops before web research. Shorten the window, archive genuinely obsolete CMS posts, or ask a technical owner to review retention and volume." },
      { title: "Choose source rotation", instruction: "Leave Rotate recently used primary sources on to check the last two non-empty research runs for this same calendar day within 14 days. It withholds recently dominant primary domains; when none of the approved domains remain, the run safely returns a source-rotation explanation instead of broadening the search." },
      { title: "Configure each day", instruction: "Set enabled state, run time, theme, description, keywords, target audiences, preferred persona slugs, and an approved web source-priority group." },
      { title: "Set quality and volume gates", instruction: "Choose min/target/max packet counts plus research-confidence and Blog-quality thresholds. Other stored advanced day fields are not editable on this screen yet." },
      { title: "Save and test one day", instruction: "Save Schedule control, then enable and save the selected day. Use Run now and inspect the wrapped amber notice, typed reason badge, recent run, and resulting research packets before scheduling it. On mobile, the run status and date stack so the full explanation remains readable. Run now intentionally bypasses the calendar's Enabled/Paused state, but still requires Research Agent on and both stop switches off." },
      { title: "Enable carefully", instruction: "Enable the calendar and clear Paused only after the test succeeds. The built-in schedule polls daily around 09:00 Asia/Kolkata. Scheduled draft handoff also needs Blogging Agent, automatic capacity above zero, and an eligible auto-scheduled persona.", caution: "Auto-publish has no runtime path. More precise run times require an explicitly approved higher-frequency scheduler." },
      { title: "Monitor outcomes", instruction: "Review succeeded, partial, no-good-topic, and failed runs. A zero-packet result can correctly report duplicate topic, insufficient freshness, insufficient evidence, source rotation, source configuration, or no qualifying candidate. Read that reason before changing the policy." },
    ],
    outputs: ["Research schedule runs with typed outcomes", "Novelty-checked citation-bound research packets", "Optional blog draft handoff"],
    relationships: [
      { label: "Growth Agents", href: "/admin/growth-agents", relationship: "Supplies capability, stop, source, and retention controls." },
      { label: "Author Personas", href: "/admin/personas", relationship: "Supplies preferred eligible writers." },
      { label: "Agent Drafts", href: "/admin/growth-agents/blog", relationship: "Consumes ready-for-blog packets." },
    ],
    troubleshooting: [
      { symptom: "Run now says duplicate topic.", response: "Open Recent runs and read the closest covered title. The server compared platform-wide research packets and non-archived CMS posts in the configured history window; change the angle only when it is genuinely distinct." },
      { symptom: "The run failed because novelty history exceeded 500 items.", response: "Do not keep retrying unchanged. Shorten the Topic history window, archive genuinely obsolete CMS posts, or ask a technical owner to review retention and data volume. The run stops so it cannot claim novelty from incomplete history." },
      { symptom: "Run now reports freshness or evidence.", response: "Use current primary sources, narrow the claim, and verify the configured source groups. Do not lower research quality merely to force output." },
      { symptom: "Run now reports source rotation.", response: "The same primary domain dominated one of the last two non-empty research runs for this day within 14 days and no approved alternative remained. Broaden approved source groups, wait for the cooldown, or deliberately turn rotation off and save the calendar policy." },
      { symptom: "Run now reports source configuration.", response: "Confirm the day's source-priority groups resolve to approved domains and that any additional RESEARCH_ALLOWED_DOMAINS entries are valid hostnames." },
      { symptom: "Scheduled runs do not start.", response: "Check calendar Enabled/Paused, day Enabled, timezone/run time, Growth Agent stop flags, research capability, and cron authentication." },
      { symptom: "Packets exist but drafts do not.", response: "Check create-draft choice, Blogging Agent state, packet threshold, and eligible persona permissions." },
      { symptom: "A packet says needs admin review but has no review button.", response: "The current UI cannot promote that packet. Improve the theme/sources or responsibly adjust the threshold, then rerun." },
    ],
    powerUser: {
      decisionPoints: [
        "Each model call is stateless; server-loaded history supplies awareness before the call and a deterministic semantic feature gate enforces it afterward.",
        "The main history window defaults to 180 days, while rejected packets use a fixed 30-day window. The combined eligible set is capped at 500 and fails closed rather than truncating.",
        "The 62% default controls weighted semantic matching. The readable exact-title fingerprint and separate rich subject key are different fields; exact matches and the same canonical source/domain/subject/intent anchor bypass the percentage cutoff.",
        "A global novelty lease serializes history loading, selection, and persistence. Persistence also atomically claims exact titles, and those claims remain reserved after packet status changes and the ordinary history window.",
        "Run claims, execution tokens, packet persistence, and completion are fenced for retry safety.",
        "Research output is accepted only when returned citations match approved exact URLs/domains.",
        "Research Calendar does not consume Product Research Queue candidates; marketplace-only source priorities intentionally yield no web packet.",
      ],
      technicalPaths: ["src/lib/research-calendar", "src/app/api/cron/growth-agents/route.ts", "vercel.json"],
    },
  },
  {
    id: "agent-drafts",
    label: "Agent Drafts",
    route: "/admin/growth-agents/blog",
    purpose:
      "Convert a verified research packet into a quality-gated, persona-attributed CMS draft without publishing it.",
    useWhen: "A research packet is ready for editorial drafting or a generation result needs review.",
    prerequisites: ["Migration 029", "Blogging Agent enabled", "Ready research packet", "Active persona with blog-writing permission"],
    steps: [
      { title: "Review ready packets", instruction: "Check topic, evidence, confidence, urgency, content type, and suggested personas before generating." },
      { title: "Choose attribution", instruction: "Use automatic selection only when tags clearly match, or explicitly choose the responsible active persona." },
      { title: "Generate once", instruction: "Start generation and wait for its artifact status. Duplicate/retry protection prevents the same active run from creating uncontrolled copies." },
      { title: "Read the quality result", instruction: "Inspect quality score, threshold, fact checks, source references, internal-link suggestions, and failure/blocked reasons." },
      { title: "Open the CMS draft", instruction: "For a needs-review result, open the linked Blog post, verify every claim and citation, edit the structure, and publish only through Blog." },
    ],
    outputs: ["Generation artifact", "Quality/fact-check record", "Unpublished CMS post"],
    relationships: [
      { label: "Research Calendar", href: "/admin/growth-agents/calendar", relationship: "Creates ready evidence packets." },
      { label: "Author Personas", href: "/admin/personas", relationship: "Constrains voice, permissions, disclosures, and product-card policy." },
      { label: "Blog", href: "/admin/blog", relationship: "Owns final editing and publication." },
    ],
    troubleshooting: [
      { symptom: "There are no ready packets.", response: "Run or inspect Research Calendar and confirm packets met confidence/status requirements." },
      { symptom: "No persona is available.", response: "Activate a persona and grant blog-writing permission." },
      { symptom: "Generation is quality blocked.", response: "Review failed checks and evidence. Improve the research or write/edit manually; do not bypass the threshold without a policy decision." },
    ],
    powerUser: {
      decisionPoints: ["Research evidence is treated as untrusted citation-bound data, not as instructions.", "Atomic persistence validates generation and upstream lease tokens before creating the CMS post."],
      technicalPaths: ["src/lib/blog-agent/service.ts", "src/lib/blog-agent/quality.ts", "src/lib/ai/blog-writer.ts"],
    },
  },
  {
    id: "feedback",
    label: "Feedback",
    route: "/admin/feedback",
    purpose:
      "Review Chip conversation outcomes and ratings to identify operational catalog, content, or recommendation problems.",
    useWhen: "During the weekly quality review or after reports of poor recommendations.",
    prerequisites: ["Chat usage", "Admin authorization", "Respect for transcript privacy and retention policy"],
    steps: [
      { title: "Review the summary", instruction: "Look at total, positive, and negative conversations; focus first on a new negative pattern rather than isolated preference differences." },
      { title: "Open a session", instruction: "On mobile, select a session and use Back to return to the list. On desktop, select from the left and read the transcript on the right." },
      { title: "Classify the issue", instruction: "Decide whether the cause is missing taxonomy, incomplete laptop data, stale availability, prompt/response quality, or a user-specific request outside scope." },
      { title: "Correct the owning feature", instruction: "Update Taxonomy, Laptops, prices, public settings, or the relevant tested recommendation logic. Record the reason for a power-user change." },
      { title: "Protect user data", instruction: "Use transcripts only for the operational purpose, avoid copying personal details, and let retention cleanup remove expired records." },
    ],
    outputs: ["Quality issue classification", "Catalog/content correction", "Evidence for a tested product decision"],
    relationships: [
      { label: "Laptops", href: "/admin/laptops", relationship: "Corrects product facts and recommendation coverage." },
      { label: "Taxonomy", href: "/admin/taxonomy", relationship: "Corrects missing or confusing audience choices." },
      { label: "Growth Agents", href: "/admin/growth-agents", relationship: "Controls Chip learning and transcript/event retention." },
    ],
    troubleshooting: [
      { symptom: "No transcript is saved.", response: "Use the rating/comment and recommended slugs that are available; do not attempt to reconstruct private content." },
      { symptom: "Feedback disappears over time.", response: "Retention cleanup is expected. Check the configured transcript and event retention windows." },
    ],
    powerUser: {
      decisionPoints: ["Feedback submission accepts identifiers, rating, and optional comment; the browser does not submit a duplicate transcript payload.", "Chip learning stores privacy-minimized structured signals rather than raw learning transcripts."],
      technicalPaths: ["src/app/admin/feedback/page.tsx", "src/app/api/chat/feedback/route.ts", "src/lib/chip-learning/service.ts"],
    },
  },
  {
    id: "refresh-prices",
    label: "Refresh Prices",
    route: "/admin/refresh-prices",
    purpose:
      "Refresh Amazon-backed price and availability information and keep unavailable products out of normal public recommendations.",
    useWhen: "On the regular price-check schedule, before a campaign, or when a product appears unavailable.",
    prerequisites: ["Valid Amazon product identifier/link", "Configured provider credentials", "Time to review automatic publication-state changes"],
    steps: [
      { title: "Start with the attention list", instruction: "Review auto-unpublished products and open Amazon when manual confirmation is useful." },
      { title: "Choose the smallest refresh", instruction: "Refresh one laptop or the current page when investigating; use all published laptops only for a planned maintenance run." },
      { title: "Wait for completion", instruction: "The process is intentionally paced. Do not start overlapping refreshes." },
      { title: "Review changed states", instruction: "Check updated/failed counts, prices, availability, and timestamps. Unavailable published products may be auto-unpublished." },
      { title: "Handle back-in-stock products", instruction: "Refresh all unpublished can automatically republish products detected back in stock. Review that action and confirm the full record is still suitable.", caution: "This is the one price workflow that can restore publication when explicitly requested with republish behavior." },
      { title: "Investigate failures", instruction: "Open the product link, confirm its identifier, and retry only the affected record after correcting data or provider configuration." },
    ],
    outputs: ["Updated price/availability snapshot", "Last-checked timestamp", "Auto-unpublish or explicit back-in-stock republish result"],
    relationships: [
      { label: "Laptops", href: "/admin/laptops", relationship: "Owns the canonical product and publication state." },
      { label: "Growth Agents", href: "/admin/growth-agents", relationship: "Controls approved source/provider availability." },
      { label: "Research Queue", href: "/admin/growth-agents/research", relationship: "Introduces source-backed products before ongoing refresh." },
    ],
    troubleshooting: [
      { symptom: "A laptop repeatedly fails refresh.", response: "Verify the Amazon URL/ASIN and provider configuration; update the laptop before retrying." },
      { symptom: "A laptop became unpublished.", response: "Check its availability result. This is expected for unavailable products; republish only after current evidence confirms stock." },
      { symptom: "A price looks implausible.", response: "Keep the item unpublished, verify on the source, and correct the record rather than trusting one response." },
    ],
    powerUser: {
      decisionPoints: ["The admin route performs bounded service-role writes after admin or cron authentication.", "Provider calls are paced and errors exposed to the UI are scrubbed."],
      technicalPaths: ["src/components/admin/RefreshPricesPanel.tsx", "src/app/api/admin/refresh-prices/route.ts", "src/lib/amazon-creators.ts"],
    },
  },
  {
    id: "settings",
    label: "Settings",
    route: "/admin/settings",
    purpose:
      "Control public site contact/disclaimer text, finder options, domain availability, and Blog/AI feature visibility.",
    useWhen: "Changing a public feature flag or global presentation—not when controlling autonomous execution.",
    prerequisites: ["Understanding of the affected public surface", "A staging verification plan"],
    steps: [
      { title: "Update general settings", instruction: "Set the WhatsApp destination and footer disclaimer. Enable voice input or the workload filter only when the public experience is ready." },
      { title: "Control domains", instruction: "Design remains available. Enable Technology or Management only after taxonomy and published catalog coverage are ready." },
      { title: "Control Blog and AI", instruction: "Manage Blog CMS, public Blog, AI writer, product blocks, JSON-LD, and sitemap independently." },
      { title: "Save each section", instruction: "Each card has its own Save action. Confirm its success message before leaving the page." },
      { title: "Verify the affected public path", instruction: "Open the staging site at mobile and desktop widths and confirm navigation, content, and fallbacks." },
    ],
    outputs: ["Public site configuration", "Domain visibility", "Blog/CMS and presentation flags"],
    relationships: [
      { label: "Growth Agents", href: "/admin/growth-agents", relationship: "Owns automation, retention, sources, and emergency controls instead." },
      { label: "Taxonomy", href: "/admin/taxonomy", relationship: "Should be populated before enabling a domain." },
      { label: "Blog", href: "/admin/blog", relationship: "Appears only when Blog CMS is enabled; public visibility remains separate." },
    ],
    troubleshooting: [
      { symptom: "A saved flag seems unchanged.", response: "Confirm the correct section showed Saved, refresh the staging page, and distinguish CMS visibility from public visibility." },
      { symptom: "Technology or Management is empty.", response: "Disable the domain until taxonomy and suitable published laptops are ready." },
      { symptom: "An agent still does not run.", response: "Use Growth Agents; general Settings does not authorize autonomous execution." },
    ],
    powerUser: {
      decisionPoints: ["General settings and agent settings use different validated admin APIs and should remain separate.", "Feature flags should fail safely when a dependent public surface is unavailable."],
      technicalPaths: ["src/components/admin/AdminSettingsForm.tsx", "src/lib/flags.ts", "src/app/api/admin/settings/route.ts"],
    },
  },
];

export const OPERATING_ROUTINES = [
  {
    cadence: "Every admin session",
    actions: ["Read Dashboard counts and recent changes", "Check for failed/retrying durable jobs", "Review urgent price or availability attention"],
  },
  {
    cadence: "Daily when agents are enabled",
    actions: ["Review Research Calendar runs", "Inspect new research packets and Agent Draft artifacts", "Keep questionable items in review/draft"],
  },
  {
    cadence: "Weekly",
    actions: ["Review coverage gaps", "Review negative Chip feedback", "Refresh prices in a planned batch", "Plan next calendar themes and output limits"],
  },
  {
    cadence: "Monthly",
    actions: ["Audit active personas and sources", "Review retention periods and job failure patterns", "Verify domain/blog feature flags still match available content"],
  },
] as const;

export const POWER_USER_EXTENSION_PATH = [
  {
    title: "1. Define the operational outcome",
    detail: "Name the user, decision, data owner, public effect, and measurable success condition before choosing code or a model.",
  },
  {
    title: "2. Map dependencies and failure states",
    detail: "Identify admin UI, authenticated API, service, database tables/policies, provider credentials, flags, retention, retries, and rollback behavior.",
  },
  {
    title: "3. Preserve the approval boundary",
    detail: "Decide which outputs may be automatic and which must remain unpublished or review-controlled. Default new automation to off and Safe mode compatible.",
  },
  {
    title: "4. Implement on preview/staging",
    detail: "Read the installed Next.js documentation, use server-side admin writes, add forward and rollback migrations together, and never apply production changes without approval.",
  },
  {
    title: "5. Test the complete path",
    detail: "Cover validation, authorization, privacy, idempotency/retry, mobile UI, empty/error states, and the final public result—not only the happy-path service call.",
  },
  {
    title: "6. Roll out one capability at a time",
    detail: "Deploy to preview, apply migrations manually in order, configure secrets, run a small smoke test, observe, and request explicit approval before promotion to master.",
  },
] as const;

export const GUIDE_GLOSSARY = [
  ["Candidate", "Imported product evidence waiting for an administrator's review."],
  ["Unpublished laptop", "A catalog record visible to admins but not eligible for normal public recommendation."],
  ["Research packet", "A citation-bound topic and evidence bundle produced by the Research Agent."],
  ["Topic history window", "The 90–365 day comparison period for non-rejected packets and non-archived CMS posts; rejected packets use a separate fixed 30-day window."],
  ["Topic similarity cutoff", "The weighted semantic comparison boundary. Hard exact and same-source/domain/subject/intent anchors can reject independently of it."],
  ["Exact-title fingerprint", "Readable normalized title text used for exact matching and the permanent atomic database claim."],
  ["Subject key", "A separate rich hash derived from normalized topic features; it is not the readable exact-title fingerprint."],
  ["Novelty lease", "The platform-wide database lease that lets one Research Calendar run at a time load history, select topics, and persist packets."],
  ["Source rotation", "The optional guard that withholds primary domains dominant in the last two non-empty runs for the same calendar day within 14 days."],
  ["Agent artifact", "The durable record of a blog generation attempt, quality result, and linked CMS draft."],
  ["Persona snapshot", "The stored version of public author attribution attached to a post."],
  ["Safe mode", "A normal staging/review guardrail that keeps affiliate monetization gated; generated content is already review-controlled."],
  ["Global pause", "A saved control that pauses new Calendar research, Blog Agent work, and affiliate monetization."],
  ["Emergency stop", "The immediate saved containment control for that same implemented scope; other tools must be disabled separately."],
  ["Source adapter", "A bounded manual or official-API integration that supplies product evidence."],
  ["Durable job", "A retry-aware operational record with status, lease, attempts, and scrubbed errors."],
] as const;
