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
exports.ResetPasswordDto = exports.ForgotPasswordDto = exports.VerifyEmailDto = exports.SigninDto = exports.RequestRegistrationOtpDto = exports.RegisterDto = void 0;
const class_validator_1 = require("class-validator");
class RegisterDto {
}
exports.RegisterDto = RegisterDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({
        message: "Name is required",
    }),
    (0, class_validator_1.MinLength)(2, {
        message: "Name must be at least 2 characters long",
    }),
    __metadata("design:type", String)
], RegisterDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsEmail)(),
    (0, class_validator_1.IsNotEmpty)({
        message: "Email is required",
    }),
    __metadata("design:type", String)
], RegisterDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({
        message: "Phone number is required",
    }),
    (0, class_validator_1.Matches)(/^[0-9()+\-\s]{7,20}$/, {
        message: "Phone number must be 7-20 characters and contain only valid digits/symbols",
    }),
    __metadata("design:type", String)
], RegisterDto.prototype, "phone", void 0);
__decorate([
    (0, class_validator_1.MinLength)(8, {
        message: "Password must be at least 8 characters long",
    }),
    (0, class_validator_1.Matches)(/[A-Z]/, {
        message: "Password must contain at least one uppercase letter",
    }),
    (0, class_validator_1.Matches)(/[a-z]/, {
        message: "Password must contain at least one lowercase letter",
    }),
    (0, class_validator_1.Matches)(/[0-9]/, {
        message: "Password must contain at least one number",
    }),
    (0, class_validator_1.Matches)(/[!@#$%^&*]/, {
        message: "Password must contain at least one special character (!@#$%^&*)",
    }),
    __metadata("design:type", String)
], RegisterDto.prototype, "password", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^\d{6}$/, {
        message: "Email OTP must be a valid 6-digit code",
    }),
    __metadata("design:type", String)
], RegisterDto.prototype, "emailOtpCode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^\d{6}$/, {
        message: "Phone OTP must be a valid 6-digit code",
    }),
    __metadata("design:type", String)
], RegisterDto.prototype, "phoneOtpCode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], RegisterDto.prototype, "requestDealerAccess", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RegisterDto.prototype, "businessName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RegisterDto.prototype, "contactPhone", void 0);
class RequestRegistrationOtpDto {
}
exports.RequestRegistrationOtpDto = RequestRegistrationOtpDto;
__decorate([
    (0, class_validator_1.IsEmail)(),
    (0, class_validator_1.IsNotEmpty)({
        message: "Email is required",
    }),
    __metadata("design:type", String)
], RequestRegistrationOtpDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({
        message: "Phone number is required",
    }),
    (0, class_validator_1.Matches)(/^[0-9()+\-\s]{7,20}$/, {
        message: "Phone number must be 7-20 characters and contain only valid digits/symbols",
    }),
    __metadata("design:type", String)
], RequestRegistrationOtpDto.prototype, "phone", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(["USER_PORTAL", "DEALER_PORTAL"]),
    __metadata("design:type", String)
], RequestRegistrationOtpDto.prototype, "purpose", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], RequestRegistrationOtpDto.prototype, "requestDealerAccess", void 0);
class SigninDto {
}
exports.SigninDto = SigninDto;
__decorate([
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], SigninDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({
        message: "Password is required",
    }),
    __metadata("design:type", String)
], SigninDto.prototype, "password", void 0);
class VerifyEmailDto {
}
exports.VerifyEmailDto = VerifyEmailDto;
__decorate([
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], VerifyEmailDto.prototype, "emailVerificationToken", void 0);
class ForgotPasswordDto {
}
exports.ForgotPasswordDto = ForgotPasswordDto;
__decorate([
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], ForgotPasswordDto.prototype, "email", void 0);
class ResetPasswordDto {
}
exports.ResetPasswordDto = ResetPasswordDto;
__decorate([
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], ResetPasswordDto.prototype, "token", void 0);
__decorate([
    (0, class_validator_1.MinLength)(8, {
        message: "Password must be at least 8 characters long",
    }),
    (0, class_validator_1.Matches)(/[A-Z]/, {
        message: "Password must contain at least one uppercase letter",
    }),
    (0, class_validator_1.Matches)(/[a-z]/, {
        message: "Password must contain at least one lowercase letter",
    }),
    (0, class_validator_1.Matches)(/[0-9]/, {
        message: "Password must contain at least one number",
    }),
    (0, class_validator_1.Matches)(/[!@#$%^&*]/, {
        message: "Password must contain at least one special character (!@#$%^&*)",
    }),
    __metadata("design:type", String)
], ResetPasswordDto.prototype, "newPassword", void 0);
