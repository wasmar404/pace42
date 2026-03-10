import { Module } from '@nestjs/common';

import { UsersController } from './users.controller';
import { SearchController } from './search.controller';

@Module({
  controllers: [UsersController, SearchController],
})
export class UsersModule {}
