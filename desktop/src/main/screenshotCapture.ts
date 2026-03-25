export type CapturedScreenshot = {
  mimeType: string;
  fileName: string;
  contentBase64: string;
};

export type ScreenshotTarget = "screen-1" | "screen-2";

function buildTimestamp(): string {
  return new Date().toISOString().replaceAll(":", "-");
}

export function createScreenshotCapture(deviceId: string) {
  return async (target: ScreenshotTarget = "screen-1"): Promise<CapturedScreenshot> => {
    const { desktopCapturer } = await import("electron");
    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: {
        width: 1920,
        height: 1080
      }
    });
    const sourceIndex = target === "screen-2" ? 1 : 0;
    const source = sources[sourceIndex] ?? sources[0];

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
