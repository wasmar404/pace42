import { IsEmail, IsIn, IsOptional, IsString, Length, MinLength } from 'class-validator';

// DTOs (Data Transfer Objects) define what the API accepts.
// Global ValidationPipe will validate these automatically.
export class SignupDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
export class LoginDto {
  @IsEmail()
  email!: string;
  @IsString()
  password!: string;
}
export class VerifyEmailDto {
  @IsEmail()
  email!: string;
  @IsString()
  @Length(6, 6) //len must be 6 not more not less
  code!: string;
}
export class ResendVerificationDto {
  @IsEmail()
  email!: string;
}
export class ForgotPasswordDto {
  @IsEmail()
  email!: string;
}
export class ResetPasswordDto {
  // Opaque token received by email.
  @IsString()
  token!: string;

  // New password must be at least 8 chars.
  @IsString()
  @MinLength(8)
  newPassword!: string;
}

export class OAuthCallbackDto {
  @IsIn(['google', 'intra'])
  provider!: 'google' | 'intra';
  @IsString()
  code!: string;
  @IsOptional()
  @IsString()
  redirectUri?: string;
}