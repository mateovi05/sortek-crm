import { Module } from "@nestjs/common";
import { TrpcModule } from "../trpc/trpc.module";
import { PlatformController } from "./platform.controller";
import { PlatformRouter } from "./platform.router";
import { PlatformService } from "./platform.service";

@Module({
	imports: [TrpcModule],
	controllers: [PlatformController],
	providers: [PlatformService, PlatformRouter],
	exports: [PlatformService],
})
export class PlatformModule {}
