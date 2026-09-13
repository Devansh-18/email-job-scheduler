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
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.port === 465,
      auth: {
        user: smtp.user,
        pass: smtp.pass,
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
