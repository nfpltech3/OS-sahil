import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { SsoToken } from '../database/entities/sso-token.entity';
import { User } from '../database/entities/user.entity';
import { UserAppAccess } from '../database/entities/user-app-access.entity';
import { SsoPayload } from '@nagarkot/shared-types';

@Injectable()
export class SsoTokenService {
  constructor(
    private jwtService: JwtService,
    private config: ConfigService,
    @InjectRepository(SsoToken)
    private ssoTokenRepo: Repository<SsoToken>,
  ) {}

  async generate(user: User, appSlug: string, appAccess: UserAppAccess): Promise<string> {
    const token_id = uuidv4();

    // Store token_id so we can mark it used after consumption
    await this.ssoTokenRepo.save({
      token_id,
      user_id: user.id,
      app_slug: appSlug,
      used: false,
      expires_at: new Date(Date.now() + 60_000), // 60 seconds
    });

    const org_id = user.clientOrgMappings?.[0]?.organization?.id ?? null;
    const org_name = user.clientOrgMappings?.[0]?.organization?.name ?? null;

    const payload: Omit<SsoPayload, 'iat' | 'exp'> = {
      token_id,
      user_id: user.id,
      email: user.email,
      name: user.name,
      // 'admin' is an OS-internal concept — receiving apps only understand 'employee' | 'client'.
      // Admin users are always treated as employees in app context; is_app_admin carries the privilege.
      user_type: (user.userType.slug === 'admin' ? 'employee' : user.userType.slug) as 'employee' | 'client',
      department_slug: user.department?.slug ?? null,
      department_name: user.department?.name ?? null,
      is_app_admin: appAccess.is_app_admin,
      is_team_lead: user.is_team_lead ?? false,
      org_id,
      org_name,
    };

    return this.jwtService.sign(payload, {
      algorithm: 'RS256',
      expiresIn: '60s',
      privateKey: this.config
        .get<string>('OS_JWT_PRIVATE_KEY')!
        .replace(/\\n/g, '\n'),
    });
  }

  async markUsed(token_id: string): Promise<void> {
    const record = await this.ssoTokenRepo.findOne({ where: { token_id } });
    if (!record) throw new UnauthorizedException('SSO token not found');
    if (record.used) throw new UnauthorizedException('SSO token already used');
    if (record.expires_at < new Date())
      throw new UnauthorizedException('SSO token expired');
    await this.ssoTokenRepo.update({ token_id }, { used: true });
  }
}
