# TARGETED AUDIT: OS PLATFORM RECENT CHANGES
**Date:** 2026-03-10  
**Status:** COMPLETE  
**Baseline:** Compared against `AUDIT.md` (dated 2026-03-09) and current live codebase.

---

## 1. USERS CONTROLLER — NEW ENDPOINTS
The `users.controller.ts` now contains several new endpoints for satellite applications and metadata fetching.

### Full Current Code: `users.controller.ts`
```typescript
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AssignAppAccessDto } from './dto/assign-app-access.dto';
import { CreateFromAppDto } from './dto/create-from-app.dto';
import { InternalApiGuard } from '../common/guards/internal-api.guard';
import { Public } from '../common/decorators/public.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  // GET /users/me — any authenticated user
  @Get('me')
  me(@Request() req) {
    return this.usersService.getMe(req.user.id);
  }

  // GET /users/departments — any authenticated user
  @Get('departments')
  getDepartments() {
    return this.usersService.getDepartments();
  }

  // GET /users/internal/departments — internal API only
  @Get('internal/departments')
  @Public()
  @UseGuards(InternalApiGuard)
  getInternalDepartments() {
    return this.usersService.getDepartments();
  }

  // POST /users/departments — admin only
  @Post('departments')
  @UseGuards(RolesGuard)
  @Roles('admin')
  createDepartment(@Body() body: { name: string }) {
    return this.usersService.createDepartment(body.name);
  }

  // PATCH /users/departments/:id — admin only
  @Patch('departments/:id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  updateDepartment(@Param('id') id: string, @Body() body: { name: string }) {
    return this.usersService.updateDepartment(id, body.name);
  }

  // DELETE /users/departments/:id — admin only
  @Delete('departments/:id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  deleteDepartment(@Param('id') id: string) {
    return this.usersService.deleteDepartment(id);
  }

  // GET /users/applications — any authenticated user
  @Get('applications')
  getApplications() {
    return this.usersService.getApplications();
  }

  // POST /users/me/change-password — any authenticated user
  @Post('me/change-password')
  changePassword(
    @Request() req,
    @Body() body: { current_password: string; new_password: string },
  ) {
    return this.usersService.changePassword(
      req.user.id,
      body.current_password,
      body.new_password,
    );
  }

  // GET /users — admin only
  @Get()
  @UseGuards(RolesGuard)
  @Roles('admin')
  findAll() {
    return this.usersService.findAll();
  }

  // GET /users/:id — admin only
  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  // GET /users/:id/profile — internal API only
  @Get(':id/profile')
  @Public()
  @UseGuards(InternalApiGuard)
  getProfile(@Param('id') id: string) {
    return this.usersService.getProfile(id);
  }

  // POST /users — admin only
  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin')
  create(@Body() dto: CreateUserDto, @Request() req) {
    return this.usersService.create(dto, req.user.id);
  }

  // PATCH /users/:id — admin only
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @Request() req) {
    return this.usersService.update(id, dto, req.user.id);
  }

  // DELETE /users/:id — admin only
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  delete(@Param('id') id: string, @Request() req) {
    return this.usersService.delete(id, req.user.id);
  }

  // POST /users/:id/app-access — admin only
  @Post(':id/app-access')
  @UseGuards(RolesGuard)
  @Roles('admin')
  assignAppAccess(
    @Param('id') userId: string,
    @Body() dto: AssignAppAccessDto,
    @Request() req,
  ) {
    return this.usersService.assignAppAccess(userId, dto, req.user.id);
  }

  // GET /users/:id/app-access — admin only
  @Get(':id/app-access')
  @UseGuards(RolesGuard)
  @Roles('admin')
  getAppAccess(@Param('id') userId: string) {
    return this.usersService.getAppAccess(userId);
  }

  // POST /users/from-app — internal API only
  @Post('from-app')
  @Public()
  @UseGuards(InternalApiGuard)
  createFromApp(@Body() dto: CreateFromAppDto) {
    return this.usersService.createFromApp(dto);
  }
}
```

### New Endpoints Summary
| Objective | Endpoint | Method in Controller | Service Called | Guards / Auth |
|---|---|---|---|---|
| **Department List** | `GET /users/internal/departments` | `getInternalDepartments()` | `this.usersService.getDepartments()` | `@Public()`, `InternalApiGuard` (API Key) |
| **App Metadata** | `GET /users/applications` | `getApplications()` | `this.usersService.getApplications()` | `JwtAuthGuard` |
| **Profile Detail** | `GET /users/:id/profile` | `getProfile()` | `this.usersService.getProfile(id)` | `@Public()`, `InternalApiGuard` (API Key) |
| **External Creation** | `POST /users/from-app` | `createFromApp()` | `this.usersService.createFromApp(dto)` | `@Public()`, `InternalApiGuard` (API Key) |

**Note:** There is **NO** endpoint for returning relevant Client Organization lists to satellite apps yet.

