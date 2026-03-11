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
  entities: [
    UserType,
    User,
    Department,
    Application,
    UserAppAccess,
    ClientOrganization,
    UserClientOrgMapping,
    SsoToken,
  ],
  synchronize: true,
});

async function seed() {
  await AppDataSource.initialize();
  console.log('✅ Database connected');

  // ─── 1. User Types ───────────────────────────────────────────────
  const userTypeRepo = AppDataSource.getRepository(UserType);

  await userTypeRepo.upsert(
    [
      { slug: 'employee', label: 'Employee' },
      { slug: 'client',   label: 'Client'   },
      { slug: 'admin',    label: 'Admin'    },
    ],
    { conflictPaths: ['slug'], skipUpdateIfNoValuesChanged: true },
  );
  console.log('✅ User types seeded');

  const employeeType = await userTypeRepo.findOneOrFail({
    where: { slug: 'employee' },
  });

  // ─── 2. Applications ─────────────────────────────────────────────
  const appRepo = AppDataSource.getRepository(Application);

  await appRepo.upsert([
    {
      slug: 'superfreight',
      name: 'Super Freight',
      url: 'http://localhost:3002',
      webhook_url: 'http://localhost:3002/webhooks/os',
      is_active: true,
    },
    {
      slug: 'tez',
      name: 'Tez',
      url: 'http://localhost:3003',
      webhook_url: 'http://localhost:3003/webhooks/os',
      is_active: true,
    },
    {
      slug: 'trainings',
      name: 'Trainings',
      url: 'http://localhost:5173',
      webhook_url: 'http://localhost:8000/webhooks/os',
      is_active: true,
    },
    {
      slug: 'shakti',
      name: 'Shakti',
      url: 'http://localhost:3004',
      webhook_url: 'http://localhost:3004/webhooks/os',
      is_active: false,
    },
  ], { conflictPaths: ['slug'], skipUpdateIfNoValuesChanged: false });
  console.log('✅ Applications seeded');

  // ─── 3. Departments ──────────────────────────────────────────────
  const deptRepo = AppDataSource.getRepository(Department);

  await deptRepo.upsert(
    [
      { slug: 'operations', name: 'Operations', default_app_slugs: ['superfreight'],        is_active: true },
      { slug: 'sales',      name: 'Sales',      default_app_slugs: ['superfreight', 'tez'], is_active: true },
      { slug: 'finance',    name: 'Finance',    default_app_slugs: ['tez'],                 is_active: true },
      { slug: 'hr',         name: 'HR',         default_app_slugs: ['trainings'],            is_active: true },
    ],
    { conflictPaths: ['slug'], skipUpdateIfNoValuesChanged: true },
  );
  console.log('✅ Departments seeded');

  // ─── 4. Admin User ────────────────────────────────────────────────
  const adminType = await userTypeRepo.findOneOrFail({
    where: { slug: 'admin' },
  });

  const userRepo = AppDataSource.getRepository(User);

  const existingAdmin = await userRepo.findOne({
    where: { email: 'admin@nagarkot.com' },
  });

  if (!existingAdmin) {
    const password_hash = await bcrypt.hash('Admin@1234', 10);

    const admin = userRepo.create({
      email: 'admin@nagarkot.com',
      password_hash,
      name: 'Admin',
      userType: adminType,
      is_active: true,
    });

    await userRepo.save(admin);
    console.log('✅ Admin user seeded');
    console.log('   Email:    admin@nagarkot.com');
    console.log('   Password: Admin@1234');
    console.log('   ⚠️  Change this password immediately after first login');
  } else {
    // Force update to admin type if it was previously employee
    existingAdmin.userType = adminType;
    await userRepo.save(existingAdmin);
    console.log('✅ Admin user updated to Admin type');
  }

  // ─── 5. Grant admin access to all apps ───────────────────────────
  const accessRepo = AppDataSource.getRepository(UserAppAccess);
  const adminUser = await userRepo.findOneOrFail({
    where: { email: 'admin@nagarkot.com' },
  });
  const allApps = await appRepo.find();

  for (const app of allApps) {
    const existing = await accessRepo.findOne({
      where: { user: { id: adminUser.id }, application: { id: app.id } },
    });
    if (existing) {
      existing.is_enabled   = true;
      existing.is_app_admin = true;
      await accessRepo.save(existing);
    } else {
      await accessRepo.save({
        user: adminUser,
        application: app,
        is_enabled:   true,
        is_app_admin: true,
        granted_by:   adminUser.id,
      });
    }
  }
  console.log('✅ Admin app access seeded (all apps enabled, is_app_admin=true)');

  // Belt-and-suspenders: force update any rows that may have been missed
  await accessRepo.update(
    { user: { id: adminUser.id } },
    { is_app_admin: true, is_enabled: true },
  );
  console.log('✅ Admin is_app_admin and is_enabled forced to true for all apps');

  await AppDataSource.destroy();
  console.log('🎉 Seed complete');
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
