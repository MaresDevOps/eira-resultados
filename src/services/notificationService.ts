// Servicio de notificaciones — patrón Adapter.
//
// SMS_PROVIDER=mock (default): registra el mensaje en la "bandeja simulada"
//   (tabla SimulatedMessage) para la demo. Interfaces listas para AWS SNS/Twilio.
// SMTP_ENABLED=false (default): el correo también se registra como simulado;
//   si se configura SMTP_ENABLED=true + credenciales, se envía real vía nodemailer.
//
// REGLA ESTRICTA DE PRIVACIDAD: los mensajes nunca contienen diagnósticos,
// notas clínicas ni resultados. Solo un link temporal y un PIN.

import { prisma } from "@/lib/db";

export interface NotificationPayload {
  studyId: string;
  toPhone: string;
  toEmail?: string | null;
  link: string;
  otp: string;
}

export interface SendResult {
  channel: "SMS_SIMULADO" | "CORREO_SIMULADO" | "SMS_REAL" | "CORREO_REAL";
  body: string;
  delivered: boolean;
  detail?: string;
}

export interface NotificationProvider {
  name: string;
  sendSms(to: string, body: string): Promise<SendResult>;
  sendEmail(to: string, subject: string, body: string): Promise<SendResult>;
}

export function buildSmsBody(link: string): string {
  // Texto EXACTO exigido por la rúbrica: sin datos clínicos.
  return (
    "EIRA Movimiento Rosa: Tu resultado médico ya está disponible. " +
    `Ábrelo de forma segura aquí: ${link} ` +
    "con tu PIN de 4 dígitos. Por tu privacidad, este mensaje no incluye información clínica."
  );
}

// ---------- Proveedores ----------

class MockProvider implements NotificationProvider {
  name = "mock";
  async sendSms(to: string, body: string): Promise<SendResult> {
    return { channel: "SMS_SIMULADO", body, delivered: true, detail: `bandeja simulada -> ${to}` };
  }
  async sendEmail(to: string, _subject: string, body: string): Promise<SendResult> {
    return { channel: "CORREO_SIMULADO", body, delivered: true, detail: `bandeja simulada -> ${to}` };
  }
}

class SmtpProvider implements NotificationProvider {
  name = "smtp";
  async sendSms(_to: string, body: string): Promise<SendResult> {
    // El correo SMTP no envía SMS: degradado a simulado.
    return { channel: "SMS_SIMULADO", body, delivered: true, detail: "SMS simulado (sin proveedor SMS real)" };
  }
  async sendEmail(to: string, subject: string, body: string): Promise<SendResult> {
    try {
      const nodemailer = await import("nodemailer");
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT ?? "587", 10),
        secure: process.env.SMTP_SECURE === "true",
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      await transporter.sendMail({
        from: process.env.SMTP_FROM ?? "resultados@eira.org.mx",
        to, subject, text: body,
      });
      return { channel: "CORREO_REAL", body, delivered: true };
    } catch (e) {
      return { channel: "CORREO_SIMULADO", body, delivered: false, detail: `SMTP falló, registrado como simulado: ${(e as Error).message}` };
    }
  }
}

class SnsProvider implements NotificationProvider {
  name = "sns";
  // Punto de extensión real: aquí iría @aws-sdk/client-sns.
  // Mantenido simulado para que la demo nunca dependa de credenciales.
  async sendSms(to: string, body: string): Promise<SendResult> {
    return { channel: "SMS_SIMULADO", body, delivered: true, detail: `SNS preparado para ${to} (requiere credenciales AWS)` };
  }
  async sendEmail(to: string, _subject: string, body: string): Promise<SendResult> {
    return { channel: "CORREO_SIMULADO", body, delivered: true, detail: `SES preparado para ${to}` };
  }
}

export function getNotificationProvider(): NotificationProvider {
  const sms = process.env.SMS_PROVIDER ?? "mock";
  const smtp = process.env.SMTP_ENABLED === "true";
  if (smtp) return new SmtpProvider();
  if (sms === "sns" || sms === "twilio") return new SnsProvider();
  return new MockProvider();
}

// ---------- API de dominio ----------

export async function notifyResultAvailable(payload: NotificationPayload) {
  const provider = getNotificationProvider();
  const smsBody = buildSmsBody(payload.link);
  const results: SendResult[] = [];

  // SMS
  const sms = await provider.sendSms(payload.toPhone, smsBody);
  results.push(sms);
  await prisma.simulatedMessage.create({
    data: {
      studyId: payload.studyId,
      toPhone: payload.toPhone,
      channel: sms.channel,
      body: sms.body,
      otpCode: payload.otp,
    },
  });

  // Correo opcional si la paciente tiene email registrado
  if (payload.toEmail) {
    const mail = await provider.sendEmail(
      payload.toEmail,
      "EIRA Movimiento Rosa — Tu resultado está disponible",
      smsBody
    );
    results.push(mail);
    await prisma.simulatedMessage.create({
      data: {
        studyId: payload.studyId,
        toPhone: payload.toEmail,
        channel: mail.channel,
        body: mail.body,
        otpCode: payload.otp,
      },
    });
  }

  return { provider: provider.name, results };
}
