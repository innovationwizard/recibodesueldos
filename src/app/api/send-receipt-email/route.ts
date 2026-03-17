import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_PDF_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_SUBJECT_LEN = 500;
const MAX_BODY_LEN = 5000;

export async function POST(request: NextRequest) {
  // 1. Validate RESEND_API_KEY is configured
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "RESEND_API_KEY no está configurado en el servidor" },
      { status: 500 }
    );
  }

  const resend = new Resend(apiKey);

  // 2. Authenticate
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // 3. Parse FormData
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Cuerpo de solicitud inválido" }, { status: 400 });
  }

  const batchId = formData.get("batchId") as string;
  const receiptId = formData.get("receiptId") as string;
  const employeeName = formData.get("employeeName") as string;
  const recipientEmail = formData.get("recipientEmail") as string;
  const fromAddress = formData.get("fromAddress") as string;
  const subject = formData.get("subject") as string;
  const bodyText = formData.get("bodyText") as string;
  const pdfFile = formData.get("pdf") as File | null;
  const pdfFileName = formData.get("pdfFileName") as string;

  // 4. Validate fields
  if (!batchId || !employeeName || !recipientEmail || !fromAddress || !subject || !bodyText || !pdfFile || !pdfFileName) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }

  if (!EMAIL_RE.test(recipientEmail)) {
    return NextResponse.json({ error: "Correo del destinatario inválido" }, { status: 400 });
  }

  if (subject.length > MAX_SUBJECT_LEN) {
    return NextResponse.json({ error: `Asunto excede ${MAX_SUBJECT_LEN} caracteres` }, { status: 400 });
  }

  if (bodyText.length > MAX_BODY_LEN) {
    return NextResponse.json({ error: `Cuerpo excede ${MAX_BODY_LEN} caracteres` }, { status: 400 });
  }

  if (pdfFile.size > MAX_PDF_SIZE) {
    return NextResponse.json({ error: "PDF excede el límite de 10MB" }, { status: 400 });
  }

  // 5. Verify batch ownership
  const { data: batch } = await supabase
    .from("batches")
    .select("id")
    .eq("id", batchId)
    .single();

  if (!batch) {
    return NextResponse.json({ error: "Lote no encontrado" }, { status: 404 });
  }

  // 6. Send via Resend
  try {
    const pdfBuffer = Buffer.from(await pdfFile.arrayBuffer());

    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: [recipientEmail],
      subject,
      text: bodyText,
      attachments: [
        {
          filename: pdfFileName,
          content: pdfBuffer,
        },
      ],
    });

    if (error) {
      const errorMessage = error.message || "Error de Resend desconocido";

      await supabase.from("email_logs").insert({
        batch_id: batchId,
        receipt_id: receiptId || null,
        employee_name: employeeName,
        recipient_email: recipientEmail,
        from_address: fromAddress,
        subject,
        status: "failed",
        error_message: errorMessage,
      });

      return NextResponse.json({ success: false, error: errorMessage }, { status: 422 });
    }

    // 7. Log success
    await supabase.from("email_logs").insert({
      batch_id: batchId,
      receipt_id: receiptId || null,
      employee_name: employeeName,
      recipient_email: recipientEmail,
      from_address: fromAddress,
      subject,
      status: "sent",
      resend_id: data?.id ?? null,
    });

    return NextResponse.json({ success: true, resendId: data?.id });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error desconocido";

    await supabase.from("email_logs").insert({
      batch_id: batchId,
      receipt_id: receiptId || null,
      employee_name: employeeName,
      recipient_email: recipientEmail,
      from_address: fromAddress,
      subject,
      status: "failed",
      error_message: errorMessage,
    });

    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
