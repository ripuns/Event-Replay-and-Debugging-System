import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ //makes env vars available in nest.
      isGlobal: true, // can inject ConfigService anywhere without importing
      envFilePath: '.env',
    }),
    HealthModule,
  ],
})
export class AppModule {}
