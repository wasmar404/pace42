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
exports.PublicGetClubDto = exports.PublicDeleteDto = exports.PublicUpdateClubDto = exports.PublicCreateClubDto = exports.PublicActivitiesDto = exports.PublicListDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
class PublicListDto {
}
exports.PublicListDto = PublicListDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], PublicListDto.prototype, "take", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], PublicListDto.prototype, "q", void 0);
class PublicActivitiesDto {
}
exports.PublicActivitiesDto = PublicActivitiesDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], PublicActivitiesDto.prototype, "take", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (typeof value === 'string' ? value.trim() : value)),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PublicActivitiesDto.prototype, "since", void 0);
class PublicCreateClubDto {
}
exports.PublicCreateClubDto = PublicCreateClubDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], PublicCreateClubDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(160),
    __metadata("design:type", String)
], PublicCreateClubDto.prototype, "location", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(['run', 'walk', 'hike', 'cycle']),
    __metadata("design:type", String)
], PublicCreateClubDto.prototype, "sport", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(800),
    __metadata("design:type", String)
], PublicCreateClubDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(800),
    __metadata("design:type", String)
], PublicCreateClubDto.prototype, "avatarUrl", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(800),
    __metadata("design:type", String)
], PublicCreateClubDto.prototype, "bannerUrl", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => {
        if (typeof value === 'boolean')
            return value;
        const s = String(value ?? '').trim().toLowerCase();
        if (['true', '1', 'yes', 'on'].includes(s))
            return true;
        if (['false', '0', 'no', 'off'].includes(s))
            return false;
        return value;
    }),
    __metadata("design:type", Boolean)
], PublicCreateClubDto.prototype, "isInviteOnly", void 0);
class PublicUpdateClubDto {
}
exports.PublicUpdateClubDto = PublicUpdateClubDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], PublicUpdateClubDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(160),
    __metadata("design:type", String)
], PublicUpdateClubDto.prototype, "location", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(['run', 'walk', 'hike', 'cycle']),
    __metadata("design:type", String)
], PublicUpdateClubDto.prototype, "sport", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(800),
    __metadata("design:type", String)
], PublicUpdateClubDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(800),
    __metadata("design:type", String)
], PublicUpdateClubDto.prototype, "avatarUrl", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(800),
    __metadata("design:type", String)
], PublicUpdateClubDto.prototype, "bannerUrl", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => {
        if (typeof value === 'boolean')
            return value;
        const s = String(value ?? '').trim().toLowerCase();
        if (['true', '1', 'yes', 'on'].includes(s))
            return true;
        if (['false', '0', 'no', 'off'].includes(s))
            return false;
        return value;
    }),
    __metadata("design:type", Boolean)
], PublicUpdateClubDto.prototype, "isInviteOnly", void 0);
class PublicDeleteDto {
}
exports.PublicDeleteDto = PublicDeleteDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PublicDeleteDto.prototype, "confirm", void 0);
class PublicGetClubDto {
}
exports.PublicGetClubDto = PublicGetClubDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], PublicGetClubDto.prototype, "id", void 0);
//# sourceMappingURL=public-api.dto.js.map