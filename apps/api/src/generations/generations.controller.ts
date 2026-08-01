import { Body, Controller, Get, Headers, Param, Post, Sse, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { from, map } from 'rxjs';
import { CurrentUserId } from '../auth/decorators/current-user-id.decorator';
import { CurrentUserGuard } from '../auth/guards/current-user.guard';
import { CreateGenerationDto } from './dto/create-generation.dto';
import { GenerationsService } from './generations.service';

@ApiTags('generations')
@UseGuards(CurrentUserGuard)
@Controller('generations')
export class GenerationsController {
  constructor(private readonly generations: GenerationsService) {}

  @Post()
  create(
    @CurrentUserId() userId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: CreateGenerationDto
  ) {
    return this.generations.create(userId, body, idempotencyKey);
  }

  @Get(':jobId')
  get(@CurrentUserId() userId: string, @Param('jobId') jobId: string) {
    return this.generations.get(userId, jobId);
  }

  @Post(':jobId/cancel')
  cancel(@CurrentUserId() userId: string, @Param('jobId') jobId: string) {
    return this.generations.cancel(userId, jobId);
  }

  @Sse(':jobId/events')
  events(@CurrentUserId() userId: string, @Param('jobId') jobId: string) {
    return from(this.generations.currentEvent(userId, jobId)).pipe(
      map((event) => ({ id: event.id, type: event.type, data: event.data }))
    );
  }
}
