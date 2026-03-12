import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';

import { SupabaseAuthGuard } from '../../auth/supabase.guard';
import { CurrentUser } from '../../auth/supabase.user';
import { ChatService } from './chat.service';

@Controller('chat')
@UseGuards(SupabaseAuthGuard)
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get('conversations')
  async list(@CurrentUser() user: { userId: string }) {
    return await this.chat.listConversations(user.userId);
  }

  @Get('mutuals')
  async mutuals(
    @CurrentUser() user: { userId: string },
    @Query('q') q?: string,
  ) {
    return await this.chat.searchMutuals(user.userId, String(q ?? ''), 10);
  }

  @Post('conversations/with/:otherUserId')
  async getOrCreate(
    @CurrentUser() user: { userId: string },
    @Param('otherUserId') otherUserId: string,
  ) {
    const convo = await this.chat.getOrCreateConversation(user.userId, otherUserId);
    return { conversation: { id: convo.id } };
  }

  @Get('conversations/:id/messages')
  async messages(
    @CurrentUser() user: { userId: string },
    @Param('id') conversationId: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    return await this.chat.getMessages(user.userId, conversationId, { limit: limit ? Number(limit) : undefined, before });
  }

  @Post('conversations/:id/messages')
  async send(
    @CurrentUser() user: { userId: string },
    @Param('id') conversationId: string,
    @Body() body: { body?: string; clientId?: string },
  ) {
    return await this.chat.sendMessage(user.userId, conversationId, String(body?.body ?? ''), body?.clientId);
  }

  @Post('conversations/:id/read')
  async read(
    @CurrentUser() user: { userId: string },
    @Param('id') conversationId: string,
  ) {
    return await this.chat.markRead(user.userId, conversationId);
  }
}
