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
import { ContractsService } from './contracts.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/role.enum';

@ApiTags('Contracts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('contracts')
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a contract for a case' })
  create(@Body() dto: CreateContractDto) {
    return this.contractsService.createContract(dto);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all contracts (paginated)' })
  findAll(@Query() query: PaginationDto) {
    return this.contractsService.getContracts(query);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get a contract by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.contractsService.getContractById(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update contract status, dates, or details' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContractDto,
  ) {
    return this.contractsService.updateContract(id, dto);
  }

  @Get('case/:caseId')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get contract by case ID' })
  findByCase(@Param('caseId', ParseUUIDPipe) caseId: string) {
    return this.contractsService.getContractByCase(caseId);
  }
}
