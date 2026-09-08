import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../../common/enums/role.enum';
import { UserStatus } from '../../../common/enums/user.enum';
import { CreateAddressDto } from './create-address.dto';
import { IsPhoneNumber } from '../../../common/validators/is-phone-number.validator';
import { IsStrongPassword } from '../../../common/validators/is-strong-password.validator';
import { NormalizeEmail } from '../../../common/transformers/normalize-email.transformer';
import {
  IsCodiceFiscale,
  IsPartitaIva,
  normalizeTaxId,
} from '../../../common/validators/is-italian-tax-id.validator';

export class CreateUserDto {
  @ApiProperty({ example: 'mario.rossi@email.com' })
  @NormalizeEmail()
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: 'StrongP@ss1',
    minLength: 8,
    description:
      'Initial password (min 8 chars, must include uppercase, lowercase, ' +
      'number and special character). The same rule the account holder is held ' +
      'to when they later change it themselves.',
  })
  @IsString()
  @IsStrongPassword()
  @IsNotEmpty()
  password: string;

  @ApiProperty({ example: 'Mario' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @ApiProperty({ example: 'Rossi' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

  @ApiPropertyOptional({ example: '+393331234567' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @IsPhoneNumber()
  phone?: string;

  @ApiProperty({ enum: UserRole, example: UserRole.PERSONAL })
  @IsEnum(UserRole)
  @IsNotEmpty()
  role: UserRole;

  @ApiPropertyOptional({ enum: UserStatus, example: UserStatus.ACTIVE })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({
    example: 'RSSMRA85T10A562S',
    description:
      "The account holder's own Codice Fiscale (16 chars). On a business " +
      'account that is the person signing for the company — the company itself ' +
      'is identified by `partitaIva`. *Required* when `role` is `business`.',
  })
  // Stored the way it is compared: upper case, no separators. Otherwise the
  // same code saved as 'rssmra…' and as 'RSSMRA…' are two different values,
  // and the app re-writes the profile on every request it fills in.
  @Transform(({ value }) =>
    typeof value === 'string' ? normalizeTaxId(value) : value,
  )
  // Required alongside the business role, optional for a personal account.
  // A business account is the one that cannot do without it: the switch
  // request files a direct debit mandate against a person, and an account that
  // arrives at that form with nothing here leaves the customer staring at a
  // mandatory field the sign-up never asked about. Personal accounts are asked
  // on the profile screen and on the request form itself.
  @ValidateIf(
    (o, value) => o.role === UserRole.BUSINESS || value !== undefined,
  )
  @IsString()
  @IsNotEmpty()
  // The check character, not just the shape. A shape-only rule here and a
  // full one on the case means the account is allowed to store a code the
  // direct debit step then refuses — which reads to the customer as the form
  // rejecting a tax code the app itself already accepted.
  @IsCodiceFiscale()
  codiceFiscale?: string;

  @ApiPropertyOptional({
    example: 'Rossi S.r.l.',
    description: 'Company legal name — *required* when `role` is `business`',
  })
  // Required alongside the role rather than optional, matching RegisterDto.
  // Left optional, a business account created without one was written with no
  // company row at all: `businessProfile: null` on a user the whole switching
  // flow reads a Partita IVA off.
  @ValidateIf((o) => o.role === UserRole.BUSINESS)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  companyName?: string;

  @ApiPropertyOptional({
    example: '12345678903',
    description:
      'Partita IVA — Italian VAT number, 11 digits — *required* when `role` is `business`',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? normalizeTaxId(value).replace(/^IT/, '') : value,
  )
  @ValidateIf((o) => o.role === UserRole.BUSINESS)
  @IsString()
  @IsNotEmpty()
  @IsPartitaIva()
  partitaIva?: string;

  @ApiPropertyOptional({ example: 'Mario Rossi' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  legalRepresentative?: string;

  @ApiPropertyOptional({ example: 'S.r.l.' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  companyType?: string;

  @ApiPropertyOptional({
    example: 'CEO / Founder',
    description:
      'Position the account holder occupies in the company. Free text: the ' +
      'mobile switch-to-business sheet offers a shortlist plus "Other".',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  jobRole?: string;

  @ApiPropertyOptional({ example: '35.11.00' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  atecoCode?: string;

  @ApiPropertyOptional({
    example: 'rossi@pec.it',
    description:
      "PEC — the company's certified email address (business only). A " +
      'business case with no explicit invoice address falls back to it.',
  })
  // Cleared by sending `null` or an empty string, and validated as an address
  // otherwise. `@IsOptional()` alone would let a null through but bounce the
  // empty string a form sends when the admin deletes what was in the field.
  @ValidateIf((_o, value) => value !== null && value !== '')
  @IsEmail()
  @MaxLength(255)
  pecEmail?: string | null;

  @ApiPropertyOptional({ type: () => CreateAddressDto, description: 'Primary address for the user' })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateAddressDto)
  address?: CreateAddressDto;
}
