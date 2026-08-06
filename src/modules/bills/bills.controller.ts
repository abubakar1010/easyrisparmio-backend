import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
  BadRequestException,
  NotFoundException,
  BadGatewayException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { statSync } from 'fs';
import { diskStorage, memoryStorage } from 'multer';
import { extname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { existsSync } from 'fs';
import type { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
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
import { VisionOcrService } from './ocr/vision-ocr.service';
import { UploadBillDto } from './dto/upload-bill.dto';
import { ExtractBillDto } from './dto/extract-bill.dto';
import { CreateEmailBillDto } from './dto/create-email-bill.dto';
import { AssociateBillUserDto } from './dto/associate-bill-user.dto';
import { QueryBillsDto } from './dto/query-bills.dto';
import { SendOffersDto } from './dto/send-offers.dto';
import { RequestVerificationDto, SubmitVerificationDto } from './dto/request-verification.dto';
import { TransitionBillStatusDto, SubmitContractVerificationDto } from './dto/transition-bill-status.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums/role.enum';
import { BillType } from '../../common/enums/bill.enum';
import { ActivityLogService } from '../activity-log/activity-log.service';

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

const ERROR_401 = { success: false, statusCode: 401, message: ['Unauthorized'], timestamp: '2026-06-10T12:00:00.000Z' };
const ERROR_403 = { success: false, statusCode: 403, message: ['Forbidden resource'], timestamp: '2026-06-10T12:00:00.000Z' };

const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

const billFileFilter = (
  _req: any,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new BadRequestException(
        `Invalid file type "${file.mimetype}". Allowed types: PDF, JPEG, PNG`,
      ),
      false,
    );
  }
};

