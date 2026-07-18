import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiBody,
} from '@nestjs/swagger';
import { CasesService } from './cases.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { UpdateCaseDto } from './dto/update-case.dto';
import { QueryCasesDto } from './dto/query-cases.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums/role.enum';

const CASE_EXAMPLE = {
  id: 'cs1a2b3c-d5e6-7890-abcd-ef1234567890',
  userId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  billId: 'bl1a2b3c-d5e6-7890-abcd-ef1234567890',
  selectedOfferId: 'o1a2b3c4-d5e6-7890-abcd-ef1234567890',
  assignedAgentId: null,
  status: 'new',
  priority: 'medium',
  notes: null,
  internalNotes: null,
  caseNumber: 'SW-20260610-00001',
  caseType: 'switch',
  fromSupplierId: 's1a2b3c4-d5e6-7890-abcd-ef1234567890',
  toSupplierId: 's2b3c4d5-e6f7-8901-bcde-f23456789012',
  createdAt: '2026-06-10T10:00:00.000Z',
  updatedAt: '2026-06-10T10:00:00.000Z',
};

const CASE_WITH_RELATIONS = {
  ...CASE_EXAMPLE,
  user: { id: 'a1b2c3d4...', email: 'mario.rossi@email.com', firstName: 'Mario', lastName: 'Rossi' },
  bill: { id: 'bl1a2b3c...', billType: 'electricity', podNumber: 'IT001E12345678', totalAmount: '120.50' },
  selectedOffer: { id: 'o1a2b3c4...', name: 'Casa Luce Fix 12', energyType: 'electricity' },
  assignedAgent: null,
  documents: [],
  contract: null,
};

const DOCUMENT_EXAMPLE = {
  id: 'dc1a2b3c-d5e6-7890-abcd-ef1234567890',
  caseId: 'cs1a2b3c-d5e6-7890-abcd-ef1234567890',
  documentType: 'id_card',
  fileUrl: 'https://storage.easyresparmio.it/docs/id-card-front.pdf',
  fileName: 'carta-identita-fronte.pdf',
  uploadedById: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  verified: false,
  verifiedById: null,
  verifiedAt: null,
  createdAt: '2026-06-10T10:30:00.000Z',
  updatedAt: '2026-06-10T10:30:00.000Z',
};

const ERROR_401 = { success: false, statusCode: 401, message: ['Unauthorized'], timestamp: '2026-06-10T12:00:00.000Z' };
const ERROR_403 = { success: false, statusCode: 403, message: ['Forbidden resource'], timestamp: '2026-06-10T12:00:00.000Z' };

