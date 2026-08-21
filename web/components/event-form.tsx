"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { instantFromWallTime, timezoneOptions } from "@/lib/datetime";
import { codeOf, fieldErrorsOf, messageFor } from "@/lib/errors";
import { centsFromReais } from "@/lib/format";
import {
  duplicatedTierName,
  emptyTier,
  eventFormFromEvent,
  MAX_TIERS,
  MIN_TIERS,
  type EventFormValues,
  type OrganizerEvent,
  type TierFormValues,
} from "@/lib/organizer";

type Feedback = { kind: "erro" | "salvo"; message: string } | null;

export function EventForm({
  mode,
  eventId,
  initial,
}: {
  mode: "create" | "edit";
  eventId?: string;
  initial: EventFormValues;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [invalid, setInvalid] = useState<Record<string, string[]>>({});
  const [tierProblem, setTierProblem] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [sending, setSending] = useState(false);

  const set = (patch: Partial<EventFormValues>) =>
    setValues((current) => ({ ...current, ...patch }));

  const setTier = (rowId: string, patch: Partial<TierFormValues>) =>
    setValues((current) => ({
      ...current,
      tiers: current.tiers.map((tier) =>
        tier.rowId === rowId ? { ...tier, ...patch } : tier,
      ),
    }));

  const addTier = () =>
    setValues((current) =>
      current.tiers.length >= MAX_TIERS
        ? current
        : { ...current, tiers: [...current.tiers, emptyTier()] },
    );

  const removeTier = (rowId: string) =>
    setValues((current) =>
      current.tiers.length <= MIN_TIERS
        ? current
        : {
            ...current,
            tiers: current.tiers.filter((tier) => tier.rowId !== rowId),
          },
    );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFeedback(null);
    setInvalid({});
    setTierProblem(null);

    const startsAt = instantFromWallTime(values.wallTime, values.timezone);
    if (!startsAt) {
      setInvalid({ startsAt: ["Informe data e hora do evento."] });
      setFeedback({ kind: "erro", message: "Informe data e hora do evento." });
      return;
    }

    const repeated = duplicatedTierName(values.tiers);
    if (repeated) {
      markRepeatedTier();
      setFeedback({
        kind: "erro",
        message: `Dois setores têm o mesmo nome: ${repeated}.`,
      });
      return;
    }

    const tiers = [];
    for (const [position, tier] of values.tiers.entries()) {
      const priceCents = centsFromReais(tier.price);
      const capacity = Number(tier.capacity);

      if (priceCents === null) {
        setTierProblem(tier.rowId);
        setFeedback({
          kind: "erro",
          message: `Preço do setor ${position + 1} deve ser um valor em reais, como 120,00.`,
        });
        return;
      }
      if (!Number.isInteger(capacity) || capacity < 1) {
        setTierProblem(tier.rowId);
        setFeedback({
          kind: "erro",
          message: `Capacidade do setor ${position + 1} deve ser um número inteiro maior que zero.`,
        });
        return;
      }

      tiers.push({ name: tier.name.trim(), priceCents, capacity });
    }

    const body = {
      title: values.title.trim(),
      description: values.description.trim() || null,
      category: values.category.trim(),
      imageUrl: values.imageUrl.trim() || null,
      startsAt,
      timezone: values.timezone,
      venueName: values.venueName.trim(),
      address: values.address.trim() || null,
      city: values.city.trim(),
      state: values.state.trim() || null,
      country: values.country.trim().toUpperCase(),
      tiers,
      ...(mode === "create" && values.externalId
        ? { externalId: values.externalId }
        : {}),
    };

    setSending(true);
    try {
      const response = await fetch(
        mode === "create"
          ? "/api/organizer/events"
          : `/api/organizer/events/${eventId}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        failWith(payload);
        return;
      }

      const saved = payload as OrganizerEvent;

      if (mode === "create") {
        router.push(`/organizador/eventos/${saved.id}`);
        return;
      }

      setValues(eventFormFromEvent(saved));
      setFeedback({ kind: "salvo", message: "Alterações salvas." });
      router.refresh();
    } catch {
      setFeedback({ kind: "erro", message: messageFor("UPSTREAM_UNAVAILABLE") });
    } finally {
      setSending(false);
    }
  };

  function markRepeatedTier() {
    const seen = new Set<string>();

    for (const tier of values.tiers) {
      const key = tier.name.trim().toLowerCase();
      if (!key) continue;
      if (seen.has(key)) {
        setTierProblem(tier.rowId);
        return;
      }
      seen.add(key);
    }
  }

  function failWith(payload: unknown) {
    const code = codeOf(payload);
    setInvalid(fieldErrorsOf(payload));

    if (code === "NOT_FOUND" && mode === "create" && values.externalId) {
      setFeedback({
        kind: "erro",
        message: messageFor("CATALOG_ITEM_NOT_FOUND"),
      });
      return;
    }

    if (code === "DUPLICATE_TIER_NAME") {
      const repeated = duplicatedTierName(values.tiers);
      if (repeated) markRepeatedTier();
      setFeedback({
        kind: "erro",
        message: repeated
          ? `Dois setores têm o mesmo nome: ${repeated}.`
          : messageFor(code),
      });
      return;
    }

    setFeedback({ kind: "erro", message: messageFor(code) });
  }

  const problemOf = (field: string) =>
    invalid[field]?.length ? "Confira este campo." : undefined;

  return (
    <form className="flex flex-col gap-3" onSubmit={submit} noValidate>
      <Field
        label="Título"
        name="title"
        value={values.title}
        onChange={(title) => set({ title })}
        problem={problemOf("title")}
        required
      />

      <label className="flex flex-col gap-1">
        <span className="label">Descrição</span>
        <textarea
          name="description"
          value={values.description}
          onChange={(event) => set({ description: event.target.value })}
          rows={4}
          className="field py-2"
        />
        <Problem message={problemOf("description")} />
      </label>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <Field
            label="Categoria"
            name="category"
            value={values.category}
            onChange={(category) => set({ category })}
            problem={problemOf("category")}
            required
          />
        </div>
        <div className="flex-1">
          <Field
            label="Imagem (URL)"
            name="imageUrl"
            type="url"
            value={values.imageUrl}
            onChange={(imageUrl) => set({ imageUrl })}
            problem={problemOf("imageUrl")}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <Field
            label="Data e hora"
            name="startsAt"
            type="datetime-local"
            value={values.wallTime}
            onChange={(wallTime) => set({ wallTime })}
            problem={problemOf("startsAt")}
            required
          />
        </div>
        <label className="flex flex-1 flex-col gap-1">
          <span className="label">Fuso horário</span>
          <select
            name="timezone"
            value={values.timezone}
            onChange={(event) => set({ timezone: event.target.value })}
            className="field"
          >
            {timezoneOptions(values.timezone).map((timezone) => (
              <option key={timezone} value={timezone}>
                {timezone}
              </option>
            ))}
          </select>
          <Problem message={problemOf("timezone")} />
        </label>
      </div>

      <Field
        label="Local"
        name="venueName"
        value={values.venueName}
        onChange={(venueName) => set({ venueName })}
        problem={problemOf("venueName")}
        required
      />

      <Field
        label="Endereço"
        name="address"
        value={values.address}
        onChange={(address) => set({ address })}
        problem={problemOf("address")}
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <Field
            label="Cidade"
            name="city"
            value={values.city}
            onChange={(city) => set({ city })}
            problem={problemOf("city")}
            required
          />
        </div>
        <div className="sm:w-32">
          <Field
            label="Estado"
            name="state"
            value={values.state}
            onChange={(state) => set({ state })}
            problem={problemOf("state")}
          />
        </div>
        <div className="sm:w-32">
          <Field
            label="País"
            name="country"
            value={values.country}
            onChange={(country) => set({ country })}
            problem={problemOf("country")}
            required
          />
        </div>
      </div>

      <fieldset className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-3">
        <legend className="label px-1">
          Setores ({values.tiers.length} de {MAX_TIERS})
        </legend>

        {values.tiers.map((tier, position) => (
          <TierFields
            key={tier.rowId}
            position={position}
            tier={tier}
            highlighted={tierProblem === tier.rowId}
            removable={values.tiers.length > MIN_TIERS}
            onChange={(patch) => setTier(tier.rowId, patch)}
            onRemove={() => removeTier(tier.rowId)}
          />
        ))}

        <Problem message={problemOf("tiers")} />

        <button
          type="button"
          onClick={addTier}
          disabled={values.tiers.length >= MAX_TIERS}
          className="btn-quiet"
        >
          Adicionar setor
        </button>
      </fieldset>

      {feedback ? (
        <p
          role="alert"
          className={feedback.kind === "erro" ? "alert" : "notice"}
        >
          {feedback.message}
        </p>
      ) : null}

      <button type="submit" disabled={sending} className="btn-primary">
        {submitLabel(mode, sending)}
      </button>
    </form>
  );
}

function TierFields({
  position,
  tier,
  highlighted,
  removable,
  onChange,
  onRemove,
}: {
  position: number;
  tier: TierFormValues;
  highlighted: boolean;
  removable: boolean;
  onChange: (patch: Partial<TierFormValues>) => void;
  onRemove: () => void;
}) {
  return (
    <div
      className={`flex flex-col gap-3 rounded-md border bg-surface-raised p-3 ${
        highlighted ? "border-danger" : "border-line"
      }`}
    >
      <Field
        label={`Nome do setor ${position + 1}`}
        name="tierName"
        value={tier.name}
        onChange={(name) => onChange({ name })}
        required
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <Field
            label="Preço em reais"
            name="price"
            value={tier.price}
            onChange={(price) => onChange({ price })}
            inputMode="decimal"
            placeholder="120,00"
            required
          />
        </div>
        <div className="flex-1">
          <Field
            label="Capacidade"
            name="capacity"
            value={tier.capacity}
            onChange={(capacity) => onChange({ capacity })}
            inputMode="numeric"
            placeholder="100"
            required
          />
        </div>
      </div>

      <button
        type="button"
        onClick={onRemove}
        disabled={!removable}
        className="btn-quiet"
      >
        Remover setor
      </button>
    </div>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  problem,
  type = "text",
  inputMode,
  placeholder,
  required,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  problem?: string;
  type?: string;
  inputMode?: "decimal" | "numeric";
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="label">
        {label}
        {required ? " *" : ""}
      </span>
      <input
        type={type}
        name={name}
        value={value}
        inputMode={inputMode}
        placeholder={placeholder}
        aria-invalid={Boolean(problem)}
        onChange={(event) => onChange(event.target.value)}
        className="field"
      />
      <Problem message={problem} />
    </label>
  );
}

function Problem({ message }: { message?: string }) {
  if (!message) return null;
  return <span className="text-sm text-danger">{message}</span>;
}

function submitLabel(mode: "create" | "edit", sending: boolean) {
  if (sending) return "Salvando…";
  return mode === "create" ? "Criar rascunho" : "Salvar alterações";
}
