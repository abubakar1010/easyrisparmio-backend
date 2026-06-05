import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { AddressType } from '../../../common/enums/address.enum';
import { User } from './user.entity';

@Entity('user_addresses')
export class UserAddress extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'address_type', type: 'enum', enum: AddressType, default: AddressType.RESIDENTIAL })
  addressType: AddressType;

  @Column({ name: 'street_address', type: 'varchar', length: 255 })
  streetAddress: string;

  @Column({ type: 'varchar', length: 100 })
  city: string;

  @Column({ type: 'varchar', length: 2, nullable: true })
  province: string | null;

  @Column({ name: 'postal_code', type: 'varchar', length: 10 })
  postalCode: string;

  @Column({ type: 'varchar', length: 2, default: 'IT' })
  country: string;

  @Column({ name: 'is_primary', type: 'boolean', default: false })
  isPrimary: boolean;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
