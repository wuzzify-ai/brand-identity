import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuthDatabaseModule } from '../auth/auth-database.module';
import { UsersRepository } from './repositories/users.repository';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [AuthDatabaseModule, AuthModule],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
  exports: [UsersService, UsersRepository]
})
export class UsersModule {}
