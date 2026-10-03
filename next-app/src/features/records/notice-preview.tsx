export function NoticePreview({ text }: { text: string }) {
  return <article className="notice-reading-preview" aria-label="최종 알림장 미리보기"><pre>{text.split(/(【전체 공지】)/).map((part, index) => part === "【전체 공지】" ? <strong className="notice-announcement-heading" key={index}>{part}</strong> : part)}</pre></article>;
}