@ApiTags('Bills')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('bills')
export class BillsController {
  constructor(
    private readonly billsService: BillsService,
    private readonly visionOcrService: VisionOcrService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  // ─── OCR Extraction ───────────────────────────────────────

  @Post('extract')
  @Throttle({ default: { limit: 20, ttl: 3600000 } })
  @ApiOperation({
    summary: 'Extract bill data from image/PDF using AI Vision',
    description:
      'Sends a bill image or PDF to OpenAI Vision API for field extraction. ' +
      'Returns structured data without creating a bill record. Use this before uploading.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: 'Bill PDF or image file' },
        billType: { type: 'string', enum: ['electricity', 'gas'], description: 'Type of energy bill' },
      },
      required: ['file', 'billType'],
    },
  })
  @ApiOkResponse({ description: 'Extraction completed successfully' })
  @ApiBadRequestResponse({ description: 'Invalid file type or size' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: billFileFilter,
    }),
  )
  async extractBillData(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: ExtractBillDto,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    try {
      // Save file to disk so it can be reused during upload (avoids double upload)
      const { writeFileSync } = await import('fs');
      const filename = `${uuidv4()}${extname(file.originalname)}`;
      const savedPath = join(process.cwd(), 'uploads', 'bills', filename);
      writeFileSync(savedPath, file.buffer);
      const fileUrl = `uploads/bills/${filename}`;

      let imageBuffers: Buffer[];

      if (file.mimetype === 'application/pdf') {
        imageBuffers = await this.visionOcrService.convertPdfToImages(savedPath);
      } else {
        imageBuffers = [file.buffer];
      }

      const billType = dto.billType as unknown as BillType;
      const result = await this.visionOcrService.extractFromImages(imageBuffers, billType);
      return { ...result, fileUrl };
    } catch (error: any) {
      if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
        throw new BadGatewayException('OCR extraction timed out. Please try again.');
      }
      if (error.status === 429 || error.status >= 500) {
        throw new BadGatewayException('OCR service temporarily unavailable. Please try again.');
      }
      throw new BadGatewayException(`OCR extraction failed: ${error.message || 'Unknown error'}`);
    }
  }

  // ─── User Endpoints ───────────────────────────────────────

  @Post('upload')
  @ApiOperation({
    summary: 'Upload an energy bill',
    description:
      'Uploads an electricity or gas bill document. The bill starts in `analyzing` status ' +
      'and appears in the admin panel for review.',
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
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: join(process.cwd(), 'uploads', 'bills'),
        filename: (_req, file, cb) => {
          const filename = `${uuidv4()}${extname(file.originalname)}`;
          cb(null, filename);
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10 MB
      },
      fileFilter: billFileFilter,
    }),
  )
  async uploadBill(
    @CurrentUser('id') userId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadBillDto,
  ) {
    let fileUrl: string;

    if (file) {
      // File uploaded directly
      fileUrl = `uploads/bills/${file.filename}`;
    } else if (dto.fileUrl) {
      // File already saved during extraction — validate it exists
      const fullPath = join(process.cwd(), dto.fileUrl);
      const billsDir = join(process.cwd(), 'uploads', 'bills');
      if (!fullPath.startsWith(billsDir) || !existsSync(fullPath)) {
        throw new BadRequestException('Invalid or missing file reference. Please re-upload the file.');
      }
      fileUrl = dto.fileUrl;
    } else {
      throw new BadRequestException('File is required');
    }

    const fileMeta = file
      ? { originalName: file.originalname, mimeType: file.mimetype, fileSize: file.size }
      : undefined;

    return this.billsService.uploadBill(userId, fileUrl, dto, fileMeta);
  }

  @Post('email-request')
  @ApiOperation({
    summary: 'Create a bill request via email',
    description:
      'Creates a placeholder bill request when the user indicates they will send their bill via email. ' +
      'The bill starts in `pending_email` status with no file attached.',
  })
  @ApiBody({ type: CreateEmailBillDto })
  @ApiCreatedResponse({ description: 'Email bill request created successfully' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT', content: { 'application/json': { example: ERROR_401 } } })
  async createEmailBillRequest(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateEmailBillDto,
  ) {
    return this.billsService.createEmailBillPlaceholder(userId, dto);
  }

  // ─── Admin Endpoints (must be before :id routes) ──────────

  @Post('admin/upload-email')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Upload an email-received bill and associate with user (admin)',
    description:
      'Admin uploads a bill document received via email. If the specified user has a pending email ' +
      'bill of the same type, that bill is updated with the file. Otherwise a new bill is created.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: 'Bill PDF or image file' },
        billType: { type: 'string', enum: ['electricity', 'gas'], description: 'Type of energy bill' },
        userId: { type: 'string', format: 'uuid', description: 'User ID to associate the bill with' },
        extractedData: { type: 'string', description: 'JSON string with OCR-extracted bill fields from POST /bills/extract' },
      },
      required: ['file', 'billType', 'userId'],
    },
  })
  @ApiCreatedResponse({ description: 'Email bill uploaded and associated successfully' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiBadRequestResponse({ description: 'Invalid file type or missing fields' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT', content: { 'application/json': { example: ERROR_401 } } })
  @ApiForbiddenResponse({ description: 'User does not have admin role', content: { 'application/json': { example: ERROR_403 } } })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: join(process.cwd(), 'uploads', 'bills'),
        filename: (_req, file, cb) => {
          const filename = `${uuidv4()}${extname(file.originalname)}`;
          cb(null, filename);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: billFileFilter,
    }),
  )
  async adminUploadEmailBill(
    @CurrentUser('id') adminId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('billType') billType: string,
    @Body('userId') userId: string,
    @Body('extractedData') extractedDataJson?: string,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    if (!billType || !['electricity', 'gas'].includes(billType)) {
      throw new BadRequestException('billType must be electricity or gas');
    }
    if (!userId) {
      throw new BadRequestException('userId is required');
    }

    let parsedExtractedData: Record<string, any> | undefined;
    if (extractedDataJson) {
      try {
        parsedExtractedData = JSON.parse(extractedDataJson);
      } catch {
        throw new BadRequestException('extractedData must be valid JSON');
      }
    }

    const fileUrl = `uploads/bills/${file.filename}`;
    const result = await this.billsService.adminUploadEmailBill(
      fileUrl,
      billType as BillType,
      userId,
      parsedExtractedData,
    );
    void this.activityLogService.log(adminId, 'Email Bill Uploaded', 'bill', result.id, { userId, billType });
    return result;
  }

  @Post('admin/:id/associate-user')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Associate a bill with a user (admin)',
    description:
      'Associates an existing bill with a user. If pendingBillId is provided, merges the bill data ' +
      'into the user\'s pending email bill and soft-deletes the original.',
  })
  @ApiOkResponse({ description: 'Bill associated with user' })
  @ApiNotFoundResponse({ description: 'Bill or user not found' })
  @ApiBadRequestResponse({ description: 'Pending bill does not belong to the specified user' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT', content: { 'application/json': { example: ERROR_401 } } })
  @ApiForbiddenResponse({ description: 'User does not have admin role', content: { 'application/json': { example: ERROR_403 } } })
  async associateBillWithUser(
    @CurrentUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssociateBillUserDto,
  ) {
    const result = await this.billsService.adminAssociateBillWithUser(
      id,
      dto.userId,
      dto.pendingBillId,
    );
    void this.activityLogService.log(adminId, 'Bill Associated with User', 'bill', id, { userId: dto.userId });
    return result;
  }

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

  @Get('admin/:id/all-offers')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get all active offers with savings for a bill (admin)',
    description: 'Returns all active offers matching the bill energy type, with estimated savings calculated per offer.',
  })
  @ApiOkResponse({ description: 'All active offers with estimated savings' })
  @ApiNotFoundResponse({ description: 'Bill not found' })
  getAllOffersForBill(@Param('id', ParseUUIDPipe) id: string) {
    return this.billsService.getAllOffersForBill(id);
  }

  @Post('admin/:id/send-offers')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Send selected offers to user (admin)',
    description: 'Sends admin-selected offers to the bill owner. Admin can choose any number of offers and optionally override estimated savings.',
  })
  @ApiOkResponse({ description: 'Offers sent to user' })
  @ApiNotFoundResponse({ description: 'Bill or offers not found' })
  async sendOffersToUser(
    @CurrentUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendOffersDto,
  ) {
    await this.billsService.sendOffersToUser(id, dto.offers);
    void this.activityLogService.log(adminId, 'Offers Sent to User', 'bill', id, { offerCount: dto.offers.length });
    return { message: 'Offers sent to user successfully' };
  }

  // ─── Verification ──────────────────────────────────────────

  @Post('admin/:id/request-verification')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Send bill back to user for verification (admin)',
    description:
      'Marks a bill as requiring verification. Admin can specify missing fields, ' +
      'request document re-upload, and include a message. User receives a notification.',
  })
  @ApiBody({ type: RequestVerificationDto })
  @ApiCreatedResponse({ description: 'Verification request sent' })
  @ApiNotFoundResponse({ description: 'Bill not found' })
  async requestVerification(
    @CurrentUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequestVerificationDto,
  ) {
    const result = await this.billsService.requestVerification(id, dto);
    void this.activityLogService.log(adminId, 'Bill Verification Requested', 'bill', id);
    return result;
  }

  @Get(':id/verification')
  @ApiOperation({
    summary: 'Get active verification request for a bill',
    description: 'Returns the pending verification request if one exists.',
  })
  @ApiOkResponse({ description: 'Active verification or null' })
  async getVerification(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (userRole === UserRole.ADMIN) {
      await this.billsService.getBillByIdAdmin(id);
    } else {
      await this.billsService.getBillById(id, userId);
    }
    return this.billsService.getActiveVerification(id);
  }

  @Get(':id/verification/history')
  @ApiOperation({
    summary: 'Get full verification history for a bill',
    description: 'Returns all verification records (pending, submitted, resolved) with associated files.',
  })
  @ApiOkResponse({ description: 'Verification history array' })
  async getVerificationHistory(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (userRole === UserRole.ADMIN) {
      await this.billsService.getBillByIdAdmin(id);
    } else {
      await this.billsService.getBillById(id, userId);
    }
    return this.billsService.getVerificationHistory(id);
  }

  @Post(':id/verification/submit')
  @ApiOperation({
    summary: 'Submit verification response (user)',
    description:
      'User submits corrected field values and/or an optional message. ' +
      'The bill is re-analyzed with the updated data.',
  })
  @ApiBody({ type: SubmitVerificationDto })
  @ApiOkResponse({ description: 'Verification submitted, bill re-analyzing' })
  @ApiNotFoundResponse({ description: 'Bill or verification not found' })
  submitVerification(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitVerificationDto,
  ) {
    return this.billsService.submitVerification(id, userId, dto);
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
    content: { 'application/json': { example: { success: true, data: { ...BILL_EXAMPLE, supplier: { id: 's1a2b3c4...', name: 'Enel Energia' } } } } },
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

  // ─── File Download ────────────────────────────────────────

  @Get(':id/file')
  @ApiOperation({
    summary: 'Download bill file',
    description: 'Streams the uploaded bill file. User must own the bill, or be an admin.',
  })
  @ApiOkResponse({ description: 'File stream' })
  @ApiNotFoundResponse({ description: 'Bill or file not found' })
  @ApiForbiddenResponse({ description: 'User does not own this bill' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT', content: { 'application/json': { example: ERROR_401 } } })
  async downloadBillFile(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const bill = userRole === UserRole.ADMIN
      ? await this.billsService.getBillByIdAdmin(id)
      : await this.billsService.getBillById(id, userId);

    if (!bill.fileUrl) {
      throw new NotFoundException('No document attached to this bill yet');
    }

    const filePath = join(process.cwd(), bill.fileUrl);
    if (!existsSync(filePath)) {
      throw new NotFoundException('Bill file not found on disk');
    }

    const ext = extname(filePath).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
    };

    res.setHeader('Content-Type', mimeMap[ext] || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="bill-${bill.id}${ext}"`);
    res.sendFile(filePath);
  }

  // ─── Bill Files (multi-file support) ─────────────────────

  @Get(':id/files')
  @ApiOperation({
    summary: 'List all files for a bill',
    description: 'Returns all uploaded files associated with a bill.',
  })
  @ApiOkResponse({ description: 'List of bill files' })
  @ApiNotFoundResponse({ description: 'Bill not found' })
  async getBillFiles(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    // Verify access
    if (userRole === UserRole.ADMIN) {
      await this.billsService.getBillByIdAdmin(id);
    } else {
      await this.billsService.getBillById(id, userId);
    }
    return this.billsService.getBillFiles(id);
  }

  @Post(':id/files')
  @ApiOperation({
    summary: 'Add a file to an existing bill',
    description: 'Uploads an additional file and attaches it to an existing bill.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: 'Bill PDF or image file' },
      },
      required: ['file'],
    },
  })
  @ApiCreatedResponse({ description: 'File added to bill' })
  @ApiNotFoundResponse({ description: 'Bill not found' })
  @ApiForbiddenResponse({ description: 'User does not own this bill' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: join(process.cwd(), 'uploads', 'bills'),
        filename: (_req, file, cb) => {
          const filename = `${uuidv4()}${extname(file.originalname)}`;
          cb(null, filename);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: billFileFilter,
    }),
  )
  async addFileToBill(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Query('verificationId') verificationId?: string,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const fileUrl = `uploads/bills/${file.filename}`;
    const filePath = join(process.cwd(), fileUrl);
    const stats = statSync(filePath);

    const meta = {
      originalName: file.originalname,
      mimeType: file.mimetype,
      fileSize: stats.size,
      verificationId: verificationId || undefined,
    };

    if (userRole === UserRole.ADMIN) {
      return this.billsService.adminAddFileToBill(id, fileUrl, meta);
    }
    return this.billsService.addFileToBill(id, fileUrl, userId, meta);
  }

  @Get(':id/files/:fileId')
  @ApiOperation({
    summary: 'Download a specific bill file',
    description: 'Streams a specific file attached to a bill.',
  })
  @ApiOkResponse({ description: 'File stream' })
  @ApiNotFoundResponse({ description: 'File not found' })
  async downloadBillFileById(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @Res() res: Response,
  ) {
    // Verify access
    if (userRole === UserRole.ADMIN) {
      await this.billsService.getBillByIdAdmin(id);
    } else {
      await this.billsService.getBillById(id, userId);
    }

    const billFile = await this.billsService.getBillFileById(id, fileId);
    const filePath = join(process.cwd(), billFile.fileUrl);

    if (!existsSync(filePath)) {
      throw new NotFoundException('File not found on disk');
    }

    const ext = extname(filePath).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
    };

    res.setHeader('Content-Type', mimeMap[ext] || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${billFile.originalName || `file-${fileId}${ext}`}"`,
    );
    res.sendFile(filePath);
  }

  // ─── Status Transition Endpoints ──────────────────────────

  @Post('admin/:id/transition')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Transition bill status (admin)' })
  @ApiBearerAuth()
  async transitionBillStatus(
    @CurrentUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransitionBillStatusDto,
  ) {
    return this.billsService.transitionBillStatus(id, dto, adminId);
  }

  @Get('admin/:id/available-transitions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get available status transitions for a bill (admin)' })
  @ApiBearerAuth()
  async getAvailableTransitions(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const bill = await this.billsService.getBillByIdAdmin(id);
    return this.billsService.getAvailableTransitionsForBill(bill.status);
  }

  @Post(':id/contract-verification/submit')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Submit contract verification response (user)' })
  @ApiBearerAuth()
  async submitContractVerification(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitContractVerificationDto,
  ) {
    return this.billsService.submitContractVerification(id, userId, dto);
  }
}
