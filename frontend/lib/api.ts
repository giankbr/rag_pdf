export type ChatSource = {
  document_id: number;
  page_number: number | null;
  score: number;
  source_type?: string;
};

export type ChatResponse = {
  answer: string;
  sources: ChatSource[];
};

export type UploadPdfResponse = {
  status: string;
  document_id: number;
  file_name: string;
  chunks: number;
  file_url: string;
};

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8010";
const UPLOAD_TIMEOUT_MS = 10 * 60 * 1000;

async function postChat(baseUrl: string, question: string, documentId?: number | null): Promise<Response> {
  return fetch(`${baseUrl}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      question,
      document_id: documentId ?? null
    })
  });
}

export async function askChatbot(params: { question: string; documentId?: number | null }): Promise<ChatResponse> {
  const { question, documentId } = params;
  let response: Response;
  try {
    response = await postChat(API_BASE_URL, question, documentId);
  } catch (error) {
    if (API_BASE_URL.endsWith(":8000")) {
      response = await postChat("http://127.0.0.1:8010", question, documentId);
    } else {
      throw error;
    }
  }

  if (!response.ok && API_BASE_URL.endsWith(":8000")) {
    response = await postChat("http://127.0.0.1:8010", question, documentId);
  }

  if (!response.ok) {
    throw new Error(`Chat request failed with status ${response.status}`);
  }

  return (await response.json()) as ChatResponse;
}

type UploadPdfOptions = {
  onProgress?: (percent: number) => void;
};

function uploadPdfXhr(
  file: File,
  options: UploadPdfOptions,
  attempt: number
): Promise<UploadPdfResponse> {
  const formData = new FormData();
  formData.append("file", file);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE_URL}/upload-pdf`);
    xhr.timeout = UPLOAD_TIMEOUT_MS;

    xhr.upload.onprogress = (event) => {
      if (!options.onProgress || !event.lengthComputable) return;
      const raw = Math.round((event.loaded / event.total) * 100);
      options.onProgress(Math.min(raw, 95));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const parsed = JSON.parse(xhr.responseText) as UploadPdfResponse;
          resolve(parsed);
        } catch {
          reject(new Error("Upload succeeded but response JSON is invalid"));
        }
        return;
      }
      reject(new Error(`Upload failed (${xhr.status}): ${xhr.responseText}`));
    };

    xhr.onerror = () => {
      if (attempt < 1) {
        uploadPdfXhr(file, options, attempt + 1).then(resolve).catch(reject);
        return;
      }
      reject(new Error("Upload failed due to network error"));
    };

    xhr.ontimeout = () => {
      reject(new Error("Upload timed out while waiting for server processing"));
    };

    xhr.send(formData);
  });
}

export async function uploadPdf(file: File, options: UploadPdfOptions = {}): Promise<UploadPdfResponse> {
  const result = await uploadPdfXhr(file, options, 0);
  if (options.onProgress) {
    options.onProgress(100);
  }
  return result;
}
