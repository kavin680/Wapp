import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe, Logger, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import { join } from 'path';
import hbs from 'hbs';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port') || 3000;
  const apiPrefix = configService.get<string>('app.apiPrefix') || 'api';
  const corsOrigins = configService.get<string[]>('app.corsOrigins') || [
    'http://localhost:3001',
  ];

  // Security
  app.use(
    helmet({
      contentSecurityPolicy: false,
    }),
  );
  app.use(compression());
  app.use(cookieParser());

  // Session for admin UI
  app.use(
    session({
      secret:
        configService.get<string>('auth.jwtSecret') || 'admin-session-secret',
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: configService.get<string>('app.env') === 'production',
      },
    }),
  );

  // Handlebars view engine
  const viewsPath = join(__dirname, '..', 'views');
  app.setBaseViewsDir(viewsPath);
  app.setViewEngine('hbs');
  hbs.registerPartials(join(viewsPath, 'partials'));
  hbs.registerHelper('eq', (a: unknown, b: unknown) => a === b);
  hbs.registerHelper('or', (...args: unknown[]) => {
    const options = args.pop();
    return args.some(Boolean) ? (options as Record<string, unknown>) : false;
  });

  // Static files
  app.useStaticAssets(join(__dirname, '..', 'public'), { prefix: '/public/' });

  // CORS
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Request-ID',
      'X-Correlation-ID',
    ],
  });

  // Global prefix (exclude admin UI and health/docs routes)
  app.setGlobalPrefix(apiPrefix, {
    exclude: ['admin', 'admin/(.*)', 'docs', 'docs/(.*)'],
  });

  // API Versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Swagger
  if (configService.get<string>('app.env') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Wapp — WhatsApp Messaging API')
      .setDescription('WhatsApp Business API messaging platform — send messages, manage contacts, run campaigns, and more')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('Auth', 'Authentication & Authorization')
      .addTag('Users', 'User Management')
      .addTag('Health', 'Health Checks')
      .addTag('Audit', 'Audit Logs')
      .addTag('Feature Flags', 'Feature Flag Management')
      .addTag('Notifications', 'User Notifications')
      .addTag('Webhooks', 'Webhook Management')
      .addTag('File Upload', 'File Upload & Storage')
      .addTag('Messaging', 'Messaging Provider & Message Sending')
      .addTag('Contacts', 'Contact Management')
      .addTag('Templates', 'Message Template Management')
      .addTag('Conversations', 'Conversation Inbox')
      .addTag('Campaigns', 'Campaign Management')
      .addTag('Billing', 'Billing & Usage Tracking')
      .addTag('Analytics', 'Analytics & Reporting')
      .addTag('Settings', 'System Settings & User Preferences')
      .addTag('API Keys', 'API Key Management')
      .addTag('Webhook Events', 'Webhook Event Processing')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
    });

    logger.log(`Swagger docs available at http://localhost:${port}/docs`);
  }

  // Graceful shutdown
  app.enableShutdownHooks();

  await app.listen(port);
  logger.log(`Application running on http://localhost:${port}`);
  logger.log(`API available at http://localhost:${port}/${apiPrefix}`);
  logger.log(`Admin UI available at http://localhost:${port}/admin`);
}

void bootstrap();
