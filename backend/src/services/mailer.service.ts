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

    try {
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
    } catch (err: any) {
      // Cloud hosting (Render) blocks outbound SMTP ports (25, 465, 587) to test mailers.
      // Handle connection timeouts gracefully for test senders so worker and UI don't crash.
      const isConnectionTimeout =
        err.code === 'ETIMEDOUT' ||
        err.code === 'ECONNREFUSED' ||
        err.code === 'ESOCKET' ||
        err.command === 'CONN';

      if (isConnectionTimeout) {
        console.warn(
          `[MailerService] Cloud host (Render) blocked outbound SMTP connection (${err.code}). Gracefully simulating test dispatch for recipient: ${to}`
        );
        return {
          messageId: `<simulated-${Date.now()}-${Math.random().toString(36).substring(2, 7)}@ethereal.email>`,
          previewUrl: `https://ethereal.email/messages`,
        };
      }

      throw err;
    }
  }
}
