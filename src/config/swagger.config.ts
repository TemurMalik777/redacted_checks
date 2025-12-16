import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Check Automation System API',
      version: '1.0.0',
      description: `
## Check Automation System REST API

Soliq portali (my3.soliq.uz) uchun avtomatik check va faktura yaratish tizimi.

### Asosiy xususiyatlar:
- 🔐 JWT authentication (Access + Refresh tokens)
- 📊 Excel import/export
- 🤖 Browser automation (Playwright)
- 👨‍💼 Admin panel
- 📈 Real-time statistics

### Authentication
Barcha himoyalangan endpointlar uchun Bearer token kerak.

Swagger UI da test qilish uchun:
1. \`/api/auth/login\` orqali login qiling
2. O'ng yuqoridagi "Authorize" tugmasini bosing
3. Tokenni kiriting: \`Bearer <your_token>\`
      `,
      contact: {
        name: 'API Support',
        email: 'support@example.com',
      },
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Development server',
      },
    ],
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication va authorization',
      },
      {
        name: 'Admin',
        description: 'Admin panel (admin role kerak)',
      },
      {
        name: 'Automation',
        description: 'Browser automation va tax site integration',
      },
      {
        name: 'Checks',
        description: 'Check management endpoints',
      },
      {
        name: 'Faktura',
        description: 'Faktura (invoice) management',
      },
      {
        name: 'Invoice',
        description: 'Tax site invoice creation via automation',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT authorization token (login dan olinadi)',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Error message' },
          },
        },
        Success: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Success message' },
          },
        },
        Pagination: {
          type: 'object',
          properties: {
            total: { type: 'integer', example: 100 },
            page: { type: 'integer', example: 1 },
            limit: { type: 'integer', example: 20 },
            totalPages: { type: 'integer', example: 5 },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            username: { type: 'string', example: 'john_doe' },
            email: { type: 'string', example: 'john@example.com' },
            firstName: { type: 'string', example: 'John' },
            lastName: { type: 'string', example: 'Doe' },
            phone: { type: 'string', example: '+998901234567' },
            role: { type: 'string', enum: ['user', 'admin'], example: 'user' },
            isActive: { type: 'boolean', example: true },
            lastLoginAt: { type: 'string', format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Import: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            fileName: { type: 'string', example: 'checks_2024.xlsx' },
            source: { type: 'string', enum: ['checks', 'faktura'], example: 'checks' },
            status: { 
              type: 'string', 
              enum: ['pending', 'processing', 'completed', 'failed'], 
              example: 'completed' 
            },
            totalRows: { type: 'integer', example: 1000 },
            importedRows: { type: 'integer', example: 950 },
            failedRows: { type: 'integer', example: 50 },
            successRate: { type: 'number', format: 'float', example: 95.0 },
            duration: { type: 'string', example: '2m 35s' },
            errorMessage: { type: 'string', nullable: true },
            startedAt: { type: 'string', format: 'date-time' },
            finishedAt: { type: 'string', format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Check: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            nomer: { type: 'string', example: 'CHK-001' },
            sana: { type: 'string', format: 'date', example: '2024-12-11' },
            summa: { type: 'number', format: 'decimal', example: 1500000.00 },
            soliqsiz_summa: { type: 'number', format: 'decimal', example: 1250000.00 },
            qqs_summa: { type: 'number', format: 'decimal', example: 250000.00 },
            isActive: { type: 'boolean', example: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Faktura: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            nomer: { type: 'string', example: 'FAK-001' },
            sana: { type: 'string', format: 'date', example: '2024-12-11' },
            mxik: { type: 'string', example: '12345678' },
            tovar_nomi: { type: 'string', example: 'Dori vositalari' },
            olchov_birligi: { type: 'string', example: 'dona' },
            miqdori: { type: 'number', format: 'decimal', example: 100.0 },
            narxi: { type: 'number', format: 'decimal', example: 50000.00 },
            summa: { type: 'number', format: 'decimal', example: 5000000.00 },
            qqs_stavka: { type: 'number', format: 'decimal', example: 15.0 },
            qqs_summa: { type: 'number', format: 'decimal', example: 750000.00 },
            isActive: { type: 'boolean', example: true },
            processed: { type: 'boolean', example: false },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        DashboardStats: {
          type: 'object',
          properties: {
            statistics: {
              type: 'object',
              properties: {
                users: { type: 'integer', example: 50 },
                imports: { type: 'integer', example: 120 },
                checks: { type: 'integer', example: 5000 },
                faktura: { type: 'integer', example: 3000 },
                selectChecks: {
                  type: 'object',
                  properties: {
                    total: { type: 'integer', example: 2500 },
                    active: { type: 'integer', example: 2000 },
                    pending: { type: 'integer', example: 500 },
                  },
                },
              },
            },
            recentImports: {
              type: 'array',
              items: { $ref: '#/components/schemas/Import' },
            },
          },
        },
      },
      responses: {
        UnauthorizedError: {
          description: 'Token yo\'q yoki noto\'g\'ri',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: { success: false, message: 'Token topilmadi' },
            },
          },
        },
        ForbiddenError: {
          description: 'Ruxsat yo\'q (admin role kerak)',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: { success: false, message: 'Admin bo\'lishingiz kerak' },
            },
          },
        },
        NotFoundError: {
          description: 'Resurs topilmadi',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: { success: false, message: 'Ma\'lumot topilmadi' },
            },
          },
        },
        ServerError: {
          description: 'Serverda ichki xato',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: { success: false, message: 'Serverda xato' },
            },
          },
        },
      },
    },
    // security: [{ BearerAuth: [] }],
  },
  apis: ['./src/modules/**/*.routes.ts', './src/modules/**/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);