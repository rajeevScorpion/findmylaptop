"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  ExternalLink,
  ListTree,
  Menu,
  Network,
  Route,
  Search,
  ShieldCheck,
  UserRound,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  ADMIN_GUIDE_VERSION,
  ADMIN_SCREEN_GUIDES,
  CURRENT_OPERATIONAL_BOUNDARIES,
  DEPENDENCY_GROUPS,
  FIRST_TIME_SETUP,
  GUIDE_GLOSSARY,
  OPERATING_ROUTINES,
  POWER_USER_EXTENSION_PATH,
  WORKFLOW_GUIDES,
  type AdminScreenGuide,
  type GuideAudience,
  type WorkflowGuide,
} from "@/lib/admin-guide/content";

const TOP_LEVEL_NAV = [
  ["guide-overview", "Start here"],
  ["first-time-setup", "First-time setup"],
  ["workflow-paths", "Workflow paths"],
  ["operating-routines", "Operating routines"],
  ["dependencies", "Common dependencies"],
  ["current-boundaries", "Current boundaries"],
  ["screen-guide", "Screen-by-screen guide"],
  ["power-user-extension", "Extending the platform"],
  ["glossary", "Glossary"],
] as const;

const BREADCRUMBS: Record<string, string> = {
  dashboard: "Admin → Dashboard",
  laptops: "Admin → Laptops",
  taxonomy: "Admin → Taxonomy",
  blog: "Admin → Blog",
  "author-personas": "Admin → Author Personas",
  "growth-agents": "Admin → Growth Agents",
  "product-curation": "Admin → Growth Agents → Product Curation",
  "research-queue": "Admin → Growth Agents → Research Queue",
  "research-calendar": "Admin → Growth Agents → Research Calendar",
  "agent-drafts": "Admin → Growth Agents → Agent Drafts",
  feedback: "Admin → Feedback",
  "refresh-prices": "Admin → Refresh Prices",
  settings: "Admin → Settings",
};

function SectionHeading({
  id,
  eyebrow,
  title,
  description,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div id={id} className="scroll-mt-28 space-y-2 lg:scroll-mt-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
        {eyebrow}
      </p>
      <h2 id={`${id}-title`} className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
        {title}
      </h2>
      <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
        {description}
      </p>
    </div>
  );
}

