import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserType } from './user-type.entity';
import { UserAppAccess } from './user-app-access.entity';
import { UserClientOrgMapping } from './user-client-org-mapping.entity';
import { Department } from './department.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password_hash: string;

  @Column()
  name: string;

  @ManyToOne(() => UserType, (ut) => ut.users, { eager: true })
  @JoinColumn({ name: 'user_type_id' })
  userType: UserType;

  @ManyToOne(() => Department, (dept) => dept.users, { nullable: true, eager: true })
  @JoinColumn({ name: 'department_id' })
  department: Department | null;

  @Column({ default: true })
  is_active: boolean;

  @Column({ default: false })
  is_team_lead: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => UserAppAccess, (access) => access.user)
  appAccess: UserAppAccess[];

  @OneToMany(() => UserClientOrgMapping, (mapping) => mapping.user)
  clientOrgMappings: UserClientOrgMapping[];
}
