import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class InternalGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const secret = request.headers['x-internal-secret'] as string;
    const expected = this.configService.get<string>('app.internalSecret');

    if (!secret || secret !== expected) {
      throw new UnauthorizedException('Invalid internal secret');
    }
    return true;
  }
}
