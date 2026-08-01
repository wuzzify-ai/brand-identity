import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailDeliveryService } from './email-delivery.service';

@Injectable()
export class AuthEmailService {
  constructor(
    private readonly config: ConfigService,
    private readonly delivery: EmailDeliveryService
  ) {}

  async sendVerificationEmail(to: string, rawToken: string): Promise<void> {
    const verifyUrl = new URL('/verify-email', this.config.getOrThrow<string>('WEB_ORIGIN'));
    verifyUrl.searchParams.set('token', rawToken);

    await this.delivery.send({
      to,
      subject: 'Verify your Brand Identity Creator account',
      text: `Verify your account: ${verifyUrl.toString()}`,
      html: `<p>Verify your account:</p><p><a href="${verifyUrl.toString()}">Verify email</a></p>`
    });
  }

  async sendPasswordResetEmail(to: string, rawToken: string): Promise<void> {
    const resetUrl = new URL('/reset-password', this.config.getOrThrow<string>('WEB_ORIGIN'));
    resetUrl.searchParams.set('token', rawToken);

    await this.delivery.send({
      to,
      subject: 'Reset your Brand Identity Creator password',
      text: `Reset your password: ${resetUrl.toString()}`,
      html: `<p>Reset your password:</p><p><a href="${resetUrl.toString()}">Reset password</a></p>`
    });
  }

  async sendWorkspaceInvitationEmail(to: string, rawToken: string): Promise<void> {
    const invitationUrl = new URL('/invitations/accept', this.config.getOrThrow<string>('WEB_ORIGIN'));
    invitationUrl.searchParams.set('token', rawToken);

    await this.delivery.send({
      to,
      subject: 'You were invited to a Brand Identity Creator workspace',
      text: `Accept the workspace invitation: ${invitationUrl.toString()}`,
      html: `<p>Accept the workspace invitation:</p><p><a href="${invitationUrl.toString()}">Accept invitation</a></p>`
    });
  }
}
