import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { usePanel } from "@/lib/store/PanelContext";
import { sendAnswer, type Answer } from "./data";
import type { RestroomOption } from "./pick";

type Key = "paid" | "customersOnly" | "codeNeeded";
const YES_QUESTIONS: Array<[Key, string]> = [
  ["paid", "Did you have to pay or buy something?"],
  ["customersOnly", "Was it customers only?"],
  ["codeNeeded", "Did you need a code or key?"],
];
const PROBLEMS: Array<[NonNullable<Answer["problem"]>, string]> = [
  ["closed", "Closed"],
  ["customers_only", "Customers only"],
  ["out_of_order", "Out of order"],
  ["not_found", "Couldn't find it"],
];

/**
 * When a walk ends at a restroom (#249): "Was the restroom available to use?"
 * Yes asks up to three quick questions, No asks what happened; every one can
 * be skipped. The answer goes once, anonymously, with the restroom id.
 */
export function ArrivalQuestion({ restroom }: { restroom: Pick<RestroomOption, "id" | "business"> }) {
  const { closePanel } = usePanel();
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [step, setStep] = useState(0);
  const sent = useRef(false);
  const questions = YES_QUESTIONS.filter(([k]) => restroom.business || k !== "customersOnly");
  const total = answer ? (answer.available ? questions.length : 1) : 0;
  const done = answer !== null && step >= total;

  const send = (a: Answer | null) => {
    if (!a || sent.current) return;
    sent.current = true;
    sendAnswer(a);
  };
  // Answered and then closed part-way: what was answered still goes.
  const latest = useRef<Answer | null>(null);
  latest.current = answer;
  useEffect(() => () => send(latest.current), []);
  useEffect(() => {
    if (done) send(answer);
  }, [done, answer]);

  const next = (patch: Partial<Answer>) => {
    if (answer) setAnswer({ ...answer, ...patch });
    setStep(step + 1);
  };

  if (!answer) {
    return (
      <div className="flex flex-col gap-3" data-testid="restroom-arrival">
        <p className="text-base font-semibold text-foreground">Was the restroom available to use?</p>
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" className="h-12 rounded-full text-base" onClick={() => setAnswer({ restroomId: restroom.id, available: true })}>Yes</Button>
          <Button type="button" variant="secondary" className="h-12 rounded-full text-base" onClick={() => setAnswer({ restroomId: restroom.id, available: false })}>No</Button>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex flex-col gap-3" data-testid="restroom-arrival">
        <p className="text-base font-semibold text-foreground">Thanks</p>
        <Button type="button" variant="secondary" className="h-11 rounded-full" onClick={closePanel}>Done</Button>
      </div>
    );
  }

  const [question, options] = answer.available
    ? [questions[step][1], [["Yes", { [questions[step][0]]: true }], ["No", { [questions[step][0]]: false }]] as Array<[string, Partial<Answer>]>]
    : ["What happened?", PROBLEMS.map(([problem, label]) => [label, { problem }] as [string, Partial<Answer>])];

  return (
    <div className="flex flex-col gap-3" data-testid="restroom-arrival">
      <p className="text-xs text-muted-foreground">{step + 1} of {total}</p>
      <p className="text-base font-semibold text-foreground">{question}</p>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label={question}>
        {options.map(([label, patch]) => (
          <Button key={label} type="button" variant="secondary" className="h-auto min-h-11 whitespace-normal rounded-xl py-2 text-sm" onClick={() => next(patch)}>{label}</Button>
        ))}
      </div>
      <Button type="button" variant="ghost" className="h-11 rounded-full text-sm" onClick={() => next({})}>Skip</Button>
    </div>
  );
}
