export type DriveFolderSettings = Record<string, string>;
export type DriveRepository = {
  getFolders: () => Promise<DriveFolderSettings>;
  updateFolder: (key: string, value: string) => Promise<void>;
};