function GuideNavigation({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Admin guide sections" className="space-y-5">
      <div>
        <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Guide sections
        </p>
        <div className="space-y-1">
          {TOP_LEVEL_NAV.map(([id, label]) => (
            <Link
              key={id}
              href={`#${id}`}
              onClick={onNavigate}
              className="flex min-h-11 items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span>{label}</span>
              <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Admin screens
        </p>
        <div className="space-y-1">
          {ADMIN_SCREEN_GUIDES.map((screen) => (
            <Link
              key={screen.id}
              href={`#${screen.id}`}
              onClick={onNavigate}
              className="flex min-h-11 items-center rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {screen.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}

function WorkflowDiagram({ workflow }: { workflow: WorkflowGuide }) {
  return (
    <figure className="glass-card min-w-0 rounded-2xl border p-4 sm:p-5">
      <figcaption className="mb-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            {workflow.frequency}
          </span>
        </div>
        <h3 className="mt-3 text-base font-semibold text-foreground sm:text-lg">
          {workflow.title}
        </h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {workflow.purpose}
        </p>
      </figcaption>

      <ol aria-label={`${workflow.title} steps`} className="flex min-w-0 flex-col gap-2 2xl:flex-row 2xl:items-stretch">
        {workflow.nodes.map((node, index) => (
          <li key={node.label} className="flex min-w-0 flex-1 flex-col gap-2 2xl:flex-row 2xl:items-stretch">
            <div className="min-w-0 flex-1 rounded-xl border border-border/60 bg-background/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                Step {index + 1}
              </p>
              <Link
                href={node.href}
                className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-foreground hover:text-primary"
              >
                {node.label}
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
              <p className="text-sm leading-5 text-muted-foreground">{node.detail}</p>
              {node.gate && (
                <p className="mt-3 rounded-lg bg-amber-500/10 px-2.5 py-2 text-xs font-medium text-amber-800 dark:text-amber-300">
                  Gate: {node.gate}
                </p>
              )}
            </div>
            {index < workflow.nodes.length - 1 && (
              <div className="flex h-7 items-center justify-center text-muted-foreground 2xl:h-auto 2xl:w-7" aria-hidden="true">
                <ArrowDown className="h-4 w-4 2xl:hidden" />
                <ArrowRight className="hidden h-4 w-4 2xl:block" />
              </div>
            )}
          </li>
        ))}
      </ol>

      <p className="mt-4 flex items-start gap-2 rounded-xl bg-emerald-500/10 p-3 text-sm leading-5 text-emerald-800 dark:text-emerald-300">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span><strong>Complete when:</strong> {workflow.completion}</span>
      </p>
    </figure>
  );
}

function ScreenGuideCard({
  screen,
  audience,
  forceOpen,
  previous,
  next,
}: {
  screen: AdminScreenGuide;
  audience: GuideAudience;
  forceOpen: boolean;
  previous?: AdminScreenGuide;
  next?: AdminScreenGuide;
}) {
  return (
    <details
      id={screen.id}
      open={forceOpen || screen.id === "dashboard" ? true : undefined}
      className="group scroll-mt-28 overflow-hidden rounded-2xl border bg-card/60 lg:scroll-mt-8"
    >
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 outline-none transition-colors hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block break-words text-base font-semibold text-foreground">
            {screen.label}
          </span>
          <span className="mt-0.5 block break-all font-mono text-xs text-muted-foreground">
            {BREADCRUMBS[screen.id]} · {screen.route}
          </span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden="true" />
      </summary>

      <div className="space-y-6 border-t border-border/50 px-4 py-5 sm:px-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Purpose</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{screen.purpose}</p>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              <strong className="text-foreground">Use it when:</strong> {screen.useWhen}
            </p>
          </div>
          <Link
            href={screen.route}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Open {screen.label}
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-border/60 p-4">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <ListTree className="h-4 w-4 text-primary" aria-hidden="true" />
              Required before you start
            </h4>
            <ul className="mt-3 space-y-2 text-sm leading-5 text-muted-foreground">
              {screen.prerequisites.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-border/60 p-4">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              What this produces or affects
            </h4>
            <ul className="mt-3 space-y-2 text-sm leading-5 text-muted-foreground">
              {screen.outputs.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-foreground">Step-by-step</h4>
          <ol className="mt-3 space-y-3">
            {screen.steps.map((step, index) => (
              <li key={`${screen.id}-${step.title}`} className="flex min-w-0 gap-3 rounded-xl bg-muted/25 p-3 sm:p-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{step.title}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{step.instruction}</p>
                  {step.result && (
                    <p className="mt-2 text-sm leading-5 text-emerald-700 dark:text-emerald-300">
                      Expected result: {step.result}
                    </p>
                  )}
                  {step.caution && (
                    <p className="mt-2 flex items-start gap-2 rounded-lg bg-amber-500/10 p-2.5 text-sm leading-5 text-amber-800 dark:text-amber-300">
                      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>{step.caution}</span>
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-foreground">How this feature is linked</h4>
          <div className="mt-3 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {screen.relationships.map((relationship) => (
              <Link
                key={`${screen.id}-${relationship.href}`}
                href={relationship.href}
                className="min-w-0 rounded-xl border border-border/60 p-3 transition-colors hover:border-primary/30 hover:bg-primary/5"
              >
                <span className="flex min-h-8 items-center gap-1.5 text-sm font-semibold text-foreground">
                  {relationship.label}
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                </span>
                <span className="mt-1 block text-sm leading-5 text-muted-foreground">
                  {relationship.relationship}
                </span>
              </Link>
            ))}
          </div>
        </div>

        <details className="rounded-xl border border-border/60 p-3 sm:p-4">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
            Troubleshooting
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </summary>
          <div className="mt-3 space-y-3 border-t border-border/50 pt-3">
            {screen.troubleshooting.map((item) => (
              <div key={item.symptom}>
                <p className="text-sm font-medium text-foreground">{item.symptom}</p>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">{item.response}</p>
              </div>
            ))}
          </div>
        </details>

        {audience === "power" && (
          <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Wrench className="h-4 w-4 text-violet-600 dark:text-violet-300" aria-hidden="true" />
              Power-user decision notes
            </h4>
            <ul className="mt-3 space-y-2 text-sm leading-5 text-muted-foreground">
              {screen.powerUser.decisionPoints.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Primary implementation paths
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {screen.powerUser.technicalPaths.map((path) => (
                <code key={path} className="max-w-full break-all rounded-md bg-background px-2 py-1 font-mono text-xs text-foreground">
                  {path}
                </code>
              ))}
            </div>
          </div>
        )}

        <nav aria-label={`${screen.label} guide navigation`} className="flex flex-col gap-2 border-t border-border/50 pt-4 sm:flex-row sm:justify-between">
          {previous ? (
            <Link href={`#${previous.id}`} className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground">
              ← {previous.label}
            </Link>
          ) : <span />}
          {next && (
            <Link href={`#${next.id}`} className="inline-flex min-h-11 items-center justify-end rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground">
              {next.label} →
            </Link>
          )}
        </nav>
      </div>
    </details>
  );
}

export function AdminGuideExplorer() {
  const [audience, setAudience] = useState<GuideAudience>("operator");
  const [query, setQuery] = useState("");
  const [navigationOpen, setNavigationOpen] = useState(false);

  const filteredScreens = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [...ADMIN_SCREEN_GUIDES];
    return ADMIN_SCREEN_GUIDES.filter((screen) =>
      JSON.stringify(screen).toLowerCase().includes(normalized)
    );
  }, [query]);

  return (
    <article className="mx-auto min-w-0 max-w-[92rem]">
      <header id="guide-overview" className="scroll-mt-28 overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-card to-card p-5 sm:p-7 lg:scroll-mt-8">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full border bg-background/70 px-2.5 py-1 font-medium text-foreground">
            Guide version {ADMIN_GUIDE_VERSION}
          </span>
          <span>Audited against the current admin implementation</span>
        </div>
        <div className="mt-5 flex max-w-4xl items-start gap-3">
          <div className="hidden rounded-xl border border-primary/20 bg-primary/10 p-3 sm:block">
            <BookOpenCheck className="h-6 w-6 text-primary" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Admin operations guide
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
              A practical guide to running LaptopFinder safely—from routine catalog work to the linked research and editorial pipelines. Start in Operator view for plain-language procedures; switch to Power-user view for implementation boundaries and extension decisions.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.7fr)]">
          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-foreground">Choose your view</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                aria-pressed={audience === "operator"}
                onClick={() => setAudience("operator")}
                className={`min-h-12 rounded-xl border px-4 py-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${audience === "operator" ? "border-primary bg-primary/10" : "bg-background/60 hover:bg-muted/50"}`}
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <UserRound className="h-4 w-4 text-primary" aria-hidden="true" />
                  Platform operator
                </span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">Everyday tasks and safe decisions; no coding knowledge required.</span>
              </button>
              <button
                type="button"
                aria-pressed={audience === "power"}
                onClick={() => setAudience("power")}
                className={`min-h-12 rounded-xl border px-4 py-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${audience === "power" ? "border-violet-500 bg-violet-500/10" : "bg-background/60 hover:bg-muted/50"}`}
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Wrench className="h-4 w-4 text-violet-600 dark:text-violet-300" aria-hidden="true" />
                  Power user
                </span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">Adds dependencies, technical paths, and safe extension guidance.</span>
              </button>
            </div>
          </fieldset>

          <div>
            <label htmlFor="admin-guide-search" className="mb-2 block text-sm font-semibold text-foreground">
              Find a screen, action, or problem
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Input
                id="admin-guide-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search the guide…"
                className="min-h-11 bg-background/70 pl-9 text-sm"
              />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Try: publish, persona, price, pause.
            </p>
          </div>
        </div>
      </header>

      <div className="sticky top-2 z-20 my-4 xl:hidden">
        <Button
          type="button"
          variant="outline"
          onClick={() => setNavigationOpen(true)}
          className="glass-card min-h-11 w-full justify-between px-4 shadow-sm"
        >
          <span className="flex items-center gap-2">
            <Menu className="h-4 w-4" aria-hidden="true" />
            Guide sections
          </span>
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Sheet open={navigationOpen} onOpenChange={setNavigationOpen}>
          <SheetContent side="bottom" className="max-h-[85svh] overflow-y-auto rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]">
            <SheetHeader className="border-b pr-14">
              <SheetTitle>Admin guide sections</SheetTitle>
              <SheetDescription>Jump directly to a workflow or admin screen.</SheetDescription>
            </SheetHeader>
            <div className="px-3 pb-4">
              <GuideNavigation onNavigate={() => setNavigationOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="mt-6 grid min-w-0 gap-8 xl:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="hidden xl:block">
          <div className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto rounded-2xl border bg-card/70 p-3">
            <GuideNavigation />
          </div>
        </aside>

        <div className="min-w-0 space-y-12">
          <section aria-labelledby="first-time-setup-title" className="space-y-5">
            <SectionHeading
              id="first-time-setup"
              eyebrow="Start safely"
              title="First-time setup order"
              description="Follow this sequence in staging. It deliberately prepares data and review roles before recurring automation."
            />
            <ol className="grid gap-3 md:grid-cols-2">
              {FIRST_TIME_SETUP.map((item, index) => (
                <li key={item.title} className="glass-card min-w-0 rounded-xl border p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <Link href={item.href} className="inline-flex min-h-8 items-center gap-1.5 text-sm font-semibold text-foreground hover:text-primary">
                        {item.title}
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.detail}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="workflow-paths-title" className="space-y-5">
            <SectionHeading
              id="workflow-paths"
              eyebrow="Clear paths"
              title="How work moves through the platform"
              description="Each diagram is a sequence of guarded decisions. Follow the links to move through a workflow without guessing which screen comes next."
            />
            <div className="space-y-5">
              {WORKFLOW_GUIDES.map((workflow) => (
                <WorkflowDiagram key={workflow.id} workflow={workflow} />
              ))}
            </div>
          </section>

          <section aria-labelledby="operating-routines-title" className="space-y-5">
            <SectionHeading
              id="operating-routines"
              eyebrow="Operational rhythm"
              title="Daily, weekly, and monthly routines"
              description="Use these checklists to catch problems early without turning every admin session into a full technical audit."
            />
            <div className="grid gap-4 md:grid-cols-2">
              {OPERATING_ROUTINES.map((routine) => (
                <div key={routine.cadence} className="glass-card rounded-xl border p-4 sm:p-5">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Clock3 className="h-4 w-4 text-primary" aria-hidden="true" />
                    {routine.cadence}
                  </h3>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                    {routine.actions.map((action) => (
                      <li key={action} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                        <span>{action}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <section aria-labelledby="dependencies-title" className="space-y-5">
            <SectionHeading
              id="dependencies"
              eyebrow="Shared foundations"
              title="Common dependencies"
              description="When a feature appears unavailable, check the upstream requirements before retrying the action."
            />
            <div className="grid gap-4 md:grid-cols-2">
              {DEPENDENCY_GROUPS.map((group) => (
                <div key={group.title} className="glass-card rounded-xl border p-4 sm:p-5">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Network className="h-4 w-4 text-primary" aria-hidden="true" />
                    {group.title}
                  </h3>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                    {group.items.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <section aria-labelledby="current-boundaries-title" className="space-y-5">
            <SectionHeading
              id="current-boundaries"
              eyebrow="Read before operating agents"
              title="Current operational boundaries"
              description="These statements describe what the current product actually enforces. They prevent similarly named controls and research features from being mistaken for one another."
            />
            <div className="space-y-3">
              {CURRENT_OPERATIONAL_BOUNDARIES.map((boundary) => (
                <div key={boundary.title} className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
                  <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300" aria-hidden="true" />
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{boundary.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{boundary.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section aria-labelledby="screen-guide-title" className="space-y-5">
            <SectionHeading
              id="screen-guide"
              eyebrow="Page reference"
              title="Screen-by-screen guide"
              description="Open a section for its purpose, dependencies, numbered procedure, linked features, expected results, and troubleshooting."
            />
            <div className="space-y-3">
              {filteredScreens.length > 0 ? (
                filteredScreens.map((screen, index) => (
                  <ScreenGuideCard
                    key={`${screen.id}-${query.trim() ? "search" : "normal"}`}
                    screen={screen}
                    audience={audience}
                    forceOpen={Boolean(query.trim())}
                    previous={filteredScreens[index - 1]}
                    next={filteredScreens[index + 1]}
                  />
                ))
              ) : (
                <div className="glass-card rounded-xl border border-dashed p-8 text-center">
                  <Search className="mx-auto h-5 w-5 text-muted-foreground" aria-hidden="true" />
                  <p className="mt-3 text-sm font-semibold text-foreground">No guide section matches “{query}”</p>
                  <p className="mt-1 text-sm text-muted-foreground">Try a screen name, action, status, or error such as “persona”, “publish”, or “stale”.</p>
                  <Button type="button" variant="outline" onClick={() => setQuery("")} className="mt-4 min-h-11">
                    Clear search
                  </Button>
                </div>
              )}
            </div>
          </section>

          <section aria-labelledby="power-user-extension-title" className="space-y-5">
            <SectionHeading
              id="power-user-extension"
              eyebrow="Product decisions"
              title="Extending or modifying a feature"
              description="This is the decision path for power users and maintainers. It keeps operational safety, data ownership, and rollback design ahead of implementation."
            />
            <ol className="space-y-3">
              {POWER_USER_EXTENSION_PATH.map((item) => (
                <li key={item.title} className="glass-card rounded-xl border p-4 sm:p-5">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Route className="h-4 w-4 text-violet-600 dark:text-violet-300" aria-hidden="true" />
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.detail}</p>
                </li>
              ))}
            </ol>
            {audience === "operator" && (
              <button
                type="button"
                onClick={() => setAudience("power")}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 text-sm font-medium text-foreground hover:bg-muted/50"
              >
                <Wrench className="h-4 w-4" aria-hidden="true" />
                Show technical paths in every screen guide
              </button>
            )}
          </section>

          <section aria-labelledby="glossary-title" className="space-y-5 pb-10">
            <SectionHeading
              id="glossary"
              eyebrow="Shared language"
              title="Glossary"
              description="Use these definitions when discussing an operational issue or product change."
            />
            <dl className="grid gap-3 md:grid-cols-2">
              {GUIDE_GLOSSARY.map(([term, definition]) => (
                <div key={term} className="glass-card rounded-xl border p-4">
                  <dt className="text-sm font-semibold text-foreground">{term}</dt>
                  <dd className="mt-1 text-sm leading-6 text-muted-foreground">{definition}</dd>
                </div>
              ))}
            </dl>

            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4 sm:p-5">
              <p className="flex items-start gap-2 text-sm leading-6 text-foreground">
                <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                <span>
                  <strong>Release rule:</strong> validate changes on the preview branch with staging Supabase and dev.laptopfinder.cc. Apply migrations manually in documented order. Promotion to master or production requires explicit approval.
                </span>
              </p>
            </div>
          </section>
        </div>
      </div>
    </article>
  );
}
