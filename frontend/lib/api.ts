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

export async function uploadPdf(file: File): Promise<UploadPdfResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/upload-pdf`, {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Upload failed (${response.status}): ${errorText}`);
  }

  return (await response.json()) as UploadPdfResponse;
}
