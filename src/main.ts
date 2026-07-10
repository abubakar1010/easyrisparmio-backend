import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Security headers
  app.use(helmet());

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // CORS
  const corsOrigins = configService.get<string>('CORS_ORIGINS');
  app.enableCors({
    origin: corsOrigins
      ? corsOrigins.split(',').map((o) => o.trim())
      : configService.get('app.env') === 'production'
        ? false
        : '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type,Authorization,Accept-Language',
    exposedHeaders: 'Content-Disposition',
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global interceptors & filters
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  // Swagger API documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('EasyRisparmio API')
    .setDescription(
      'Italian energy utility comparison & switching platform API',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Auth', 'Authentication & registration')
    .addTag('Users', 'User management')
    .addTag('Bills', 'Energy bill upload & analysis')
    .addTag('Suppliers', 'Energy supplier management')
    .addTag('Offers', 'Energy offer management & comparison')
    .addTag('Cases', 'Switching case management')
    .addTag('Contracts', 'Contract management')
    .addTag('Commissions', 'Agent commission tracking')
    .addTag('Support', 'Support tickets & FAQ')
    .addTag('Notifications', 'Push notifications & in-app alerts')
    .addTag('Dashboard', 'Analytics & KPI dashboards')
    .addTag('Market Data', 'Italian energy market indices')
    .addTag('Meters', 'Utility meter management')
    .addTag('File Upload', 'File upload service')
    .addTag('Referrals', 'Referral program & invite tracking')
    .addTag('Agreements', 'Exclusive partner discounts & agreements')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = configService.get('app.port') || 3000;
  await app.listen(port);
  console.log(`EasyRisparmio API running on port ${port}`);
  console.log(`Swagger docs: http://localhost:${port}/api/docs`);
}
bootstrap();
