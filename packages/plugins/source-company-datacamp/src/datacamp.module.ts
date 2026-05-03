import { Module } from '@nestjs/common';
import { DataCampService } from './datacamp.service';

@Module({ providers: [DataCampService], exports: [DataCampService] })
export class DataCampModule {}
