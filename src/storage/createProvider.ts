import type { SyncProvider } from "../state/types";
import { appwriteProvider } from "./appwriteProvider";
import { googleSheetsProvider } from "./googleSheetsProvider";
import { localProvider } from "./localProvider";
import type { StorageProvider } from "./types";

export const createProvider = (provider: SyncProvider): StorageProvider => {
  switch (provider) {
    case "appwrite":
      return appwriteProvider;
    case "google-sheets":
      return googleSheetsProvider;
    case "local":
    default:
      return localProvider;
  }
};
