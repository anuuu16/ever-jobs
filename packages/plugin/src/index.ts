// Core module
export { PluginModule } from './plugin.module';

// Decorator
export { SourcePlugin, SOURCE_PLUGIN_METADATA } from './decorators/source-plugin.decorator';

// Registry
export { PluginRegistry } from './registry/plugin-registry.service';

// Discovery
export { PluginDiscoveryService } from './discovery/plugin-discovery.service';

// Interfaces
export { IPluginMetadata, PluginCategory } from './interfaces/plugin-metadata.interface';

// Configuration
export {
  DISABLED_SOURCES_ENV_VAR,
  parseDisabledSources,
  readDisabledSources,
} from './config/disabled-sources';
