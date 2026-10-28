import { createCircle } from '@/lib/circles';
import {
  CIRCLE_COPY,
  CIRCLE_DESCRIPTION_MAX,
  CIRCLE_NAME_MAX,
  CircleClientError,
  buildCircleCreate,
} from '@shared/circles';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function CircleCreatePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [nameTouched, setNameTouched] = useState(false);
  const draft = buildCircleCreate({ name, description });
  const canCreate = name.trim().length > 0 && draft.ok;
  const create = useMutation({
    mutationFn: () => {
      if (!draft.ok) throw new CircleClientError(draft.message);
      return createCircle(draft.payload);
    },
    onSuccess: async (circle) => {
      await queryClient.invalidateQueries({ queryKey: ['circles'] });
      await queryClient.invalidateQueries({ queryKey: ['prayer-circles'] });
      navigate(`/app/circles/${circle.id}?invite=1`, { replace: true });
    },
    onError: (createError) => {
      setError(
        createError instanceof CircleClientError ? createError.message : CIRCLE_COPY.saveFailed,
      );
    },
  });

  return (
    <div className="min-h-[100dvh] bg-[#f6f1ee] px-4 pb-10">
      <header className="grid grid-cols-[auto_1fr_auto] items-center py-3">
        <button
          type="button"
          className="text-[17px] font-semibold text-[#a2033f]"
          onClick={() => navigate(-1)}
        >
          {CIRCLE_COPY.cancel}
        </button>
        <h1 className="text-center text-[17px] font-semibold">{CIRCLE_COPY.createTitle}</h1>
        <span />
      </header>
      <label className="mt-4 block text-base font-semibold" htmlFor="circle-name">
        {CIRCLE_COPY.nameLabel}
      </label>
      <input
        id="circle-name"
        value={name}
        maxLength={CIRCLE_NAME_MAX}
        onBlur={() => setNameTouched(true)}
        onChange={(event) => setName(event.target.value)}
        placeholder={CIRCLE_COPY.namePlaceholder}
        className="mt-2 w-full rounded-2xl border border-[#e1dbd7] bg-white px-4 py-3 text-base"
      />
      {nameTouched && !name.trim() ? (
        <p className="mt-1 text-sm text-[#6e6a68]">{CIRCLE_COPY.nameRequired}</p>
      ) : null}
      <label className="mt-4 block text-base font-semibold" htmlFor="circle-description">
        {CIRCLE_COPY.descriptionLabel}
      </label>
      <textarea
        id="circle-description"
        value={description}
        maxLength={CIRCLE_DESCRIPTION_MAX}
        onChange={(event) => setDescription(event.target.value)}
        rows={4}
        className="mt-2 w-full rounded-2xl border border-[#e1dbd7] bg-white px-4 py-3 text-base"
      />
      {error ? <p className="mt-3 text-sm text-red-800">{error}</p> : null}
      <button
        type="button"
        disabled={!canCreate || create.isPending}
        className="mt-6 h-[54px] w-full rounded-full bg-[#a2033f] font-semibold text-white disabled:opacity-40"
        onClick={() => {
          setError(null);
          create.mutate();
        }}
      >
        {CIRCLE_COPY.createCta}
      </button>
    </div>
  );
}
