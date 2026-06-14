export async function listFiles() {
  // TODO: Implement Google Drive API list
  return [];
}

export async function uploadFile(fileBuffer: Buffer, fileName: string) {
  // TODO: Implement Google Drive API upload
  return { id: 'mock-file-id' };
}

export async function downloadFile(fileId: string) {
  // TODO: Implement Google Drive API download
  return Buffer.from('mock data');
}
