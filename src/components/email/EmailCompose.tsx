"use client";

import { useState } from "react";

export interface EmailComposeData {
  fromAddress: string;
  subject: string;
  bodyText: string;
}

interface EmailComposeProps {
  companyName: string;
  periodRange: string;
  onSubmit: (data: EmailComposeData) => void;
  onBack: () => void;
}

export function EmailCompose({ companyName, periodRange, onSubmit, onBack }: EmailComposeProps) {
  const [fromAddress, setFromAddress] = useState("");
  const [subject, setSubject] = useState(`Boleta de pago - ${periodRange}`);
  const [bodyText, setBodyText] = useState(
    `Estimado/a colaborador/a,\n\nAdjunto encontrará su boleta de pago correspondiente al período ${periodRange}.\n\nSaludos cordiales,\n${companyName}`
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!fromAddress.trim()) {
      errs.fromAddress = "El remitente es obligatorio";
    }
    if (!subject.trim()) {
      errs.subject = "El asunto es obligatorio";
    }
    if (!bodyText.trim()) {
      errs.bodyText = "El mensaje es obligatorio";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      onSubmit({ fromAddress: fromAddress.trim(), subject: subject.trim(), bodyText: bodyText.trim() });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-primary">Redactar correo</h3>
        <p className="mt-1 text-[13px] text-gray-600">
          Configure el remitente, asunto y mensaje que acompañará cada boleta.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            De (Remitente)
          </label>
          <input
            type="text"
            value={fromAddress}
            onChange={(e) => { setFromAddress(e.target.value); setErrors((p) => ({ ...p, fromAddress: "" })); }}
            placeholder="Pagos <pagos@empresa.com> o pagos@empresa.com"
            className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary/20"
          />
          {errors.fromAddress && <p className="mt-1 text-xs text-red-600">{errors.fromAddress}</p>}
          <p className="mt-1 text-[11px] text-gray-400">
            El dominio debe estar verificado en Resend. Para pruebas use: onboarding@resend.dev
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Asunto</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => { setSubject(e.target.value); setErrors((p) => ({ ...p, subject: "" })); }}
            placeholder="Asunto del correo"
            className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary/20"
          />
          {errors.subject && <p className="mt-1 text-xs text-red-600">{errors.subject}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Mensaje</label>
          <textarea
            value={bodyText}
            onChange={(e) => { setBodyText(e.target.value); setErrors((p) => ({ ...p, bodyText: "" })); }}
            rows={6}
            className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary/20"
          />
          {errors.bodyText && <p className="mt-1 text-xs text-red-600">{errors.bodyText}</p>}
          <p className="mt-1 text-[11px] text-gray-400">
            Este mensaje se enviará como texto plano. La boleta PDF se adjuntará automáticamente.
          </p>
        </div>
      </div>

      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="rounded-lg border border-gray-200 bg-gray-50 px-5 py-2.5 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-100"
        >
          Atrás
        </button>
        <button
          onClick={handleSubmit}
          className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-light"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
