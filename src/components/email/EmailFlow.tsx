"use client";

import { useState, useCallback, useRef } from "react";
import type { ReceiptData } from "@/lib/excel-parser";
import type { MappingResult, MatchedRecipient } from "@/lib/email-mapping-parser";
import { generateSingleReceiptPdf, getReceiptHtml, receiptFileName } from "@/lib/pdf-generator";
import { MappingUpload } from "./MappingUpload";
import { EmailCompose, type EmailComposeData } from "./EmailCompose";
import { RecipientPreview } from "./RecipientPreview";
import { SendProgress, type SendStatus } from "./SendProgress";
import { SendResults } from "./SendResults";

type EmailStep = "mapping_upload" | "compose" | "preview" | "sending" | "results";

interface EmailFlowProps {
  receipts: ReceiptData[];
  batchId: string;
  receiptIds: string[];
  printRef: React.RefObject<HTMLDivElement>;
  onClose: () => void;
}

export function EmailFlow({ receipts, batchId, receiptIds, printRef, onClose }: EmailFlowProps) {
  const [step, setStep] = useState<EmailStep>("mapping_upload");
  const [mappingResult, setMappingResult] = useState<MappingResult | null>(null);
  const [composeData, setComposeData] = useState<EmailComposeData | null>(null);
  const [sendStatuses, setSendStatuses] = useState<SendStatus[]>([]);
  const [currentSendIndex, setCurrentSendIndex] = useState(0);
  const [resending, setResending] = useState(false);
  const cancelledRef = useRef(false);
  const [cancelled, setCancelled] = useState(false);

  // ─── Step 1: Mapping uploaded ───
  const handleMappingReady = useCallback((result: MappingResult) => {
    setMappingResult(result);
    setStep("compose");
  }, []);

  // ─── Step 2: Email composed ───
  const handleComposeSubmit = useCallback((data: EmailComposeData) => {
    setComposeData(data);
    setStep("preview");
  }, []);

  // ─── Step 3: Toggle recipient selection ───
  const handleToggle = useCallback((receiptIndex: number) => {
    setMappingResult((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        matched: prev.matched.map((m) =>
          m.receiptIndex === receiptIndex ? { ...m, selected: !m.selected } : m
        ),
      };
    });
  }, []);

  const handleToggleAll = useCallback((selected: boolean) => {
    setMappingResult((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        matched: prev.matched.map((m) => ({ ...m, selected })),
      };
    });
  }, []);

  // ─── Step 4: Send emails ───
  const sendEmails = useCallback(
    async (recipients: MatchedRecipient[]) => {
      if (!composeData) return;

      cancelledRef.current = false;
      setCancelled(false);

      const initialStatuses: SendStatus[] = recipients.map((r) => ({
        receiptIndex: r.receiptIndex,
        employeeName: r.employeeName,
        email: r.email,
        status: "pending" as const,
      }));
      setSendStatuses(initialStatuses);
      setCurrentSendIndex(0);
      setStep("sending");

      for (let i = 0; i < recipients.length; i++) {
        if (cancelledRef.current) break;

        const recipient = recipients[i];
        setCurrentSendIndex(i);

        // Mark as sending
        setSendStatuses((prev) =>
          prev.map((s) =>
            s.receiptIndex === recipient.receiptIndex ? { ...s, status: "sending" } : s
          )
        );

        try {
          // Generate PDF
          const html = getReceiptHtml(printRef, recipient.receiptIndex);
          if (!html) throw new Error("No se pudo obtener el HTML de la boleta");

          const { pdfArrayBuffer } = await generateSingleReceiptPdf(html);
          const fileName = receiptFileName(
            receipts[recipient.receiptIndex].ordinal,
            recipient.employeeName
          );

          // Send via FormData to avoid JSON body size limits
          const formData = new FormData();
          formData.append("batchId", batchId);
          formData.append("receiptId", receiptIds[recipient.receiptIndex] || "");
          formData.append("employeeName", recipient.employeeName);
          formData.append("recipientEmail", recipient.email);
          formData.append("fromAddress", composeData.fromAddress);
          formData.append("subject", composeData.subject);
          formData.append("bodyText", composeData.bodyText);
          formData.append("pdf", new Blob([pdfArrayBuffer], { type: "application/pdf" }), fileName);
          formData.append("pdfFileName", fileName);

          const response = await fetch("/api/send-receipt-email", {
            method: "POST",
            body: formData,
          });

          const responseText = await response.text();
          let result: { success?: boolean; error?: string };
          try {
            result = JSON.parse(responseText);
          } catch {
            throw new Error(`Error del servidor (${response.status}): ${responseText.slice(0, 200)}`);
          }

          if (result.success) {
            setSendStatuses((prev) =>
              prev.map((s) =>
                s.receiptIndex === recipient.receiptIndex ? { ...s, status: "sent" } : s
              )
            );
          } else {
            setSendStatuses((prev) =>
              prev.map((s) =>
                s.receiptIndex === recipient.receiptIndex
                  ? { ...s, status: "failed", error: result.error }
                  : s
              )
            );
          }
        } catch (err) {
          setSendStatuses((prev) =>
            prev.map((s) =>
              s.receiptIndex === recipient.receiptIndex
                ? { ...s, status: "failed", error: (err as Error).message }
                : s
            )
          );
        }
      }

      setStep("results");
    },
    [composeData, batchId, receiptIds, receipts, printRef]
  );

  const handleConfirmSend = useCallback(() => {
    if (!mappingResult) return;
    const selected = mappingResult.matched.filter((m) => m.selected);
    sendEmails(selected);
  }, [mappingResult, sendEmails]);

  const handleCancel = useCallback(() => {
    cancelledRef.current = true;
    setCancelled(true);
  }, []);

  // ─── Step 5: Resend failed ───
  const handleResend = useCallback(
    (receiptIndices: number[]) => {
      if (!mappingResult) return;
      setResending(true);
      const toResend = mappingResult.matched.filter((m) =>
        receiptIndices.includes(m.receiptIndex)
      );
      sendEmails(toResend).finally(() => setResending(false));
    },
    [mappingResult, sendEmails]
  );

  // ─── Render ───
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
      {/* Step indicator */}
      <div className="mb-5 flex items-center gap-1 text-[12px]">
        {[
          { key: "mapping_upload", label: "Mapeo" },
          { key: "compose", label: "Redactar" },
          { key: "preview", label: "Confirmar" },
          { key: "sending", label: "Enviar" },
          { key: "results", label: "Resultado" },
        ].map(({ key, label }, i, arr) => {
          const steps: EmailStep[] = ["mapping_upload", "compose", "preview", "sending", "results"];
          const currentIdx = steps.indexOf(step);
          const isActive = i <= currentIdx;
          return (
            <div key={key} className="flex items-center gap-1.5">
              <div
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${
                  isActive ? "bg-primary text-white" : "bg-gray-200 text-gray-400"
                }`}
              >
                {i + 1}
              </div>
              <span className={isActive ? "font-medium text-primary" : "text-gray-400"}>
                {label}
              </span>
              {i < arr.length - 1 && <div className="h-px w-4 bg-gray-200" />}
            </div>
          );
        })}
      </div>

      {step === "mapping_upload" && (
        <MappingUpload
          receipts={receipts}
          companyName={receipts[0]?.companyName ?? ""}
          onMappingReady={handleMappingReady}
          onCancel={onClose}
        />
      )}

      {step === "compose" && (
        <EmailCompose
          companyName={receipts[0]?.companyName ?? ""}
          periodRange={receipts[0]?.dateRange ?? ""}
          onSubmit={handleComposeSubmit}
          onBack={() => setStep("mapping_upload")}
        />
      )}

      {step === "preview" && mappingResult && (
        <RecipientPreview
          matched={mappingResult.matched}
          unmatched={mappingResult.unmatched}
          warnings={mappingResult.warnings}
          onToggle={handleToggle}
          onToggleAll={handleToggleAll}
          onConfirm={handleConfirmSend}
          onBack={() => setStep("compose")}
        />
      )}

      {step === "sending" && (
        <SendProgress
          statuses={sendStatuses}
          currentIndex={currentSendIndex}
          total={sendStatuses.length}
          onCancel={handleCancel}
          cancelled={cancelled}
        />
      )}

      {step === "results" && (
        <SendResults
          statuses={sendStatuses}
          onResend={handleResend}
          onClose={onClose}
          resending={resending}
        />
      )}
    </div>
  );
}
