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
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CasesService } from './cases.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { UpdateCaseDto } from './dto/update-case.dto';
import { QueryCasesDto } from './dto/query-cases.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums/role.enum';
import { DocumentType } from '../../common/enums/user.enum';

@ApiTags('Cases')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('cases')
export class CasesController {
  constructor(private readonly casesService: CasesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new switch case by selecting an offer' })
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateCaseDto,
  ) {
    return this.casesService.createCase(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all cases (admin: all filtered; user: own cases)' })
  findAll(
    @Query() query: QueryCasesDto,
    @CurrentUser() user: { id: string; role: UserRole },
  ) {
    return this.casesService.getCases(query, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a case by ID' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string; role: UserRole },
  ) {
    return this.casesService.getCaseById(id, user);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.AGENT)
  @ApiOperation({ summary: 'Update case status, assignment, or notes (admin/agent)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCaseDto,
  ) {
    return this.casesService.updateCase(id, dto);
  }

  @Post(':id/documents')
  @ApiOperation({ summary: 'Upload a document for a case' })
  uploadDocument(
    @Param('id', ParseUUIDPipe) caseId: string,
    @CurrentUser('id') userId: string,
    @Body('documentType') documentType: DocumentType,
    @Body('fileUrl') fileUrl: string,
    @Body('fileName') fileName: string,
  ) {
    return this.casesService.uploadDocument(
      caseId,
      userId,
      documentType,
      fileUrl,
      fileName,
    );
  }

  @Get(':id/documents')
  @ApiOperation({ summary: 'Get all documents for a case' })
  getDocuments(@Param('id', ParseUUIDPipe) caseId: string) {
    return this.casesService.getDocuments(caseId);
  }

  @Patch(':id/documents/:docId/verify')
  @Roles(UserRole.ADMIN, UserRole.AGENT)
  @ApiOperation({ summary: 'Verify a case document (admin/agent)' })
  verifyDocument(
    @Param('id', ParseUUIDPipe) caseId: string,
    @Param('docId', ParseUUIDPipe) docId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.casesService.verifyDocument(caseId, docId, userId);
  }
}
