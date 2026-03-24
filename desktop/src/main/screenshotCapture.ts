export type CapturedScreenshot = {
  mimeType: string;
  fileName: string;
  contentBase64: string;
};

function buildTimestamp(): string {
  return new Date().toISOString().replaceAll(":", "-");
}

export function createScreenshotCapture(deviceId: string) {
  return async (): Promise<CapturedScreenshot> => {
    const { desktopCapturer } = await import("electron");
    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: {
        width: 1920,
        height: 1080
      }
    });
    const source = sources[0];

    if (source === undefined || source.thumbnail.isEmpty()) {
      throw new Error("Unable to capture screenshot.");
    }

    return {
      mimeType: "image/png",
      fileName: `${deviceId}-${buildTimestamp()}.png`,
      contentBase64: source.thumbnail.toPNG().toString("base64")
    };
  };
}
