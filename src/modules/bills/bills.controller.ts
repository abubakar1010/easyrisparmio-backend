import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { BillsService } from './bills.service';
import { UploadBillDto } from './dto/upload-bill.dto';
import { QueryBillsDto } from './dto/query-bills.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums/role.enum';

const BILL_EXAMPLE = {
  id: 'bl1a2b3c-d5e6-7890-abcd-ef1234567890',
  fileUrl: 'uploads/bills/enel-electricity-2026-01.pdf',
  billType: 'electricity',
  status: 'analyzed',
  podNumber: 'IT001E12345678',
  pdrNumber: null,
  billingPeriodStart: '2026-01-01',
  billingPeriodEnd: '2026-01-31',
  totalAmount: '120.50',
  consumptionKwh: '350.00',
  consumptionSmc: null,
  costPerUnit: '0.085000',
  fixedCharges: '9.90',
  taxes: '22.10',
  userId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  supplierId: 's1a2b3c4-d5e6-7890-abcd-ef1234567890',
  meterId: null,
  createdAt: '2026-06-01T10:00:00.000Z',
  updatedAt: '2026-06-01T10:00:00.000Z',
};

const ANALYSIS_EXAMPLE = {
  id: 'an1a2b3c-d5e6-7890-abcd-ef1234567890',
  billId: 'bl1a2b3c-d5e6-7890-abcd-ef1234567890',
  potentialSavings: '18.08',
  currentMonthlyAvg: '114.48',
  recommendedMarketType: 'fixed',
  analysisSummary: 'Based on your electricity bill analysis, you could save approximately EUR 18.08 per billing period by switching to a fixed-rate plan.',
  analysisDetails: {
    currentCostPerUnit: '0.085000',
    averageMarketRate: 0.08,
    consumptionPattern: 'standard',
    recommendedActions: ['Consider switching to a fixed-rate contract', 'Review your consumption during peak hours', 'Compare offers from alternative suppliers'],
  },
  confidenceScore: null,
  recommendedOffers: null,
  createdAt: '2026-06-01T10:05:00.000Z',
  updatedAt: '2026-06-01T10:05:00.000Z',
};

const ERROR_401 = { success: false, statusCode: 401, message: ['Unauthorized'], timestamp: '2026-06-10T12:00:00.000Z' };
const ERROR_403 = { success: false, statusCode: 403, message: ['Forbidden resource'], timestamp: '2026-06-10T12:00:00.000Z' };

@ApiTags('Bills')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('bills')
export class BillsController {
  constructor(private readonly billsService: BillsService) {}

  // ─── User Endpoints ───────────────────────────────────────

