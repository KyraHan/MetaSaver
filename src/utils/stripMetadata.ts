import RNFS from "react-native-fs";
import { FFmpegKit, ReturnCode } from "ffmpeg-kit-react-native";

/**
 * Dosya uzantısına göre (foto/video) metadata temizlenmiş yeni bir çıktı üretir.
 * - Foto için: EXIF/IPTC/XMP gibi metadata'ları temizler.
 * - Video için: container metadata (title, gps, device, vb.) temizler.
 *
 * Not:
 * - "-map_metadata -1" container metadata’yı kaldırır.
 * - Foto için ayrıca yeniden encode (çıktı) alınır -> metadata gitmiş olur.
 */
export async function stripMetadata(inputPath: string): Promise<string> {
  // 1) Giriş dosyasının var olduğundan emin ol
  const exists = await RNFS.exists(inputPath);
  if (!exists) throw new Error("Input file does not exist: " + inputPath);

  // 2) Çıktı klasörü (app’in Documents’ı güvenli bir yer)
  const outDir = `${RNFS.DocumentDirectoryPath}/metasaver`;
  if (!(await RNFS.exists(outDir))) {
    await RNFS.mkdir(outDir);
  }

  // 3) Dosya uzantısını al (çok basit bir yöntem)
  const lower = inputPath.toLowerCase();
  const isImage = lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png") || lower.endsWith(".heic");
  const isVideo = lower.endsWith(".mp4") || lower.endsWith(".mov") || lower.endsWith(".m4v") || lower.endsWith(".mkv");

  if (!isImage && !isVideo) {
    throw new Error("Unsupported file type. Only common image/video formats are supported.");
  }

  // 4) Çıktı dosya adını üret (timestamp ile çakışmayı engeller)
  const ts = Date.now();
  const outExt = isVideo ? "mp4" : "jpg"; // çıktı formatını normalize ediyoruz
  const outputPath = `${outDir}/clean_${ts}.${outExt}`;

  /**
   * 5) FFmpeg komutu
   *
   * Foto:
   *  - metadata kaldır
   *  - jpg olarak yaz (yeniden encode -> metadata temiz)
   *
   * Video:
   *  - metadata kaldır
   *  - mümkünse stream copy (hızlı) -> kalite kaybı yok
   *  - bazı durumlarda re-encode gerekebilir (format/uyumluluk)
   */
  let cmd = "";

  if (isImage) {
    // Fotoğrafı yeniden yazdırıyoruz. Metadata gider.
    // -map_metadata -1 : metadata’yı tamamen kaldır
    // -q:v 2 : jpg kalite (1-31 arası, düşük daha iyi). 2 iyi kalite.
    cmd = `-y -i "${inputPath}" -map_metadata -1 -q:v 2 "${outputPath}"`;
  } else {
    // Videoda ilk deneme: re-mux / copy (çok hızlı, kalite kaybı yok)
    // -map_metadata -1 metadata'yı kaldır
    // -c copy yeniden encode yapmadan kopyalar
    cmd = `-y -i "${inputPath}" -map_metadata -1 -c copy "${outputPath}"`;
  }

  // 6) Çalıştır
  const session = await FFmpegKit.execute(cmd);
  const returnCode = await session.getReturnCode();

  // 7) Başarısızsa video için fallback: re-encode
  if (!ReturnCode.isSuccess(returnCode)) {
    if (isVideo) {
      // Re-encode: biraz daha yavaş ama daha sağlam çalışır.
      // libx264 + aac: geniş uyumluluk
      const fallbackCmd = `-y -i "${inputPath}" -map_metadata -1 -c:v libx264 -preset veryfast -crf 23 -c:a aac -b:a 128k "${outputPath}"`;
      const fallbackSession = await FFmpegKit.execute(fallbackCmd);
      const fallbackCode = await fallbackSession.getReturnCode();
      if (!ReturnCode.isSuccess(fallbackCode)) {
        throw new Error("FFmpeg failed to strip metadata (video).");
      }
    } else {
      throw new Error("FFmpeg failed to strip metadata (image).");
    }
  }

  // 8) Çıktı gerçekten oluştu mu?
  if (!(await RNFS.exists(outputPath))) {
    throw new Error("Output file not created.");
  }

  return outputPath;
}
