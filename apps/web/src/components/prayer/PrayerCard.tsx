import {
  chipLabels,
  personInitials,
  postedByLine,
  prayingLabel,
  previewDetails,
  PRAYER_COPY,
  type PrayerRequest,
} from '@shared/prayer';

const TINTS = ['bg-[#f3c1d0]', 'bg-[#e7b4c6]', 'bg-[#f7d5e0]'];

export default function PrayerCard({
  prayer,
  full = false,
}: {
  prayer: PrayerRequest;
  full?: boolean;
}) {
  const details = full ? prayer.details.trim() : previewDetails(prayer.details);
  return (
    <article className="rounded-[22px] border border-[#e1dbd7] bg-white p-4 shadow-sm">
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-[#f9e8ee] px-3 py-1 text-sm font-semibold text-[#a2033f]">
          {PRAYER_COPY.prayerChip}
        </span>
        {chipLabels(prayer).map((chip) => (
          <span
            key={chip}
            className="rounded-full bg-[#f3eeeb] px-3 py-1 text-sm font-medium text-[#222]"
          >
            {chip}
          </span>
        ))}
      </div>
      <h3 className="mt-3 font-display text-[28px] font-bold leading-tight text-[#222]">
        {prayer.title}
      </h3>
      {details ? <p className="mt-2 text-base leading-6 text-[#5c5856]">{details}</p> : null}
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#e1dbd7] pt-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f3c1d0] text-[11px] font-semibold text-[#a2033f]">
            {personInitials(prayer.author.name)}
          </span>
          <span className="truncate text-sm text-[#6e6a68]">
            {postedByLine(prayer.author.name)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-[#a2033f] ${TINTS[0]}`}
          >
            {personInitials(prayer.author.name)}
          </span>
          <span className="text-sm font-semibold text-[#a2033f]">
            {prayingLabel(prayer.prayingCount)}
          </span>
        </div>
      </div>
    </article>
  );
}
