import nodemailer from 'nodemailer';

export interface SMTPConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  fromName: string;
  fromEmail: string;
}

export class MailerService {
  public static async sendMail(
    smtp: SMTPConfig,
    to: string,
    subject: string,
    bodyText: string,
    bodyHtml?: string | null
  ) {
    // Cloud providers (Render, Heroku, AWS) block outbound port 587 to Ethereal.
    // Use port 465 with SSL/TLS (secure: true) for Ethereal and 465 SMTP.
    const isEthereal = smtp.host.includes('ethereal.email');
    const targetPort = isEthereal && smtp.port === 587 ? 465 : smtp.port;
    const isSecure = targetPort === 465;

    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: targetPort,
      secure: isSecure,
      auth: {
        user: smtp.user,
        pass: smtp.pass,
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
      tls: {
        rejectUnauthorized: false,
      },
    });

    const info = await transporter.sendMail({
      from: `"${smtp.fromName}" <${smtp.fromEmail}>`,
      to,
      subject,
      text: bodyText,
      html: bodyHtml || undefined,
    });

    const testUrl = nodemailer.getTestMessageUrl(info);
    return {
      messageId: info.messageId,
      previewUrl: testUrl || null,
    };
  }
}
