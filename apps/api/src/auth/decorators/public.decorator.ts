import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** این route یا کنترلر نیاز به توکن ندارد */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);