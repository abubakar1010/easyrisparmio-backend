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
} from '@nestjs/swagger';
import { BillsService } from './bills.service';
import { UploadBillDto } from './dto/upload-bill.dto';
import { QueryBillsDto } from './dto/query-bills.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Bills')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('bills')
export class BillsController {
  constructor(private readonly billsService: BillsService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload an energy bill' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        billType: { type: 'string', enum: ['electricity', 'gas'] },
        podNumber: { type: 'string' },
        pdrNumber: { type: 'string' },
      },
      required: ['file', 'billType'],
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadBill(
    @CurrentUser('id') userId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadBillDto,
  ) {
    // In production, file would be uploaded to cloud storage.
    // For now, use the local path or a placeholder URL.
    const fileUrl = file?.path || file?.filename || 'uploads/bills/' + Date.now();
    return this.billsService.uploadBill(userId, fileUrl, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get current user bills (paginated)' })
  async getUserBills(
    @CurrentUser('id') userId: string,
    @Query() query: QueryBillsDto,
  ) {
    return this.billsService.getUserBills(userId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific bill by ID' })
  async getBillById(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.billsService.getBillById(id, userId);
  }

  @Get(':id/analysis')
  @ApiOperation({ summary: 'Get analysis results for a bill' })
  async getBillAnalysis(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.billsService.getBillAnalysis(id, userId);
  }

  @Post(':id/analyze')
  @ApiOperation({ summary: 'Trigger analysis for a bill' })
  async analyzeBill(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.billsService.analyzeBill(id, userId);
  }
}
