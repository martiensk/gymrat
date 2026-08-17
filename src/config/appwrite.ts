export const appwriteConfig = {
  endpoint: process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT ?? '',
  projectId: process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID ?? '',
  databaseId: process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID ?? '',
  workoutsCollectionId:
    process.env.EXPO_PUBLIC_APPWRITE_WORKOUTS_COLLECTION_ID ?? '',
  equipmentCollectionId:
    process.env.EXPO_PUBLIC_APPWRITE_EQUIPMENT_COLLECTION_ID ?? '',
  exercisesCollectionId:
    process.env.EXPO_PUBLIC_APPWRITE_EXERCISES_COLLECTION_ID ?? '',
  plansCollectionId:
    process.env.EXPO_PUBLIC_APPWRITE_PLANS_COLLECTION_ID ?? '',
  platform: process.env.EXPO_PUBLIC_APPWRITE_PLATFORM ?? 'com.gymrat.app',
};

export const isAppwriteConfigured = Boolean(
  appwriteConfig.endpoint &&
    appwriteConfig.projectId &&
    appwriteConfig.databaseId,
);

export const canSyncWorkouts = Boolean(
  isAppwriteConfigured && appwriteConfig.workoutsCollectionId,
);

export const canSyncEquipment = Boolean(
  isAppwriteConfigured && appwriteConfig.equipmentCollectionId,
);

export const canSyncExercises = Boolean(
  isAppwriteConfigured && appwriteConfig.exercisesCollectionId,
);

export const canSyncPlans = Boolean(
  isAppwriteConfigured && appwriteConfig.plansCollectionId,
);
