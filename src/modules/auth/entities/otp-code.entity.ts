import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { OtpType } from '../../../common/enums/user.enum';
import { User } from '../../users/entities/user.entity';

@Entity('otp_codes')
export class OtpCode extends BaseEntity {
  @Column({ type: 'varchar', length: 6 })
  code: string;

  @Index()
  @Column({ type: 'enum', enum: OtpType })
  type: OtpType;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'boolean', default: false })
  used: boolean;

  @Column({ type: 'smallint', default: 0 })
  attempts: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;
}
