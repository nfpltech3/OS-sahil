import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { User } from '../database/entities/user.entity';
import { UserType } from '../database/entities/user-type.entity';
import { Application } from '../database/entities/application.entity';
import { UserAppAccess } from '../database/entities/user-app-access.entity';
import { ClientOrganization } from '../database/entities/client-organization.entity';
import { UserClientOrgMapping } from '../database/entities/user-client-org-mapping.entity';
import { Department } from '../database/entities/department.entity';

import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AssignAppAccessDto } from './dto/assign-app-access.dto';
import { CreateFromAppDto } from './dto/create-from-app.dto';
import { AppAccess } from '@nagarkot/shared-types';
import { WebhookService } from '../common/services/webhook.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    @InjectRepository(UserType)
    private userTypeRepo: Repository<UserType>,
    @InjectRepository(Application)
    private appRepo: Repository<Application>,
    @InjectRepository(UserAppAccess)
    private accessRepo: Repository<UserAppAccess>,
    @InjectRepository(ClientOrganization)
    private clientOrgRepo: Repository<ClientOrganization>,
    @InjectRepository(UserClientOrgMapping)
    private clientOrgMappingRepo: Repository<UserClientOrgMapping>,
    @InjectRepository(Department)
    private deptRepo: Repository<Department>,
    private webhookService: WebhookService,
  ) {}

  // ─── Get current user + allowed apps ─────────────────────────────
  async getMe(userId: string) {
    const user = await this.usersRepo.findOne({
      where: { id: userId, is_active: true },
      relations: [
        'userType',
        'department',
        'clientOrgMappings',
        'clientOrgMappings.organization',
      ],
    });
    if (!user) throw new NotFoundException('User not found');

    // Admins have unrestricted access to all active apps
    if (user.userType.slug === 'admin') {
      const allApps = await this.appRepo.find({ where: { is_active: true }, order: { name: 'ASC' } });
      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          user_type: user.userType.slug,
          org_id: null,
          department_id: user.department?.id ?? null,
          department_slug: user.department?.slug ?? null,
          department_name: user.department?.name ?? null,
        },
        allowed_apps: allApps.map((a) => ({
          slug: a.slug,
          name: a.name,
          url: a.url,
          icon_url: a.icon_url,
        })) as AppAccess[],
      };
    }

    const access = await this.accessRepo.find({
      where: { user: { id: userId }, is_enabled: true },
      relations: ['application'],
    });

    const allowed_apps: AppAccess[] = access
      .filter((a) => a.application.is_active)
      .map((a) => ({
        slug: a.application.slug as any,
        name: a.application.name,
        url: a.application.url,
        icon_url: a.application.icon_url,
      }));

    const org_id =
      user.clientOrgMappings?.[0]?.organization?.id ?? null;

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        user_type: user.userType.slug,
        org_id,
        department_id: user.department?.id ?? null,
        department_slug: user.department?.slug ?? null,
        department_name: user.department?.name ?? null,
      },
      allowed_apps,
    };
  }

  // ─── List all users ───────────────────────────────────────────────
  async findAll() {
    const users = await this.usersRepo.find({
      relations: [
        'userType',
        'clientOrgMappings',
        'clientOrgMappings.organization',
      ],
      order: { created_at: 'DESC' },
    });

    return users.map((u) => this.sanitize(u));
  }

  // ─── Get single user ──────────────────────────────────────────────
  async findOne(id: string) {
    const user = await this.usersRepo.findOne({
      where: { id },
      relations: [
        'userType',
        'appAccess',
        'appAccess.application',
        'clientOrgMappings',
        'clientOrgMappings.organization',
      ],
    });
    if (!user) throw new NotFoundException('User not found');
    return this.sanitize(user);
  }

  // ─── Create user ──────────────────────────────────────────────────
  async create(dto: CreateUserDto, createdById: string) {
    const existing = await this.usersRepo.findOne({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email already in use');

    const userType = await this.userTypeRepo.findOne({
      where: { slug: dto.user_type },
    });
    if (!userType) throw new BadRequestException('Invalid user type');

    if (dto.user_type === 'client' && !dto.org_id) {
      throw new BadRequestException('org_id is required for client users');
    }

    const password_hash = await bcrypt.hash(dto.password, 10);

    const user = this.usersRepo.create({
      email: dto.email,
      password_hash,
      name: dto.name,
      userType,
      is_active: true,
      is_team_lead: dto.is_team_lead ?? false,
    });

    if (dto.department_id) {
      const department = await this.deptRepo.findOne({
        where: { id: dto.department_id },
      });
      if (!department) throw new NotFoundException('Department not found');
      user.department = department;
    }

    const saved = await this.usersRepo.save(user);

    // Link client user to organization
    if (dto.user_type === 'client' && dto.org_id) {
      const org = await this.clientOrgRepo.findOne({
        where: { id: dto.org_id },
      });
      if (!org) throw new NotFoundException('Client organization not found');

      await this.clientOrgMappingRepo.save({
        user: saved,
        organization: org,
      });
    }

    return this.sanitize(saved);
  }

  // ─── Update user ──────────────────────────────────────────────────
  async update(id: string, dto: UpdateUserDto, requesterId: string) {
    if (dto.is_active === false && id === requesterId) {
      throw new BadRequestException('You cannot deactivate your own account');
    }
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    if (dto.name !== undefined) user.name = dto.name;
    if (dto.is_active !== undefined) user.is_active = dto.is_active;
    if (dto.is_team_lead !== undefined) user.is_team_lead = dto.is_team_lead;

    if (dto.department_id !== undefined) {
      if (dto.department_id === null) {
        user.department = null;
      } else {
        const department = await this.deptRepo.findOne({
          where: { id: dto.department_id },
        });
        if (!department) throw new NotFoundException('Department not found');
        user.department = department;
      }
    }

    const saved = await this.usersRepo.save(user);

    // Fire webhook if active status changed
    if (dto.is_active !== undefined) {
      const event = dto.is_active ? 'user.reactivated' : 'user.deactivated';
      // Fire and forget — don't slow down the response
      this.webhookService.notifyApps(id, saved.email, event).catch((err) =>
        console.warn('[UsersService] Webhook notification failed:', err),
      );
    }

    return this.sanitize(
      (await this.usersRepo.findOne({
        where: { id: saved.id },
        relations: ['userType', 'department', 'clientOrgMappings', 'clientOrgMappings.organization'],
      }))!
    );
  }

  // ─── Change own password ──────────────────────────────────────────
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) throw new BadRequestException('Current password is incorrect');

    user.password_hash = await bcrypt.hash(newPassword, 10);
    await this.usersRepo.save(user);

    return { message: 'Password changed successfully' };
  }

  // ─── Assign / revoke app access ───────────────────────────────────
  async assignAppAccess(
    userId: string,
    dto: AssignAppAccessDto,
    grantedById: string,
  ) {
    if (userId === grantedById) {
      throw new BadRequestException('You cannot manage your own app access');
    }
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const app = await this.appRepo.findOne({
      where: { slug: dto.app_slug, is_active: true },
    });
    if (!app) throw new NotFoundException('Application not found');

    const existing = await this.accessRepo.findOne({
      where: {
        user: { id: userId },
        application: { id: app.id },
      },
    });

    if (existing) {
      existing.is_enabled = dto.is_enabled;
      existing.is_app_admin = dto.is_app_admin ?? existing.is_app_admin ?? false;
      await this.accessRepo.save(existing);
    } else {
      await this.accessRepo.save({
        user,
        application: app,
        is_enabled: dto.is_enabled,
        is_app_admin: dto.is_app_admin ?? false,
        granted_by: grantedById,
      });
    }

    return {
      message: `Access to ${app.name} ${dto.is_enabled ? 'granted' : 'revoked'}`,
    };
  }

  // ─── Get app access list for a user ──────────────────────────────
  async getAppAccess(userId: string) {
    const access = await this.accessRepo.find({
      where: { user: { id: userId } },
      relations: ['application'],
    });

    return access.map((a) => ({
      app_slug: a.application.slug,
      app_name: a.application.name,
      is_enabled: a.is_enabled,
      is_app_admin: a.is_app_admin,
      granted_at: a.granted_at,
    }));
  }

  // ─── Delete user ──────────────────────────────────────────────────
  async delete(id: string, requesterId: string) {
    if (id === requesterId) {
      throw new BadRequestException('You cannot delete your own account');
    }
    const user = await this.usersRepo.findOne({
      where: { id },
      relations: ['userType'],
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.userType?.slug === 'admin') {
      throw new BadRequestException('Admin accounts cannot be deleted');
    }

    // Notify all apps BEFORE deleting (access records still exist at this point)
    await this.webhookService.notifyApps(id, user.email, 'user.deleted');

    // Remove FK-constrained child rows before deleting the user
    await this.accessRepo.delete({ user: { id } });
    await this.clientOrgMappingRepo.delete({ user: { id } });

    await this.usersRepo.remove(user);
    return { message: 'User deleted' };
  }

  // ─── Strip password_hash before returning ────────────────────────
  private sanitize(user: User) {
    const { password_hash, ...safe } = user as any;
    return safe;
  }

  // ─── Get full profile (for internal API) ─────────────────────────
  async getProfile(id: string) {
    const user = await this.usersRepo.findOne({
      where: { id },
      relations: ['userType', 'department', 'clientOrgMappings', 'clientOrgMappings.organization'],
    });
    if (!user) throw new NotFoundException('User not found');
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      user_type: user.userType.slug,
      is_active: user.is_active,
      department_id: user.department?.id ?? null,
      department_slug: user.department?.slug ?? null,
      department_name: user.department?.name ?? null,
      org_id: user.clientOrgMappings?.[0]?.organization?.id ?? null,
      org_name: user.clientOrgMappings?.[0]?.organization?.name ?? null,
    };
  }

  // ─── Create user from an app (for internal API) ───────────────────
  async createFromApp(dto: CreateFromAppDto) {
    // Check if user already exists by email
    let user = await this.usersRepo.findOne({ where: { email: dto.email } });

    if (!user) {
      const employeeType = await this.userTypeRepo.findOne({
        where: { slug: 'employee' },
      });
      const department = dto.department_slug
        ? await this.deptRepo.findOne({ where: { slug: dto.department_slug } })
        : null;

      const password_hash = await bcrypt.hash(dto.password, 10);
      user = this.usersRepo.create({
        email: dto.email,
        name: dto.name,
        password_hash,
        userType: employeeType!,
        department: department ?? undefined,
        is_active: true,
      });
      user = await this.usersRepo.save(user);
    }

    // Grant access to the requesting app (is_app_admin = false by default)
    const app = await this.appRepo.findOne({ where: { slug: dto.app_slug } });
    if (app) {
      const exists = await this.accessRepo.findOne({
        where: { user: { id: user.id }, application: { id: app.id } },
      });
      if (!exists) {
        await this.accessRepo.save({
          user,
          application: app,
          is_enabled: true,
          is_app_admin: false,
          granted_by: dto.requested_by_os_user_id,
        });
      }
    }

    return { os_user_id: user.id, email: user.email, name: user.name };
  }

  // ─── List active departments ──────────────────────────────────────
  async getDepartments() {
    return this.deptRepo.find({ where: { is_active: true } });
  }

  // ─── Create department ────────────────────────────────────────────
  async createDepartment(name: string) {
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    const existing = await this.deptRepo.findOne({ where: { slug } });
    if (existing)
      throw new ConflictException(
        'A department with this name already exists',
      );
    return this.deptRepo.save(
      this.deptRepo.create({ name: name.trim(), slug, is_active: true, default_app_slugs: [] }),
    );
  }

  // ─── Update department ────────────────────────────────────────────
  async updateDepartment(id: string, name: string) {
    const dept = await this.deptRepo.findOne({ where: { id } });
    if (!dept) throw new NotFoundException('Department not found');
    dept.name = name.trim();
    return this.deptRepo.save(dept);
  }

  // ─── Delete department ────────────────────────────────────────────
  async deleteDepartment(id: string) {
    const dept = await this.deptRepo.findOne({
      where: { id },
      relations: ['users'],
    });
    if (!dept) throw new NotFoundException('Department not found');
    if (dept.users && dept.users.length > 0) {
      throw new BadRequestException(
        'Cannot delete a department that has users assigned. Reassign users first.',
      );
    }
    await this.deptRepo.remove(dept);
    return { message: 'Department deleted' };
  }

  // ─── List active applications ─────────────────────────────────
  async getApplications() {
    return this.appRepo.find({
      where: { is_active: true },
      select: ['id', 'slug', 'name', 'url', 'icon_url'],
      order: { name: 'ASC' },
    });
  }}
