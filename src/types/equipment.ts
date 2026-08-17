import type { SyncStatus } from './workout';

export type EquipmentMeasurement = {
  id: string;
  equipmentId: string;
  label: string;
  unit: string;
  increment: number;
  defaultValue: number | null;
  position: number;
};

export type Equipment = {
  id: string;
  name: string;
  thumbnailDataUri: string | null;
  thumbnailRemoteFileId: string | null;
  measurements: EquipmentMeasurement[];
  updatedAt: string;
  deleted: boolean;
  syncStatus: SyncStatus;
};

export type EquipmentMeasurementDraft = Omit<
  EquipmentMeasurement,
  'equipmentId' | 'position'
>;

export type EquipmentDraft = {
  name: string;
  thumbnailDataUri: string | null;
  measurements: EquipmentMeasurementDraft[];
};
