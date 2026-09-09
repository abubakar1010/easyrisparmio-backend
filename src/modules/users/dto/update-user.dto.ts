import { PartialType, OmitType, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { CreateUserDto } from './create-user.dto';
import {
  IsCodiceFiscale,
  IsPartitaIva,
  normalizeTaxId,
} from '../../../common/validators/is-italian-tax-id.validator';

/**
 * The two tax identifiers are omitted from the base and declared again here,
 * shape-checked but not role-checked.
 *
 * On `CreateUserDto` the rule reads `role` off the payload, which a create
 * always carries. A PATCH does not: the app's own profile save sends a company's
 * Partita IVA with no role at all, and inheriting the create rule would read
 * that as a personal account offering a VAT number and refuse it. So which of
 * the two the account may carry is settled in `UsersService` against the role
 * actually stored — see `assertTaxIdsMatchRole` — and what stays here is the
 * check every tax ID in this codebase gets: the check character, not the shape.
 */
export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['password', 'codiceFiscale', 'partitaIva'] as const),
) {
  @ApiPropertyOptional({
    example: 'RSSMRA85T10A562S',
    description:
      "The account holder's own Codice Fiscale — a personal account only. " +
      'Refused on a business account, which is identified by its Partita IVA.',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? normalizeTaxId(value) : value,
  )
  @IsCodiceFiscale()
  codiceFiscale?: string;

  @ApiPropertyOptional({
    example: '12345678903',
    description:
      'Partita IVA — a business account only. Refused on a personal account, ' +
      'which is identified by its Codice Fiscale.',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? normalizeTaxId(value).replace(/^IT/, '') : value,
  )
  @IsPartitaIva()
  partitaIva?: string;

  @ApiPropertyOptional({ example: '/uploads/avatar-uuid.jpg', description: 'Avatar image URL' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatar?: string;
}