@ApiTags('Cases')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('cases')
export class CasesController {
  constructor(private readonly casesService: CasesService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new switch case',
    description:
      'Creates a switching request by selecting an offer for a previously uploaded bill. ' +
      'A unique case number (SW-YYYYMMDD-XXXXX) is auto-generated. The current and target suppliers ' +
      'are automatically populated from the bill and offer data.',
  })
  @ApiBody({ type: CreateCaseDto })
  @ApiCreatedResponse({
    description: 'Case created successfully',
    content: { 'application/json': { example: { success: true, data: CASE_WITH_RELATIONS } } },
  })
  @ApiBadRequestResponse({
    description: 'Validation failed',
    content: { 'application/json': { example: { success: false, statusCode: 400, message: ['billId must be a UUID', 'selectedOfferId must be a UUID'], timestamp: '2026-06-10T12:00:00.000Z' } } },
  })
  @ApiNotFoundResponse({
    description: 'Bill or offer not found',
    content: { 'application/json': { example: { success: false, statusCode: 404, message: ['Bill not found'], timestamp: '2026-06-10T12:00:00.000Z' } } },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT', content: { 'application/json': { example: ERROR_401 } } })
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateCaseDto,
  ) {
    return this.casesService.createCase(userId, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List cases (user: own, admin: all)',
    description:
      'Returns a paginated list of switch cases. Regular users see only their own cases; ' +
      'admins see all cases with full filtering. Supports search by user name, email, or case number.',
  })
  @ApiOkResponse({
    description: 'Paginated list of cases',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            data: [CASE_WITH_RELATIONS],
            meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT', content: { 'application/json': { example: ERROR_401 } } })
  findAll(
    @Query() query: QueryCasesDto,
    @CurrentUser() user: { id: string; role: UserRole },
  ) {
    return this.casesService.getCases(query, user);
  }

  @Get('by-bill/:billId')
  @ApiOperation({
    summary: 'Get case by bill ID (user)',
    description:
      'Returns the case associated with a specific bill for the authenticated user. ' +
      'Includes selected offer, contract, documents, and event timeline.',
  })
  @ApiOkResponse({
    description: 'Case found for the given bill',
    content: { 'application/json': { example: { success: true, data: CASE_WITH_RELATIONS } } },
  })
  @ApiNotFoundResponse({
    description: 'No case found for this bill',
    content: { 'application/json': { example: { success: false, statusCode: 404, message: ['No case found for this bill'], timestamp: '2026-06-10T12:00:00.000Z' } } },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT', content: { 'application/json': { example: ERROR_401 } } })
  findByBill(
    @Param('billId', ParseUUIDPipe) billId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.casesService.getCaseByBillId(billId, userId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get case by ID',
    description:
      'Returns a single case with full details: user, bill, offer, assigned agent, documents, and contract. ' +
      'Users can only access their own cases; admins can access any case.',
  })
  @ApiOkResponse({
    description: 'Case details with all relations',
    content: { 'application/json': { example: { success: true, data: CASE_WITH_RELATIONS } } },
  })
  @ApiNotFoundResponse({ description: 'Case not found', content: { 'application/json': { example: { success: false, statusCode: 404, message: ['Case not found'], timestamp: '2026-06-10T12:00:00.000Z' } } } })
  @ApiForbiddenResponse({ description: 'User does not own this case', content: { 'application/json': { example: { success: false, statusCode: 403, message: ['Access denied'], timestamp: '2026-06-10T12:00:00.000Z' } } } })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT', content: { 'application/json': { example: ERROR_401 } } })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string; role: UserRole },
  ) {
    return this.casesService.getCaseById(id, user);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Update case (admin)',
    description:
      'Updates case status, priority, agent assignment, or notes. All fields are optional. ' +
      'Status changes and agent assignments are logged as case events for audit trail.',
  })
  @ApiBody({ type: UpdateCaseDto })
  @ApiOkResponse({
    description: 'Case updated',
    content: {
      'application/json': {
        example: {
          success: true,
          data: { ...CASE_EXAMPLE, status: 'in_progress', assignedAgentId: 'admin-uuid', updatedAt: '2026-06-10T14:00:00.000Z' },
        },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Case not found', content: { 'application/json': { example: { success: false, statusCode: 404, message: ['Case not found'], timestamp: '2026-06-10T12:00:00.000Z' } } } })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT', content: { 'application/json': { example: ERROR_401 } } })
  @ApiForbiddenResponse({ description: 'User does not have admin role', content: { 'application/json': { example: ERROR_403 } } })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCaseDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.casesService.updateCase(id, dto, adminId);
  }

  @Post(':id/documents')
  @ApiOperation({
    summary: 'Upload a document for a case',
    description:
      'Attaches a document to a switching case. The file must be uploaded first via the file-upload service; ' +
      'this endpoint stores the file reference. Document uploads are logged as case events.',
  })
  @ApiBody({ type: UploadDocumentDto })
  @ApiCreatedResponse({
    description: 'Document uploaded',
    content: { 'application/json': { example: { success: true, data: DOCUMENT_EXAMPLE } } },
  })
  @ApiNotFoundResponse({ description: 'Case not found', content: { 'application/json': { example: { success: false, statusCode: 404, message: ['Case not found'], timestamp: '2026-06-10T12:00:00.000Z' } } } })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT', content: { 'application/json': { example: ERROR_401 } } })
  uploadDocument(
    @Param('id', ParseUUIDPipe) caseId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UploadDocumentDto,
  ) {
    return this.casesService.uploadDocument(
      caseId,
      userId,
      dto.documentType,
      dto.fileUrl,
      dto.fileName,
    );
  }

  @Get(':id/documents')
  @ApiOperation({
    summary: 'List documents for a case',
    description: 'Returns all documents attached to a case, with uploader and verifier details.',
  })
  @ApiOkResponse({
    description: 'List of case documents',
    content: {
      'application/json': {
        example: {
          success: true,
          data: [DOCUMENT_EXAMPLE],
        },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Case not found', content: { 'application/json': { example: { success: false, statusCode: 404, message: ['Case not found'], timestamp: '2026-06-10T12:00:00.000Z' } } } })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT', content: { 'application/json': { example: ERROR_401 } } })
  getDocuments(@Param('id', ParseUUIDPipe) caseId: string) {
    return this.casesService.getDocuments(caseId);
  }

  @Patch(':id/documents/:docId/verify')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Verify a case document (admin)',
    description:
      'Marks a document as verified. Sets `verified: true`, `verifiedById`, and `verifiedAt`. ' +
      'Verification is logged as a case event.',
  })
  @ApiOkResponse({
    description: 'Document verified',
    content: {
      'application/json': {
        example: {
          success: true,
          data: { ...DOCUMENT_EXAMPLE, verified: true, verifiedById: 'admin-uuid', verifiedAt: '2026-06-10T14:00:00.000Z' },
        },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Document not found', content: { 'application/json': { example: { success: false, statusCode: 404, message: ['Document not found'], timestamp: '2026-06-10T12:00:00.000Z' } } } })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT', content: { 'application/json': { example: ERROR_401 } } })
  @ApiForbiddenResponse({ description: 'User does not have admin role', content: { 'application/json': { example: ERROR_403 } } })
  verifyDocument(
    @Param('id', ParseUUIDPipe) caseId: string,
    @Param('docId', ParseUUIDPipe) docId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.casesService.verifyDocument(caseId, docId, userId);
  }
}
