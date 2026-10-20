import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@myapp/shared-types';

export const ROLES_KEY = 'roles';

/** فقط نقش‌های ذکرشده اجازه‌ی دسترسی دارند */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);