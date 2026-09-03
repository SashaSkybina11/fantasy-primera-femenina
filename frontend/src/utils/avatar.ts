const maxAvatarDimension = 1200;
const recompressThreshold = 2 * 1024 * 1024;
const rasterTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function optimizeAvatar(file: File) {
  // HEIC/HEIF is not consistently decodable in browsers, so preserve the original
  // and let the server store it with its correct MIME type.
  if (!rasterTypes.has(file.type)) return file;

  try {
    const image = await createImageBitmap(file);
    if (image.width <= maxAvatarDimension && image.height <= maxAvatarDimension && file.size <= recompressThreshold) {
      image.close();
      return file;
    }
    const scale = Math.min(1, maxAvatarDimension / image.width, maxAvatarDimension / image.height);
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      image.close();
      return file;
    }
    context.drawImage(image, 0, 0, width, height);
    image.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", .86));
    return blob ? new File([blob], "avatar.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}
