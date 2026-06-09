import {
  Entity,
  Column,
  OneToOne,
  OneToMany,
  Index,
  DeleteDateColumn,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { UserRole } from '../../../common/enums/role.enum';
import { UserStatus, AuthProvider } from '../../../common/enums/user.enum';
import { BusinessProfile } from './business-profile.entity';
import { EnergyBill } from '../../bills/entities/energy-bill.entity';
import { SupportTicket } from '../../support/entities/support-ticket.entity';
import { Notification } from '../../notifications/entities/notification.entity';

@Entity('users')
@Index(['role', 'status'])
export class User extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255, nullable: true })
  passwordHash: string | null;

  @Column({ name: 'first_name', type: 'varchar', length: 100 })
  firstName: string;

  @Column({ name: 'last_name', type: 'varchar', length: 100 })
  lastName: string;

  @Column({ name: 'codice_fiscale', type: 'varchar', length: 16, nullable: true })
  codiceFiscale: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  avatar: string;

  @Column({
    name: 'auth_provider',
    type: 'enum',
    enum: AuthProvider,
    default: AuthProvider.LOCAL,
  })
  authProvider: AuthProvider;

  @Column({ name: 'firebase_uid', type: 'varchar', length: 128, nullable: true, unique: true })
  firebaseUid: string | null;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.PERSONAL,
  })
  role: UserRole;

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.PENDING_VERIFICATION,
  })
  status: UserStatus;

  @Column({ name: 'email_verified', type: 'boolean', default: false })
  emailVerified: boolean;

  @Column({ name: 'phone_verified', type: 'boolean', default: false })
  phoneVerified: boolean;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;

  @OneToOne(() => BusinessProfile, (profile) => profile.user, {
    cascade: true,
    eager: false,
  })
  businessProfile: BusinessProfile;

  @OneToMany(() => EnergyBill, (bill) => bill.user)
  bills: EnergyBill[];

  @OneToMany('SwitchCase', 'user')
  cases: any[];

  @OneToMany(() => SupportTicket, (ticket) => ticket.user)
  tickets: SupportTicket[];

  @OneToMany(() => Notification, (notification) => notification.user)
  notifications: Notification[];
}
