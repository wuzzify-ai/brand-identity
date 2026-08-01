import { Body, Controller, Delete, Get, Ip, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CurrentUserId } from './decorators/current-user-id.decorator';
import { CurrentSessionId } from './decorators/current-session-id.decorator';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { CurrentUserGuard } from './guards/current-user.guard';
import { clearRefreshCookie, readCookie, refreshCookieName, setRefreshCookie, shouldSecureRefreshCookie } from './refresh-cookie';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService
  ) {}

  private refreshCookieOptions() {
    return {
      secure: shouldSecureRefreshCookie(
        this.config.get<string>('NODE_ENV'),
        this.config.get<string>('API_PUBLIC_URL')
      )
    };
  }

  @Post('register')
  register(@Body() body: RegisterDto, @Ip() ip: string) {
    return this.authService.register(body, ip);
  }

  @Post('verify-email')
  verifyEmail(@Body() body: VerifyEmailDto) {
    return this.authService.verifyEmail(body.token);
  }

  @Post('resend-verification')
  resendVerification(@Body() body: ResendVerificationDto, @Ip() ip: string) {
    return this.authService.resendVerification(body.email, ip);
  }

  @Post('login')
  async login(
    @Body() body: LoginDto,
    @Ip() ip: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ) {
    const metadata: { ipKey: string; userAgent?: string } = { ipKey: ip };
    const userAgent = request.header('user-agent');

    if (userAgent) {
      metadata.userAgent = userAgent;
    }

    const result = await this.authService.login(body, metadata);
    setRefreshCookie(response, result.refreshToken, result.refreshMaxAgeMs, this.refreshCookieOptions());

    return {
      accessToken: result.accessToken,
      expiresIn: result.expiresIn
    };
  }

  @Post('refresh')
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.refresh(readCookie(request.header('cookie'), refreshCookieName));
    setRefreshCookie(response, result.refreshToken, result.refreshMaxAgeMs, this.refreshCookieOptions());

    return {
      accessToken: result.accessToken,
      expiresIn: result.expiresIn
    };
  }

  @Post('logout')
  @UseGuards(CurrentUserGuard)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.authService.logout(request.currentSessionId as string);
    clearRefreshCookie(response, this.refreshCookieOptions());

    return { ok: true };
  }

  @Post('logout-all')
  @UseGuards(CurrentUserGuard)
  async logoutAll(@CurrentUserId() userId: string, @Res({ passthrough: true }) response: Response) {
    await this.authService.logoutAll(userId);
    clearRefreshCookie(response, this.refreshCookieOptions());

    return { ok: true };
  }

  @Post('forgot-password')
  forgotPassword(@Body() body: ForgotPasswordDto, @Ip() ip: string) {
    return this.authService.forgotPassword(body.email, ip);
  }

  @Post('reset-password')
  resetPassword(@Body() body: ResetPasswordDto) {
    return this.authService.resetPassword(body.token, body.newPassword);
  }

  @Get('sessions')
  @UseGuards(CurrentUserGuard)
  sessions(@CurrentUserId() userId: string, @CurrentSessionId() sessionId: string) {
    return this.authService.listSessions(userId, sessionId);
  }

  @Delete('sessions/:sessionId')
  @UseGuards(CurrentUserGuard)
  revokeSession(@CurrentUserId() userId: string, @Param('sessionId') sessionId: string) {
    return this.authService.revokeSession(userId, sessionId);
  }
}