  @Post('upload')
  @ApiOperation({
    summary: 'Upload an energy bill',
    description:
      'Uploads an electricity or gas bill document. The bill starts in `uploaded` status. ' +
      'Use `POST /bills/:id/analyze` to trigger analysis after upload.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: 'Bill PDF or image file' },
        billType: { type: 'string', enum: ['electricity', 'gas'], description: 'Type of energy bill' },
        podNumber: { type: 'string', description: 'POD number for electricity (e.g. IT001E12345678)' },
        pdrNumber: { type: 'string', description: 'PDR number for gas (e.g. GS002C87654321)' },
      },
      required: ['file', 'billType'],
    },
  })
  @ApiCreatedResponse({
    description: 'Bill uploaded successfully',
    content: {
      'application/json': {
        example: {
          success: true,
          data: { ...BILL_EXAMPLE, status: 'uploaded', totalAmount: null, consumptionKwh: null },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Validation failed',
    content: { 'application/json': { example: { success: false, statusCode: 400, message: ['billType must be a valid enum value'], timestamp: '2026-06-10T12:00:00.000Z' } } },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT access token',
    content: { 'application/json': { example: ERROR_401 } },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadBill(
    @CurrentUser('id') userId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadBillDto,
  ) {
    const fileUrl = file?.path || file?.filename || 'uploads/bills/' + Date.now();
    return this.billsService.uploadBill(userId, fileUrl, dto);
  }

  // ─── Admin Endpoints (must be before :id routes) ──────────

  @Get('admin')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'List all bills (admin, paginated)',
    description:
      'Returns a paginated list of all user bills with user and supplier details. ' +
      'Supports filtering by bill type, status, date range, and text search (user email/name, POD/PDR number).',
  })
  @ApiOkResponse({
    description: 'Paginated list of all bills',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            data: [
              { ...BILL_EXAMPLE, user: { id: 'a1b2c3d4...', email: 'mario.rossi@email.com', firstName: 'Mario', lastName: 'Rossi' }, supplier: { id: 's1a2b3c4...', name: 'Enel Energia' } },
            ],
            meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT', content: { 'application/json': { example: ERROR_401 } } })
  @ApiForbiddenResponse({ description: 'User does not have admin role', content: { 'application/json': { example: ERROR_403 } } })
  getAllBillsAdmin(@Query() query: QueryBillsDto) {
    return this.billsService.getAllBills(query);
  }

  @Get('admin/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get any bill by ID (admin)',
    description: 'Returns a single bill with user, supplier, and analysis details. No ownership check.',
  })
  @ApiOkResponse({
    description: 'Bill details with user and analysis',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            ...BILL_EXAMPLE,
            user: { id: 'a1b2c3d4...', email: 'mario.rossi@email.com', firstName: 'Mario', lastName: 'Rossi' },
            supplier: { id: 's1a2b3c4...', name: 'Enel Energia' },
            analysis: ANALYSIS_EXAMPLE,
          },
        },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Bill not found', content: { 'application/json': { example: { success: false, statusCode: 404, message: ['Bill not found'], timestamp: '2026-06-10T12:00:00.000Z' } } } })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT', content: { 'application/json': { example: ERROR_401 } } })
  @ApiForbiddenResponse({ description: 'User does not have admin role', content: { 'application/json': { example: ERROR_403 } } })
  getBillByIdAdmin(@Param('id', ParseUUIDPipe) id: string) {
    return this.billsService.getBillByIdAdmin(id);
  }

  // ─── User List & Detail ───────────────────────────────────

  @Get()
  @ApiOperation({
    summary: 'List my bills (paginated)',
    description:
      'Returns a paginated list of the authenticated user\'s bills with supplier details. ' +
      'Supports filtering by bill type, status, and date range.',
  })
  @ApiOkResponse({
    description: 'Paginated list of user\'s bills',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            data: [{ ...BILL_EXAMPLE, supplier: { id: 's1a2b3c4...', name: 'Enel Energia' } }],
            meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT', content: { 'application/json': { example: ERROR_401 } } })
  getUserBills(
    @CurrentUser('id') userId: string,
    @Query() query: QueryBillsDto,
  ) {
    return this.billsService.getUserBills(userId, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get bill by ID',
    description: 'Returns a single bill with supplier and analysis details. User must own the bill.',
  })
  @ApiOkResponse({
    description: 'Bill details',
    content: { 'application/json': { example: { success: true, data: { ...BILL_EXAMPLE, supplier: { id: 's1a2b3c4...', name: 'Enel Energia' }, analysis: ANALYSIS_EXAMPLE } } } },
  })
  @ApiNotFoundResponse({ description: 'Bill not found', content: { 'application/json': { example: { success: false, statusCode: 404, message: ['Bill not found'], timestamp: '2026-06-10T12:00:00.000Z' } } } })
  @ApiForbiddenResponse({ description: 'User does not own this bill', content: { 'application/json': { example: { success: false, statusCode: 403, message: ['You do not have access to this bill'], timestamp: '2026-06-10T12:00:00.000Z' } } } })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT', content: { 'application/json': { example: ERROR_401 } } })
  getBillById(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.billsService.getBillById(id, userId);
  }

  @Get(':id/analysis')
  @ApiOperation({
    summary: 'Get analysis results for a bill',
    description: 'Returns the analysis for a specific bill. The bill must have been analyzed first via `POST /bills/:id/analyze`.',
  })
  @ApiOkResponse({
    description: 'Bill analysis results',
    content: { 'application/json': { example: { success: true, data: ANALYSIS_EXAMPLE } } },
  })
  @ApiNotFoundResponse({ description: 'Analysis not found', content: { 'application/json': { example: { success: false, statusCode: 404, message: ['Analysis not found. Please trigger analysis first.'], timestamp: '2026-06-10T12:00:00.000Z' } } } })
  @ApiForbiddenResponse({ description: 'User does not own this bill', content: { 'application/json': { example: { success: false, statusCode: 403, message: ['You do not have access to this bill'], timestamp: '2026-06-10T12:00:00.000Z' } } } })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT', content: { 'application/json': { example: ERROR_401 } } })
  getBillAnalysis(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.billsService.getBillAnalysis(id, userId);
  }

  @Post(':id/analyze')
  @ApiOperation({
    summary: 'Trigger analysis for a bill',
    description:
      'Triggers AI analysis on an uploaded bill. Updates status to `analyzing` then `analyzed` on success, ' +
      'or `error` on failure. Returns the analysis with potential savings and recommended actions.',
  })
  @ApiOkResponse({
    description: 'Analysis completed',
    content: { 'application/json': { example: { success: true, data: ANALYSIS_EXAMPLE } } },
  })
  @ApiNotFoundResponse({ description: 'Bill not found', content: { 'application/json': { example: { success: false, statusCode: 404, message: ['Bill not found'], timestamp: '2026-06-10T12:00:00.000Z' } } } })
  @ApiForbiddenResponse({ description: 'User does not own this bill', content: { 'application/json': { example: { success: false, statusCode: 403, message: ['You do not have access to this bill'], timestamp: '2026-06-10T12:00:00.000Z' } } } })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT', content: { 'application/json': { example: ERROR_401 } } })
  analyzeBill(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.billsService.analyzeBill(id, userId);
  }
}
