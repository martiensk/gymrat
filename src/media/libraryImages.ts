import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

export async function pickLibraryImage() {
  if (Platform.OS !== 'web') {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) throw new Error('Photo library permission is required.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 1,
  });
  if (result.canceled) return null;

  const asset = result.assets[0];
  const supportedMimeTypes = ['image/png', 'image/jpeg', 'image/jpg'];
  if (asset.mimeType && !supportedMimeTypes.includes(asset.mimeType.toLowerCase())) {
    throw new Error('Choose a PNG, JPG, or JPEG image.');
  }

  const image = await manipulateAsync(
    asset.uri,
    asset.width > 1024 ? [{ resize: { width: 1024 } }] : [],
    { base64: true, compress: 1, format: SaveFormat.PNG },
  );
  if (!image.base64) throw new Error('The PNG could not be read.');
  return `data:image/png;base64,${image.base64}`;
}
