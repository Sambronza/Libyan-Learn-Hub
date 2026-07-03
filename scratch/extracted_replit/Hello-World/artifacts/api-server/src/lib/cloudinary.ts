import { v2 as cloudinary } from "cloudinary";

// Initialize using environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export { cloudinary };

/**
 * Deletes a Cloudinary asset given its secure URL.
 * Automatically parses the resource type and public ID.
 */
export async function deleteFromCloudinaryByUrl(url: string | null | undefined) {
  if (!url || !url.includes("cloudinary.com")) return;
  
  try {
    // Example URL: https://res.cloudinary.com/demo/video/upload/v1234567/folder/file.mp4
    const urlObj = new URL(url);
    const pathname = urlObj.pathname; // /demo/video/upload/v1234567/folder/file.mp4
    
    const parts = pathname.split('/').filter(Boolean); 
    // parts = ['demo', 'video', 'upload', 'v1234567', 'folder', 'file.mp4']
    
    const uploadIndex = parts.indexOf('upload');
    if (uploadIndex === -1) return;
    
    const resourceType = parts[uploadIndex - 1]; // e.g. 'video', 'image', 'raw'
    
    // Find the starting index of the public_id
    let startIndex = uploadIndex + 1;
    if (parts[startIndex] && parts[startIndex].startsWith('v') && !isNaN(parseInt(parts[startIndex].substring(1)))) {
      startIndex++; // Skip the version folder
    }
    
    const publicIdWithExt = parts.slice(startIndex).join('/');
    
    // Cloudinary raw files often keep their extension in the public_id, but video/image do not.
    let publicId = publicIdWithExt;
    if (resourceType !== 'raw') {
      const lastDotIndex = publicIdWithExt.lastIndexOf('.');
      if (lastDotIndex !== -1) {
        publicId = publicIdWithExt.substring(0, lastDotIndex);
      }
    }
    
    console.log(`[Cloudinary] Deleting asset: publicId=${publicId}, resourceType=${resourceType}`);
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (err) {
    console.error("[Cloudinary] Failed to delete asset from url:", url, err);
  }
}
