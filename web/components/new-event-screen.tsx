"use client";

import { useState } from "react";
import { CatalogImport } from "@/components/catalog-import";
import { EventForm } from "@/components/event-form";
import {
  blankEventForm,
  eventFormFromCatalogItem,
  type CatalogItem,
  type EventFormValues,
} from "@/lib/organizer";

const buttonClass = "min-h-11 rounded border px-4 text-base";

export function NewEventScreen() {
  const [imported, setImported] = useState<CatalogItem | null>(null);
  const [values, setValues] = useState<EventFormValues>(blankEventForm);
  const [formsStarted, setFormsStarted] = useState(0);

  const importItem = (item: CatalogItem) => {
    setImported(item);
    setValues(eventFormFromCatalogItem(item));
    setFormsStarted((started) => started + 1);
  };

  const clearImport = () => {
    setImported(null);
    setValues(blankEventForm());
    setFormsStarted((started) => started + 1);
  };

  return (
    <div className="flex flex-col gap-8">
      <CatalogImport onImport={importItem} />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Dados do evento</h2>

        {imported ? (
          <div className="flex flex-col items-start gap-2 rounded border p-3">
            <p className="text-sm">
              Formulário preenchido a partir de {imported.title}. Todos os campos
              continuam editáveis, e data, local, preço e capacidade são decisão
              sua.
            </p>
            {values.wallTime ? null : (
              <p className="text-sm">
                A data veio em um fuso que não foi possível interpretar, então o
                campo ficou em branco e o fuso voltou ao padrão. Preencha antes
                de salvar.
              </p>
            )}
            <button type="button" onClick={clearImport} className={buttonClass}>
              Limpar e começar do zero
            </button>
          </div>
        ) : (
          <p className="text-sm opacity-70">
            Preencha os campos abaixo, ou busque no catálogo externo para começar
            a partir de um evento existente.
          </p>
        )}

        <EventForm key={formsStarted} mode="create" initial={values} />
      </section>
    </div>
  );
}
