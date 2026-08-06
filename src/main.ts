import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    // check all reqs before your route handler does
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true, // strings into bools, nos
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();
  const configService = app.get(ConfigService);
  app.setGlobalPrefix('/v1');
  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);
}

void bootstrap();
