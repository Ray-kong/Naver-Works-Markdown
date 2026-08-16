export const STRINGS = {
  preview: "미리보기",
  showPreview: "프리뷰 보기",
  hidePreview: "프리뷰 닫기",
  checkingFile: "파일 확인 중…",
  expiredFile: "만료된 파일",
  unavailableFile: "미리보기 불가",
  loading: "불러오는 중…",
  renderError: "미리보기를 표시할 수 없습니다.",
  fileError: "파일을 불러올 수 없습니다.",
  fileTooLarge: "파일이 너무 커서 미리볼 수 없습니다.",
  messageTooLong: "메시지가 너무 길어 미리볼 수 없습니다.",
  fileTimeout: "파일을 불러오는 데 시간이 초과되었습니다.",
  unsupportedFile: "지원하지 않는 파일 형식입니다."
} as const;

export type LocalizedStringKey = keyof typeof STRINGS;

export const getString = (key: LocalizedStringKey): string => STRINGS[key];
