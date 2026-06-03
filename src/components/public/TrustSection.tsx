import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

const FAQS = [
  {
    q: "How do these recommendations actually work?",
    a: "Each recommendation is curated by design practitioners with years of hands-on experience across disciplines — not generated from a generic spec sheet. We map real hardware requirements to actual design workflows and course curriculums, so what you get is grounded in how designers actually work.",
  },
  {
    q: "Are the suggestions random or just algorithm-driven?",
    a: "Neither. The recommendations reflect deep expertise in design practice. We factor in which software each discipline relies on, what those tools demand from hardware under real workloads, and what a design education — or professional practice — actually requires over time.",
  },
  {
    q: "Do you endorse or favour specific brands?",
    a: "No. We're completely brand-neutral. Recommendations are based entirely on hardware specifications: CPU performance, GPU capability, RAM, display quality, and thermal headroom. A mid-range machine from any brand will appear if the specs are right for your work.",
  },
  {
    q: "What if my budget is tight?",
    a: "We cover the full range — from entry-level options for aspirants and first-year students to workstation-class machines for professionals. We're honest when a budget genuinely can't meet a workflow's demands, and we always suggest the closest viable option rather than leaving you with nothing.",
  },
  {
    q: "Is this useful for working professionals, not just students?",
    a: "Absolutely. Design professionals often run the most demanding software — Cinema 4D, high-res Premiere Pro, Blender renders, complex Figma files — but rarely find hardware guidance that speaks to their specific stack. This tool was built precisely for that gap: understanding the hardware, so you can focus on the work.",
  },
];

export function TrustSection() {
  return (
    <section className="py-16 px-4 bg-muted/20">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">
            Why trust these recommendations?
          </h2>
          <p className="text-sm text-muted-foreground">
            Straight answers about our process and how we make our picks.
          </p>
        </div>

        <Accordion>
          {FAQS.map((faq, i) => (
            <AccordionItem key={i} value={String(i)}>
              <AccordionTrigger className="text-sm font-medium py-4 text-left">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-sm text-muted-foreground leading-relaxed pb-1">
                  {faq.a}
                </p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
