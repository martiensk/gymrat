import {
  Account,
  AppwriteException,
  Client,
  Databases,
  ID,
  Permission,
  Query,
  Role,
  type Models,
} from 'react-native-appwrite';

import type { appwriteConfig } from '../config/appwrite';

export { Account, AppwriteException, Databases, ID, Permission, Query, Role };
export type AppwriteDocument = Models.Document;

export function createAppwriteServices(config: typeof appwriteConfig) {
  const client = new Client()
    .setEndpoint(config.endpoint)
    .setProject(config.projectId)
    .setPlatform(config.platform);
  return {
    account: new Account(client),
    databases: new Databases(client),
  };
}
