import 'reflect-metadata';
import { config } from 'dotenv';

config({ path: ['.env', '../../.env'], quiet: true });
process.env.NODE_ENV = 'test';