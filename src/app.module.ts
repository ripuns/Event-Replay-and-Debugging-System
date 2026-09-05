import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './common/auth/auth.module';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import redisConfig from './config/redis.config';
import authConfig from './config/auth.config';
import { ProjectsModule } from './projects/projects.module';
import { OrganizationModule } from './organization/organization.module';
import { EventsModule } from './events/events.module';

// func to validate all the env vars so that system can show all errors at once
function validateEnv(config: Record<string, string>) {
  if (!config.DATABASE_URL) throw new Error('DATABASE_URL is required');
  if (!config.REDIS_URL) throw new Error('REDIS_URL is required');
  if (!config.JWT_SECRET) throw new Error('JWT_SECRET is required');

  return {
    ...config,
    PORT: Number(config.PORT ?? 3000),
  };
}
@Module({
  imports: [
    ConfigModule.forRoot({
      //makes env vars available in nest.
      isGlobal: true, // can inject ConfigService anywhere without importing
      envFilePath: '.env',
      validate: validateEnv,
      load: [appConfig, databaseConfig, redisConfig, authConfig],
    }),
    HealthModule,
    AuthModule,
    ProjectsModule,
    OrganizationModule,
    EventsModule,
  ],
})
export class AppModule {}
