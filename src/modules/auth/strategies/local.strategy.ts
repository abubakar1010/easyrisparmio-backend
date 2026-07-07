import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({ usernameField: 'email' });
  }

  async validate(email: string, password: string) {
    const user = await this.authService.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return user;
  }

  // Override handleRequest to preserve our custom error message
  // instead of Passport's generic "Unauthorized"
  handleRequest(err: any, user: any, info: any) {
    if (err) throw err;
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return user;
  }
}
