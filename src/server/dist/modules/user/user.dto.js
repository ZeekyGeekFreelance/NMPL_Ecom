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
exports.SetDealerPricesDto = exports.DealerPriceItemDto = exports.UpdateDealerStatusDto = exports.CreateDealerDto = exports.CreateAdminDto = exports.UserEmailDto = exports.UserIdDto = exports.UpdateUserDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
class UpdateUserDto {
}
exports.UpdateUserDto = UpdateUserDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: "Name must be a string" }),
    __metadata("design:type", String)
], UpdateUserDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEmail)({}, { message: "Invalid email format" }),
    __metadata("design:type", String)
], UpdateUserDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.MinLength)(6, { message: "Password must be at least 6 characters long" }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateUserDto.prototype, "password", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(["USER", "ADMIN", "SUPERADMIN"], {
        message: "Role must be USER, ADMIN, or SUPERADMIN",
    }),
    __metadata("design:type", String)
], UpdateUserDto.prototype, "role", void 0);
class UserIdDto {
}
exports.UserIdDto = UserIdDto;
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: "ID is required" }),
    (0, class_validator_1.IsString)({ message: "ID must be a string" }),
    __metadata("design:type", String)
], UserIdDto.prototype, "id", void 0);
class UserEmailDto {
}
exports.UserEmailDto = UserEmailDto;
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: "Email is required" }),
    (0, class_validator_1.IsEmail)({}, { message: "Invalid email format" }),
    __metadata("design:type", String)
], UserEmailDto.prototype, "email", void 0);
class CreateAdminDto {
}
exports.CreateAdminDto = CreateAdminDto;
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: "Name is required" }),
    (0, class_validator_1.IsString)({ message: "Name must be a string" }),
    (0, class_validator_1.MinLength)(3, { message: "Name must be at least 3 characters long" }),
    __metadata("design:type", String)
], CreateAdminDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: "Email is required" }),
    (0, class_validator_1.IsEmail)({}, { message: "Invalid email format" }),
    __metadata("design:type", String)
], CreateAdminDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: "Password is required" }),
    (0, class_validator_1.MinLength)(6, { message: "Password must be at least 6 characters long" }),
    (0, class_validator_1.IsString)({ message: "Password must be a string" }),
    __metadata("design:type", String)
], CreateAdminDto.prototype, "password", void 0);
class CreateDealerDto {
}
exports.CreateDealerDto = CreateDealerDto;
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: "Name is required" }),
    (0, class_validator_1.IsString)({ message: "Name must be a string" }),
    (0, class_validator_1.MinLength)(3, { message: "Name must be at least 3 characters long" }),
    __metadata("design:type", String)
], CreateDealerDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: "Email is required" }),
    (0, class_validator_1.IsEmail)({}, { message: "Invalid email format" }),
    __metadata("design:type", String)
], CreateDealerDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: "Password is required" }),
    (0, class_validator_1.MinLength)(6, { message: "Password must be at least 6 characters long" }),
    (0, class_validator_1.IsString)({ message: "Password must be a string" }),
    __metadata("design:type", String)
], CreateDealerDto.prototype, "password", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: "Business name must be a string" }),
    __metadata("design:type", String)
], CreateDealerDto.prototype, "businessName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: "Contact phone must be a string" }),
    __metadata("design:type", String)
], CreateDealerDto.prototype, "contactPhone", void 0);
class UpdateDealerStatusDto {
}
exports.UpdateDealerStatusDto = UpdateDealerStatusDto;
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: "Status is required" }),
    (0, class_validator_1.IsIn)(["PENDING", "APPROVED", "REJECTED"], {
        message: "Status must be PENDING, APPROVED, or REJECTED",
    }),
    __metadata("design:type", String)
], UpdateDealerStatusDto.prototype, "status", void 0);
class DealerPriceItemDto {
}
exports.DealerPriceItemDto = DealerPriceItemDto;
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: "variantId is required" }),
    (0, class_validator_1.IsString)({ message: "variantId must be a string" }),
    __metadata("design:type", String)
], DealerPriceItemDto.prototype, "variantId", void 0);
__decorate([
    (0, class_validator_1.IsNumber)({}, { message: "customPrice must be a number" }),
    (0, class_validator_1.Min)(0, { message: "customPrice cannot be negative" }),
    __metadata("design:type", Number)
], DealerPriceItemDto.prototype, "customPrice", void 0);
class SetDealerPricesDto {
}
exports.SetDealerPricesDto = SetDealerPricesDto;
__decorate([
    (0, class_validator_1.IsArray)({ message: "prices must be an array" }),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => DealerPriceItemDto),
    __metadata("design:type", Array)
], SetDealerPricesDto.prototype, "prices", void 0);
