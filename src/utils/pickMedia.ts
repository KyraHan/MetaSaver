import { launchImageLibrary } from "react-native-image-picker";

/**
 * Galeriden foto/video seçtirir ve seçilen dosyanın path'ini döner.
 */
export async function pickMediaFromGallery(): Promise<string | null> {
  const res = await launchImageLibrary({
    mediaType: "mixed", // hem foto hem video
    selectionLimit: 1,
  });

  // Kullanıcı iptal ettiyse
  if (res.didCancel) return null;

  // Hata varsa
  if (res.errorCode) {
    throw new Error(res.errorMessage || "ImagePicker error");
  }

  const asset = res.assets?.[0];
  if (!asset?.uri) return null;

  /**
   * asset.uri örnekleri:
   * - iOS: "file://...."
   * - Android: "content://...."
   *
   * FFmpeg genelde file path ister.
   * Android content:// için bazen dosyayı app içine kopyalamak gerekir.
   * (Aşağıda basit yaklaşım: iOS file:// temizle, Android’de çoğu cihazda picker filePath verir)
   */
  const path = asset.fileName && asset.uri.startsWith("file://")
    ? asset.uri.replace("file://", "")
    : (asset.uri.startsWith("file://") ? asset.uri.replace("file://", "") : asset.uri);

  return path;
}
