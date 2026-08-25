import { getCoreDriveFolders, updateCoreDriveFolder } from '../../gas/client';
import type { DriveRepository } from './contracts';

export const driveGasRepository: DriveRepository = {
  getFolders: () => getCoreDriveFolders(),
  updateFolder: (key, value) => updateCoreDriveFolder(key, value)
};
