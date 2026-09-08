import { IsOptional, IsString, IsBoolean, MaxLength, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { POSTAL_CODE_PATTERN } from '../../../common/utils/address.utils';
import { UserRole } from '../../../common/enums/role.enum';

/**
 * The three addresses a case carries, each as the same five fields: street,
 * civic number, city, postal code (CAP) and province.
 *
 * Declared once and extended by both `CreateCaseDto` and `UpdateCaseDto` so the
 * app writing an address and the admin correcting it are held to identical
 * rules — a CAP that is not five digits is refused on either path.
 *
 * The two `sameAsSupply` flags are the relationship, not a hint: while one is
 * true the matching block is a copy of the supply address and the service keeps
 * it that way, so the case can never claim a residence the customer said was
 * the same while holding something else.
 */
export class CaseAddressesDto {
  // ── Supply — where the energy is delivered ──

  @ApiPropertyOptional({ description: 'Supply address street', example: 'Via Roma' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  supplyStreet?: string;

  @ApiPropertyOptional({ description: 'Supply address street number', example: '10' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  supplyStreetNumber?: string;

  @ApiPropertyOptional({ description: 'Supply address city', example: 'Milano' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  supplyCity?: string;

  @ApiPropertyOptional({ description: 'Supply address postal code (CAP)', example: '20100' })
  @IsOptional()
  @IsString()
  @Matches(POSTAL_CODE_PATTERN, { message: 'supplyPostalCode must be a 5-digit CAP' })
  supplyPostalCode?: string;

  @ApiPropertyOptional({ description: 'Supply address province (free text)', example: 'MI' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  supplyProvince?: string;

  // ── Residence, or the registered office — the account holder's own address ──
  //
  // One pair of columns for both, because they are the same thing in the same
  // place on the same form: the address the contract is headed with, as opposed
  // to where the energy is delivered. What it is called depends on who is
  // filing — a person has a residence, a company has a sede legale — so the
  // wording comes from `caseAddressBlockLabels` rather than from these names.

  @ApiPropertyOptional({ description: 'Whether the residence address is the same as the supply address. While true the residence fields are kept as a copy of the supply address.', example: true })
  @IsOptional()
  @IsBoolean()
  residentialSameAsSupply?: boolean;

  @ApiPropertyOptional({ description: 'Residence address street', example: 'Via Verdi' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  residentialStreet?: string;

  @ApiPropertyOptional({ description: 'Residence address street number', example: '25' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  residentialStreetNumber?: string;

  @ApiPropertyOptional({ description: 'Residence address city', example: 'Milano' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  residentialCity?: string;

  @ApiPropertyOptional({ description: 'Residence address postal code (CAP)', example: '20100' })
  @IsOptional()
  @IsString()
  @Matches(POSTAL_CODE_PATTERN, { message: 'residentialPostalCode must be a 5-digit CAP' })
  residentialPostalCode?: string;

  @ApiPropertyOptional({ description: 'Residence address province (free text)', example: 'MI' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  residentialProvince?: string;

  // ── Shipping — where paper invoices are posted ──

  @ApiPropertyOptional({ description: 'Whether paper invoices go to the supply address. While true the shipping fields are kept as a copy of the supply address.', example: true })
  @IsOptional()
  @IsBoolean()
  shippingSameAsSupply?: boolean;

  @ApiPropertyOptional({ description: 'Shipping address street', example: 'Via Dante' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  shippingStreet?: string;

  @ApiPropertyOptional({ description: 'Shipping address street number', example: '7' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  shippingStreetNumber?: string;

  @ApiPropertyOptional({ description: 'Shipping address city', example: 'Milano' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  shippingCity?: string;

  @ApiPropertyOptional({ description: 'Shipping address postal code (CAP)', example: '20100' })
  @IsOptional()
  @IsString()
  @Matches(POSTAL_CODE_PATTERN, { message: 'shippingPostalCode must be a 5-digit CAP' })
  shippingPostalCode?: string;

  @ApiPropertyOptional({ description: 'Shipping address province (free text)', example: 'MI' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  shippingProvince?: string;
}

/** The three blocks, and the five fields each is stored as. */
export const CASE_ADDRESS_BLOCKS = ['supply', 'residential', 'shipping'] as const;
export const CASE_ADDRESS_FIELDS = [
  'Street', 'StreetNumber', 'City', 'PostalCode', 'Province',
] as const;

export type CaseAddressBlock = (typeof CASE_ADDRESS_BLOCKS)[number];

/**
 * How each block is named to a human — on the case timeline, for instance.
 *
 * The middle block is whatever the account holder's own address is, and that
 * depends on the account: a person has a residence, a company has a registered
 * office and no residence at all. The columns stay named `residential_*`
 * because renaming them would rewrite the schema for a wording change, but
 * nothing a customer or an admin reads should call a company's sede legale its
 * "residence".
 */
export function caseAddressBlockLabels(
  role?: UserRole | null,
): Record<CaseAddressBlock, string> {
  return {
    supply: 'Supply address',
    residential:
      role === UserRole.BUSINESS ? 'Registered office' : 'Residential address',
    shipping: 'Shipping address',
  };
}
