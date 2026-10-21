import { SetMetadata } from '@nestjs/common';

export const REQUIRE_TENANT_KEY = 'requireTenant';

/** این route بدون tenant (از Host) معنی ندارد؛ بدون آن 404 می‌دهد */
export const RequireTenant = () => SetMetadata(REQUIRE_TENANT_KEY, true);