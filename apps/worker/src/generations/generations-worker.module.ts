import { Module } from '@nestjs/common';
import { AiWorkerModule } from '../ai/ai-worker.module.js';
import { BriefGenerator } from '../brief-generator/brief-generator.js';
import { StrategyGenerator } from '../strategy-generator/strategy-generator.js';
import { VisualDirectionGenerator } from '../visual-generator/visual-direction-generator.js';
import { ImageTransportModule } from '../image-transport/image-transport.module.js';
import { LogoConceptGenerator } from '../logo-concept-generator/logo-concept-generator.js';
import { GenerationWorkerService } from './generation-worker.service.js';
import { StageGeneratorFactory } from './stage-generator.factory.js';

@Module({
  imports: [AiWorkerModule, ImageTransportModule],
  providers: [
    GenerationWorkerService,
    StageGeneratorFactory,
    BriefGenerator,
    StrategyGenerator,
    VisualDirectionGenerator,
    LogoConceptGenerator,
    {
      provide: 'BRIEF_GENERATOR_REGISTRATION',
      useFactory: (factory: StageGeneratorFactory, generator: BriefGenerator) => {
        factory.register('BRIEF_EXTRACT', generator);
        factory.register('BRIEF_IMPROVE', generator);
        return true;
      },
      inject: [StageGeneratorFactory, BriefGenerator]
    },
    {
      provide: 'STRATEGY_GENERATOR_REGISTRATION',
      useFactory: (factory: StageGeneratorFactory, generator: StrategyGenerator) => {
        factory.register('STRATEGY_GENERATE', generator);
        factory.register('STRATEGY_SECTION_REGENERATE', generator);
        return true;
      },
      inject: [StageGeneratorFactory, StrategyGenerator]
    },
    {
      provide: 'VISUAL_DIRECTION_GENERATOR_REGISTRATION',
      useFactory: (factory: StageGeneratorFactory, generator: VisualDirectionGenerator) => {
        factory.register('VISUAL_DIRECTIONS_GENERATE', generator);
        factory.register('VISUAL_VARIATION_GENERATE', generator);
        return true;
      },
      inject: [StageGeneratorFactory, VisualDirectionGenerator]
    },
    {
      provide: 'LOGO_CONCEPT_GENERATOR_REGISTRATION',
      useFactory: (factory: StageGeneratorFactory, generator: LogoConceptGenerator) => {
        factory.register('LOGO_CONCEPTS_GENERATE', generator);
        return true;
      },
      inject: [StageGeneratorFactory, LogoConceptGenerator]
    }
  ]
})
export class GenerationsWorkerModule {}
