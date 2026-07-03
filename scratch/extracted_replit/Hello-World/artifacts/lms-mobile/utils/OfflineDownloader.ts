import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface OfflineVideo {
  id: string; // usually courseId_lessonId
  localPlaylistPath: string;
  courseId: number;
  lessonId: number;
  title: string;
  sizeBytes: number;
  downloadedAt: string;
}

const OFFLINE_DIR = (FileSystem as any).documentDirectory + 'offline_videos/';
const STORE_KEY = '@offline_videos';

export class OfflineDownloader {
  static async initDir() {
    const info = await FileSystem.getInfoAsync(OFFLINE_DIR);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(OFFLINE_DIR, { intermediates: true });
    }
  }

  static async getOfflineVideos(): Promise<OfflineVideo[]> {
    try {
      const data = await AsyncStorage.getItem(STORE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  static async saveOfflineVideos(videos: OfflineVideo[]) {
    await AsyncStorage.setItem(STORE_KEY, JSON.stringify(videos));
  }

  static async downloadHLS(url: string, courseId: number, lessonId: number, title: string, progressCallback?: (progress: number) => void) {
    await this.initDir();
    const videoId = `${courseId}_${lessonId}`;
    const videoDir = OFFLINE_DIR + videoId + '/';
    
    // Ensure clean directory
    const dirInfo = await FileSystem.getInfoAsync(videoDir);
    if (dirInfo.exists) {
      await FileSystem.deleteAsync(videoDir);
    }
    await FileSystem.makeDirectoryAsync(videoDir, { intermediates: true });

    try {
      // 1. Download the master m3u8
      const masterRes = await fetch(url);
      const masterContent = await masterRes.text();

      // Cloudinary nested HLS: The master contains URLs to variant playlists (e.g., 720p, 480p)
      // For offline, we will parse and select the highest quality or just the first variant to save space.
      const lines = masterContent.split('\n');
      let targetVariantUrl = null;
      let isEagerVariant = false;

      for (const line of lines) {
        if (line.trim().endsWith('.m3u8')) {
          targetVariantUrl = new URL(line.trim(), url).href;
          break; // just take the first variant for offline to save device space
        }
      }

      // If it's not a master playlist, but a variant itself:
      if (!targetVariantUrl && masterContent.includes('#EXTINF')) {
        targetVariantUrl = url;
        isEagerVariant = true;
      }

      if (!targetVariantUrl) {
        throw new Error("Could not parse HLS playlist");
      }

      // 3. Download the variant playlist and process EXT-X-KEY if present
      const variantRes = await fetch(targetVariantUrl);
      let variantContent = await variantRes.text();

      // Look for #EXT-X-KEY to cache the decryption key offline
      const keyMatch = variantContent.match(/#EXT-X-KEY:METHOD=AES-128,URI="([^"]+)"/);
      if (keyMatch && keyMatch[1]) {
        const keyUrl = new URL(keyMatch[1], targetVariantUrl).href;
        // Fetch the key bytes
        const keyRes = await fetch(keyUrl);
        const keyBuffer = await keyRes.arrayBuffer();
        
        // Convert to base64
        const base64 = btoa(
          new Uint8Array(keyBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        );
        const dataUri = `data:application/octet-stream;base64,${base64}`;
        
        // Replace in playlist so the native player decrypts offline without internet
        variantContent = variantContent.replace(`URI="${keyMatch[1]}"`, `URI="${dataUri}"`);
      }

      // Parse the TS files
      const variantLines = variantContent.split('\n');
      const tsUrls: string[] = [];
      let totalSize = 0;

      for (let i = 0; i < variantLines.length; i++) {
        const line = variantLines[i].trim();
        if (line && !line.startsWith('#')) {
          const tsUrl = new URL(line, targetVariantUrl).href;
          tsUrls.push(tsUrl);
        }
      }

      // 3. Download all TS chunks and replace URIs in the local playlist
      let newVariantContent = variantContent;

      for (let i = 0; i < tsUrls.length; i++) {
        const tsUrl = tsUrls[i];
        const fileName = `chunk_${i}.bin`; // Rename extension for minor obfuscation
        const localUri = videoDir + fileName;

        // Note: For true AES-128 prevention against rooted users, we would encrypt the downloaded bytes here.
        // Due to pure-JS memory limits, we rely on the OS sandbox and obfuscation.
        const downloadRes = await FileSystem.downloadAsync(tsUrl, localUri);
        totalSize += downloadRes.headers['Content-Length'] ? parseInt(downloadRes.headers['Content-Length']) : 500000;

        // Replace the remote URL in the m3u8 with the local relative path
        const originalLine = variantLines.find(l => l.trim().endsWith(tsUrl.split('/').pop() || ''));
        if (originalLine) {
           newVariantContent = newVariantContent.replace(originalLine, fileName);
        }

        if (progressCallback) {
          progressCallback((i + 1) / tsUrls.length);
        }
      }

      // 4. Save the new localized m3u8
      const localPlaylistPath = videoDir + 'playlist.m3u8';
      await FileSystem.writeAsStringAsync(localPlaylistPath, newVariantContent);

      // 5. Update state
      const existing = await this.getOfflineVideos();
      existing.push({
        id: videoId,
        localPlaylistPath,
        courseId,
        lessonId,
        title,
        sizeBytes: totalSize,
        downloadedAt: new Date().toISOString() // Fixed syntax
      });
      await this.saveOfflineVideos(existing);

      return localPlaylistPath;
    } catch (e: any) {
      // Cleanup on failure
      await FileSystem.deleteAsync(videoDir).catch(() => {});
      throw new Error("Failed to download video: " + e.message);
    }
  }

  static async deleteOfflineVideo(courseId: number, lessonId: number) {
    const videoId = `${courseId}_${lessonId}`;
    const videoDir = OFFLINE_DIR + videoId + '/';
    await FileSystem.deleteAsync(videoDir, { idempotent: true });
    
    let existing = await this.getOfflineVideos();
    existing = existing.filter(v => v.id !== videoId);
    await this.saveOfflineVideos(existing);
  }

  static async clearAllOfflineVideos() {
    await FileSystem.deleteAsync(OFFLINE_DIR, { idempotent: true });
    await this.initDir();
    await this.saveOfflineVideos([]);
  }
}