---

## 2. USERS SERVICE — NEW METHODS
These were added or modified to support webhooks and internal app integrations.

### `getProfile(id: string)`
```typescript
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
```

### `createFromApp(dto: CreateFromAppDto)`
```typescript
  async createFromApp(dto: CreateFromAppDto) {
    let user = await this.usersRepo.findOne({ where: { email: dto.email } });
    if (!user) {
      const employeeType = await this.userTypeRepo.findOne({ where: { slug: 'employee' } });
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
    const app = await this.appRepo.findOne({ where: { slug: dto.app_slug } });
    if (app) {
      const exists = await this.accessRepo.findOne({ where: { user: { id: user.id }, application: { id: app.id } } });
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
```

### `getDepartments()`
```typescript
  async getDepartments() {
    return this.deptRepo.find({ where: { is_active: true } });
  }
```

---

## 3. DATABASE SCHEMA CHANGES

### `departments` table — `department.entity.ts`
```typescript
@Entity('departments')
export class Department {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  slug: string;

  @Column()
  name: string;

  @Column('simple-array', { nullable: true })
  default_app_slugs: string[];

  @Column({ default: true })
  is_active: boolean;

  @OneToMany(() => User, (user) => user.department)
  users: User[];
}
```

### `client_organizations` table — `client-organization.entity.ts`
```typescript
@Entity('client_organizations')
export class ClientOrganization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  country: string;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @OneToMany(() => UserClientOrgMapping, (mapping) => mapping.organization)
  userMappings: UserClientOrgMapping[];
}
```

### `applications` table — `application.entity.ts`
Added `webhook_url` for outbound user lifecycle notifications.
```typescript
@Entity('applications')
export class Application {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  slug: string;

  @Column()
  name: string;

  @Column()
  url: string;

  @Column({ type: 'varchar', nullable: true })
  icon_url: string | null;

  @Column({ type: 'varchar', nullable: true })
  webhook_url: string | null;

  @Column({ default: true })
  is_active: boolean;

  @OneToMany(() => UserAppAccess, (access) => access.application)
  userAccess: UserAppAccess[];
}
```

---

## 4. SEED CHANGES
Expanded to include all active apps, departments with default permissions, and forced admin app-admin flags.

### Full Current Code: `seed.ts`
```typescript
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import { UserType } from './entities/user-type.entity';
import { User } from './entities/user.entity';
import { Department } from './entities/department.entity';
import { Application } from './entities/application.entity';
import { UserAppAccess } from './entities/user-app-access.entity';
import { ClientOrganization } from './entities/client-organization.entity';
import { UserClientOrgMapping } from './entities/user-client-org-mapping.entity';
import { SsoToken } from './entities/sso-token.entity';

dotenv.config();

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  entities: [UserType, User, Department, Application, UserAppAccess, ClientOrganization, UserClientOrgMapping, SsoToken],
  synchronize: true,
});

async function seed() {
  await AppDataSource.initialize();
  console.log('✅ Database connected');

  const userTypeRepo = AppDataSource.getRepository(UserType);
  await userTypeRepo.upsert([
    { slug: 'employee', label: 'Employee' },
    { slug: 'client',   label: 'Client'   },
    { slug: 'admin',    label: 'Admin'    },
  ], { conflictPaths: ['slug'], skipUpdateIfNoValuesChanged: true });

  const appRepo = AppDataSource.getRepository(Application);
  await appRepo.upsert([
    { slug: 'superfreight', name: 'Super Freight', url: 'http://localhost:3002', webhook_url: 'http://localhost:3002/webhooks/os', is_active: true },
    { slug: 'tez', name: 'Tez', url: 'http://localhost:3003', webhook_url: 'http://localhost:3003/webhooks/os', is_active: true },
    { slug: 'trainings', name: 'Trainings', url: 'http://localhost:5173', webhook_url: 'http://localhost:8000/webhooks/os', is_active: true },
    { slug: 'shakti', name: 'Shakti', url: 'http://localhost:3004', webhook_url: 'http://localhost:3004/webhooks/os', is_active: false },
  ], { conflictPaths: ['slug'], skipUpdateIfNoValuesChanged: false });

  const deptRepo = AppDataSource.getRepository(Department);
  await deptRepo.upsert([
    { slug: 'operations', name: 'Operations', default_app_slugs: ['superfreight'], is_active: true },
    { slug: 'sales',      name: 'Sales',      default_app_slugs: ['superfreight', 'tez'], is_active: true },
    { slug: 'finance',    name: 'Finance',    default_app_slugs: ['tez'], is_active: true },
    { slug: 'hr',         name: 'HR',         default_app_slugs: ['trainings'], is_active: true },
  ], { conflictPaths: ['slug'], skipUpdateIfNoValuesChanged: true });

  const adminType = await userTypeRepo.findOneOrFail({ where: { slug: 'admin' } });
  const userRepo = AppDataSource.getRepository(User);
  const existingAdmin = await userRepo.findOne({ where: { email: 'admin@nagarkot.com' } });

  if (!existingAdmin) {
    const password_hash = await bcrypt.hash('Admin@1234', 10);
    const admin = userRepo.create({ email: 'admin@nagarkot.com', password_hash, name: 'Admin', userType: adminType, is_active: true });
    await userRepo.save(admin);
  } else {
    existingAdmin.userType = adminType;
    await userRepo.save(existingAdmin);
  }

  const accessRepo = AppDataSource.getRepository(UserAppAccess);
  const adminUser = await userRepo.findOneOrFail({ where: { email: 'admin@nagarkot.com' } });
  const allApps = await appRepo.find();

  for (const app of allApps) {
    const existing = await accessRepo.findOne({ where: { user: { id: adminUser.id }, application: { id: app.id } } });
    if (existing) {
      existing.is_enabled = true;
      existing.is_app_admin = true;
      await accessRepo.save(existing);
    } else {
      await accessRepo.save({ user: adminUser, application: app, is_enabled: true, is_app_admin: true, granted_by: adminUser.id });
    }
  }

  await accessRepo.update({ user: { id: adminUser.id } }, { is_app_admin: true, is_enabled: true });
  await AppDataSource.destroy();
  console.log('🎉 Seed complete');
}
seed().catch((err) => { console.error('❌ Seed failed:', err); process.exit(1); });
```

