import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AdminActor } from './admin.guard';

@Injectable()
export class AdminAuditService {
  constructor(private readonly prisma: PrismaService) {}

  record(
    actor: AdminActor,
    action: string,
    targetTenantId: string | null,
    details: Record<string, unknown> = {},
  ) {
    return this.prisma.adminAuditLog.create({
      data: {
        adminId: actor.id,
        adminEmail: actor.email,
        action,
        targetTenantId,
        details: details as Prisma.InputJsonObject,
        ip: actor.ip,
      },
    });
  }
}