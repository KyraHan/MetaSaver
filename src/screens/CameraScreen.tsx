import React, { useEffect, useRef, useState } from "react";
import {
    View,
    TouchableOpacity,
    Text,
    StyleSheet,
    Image,
    Alert,
    ActivityIndicator,
    Platform,
} from "react-native";
import { Camera, useCameraDevice } from "react-native-vision-camera";
import { launchImageLibrary } from "react-native-image-picker";
import RNFS from "react-native-fs";
import { FFmpegKit } from "ffmpeg-kit-react-native";
//@ts-ignore
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";

type PendingMedia =
    | { kind: "photo"; uri: string }
    | null;

export default function CameraScreen() {
    const cameraRef = useRef<Camera>(null);
    const device = useCameraDevice("back");

    const [hasPermission, setHasPermission] = useState(false);

    // Preview/edit mode
    const [pending, setPending] = useState<PendingMedia>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        (async () => {
            const cam = await Camera.requestCameraPermission();
            const mic = await Camera.requestMicrophonePermission(); // video yoksa şart değil ama sorun çıkarmaz
            setHasPermission(cam === "granted" && mic === "granted");
        })();
    }, []);

    const inEditMode = !!pending;

    const onPickFromGallery = async () => {
        if (busy) return;
        const res = await launchImageLibrary({
            mediaType: "photo",
            selectionLimit: 1,
        });

        const asset = res.assets?.[0];
        if (!asset?.uri) return;

        // iOS: "ph://" gelebilir, image-picker çoğu zaman dosya uri veriyor.
        // Android: content:// olabilir. Biz güvenli olsun diye önce cache'e kopyalayacağız.
        setBusy(true);
        try {
            const localUri = await copyToAppCache(asset.uri, "picked.jpg");
            setPending({ kind: "photo", uri: localUri });
        } catch (e: any) {
            Alert.alert("Hata", e?.message ?? "Galeriden seçilemedi.");
        } finally {
            setBusy(false);
        }
    };

    const onTakePhoto = async () => {
        if (busy || !cameraRef.current) return;

        setBusy(true);
        try {
            const photo = await cameraRef.current.takePhoto({
                flash: "off",
            });

            // VisionCamera genelde path döndürür: photo.path
            const uri = "file://" + photo.path;
            setPending({ kind: "photo", uri });
        } catch (e: any) {
            Alert.alert("Hata", e?.message ?? "Foto çekilemedi.");
        } finally {
            setBusy(false);
        }
    };

    const onDiscard = () => {
        setPending(null);
    };

    const onSave = async () => {
        if (!pending) return;

        Alert.alert(
            "Kaydet?",
            "Metadata temizlenmiş hali kaydedilecek. Devam?",
            [
                { text: "İptal", style: "cancel" },
                {
                    text: "Kaydet",
                    style: "default",
                    onPress: async () => {
                        setBusy(true);
                        try {
                            const cleaned = await stripMetadataWithFfmpeg(pending.uri);

                            // İstersen direkt galeriye kaydet; şimdilik app içine kaydedelim:
                            const outPath = `${RNFS.PicturesDirectoryPath}/MetaSaver`;
                            await RNFS.mkdir(outPath);
                            const fileName = `metasaver_${Date.now()}.jpg`;
                            const dest = `${outPath}/${fileName}`;

                            await RNFS.copyFile(cleaned.replace("file://", ""), dest);

                            Alert.alert("Başarılı", `Kaydedildi:\n${dest}`);
                            setPending(null);
                        } catch (e: any) {
                            Alert.alert("Hata", e?.message ?? "Kaydedilemedi.");
                        } finally {
                            setBusy(false);
                        }
                    },
                },
            ]
        );
    };

    if (!device || !hasPermission) {
        return (
            <View style={styles.center}>
                <Text style={{ color: "#fff" }}>
                    Kamera izni gerekli (Settings’ten izin ver).
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.root}>
            {/* Kamera veya Preview */}
            <View style={styles.previewArea}>
                {!inEditMode ? (
                    <Camera
                        ref={cameraRef}
                        style={StyleSheet.absoluteFill}
                        device={device}
                        isActive={true}
                        photo={true}
                    />
                ) : (
                    <Image
                        source={{ uri: pending!.uri }}
                        style={StyleSheet.absoluteFill}
                        resizeMode="cover"
                    />
                )}

                {busy && (
                    <View style={styles.busyOverlay}>
                        <ActivityIndicator />
                    </View>
                )}
            </View>

            {/* Alt bar */}
            <View style={styles.bottomBar}>
                {!inEditMode ? (
                    <>
                        <TouchableOpacity
                            onPress={onPickFromGallery}
                            style={styles.galleryButton}
                            activeOpacity={0.85}
                        >
                            {/* Placeholder manzara */}
                            <Image
                                source={require("../assets/gallery_placeholder.jpg")}
                                style={styles.galleryImage}
                            />

                            {/* Camera icon overlay */}
                            <View style={styles.galleryIconOverlay}>
                                <MaterialCommunityIcons name="camera" size={18} color="#fff" />
                            </View>
                        </TouchableOpacity>

                        {/* Orta: shutter */}
                        <TouchableOpacity
                            onPress={onTakePhoto}
                            style={styles.shutterOuter}
                            activeOpacity={0.85}
                        >
                            <View style={styles.shutterInner} />
                        </TouchableOpacity>

                        {/* Sağ boş (istersen flash vs) */}
                        <View style={{ width: 54 }} />
                    </>
                ) : (
                    <>
                        <TouchableOpacity onPress={onDiscard} style={styles.actionBtn}>
                            <Text style={styles.actionText}>Vazgeç</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={onSave} style={[styles.actionBtn, styles.saveBtn]}>
                            <Text style={styles.actionText}>Kaydet</Text>
                        </TouchableOpacity>
                    </>
                )}
            </View>
        </View>
    );
}

