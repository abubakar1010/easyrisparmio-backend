import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // CORS
  app.enableCors({
    origin: [
      configService.get('app.frontendUrl'),
      'http://localhost:3000',
      'http://localhost:3001',
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
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
    .addTag('Upload', 'File upload service')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = configService.get('app.port') || 3000;
  await app.listen(port);
  console.log(`EasyRisparmio API running on port ${port}`);
  console.log(`Swagger docs: http://localhost:${port}/api/docs`);
}
bootstrap();
