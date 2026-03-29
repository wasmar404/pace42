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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateClubPostDto = exports.DeleteClubDto = exports.SetMemberRoleDto = exports.UpdateClubDto = exports.InviteUserDto = exports.CreateClubDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
function toBool(value) {
    if (value === null || value === undefined)
        return value;
    if (typeof value === 'boolean')
        return value;
    const s = String(value).trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(s))
        return true;
    if (['false', '0', 'no', 'off'].includes(s))
        return false;
    return value;
}
class CreateClubDto {
}
exports.CreateClubDto = CreateClubDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], CreateClubDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(160),
    __metadata("design:type", String)
], CreateClubDto.prototype, "location", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(['run', 'walk', 'hike', 'cycle']),
    __metadata("design:type", String)
], CreateClubDto.prototype, "sport", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(800),
    __metadata("design:type", String)
], CreateClubDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => toBool(value)),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateClubDto.prototype, "isInviteOnly", void 0);
class InviteUserDto {
}
exports.InviteUserDto = InviteUserDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], InviteUserDto.prototype, "userId", void 0);
class UpdateClubDto {
}
exports.UpdateClubDto = UpdateClubDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], UpdateClubDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(160),
    __metadata("design:type", String)
], UpdateClubDto.prototype, "location", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(['run', 'walk', 'hike', 'cycle']),
    __metadata("design:type", String)
], UpdateClubDto.prototype, "sport", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(800),
    __metadata("design:type", String)
], UpdateClubDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => toBool(value)),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateClubDto.prototype, "isInviteOnly", void 0);
class SetMemberRoleDto {
}
exports.SetMemberRoleDto = SetMemberRoleDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(['admin', 'member']),
    __metadata("design:type", String)
], SetMemberRoleDto.prototype, "role", void 0);
class DeleteClubDto {
}
exports.DeleteClubDto = DeleteClubDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], DeleteClubDto.prototype, "confirm", void 0);
class CreateClubPostDto {
}
exports.CreateClubPostDto = CreateClubPostDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], CreateClubPostDto.prototype, "body", void 0);
//# sourceMappingURL=clubs.dto.js.map