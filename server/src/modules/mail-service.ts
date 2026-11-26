import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

const transporter =
  env.SMTP_HOST !== undefined &&
  env.SMTP_PORT !== undefined &&
  env.SMTP_USER !== undefined &&
  env.SMTP_PASSWORD !== undefined &&
  env.SMTP_FROM !== undefined
    ? nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465,
        auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
      })
    : undefined;

async function deliver(to: string, subject: string, link: string): Promise<void> {
  if (transporter === undefined) {
    if (env.NODE_ENV !== "development") {
      throw new Error("SMTP is required to send account emails outside development");
    }
    logger.info({ to, link }, subject);
    return;
  }

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to,
    subject,
    text: `${subject}\n\n${link}\n\nIf you did not request this, you can ignore this email.`,
  });
}

function actionLink(path: string, token: string): string {
  const link = new URL(path, env.CLIENT_ORIGIN);
  link.searchParams.set("token", token);
  return link.toString();
}

export const mailService = {
  sendVerificationEmail(to: string, token: string): Promise<void> {
    return deliver(to, "Verify your QM Portfolio email", actionLink("/verify-email", token));
  },
  sendPasswordResetEmail(to: string, token: string): Promise<void> {
    return deliver(to, "Reset your QM Portfolio password", actionLink("/reset-password", token));
  },
};
