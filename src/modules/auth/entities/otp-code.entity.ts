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
@Index(['userId', 'type', 'used'])
export class OtpCode extends BaseEntity {
  /**
   * bcrypt hash of the 6-digit code — never the code itself.
   *
   * A password-reset OTP is a bearer credential for the account, so a leaked
   * database dump (or an over-broad admin query, or a log of a row) would hand
   * over every account with a reset in flight. bcrypt rather than a plain
   * digest because the code space is only 10^6: any unsalted hash of it is
   * reversible by brute force in milliseconds.
   */
  @Column({ name: 'code_hash', type: 'varchar', length: 120 })
  codeHash: string;

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

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;
}
