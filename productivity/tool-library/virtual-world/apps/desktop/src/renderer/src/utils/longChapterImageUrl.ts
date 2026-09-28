export function longChapterImageUrl(
  bookId: string,
  documentPath: string,
  source: string
): string | undefined {
  const chapter = /^long\/chapters\/([a-f0-9]{32})\/body\.md$/.exec(
    documentPath
  )?.[1];
  const filename = /^images\/([\w.-]+\.(?:png|jpe?g|webp|gif|avif))$/i.exec(
    source
  )?.[1];
  if (!chapter || !filename) {
    return undefined;
  }
  return `deepwrite-image://book/${bookId}/${chapter}/${filename}`;
}
