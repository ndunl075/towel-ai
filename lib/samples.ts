export interface Sample {
  id: string;
  label: string;
  text: string;
}

/** Demo fodder - one per v0 layout so the pipeline is visible in three clicks. */
export const SAMPLES: Sample[] = [
  {
    id: "flowchart",
    label: "Process",
    text: `Our support escalation works like this. A ticket arrives in the queue and a
frontline agent triages it. If it is a known issue they resolve it directly and
close the ticket. If it is not, it goes to a specialist who either ships a fix or
files a bug for engineering. Anything filed as a bug gets a weekly review, and
once engineering closes it the original reporter is notified.`,
  },
  {
    id: "cycle",
    label: "Cycle",
    text: `We run a continuous discovery loop. We start by talking to five customers a
week, then turn what we hear into a prioritised list of problems. From that list
we sketch a solution and put a prototype in front of the same customers. What we
learn feeds straight back into the next round of interviews, and the loop
repeats.`,
  },
  {
    id: "comparison",
    label: "Comparison",
    text: `Build vs buy for our billing system.

Building in-house:
- Full control over the data model
- No per-seat vendor cost as we scale
- Roughly two engineer-quarters to a first version
- We own compliance and PCI scope forever

Buying an off-the-shelf platform:
- Live in about three weeks
- Vendor handles PCI and tax logic
- Costs scale with revenue, not with usage
- Migration cost later if we outgrow it`,
  },
  {
    id: "narrative",
    label: "Unstructured",
    text: `The best thing about the old office was the light. It came in sideways all
afternoon and made everything look like a photograph of itself. Nobody ever
agreed on where the desks should go, and somehow that never mattered.`,
  },
];
