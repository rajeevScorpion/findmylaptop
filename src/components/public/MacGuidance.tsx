import { Apple, Monitor, Info } from "lucide-react";

export function MacGuidance() {
  return (
    <section className="px-4 py-10 max-w-3xl mx-auto w-full">
      <div className="glass-card rounded-2xl border p-6 space-y-5">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <h2 className="text-base font-semibold text-foreground mb-1">
              Already have a MacBook or iPad?
            </h2>
            <p className="text-sm text-muted-foreground">
              Here's how to think about it for design education.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex gap-3">
            <Apple className="w-4 h-4 text-foreground/60 shrink-0 mt-1" />
            <div>
              <p className="text-sm font-medium text-foreground mb-0.5">MacBook Air / Pro (M-series)</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                MacBooks are excellent for writing, note-taking, web browsing, Figma, Sketch, light Adobe
                work, photography, and video editing in Final Cut. They run cool and quiet, and battery
                life is outstanding. If you already own one, it will serve you well for communication
                design, UI/UX, fashion communication, and brand management courses.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed mt-2">
                However, for 3D modelling (Blender, Rhino, 3ds Max), game development (Unreal Engine),
                rendering with CUDA/NVIDIA acceleration, AI workflows with NVIDIA GPUs, and most
                simulation tools used in animation, game, product, interior, and transportation design —
                a Windows laptop with an NVIDIA RTX GPU is generally the safer, more capable choice. The
                design industry largely runs these tools on Windows with NVIDIA hardware.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Monitor className="w-4 h-4 text-foreground/60 shrink-0 mt-1" />
            <div>
              <p className="text-sm font-medium text-foreground mb-0.5">iPad</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                An iPad with Apple Pencil is a valuable companion for sketching, note-taking, ideation,
                and mood boarding. It is not a replacement for a laptop for design coursework. Use it
                alongside your main laptop, not instead of one.
              </p>
            </div>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-muted/30 border border-border/30">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="font-medium text-foreground">Practical advice: </span>
            Students who already own a MacBook or iPad may use them initially and decide after
            understanding their specific course workload. Heavy 3D, animation, game, AI, and
            computational design workflows will benefit from a Windows machine with an NVIDIA GPU
            sooner than lighter disciplines.
          </p>
        </div>
      </div>
    </section>
  );
}
