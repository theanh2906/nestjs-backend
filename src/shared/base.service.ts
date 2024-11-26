import { HttpService } from '@nestjs/axios';
import { UtilsService } from './utils.service';

export class BaseService {
  constructor(
    protected httpService: HttpService,
    protected utils: UtilsService,
  ) {}
}