---

## 5. SHARED TYPES

### `packages/shared-types/src/sso.types.ts`
```typescript
export interface SsoPayload {
  token_id: string;
  user_id: string;
  email: string;
  name: string;
  user_type: 'employee' | 'client';
  department_slug: string | null;
  department_name: string | null;
  is_app_admin: boolean;
  org_id: string | null;
  org_name: string | null;
  iat: number;
  exp: number;
}
```

---

## 6. OTHER CHANGED / NEW FILES

### `apps/os-backend/src/common/services/webhook.service.ts` (NEW)
```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserAppAccess } from '../../database/entities/user-app-access.entity';

export type OsWebhookEvent = 'user.deactivated' | 'user.deleted' | 'user.reactivated';

export interface OsWebhookPayload {
  event: OsWebhookEvent;
  os_user_id: string;
  email: string;
  timestamp: string;
}

@Injectable()
export class WebhookService {
  constructor(private config: ConfigService, @InjectRepository(UserAppAccess) private accessRepo: Repository<UserAppAccess>) {}

  async notifyApps(osUserId: string, email: string, event: OsWebhookEvent): Promise<void> {
    const records = await this.accessRepo.find({ where: { user: { id: osUserId } }, relations: ['application'] });
    const internalKey = this.config.get<string>('INTERNAL_API_KEY') ?? '';
    const payload: OsWebhookPayload = { event, os_user_id: osUserId, email, timestamp: new Date().toISOString() };

    const promises = records.filter((r) => r.application?.webhook_url).map(async (r) => {
      try {
        await fetch(r.application.webhook_url!, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-internal-key': internalKey },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(5000),
        });
      } catch (err) { console.warn(`[WebhookService] Notification failed for ${r.application.slug}`); }
    });
    await Promise.allSettled(promises);
  }
}
```

### `apps/os-backend/src/common/guards/internal-api.guard.ts` (NEW)
```typescript
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class InternalApiGuard implements CanActivate {
  constructor(private config: ConfigService) {}
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-internal-key'];
    const validKey = this.config.get<string>('INTERNAL_API_KEY');
    if (!apiKey || apiKey !== validKey) throw new UnauthorizedException('Invalid internal API key');
    return true;
  }
}
```

### `apps/os-backend/src/apps/apps.controller.ts` (NEW)
```typescript
import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { AppsService } from './apps.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UpdateAppDto } from './dto/update-app.dto';
import { CreateAppDto } from './dto/create-app.dto';

@Controller('apps')
@UseGuards(JwtAuthGuard)
export class AppsController {
  constructor(private appsService: AppsService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles('admin')
  findAll() { return this.appsService.findAll(); }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin')
  create(@Body() dto: CreateAppDto) { return this.appsService.create(dto); }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  update(@Param('id') id: string, @Body() dto: UpdateAppDto) { return this.appsService.update(id, dto); }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  remove(@Param('id') id: string) { return this.appsService.remove(id); }

  @Post(':id/image')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: join(process.cwd(), 'uploads', 'app-images'),
      filename: (_req, file, cb) => cb(null, `app-${Date.now()}${extname(file.originalname)}`),
    }),
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.startsWith('image/')) cb(new BadRequestException('Only images allowed') as any, false);
      else cb(null, true);
    },
    limits: { fileSize: 5 * 1024 * 1024 },
  }))
  uploadImage(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file');
    return this.appsService.uploadImage(id, file);
  }
}
```