/**
 * content:// veya diğer uri’ları güvenli şekilde app cache’e al
 */
async function copyToAppCache(inputUri: string, name: string): Promise<string> {
    const cacheDir = RNFS.CachesDirectoryPath;
    const destPath = `${cacheDir}/${name}`;

    // Android content:// kopyalama: RNFS.copyFile çoğu zaman çalışır, bazen downloadFile gerekebilir.
    if (Platform.OS === "android" && inputUri.startsWith("content://")) {
        const res = await RNFS.downloadFile({
            fromUrl: inputUri,
            toFile: destPath,
        }).promise;
        if (res.statusCode && res.statusCode >= 400) {
            throw new Error("Dosya kopyalanamadı (content uri).");
        }
        return "file://" + destPath;
    }

    // file:// veya direkt path
    const src = inputUri.startsWith("file://") ? inputUri.replace("file://", "") : inputUri;
    await RNFS.copyFile(src, destPath);
    return "file://" + destPath;
}

/**
 * Metadata temizleme: yeniden encode + map_metadata -1
 * - JPEG için en basit: -map_metadata -1 -q:v 2
 */
async function stripMetadataWithFfmpeg(inputUri: string): Promise<string> {
    const cacheDir = RNFS.CachesDirectoryPath;
    const outPath = `${cacheDir}/clean_${Date.now()}.jpg`;

    const inPath = inputUri.startsWith("file://")
        ? inputUri.replace("file://", "")
        : inputUri;

    const cmd = `
    -y
    -i "${inPath}"
    -map_metadata -1
    -metadata creation_time=
    -metadata date=
    -metadata:s:v:0 creation_time=
    -metadata:s:v:0 date=
    -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2"
    -q:v 2
    "${outPath}"
  `;

    const session = await FFmpegKit.execute(cmd.replace(/\s+/g, " ").trim());
    const rc = await session.getReturnCode();

    if (!rc?.isValueSuccess?.()) {
        const log = await session.getAllLogsAsString();
        throw new Error("Metadata temizleme başarısız:\n" + log?.slice(-500));
    }

    return "file://" + outPath;
}


const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: "#000" },
    previewArea: { flex: 1, backgroundColor: "#000" },
    bottomBar: {
        height: 140,
        backgroundColor: "#000",
        alignItems: "center",
        justifyContent: "space-between",
        flexDirection: "row",
        paddingHorizontal: 28,
        paddingBottom: 18,
    },
    galleryButton: {
        width: 54,
        height: 54,
        borderRadius: 8,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.3)",
    },

    galleryImage: {
        width: "100%",
        height: "100%",
        resizeMode: "cover",
    },

    galleryIconOverlay: {
        position: "absolute",
        right: 4,
        bottom: 4,
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: "rgba(0,0,0,0.6)",
        alignItems: "center",
        justifyContent: "center",
    },
    leftButton: {
        width: 46,
        height: 46,
        backgroundColor: "#fff",
        borderRadius: 6,
    },
    shutterOuter: {
        width: 76,
        height: 76,
        borderRadius: 38,
        borderWidth: 6,
        borderColor: "#fff",
        alignItems: "center",
        justifyContent: "center",
    },
    shutterInner: {
        width: 54,
        height: 54,
        borderRadius: 27,
        backgroundColor: "#fff",
    },
    actionBtn: {
        flex: 1,
        height: 52,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#fff",
        alignItems: "center",
        justifyContent: "center",
        marginHorizontal: 8,
    },
    saveBtn: { backgroundColor: "#fff" },
    actionText: { color: "#000", fontWeight: "700" },
    center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#000" },
    busyOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.25)",
    },
});
