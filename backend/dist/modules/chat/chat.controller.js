"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatController = void 0;
const common_1 = require("@nestjs/common");
const supabase_guard_1 = require("../../auth/supabase.guard");
const supabase_user_1 = require("../../auth/supabase.user");
const chat_service_1 = require("./chat.service");
let ChatController = class ChatController {
    constructor(chat) {
        this.chat = chat;
    }
    async unread(user) {
        return await this.chat.getUnreadSummary(user.userId);
    }
    async list(user) {
        return await this.chat.listConversations(user.userId);
    }
    async mutuals(user, q) {
        return await this.chat.searchMutuals(user.userId, String(q ?? ''), 10);
    }
    async getOrCreate(user, otherUserId) {
        const convo = await this.chat.getOrCreateConversation(user.userId, otherUserId);
        return { conversation: { id: convo.id } };
    }
    async messages(user, conversationId, limit, before) {
        return await this.chat.getMessages(user.userId, conversationId, { limit: limit ? Number(limit) : undefined, before });
    }
    async send(user, conversationId, body) {
        return await this.chat.sendMessage(user.userId, conversationId, String(body?.body ?? ''), body?.clientId);
    }
    async read(user, conversationId) {
        return await this.chat.markRead(user.userId, conversationId);
    }
};
exports.ChatController = ChatController;
__decorate([
    (0, common_1.Get)('unread'),
    __param(0, (0, supabase_user_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "unread", null);
__decorate([
    (0, common_1.Get)('conversations'),
    __param(0, (0, supabase_user_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('mutuals'),
    __param(0, (0, supabase_user_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('q')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "mutuals", null);
__decorate([
    (0, common_1.Post)('conversations/with/:otherUserId'),
    __param(0, (0, supabase_user_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('otherUserId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "getOrCreate", null);
__decorate([
    (0, common_1.Get)('conversations/:id/messages'),
    __param(0, (0, supabase_user_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)('limit')),
    __param(3, (0, common_1.Query)('before')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "messages", null);
__decorate([
    (0, common_1.Post)('conversations/:id/messages'),
    __param(0, (0, supabase_user_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "send", null);
__decorate([
    (0, common_1.Post)('conversations/:id/read'),
    __param(0, (0, supabase_user_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "read", null);
exports.ChatController = ChatController = __decorate([
    (0, common_1.Controller)('chat'),
    (0, common_1.UseGuards)(supabase_guard_1.SupabaseAuthGuard),
    __metadata("design:paramtypes", [chat_service_1.ChatService])
], ChatController);
//# sourceMappingURL=chat.controller.js.map