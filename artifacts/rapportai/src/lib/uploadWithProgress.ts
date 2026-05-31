export interface UploadProgressOptions {
  onProgress: (pct: number) => void;
}

export function uploadWithProgress(
  url: string,
  formData: FormData,
  { onProgress }: UploadProgressOptions
): Promise<{ ok: boolean; status: number; text: () => Promise<string>; json: <T = unknown>() => Promise<T> }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.upload.addEventListener("load", () => onProgress(100));

    xhr.addEventListener("load", () => {
      const responseText = xhr.responseText;
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        text: () => Promise.resolve(responseText),
        json: <T>() => Promise.resolve(JSON.parse(responseText) as T),
      });
    });

    xhr.addEventListener("error", () => reject(new Error("Erreur réseau")));
    xhr.addEventListener("abort", () => {
      const err = new Error("AbortError");
      err.name = "AbortError";
      reject(err);
    });

    xhr.send(formData);
  });
}
