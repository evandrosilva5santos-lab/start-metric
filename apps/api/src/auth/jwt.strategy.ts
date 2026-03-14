/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, type StrategyOptions } from 'passport-jwt';

type JwtPayload = {
  sub: string;
  email: string;
  org_id: string;
  role?: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const jwtFromRequest =
      ExtractJwt.fromAuthHeaderAsBearerToken() as StrategyOptions['jwtFromRequest'];
    const options: StrategyOptions = {
      jwtFromRequest,
      ignoreExpiration: false,
      secretOrKey: process.env.SUPABASE_JWT_SECRET || 'dev-secret',
    };

    super(options);
  }

  validate(payload: JwtPayload) {
    return {
      userId: payload.sub,
      email: payload.email,
      orgId: payload.org_id,
      role: payload.role || 'member',
    };
  }
}
