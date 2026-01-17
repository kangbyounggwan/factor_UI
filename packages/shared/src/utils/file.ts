/**
 * 파일 관련 유틸리티 함수
 * aiService.ts, chatApiService.ts에서 중복된 함수 통합
 */

/**
 * File 객체를 Base64 문자열로 변환
 * @param file - 변환할 File 객체
 * @returns Base64 인코딩된 문자열 (data:... prefix 제외)
 */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // data:image/...;base64, 부분 제거하고 순수 base64만 반환
      const base64 = result.split(',')[1] || result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * 여러 File 객체를 Base64 배열로 변환
 * @param files - 변환할 File 객체 배열
 * @returns Base64 인코딩된 문자열 배열
 */
export async function filesToBase64(files: File[]): Promise<string[]> {
  return Promise.all(files.map(fileToBase64));
}
