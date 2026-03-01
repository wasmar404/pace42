import {Injectable} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';// allowes me to read from env file
import  nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
@Injectable()
export class MailService{

private transporter: Transporter | null = null;
private from: string | null = null;

constructor(private readonly config: ConfigService){}

private getTransporter(): Transporter{
    if (this.transporter) return this.transporter;
    const host = this.config.get<string>('SMTP_HOST');
    const port = Number(this.config.get<string>('SMTP_PORT') ?? 0); // ?? means use port or use  0 if port not found or null
    const secure = String(this.config.get<string>('SMTP_SECURE') ?? 'true') === 'true';// === means same value same type
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    const from = this.config.get<string>('SMTP_FROM') ?? user;
    if (!host || !port || !user || !pass || !from) {
      throw new Error('SMTP is not configured (set SMTP_HOST/PORT/SECURE/USER/PASS/FROM)');
    }
    this.from = from;
    this.transporter = nodemailer.createTransport({host,port,secure,auth:{user,pass}});
    return this.transporter;
}

private buildResetLink(frontendUrl: string, resetToken: string): string | null {
    if (!frontendUrl) return null;
    const base = frontendUrl.endsWith('/') ? frontendUrl.slice(0, -1) : frontendUrl;
    return `${base}/reset-password?token=${encodeURIComponent(resetToken)}`;
}

async sendVerificationCode(email: string, code: string): Promise<void> {
    const transporter = this.getTransporter();
    const from = this.from!;
    await transporter.sendMail({
      from,
      to: email,
      subject: 'Your verification code',
      text: `Your verification code is: ${code}\n\nThis code expires soon.`,
    });
}

async sendPasswordReset(email: string, resetToken: string): Promise<void> {
    const transporter = this.getTransporter();
    const from = this.from!;

    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? '';
    const link = this.buildResetLink(frontendUrl, resetToken);

    await transporter.sendMail({
      from,
      to: email,
      subject: 'Reset your password',
      text:
        link ? `Reset your password using this link:\n${link}\n\nIf you did not request this, ignore this email.` :
        `Use this reset token to reset your password: ${resetToken}\n\nIf you did not request this, ignore this email.`,});
}
}