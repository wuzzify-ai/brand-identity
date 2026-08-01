import { Body, Controller, Delete, Get, HttpCode, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from '../auth/auth.service';
import { CurrentUserId } from '../auth/decorators/current-user-id.decorator';
import { CurrentSessionId } from '../auth/decorators/current-session-id.decorator';
import { CurrentUserGuard } from '../auth/guards/current-user.guard';
import { ChangePasswordDto } from '../auth/dto/change-password.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@UseGuards(CurrentUserGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService
  ) {}

  @Get('me')
  me(@CurrentUserId() userId: string) {
    return this.usersService.getMe(userId);
  }

  @Patch('me')
  updateMe(@CurrentUserId() userId: string, @Body() body: UpdateMeDto) {
    return this.usersService.updateMe(userId, body);
  }

  @Delete('me')
  @HttpCode(204)
  async deleteMe(@CurrentUserId() userId: string) {
    await this.usersService.softDeleteMe(userId);
  }

  @Post('me/change-password')
  changePassword(
    @CurrentUserId() userId: string,
    @CurrentSessionId() sessionId: string,
    @Body() body: ChangePasswordDto
  ) {
    return this.authService.changePassword(userId, sessionId, body);
  }
}
