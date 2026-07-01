import type {
  ChangeDeploymentRequest,
  ChangeDeploymentResult,
  ProgressEvent,
  RemoteServerConfig,
  AccessMode,
} from '../types.js';
import { DeploymentOrchestrator } from '../deployment/DeploymentOrchestrator.js';
import { ConfigManager } from '../config/ConfigManager.js';

type Emit = (e: ProgressEvent) => void;

export class ChangeModeManager {
  private readonly orchestrator: DeploymentOrchestrator;

  constructor() {
    this.orchestrator = new DeploymentOrchestrator();
  }

  async changeDeployment(req: ChangeDeploymentRequest, emit: Emit): Promise<ChangeDeploymentResult> {
    const stepsApplied: string[] = [];
    const stepsSkipped: string[] = [];

    try {
      emit({
        level: 'info',
        message: `Changing deployment: ${req.currentDeploymentType} -> ${req.targetDeploymentType}`,
        timestamp: now(),
      });
      emit({
        level: 'info',
        message: `Access modes: [${req.currentAccessModes.join(', ')}] -> [${req.targetAccessModes.join(', ')}]`,
        timestamp: now(),
      });

      const remoteUrl = req.remoteServer?.apiUrl;
      const validation = this.orchestrator.validate(
        req.targetDeploymentType,
        req.targetAccessModes,
        remoteUrl,
      );
      if (!validation.valid) {
        return {
          success: false,
          stepsApplied: [],
          stepsSkipped: [],
          error: validation.errors.join('\n'),
          requiresRestart: false,
        };
      }

      const diff = this.orchestrator.diff(
        req.currentDeploymentType, req.currentAccessModes,
        req.targetDeploymentType,  req.targetAccessModes,
        emit,
      );

      // Component install/uninstall orchestration is not yet implemented.
      // Block the operation rather than pretending it succeeded.
      if (diff.toInstall.length > 0 || diff.toUninstall.length > 0) {
        const pending = [
          ...diff.toInstall.map(c => `install:${c}`),
          ...diff.toUninstall.map(c => `uninstall:${c}`),
        ];
        emit({
          level: 'error',
          message: `Component orchestration not yet implemented for: ${pending.join(', ')}. This deployment change requires a full reinstall.`,
          timestamp: now(),
        });
        return {
          success: false,
          stepsApplied,
          stepsSkipped,
          error: `Component changes require a full reinstall in this version: ${pending.join(', ')}`,
          requiresRestart: false,
        };
      }

      for (const component of diff.unchanged) {
        stepsSkipped.push(`unchanged:${component}`);
      }

      // Only update config when no component changes are needed
      const cfg = ConfigManager.load();
      cfg.deploymentType = req.targetDeploymentType;
      cfg.accessModes    = req.targetAccessModes;
      cfg.components     = this.orchestrator.getComponents(
        req.targetDeploymentType,
        req.targetAccessModes,
      );
      if (req.remoteServer) {
        cfg.remoteServer = req.remoteServer;
      }
      ConfigManager.save(cfg);
      stepsApplied.push('update-config');

      emit({
        level: 'success',
        message: 'Deployment settings updated - please restart',
        timestamp: now(),
      });

      return {
        success: true,
        stepsApplied,
        stepsSkipped,
        requiresRestart: false,
      };

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      emit({ level: 'error', message: `Deployment change failed: ${msg}`, timestamp: now() });
      return { success: false, stepsApplied, stepsSkipped, error: msg, requiresRestart: false };
    }
  }

  async changeEndpoint(
    remoteServer: RemoteServerConfig,
    emit: Emit,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const cfg = ConfigManager.load();
      const old = cfg.remoteServer.apiUrl;
      cfg.remoteServer = remoteServer;
      ConfigManager.save(cfg);
      emit({
        level: 'success',
        message: `Server address changed: ${old} -> ${remoteServer.apiUrl}`,
        timestamp: now(),
      });
      return { success: true };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { success: false, error: msg };
    }
  }

  async changeAccessModes(
    currentModes: AccessMode[],
    targetModes:  AccessMode[],
    emit: Emit,
  ): Promise<ChangeDeploymentResult> {
    const cfg = ConfigManager.load();
    return this.changeDeployment({
      currentDeploymentType: cfg.deploymentType,
      currentAccessModes:    currentModes,
      targetDeploymentType:  cfg.deploymentType,
      targetAccessModes:     targetModes,
    }, emit);
  }
}

function now() { return new Date().toISOString(); }
