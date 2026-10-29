import { VOTING_COPY, VOTE_RUBRIC } from '@shared/voting';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

/** Before you post. Guidance only — posting does not depend on opening it. */
export default function VoteRubric({ startCollapsed }: { startCollapsed: boolean }) {
  const [open, setOpen] = useState(!startCollapsed);

  return (
    <section className="mt-4 rounded-2xl border border-[#e1dbd7] bg-white">
      <button
        type="button"
        className="flex min-h-14 w-full items-center justify-between gap-3 px-4 text-left"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="text-base font-semibold text-[#222]">{VOTING_COPY.rubricTitle}</span>
        <ChevronDown className={`h-5 w-5 text-[#6e6a68] ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open ? (
        <ol className="list-decimal space-y-3 px-8 pb-4 text-sm leading-5 text-[#6e6a68]">
          {VOTE_RUBRIC.map((item) => (
            <li key={item.title}>
              <span className="font-semibold text-[#222]">{item.title}.</span> {item.body}
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
