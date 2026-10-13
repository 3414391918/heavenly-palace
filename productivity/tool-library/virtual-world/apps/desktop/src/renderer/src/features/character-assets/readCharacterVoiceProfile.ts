import type { DeepWriteApi } from "@deepwrite/contracts";
import { latestCommittedContinuityChapter } from "../../utils/longLatestContinuityChapter";
import { characterApi } from "./character-api";
import type { CharacterVoiceProfile } from "./generateCharacterVoiceText";

export type CharacterVoiceReadApi = Pick<
  DeepWriteApi["long"],
  "readCharacterProfile" | "getWorkspaceIndex" | "readDocument"
>;

export async function readCharacterVoiceProfile(
  bookId: string,
  characterId: string,
  api: CharacterVoiceReadApi = characterApi()
): Promise<CharacterVoiceProfile> {
  const [saved, indexed] = await Promise.all([
    api.readCharacterProfile({ bookId, characterId }),
    api.getWorkspaceIndex({ bookId })
  ]);
  const index = indexed.workspaceIndex;
  const characterFiles = index.characterFiles.find(
    (entry) => entry.characterId === characterId
  );
  if (!characterFiles) throw new Error("角色档案索引不存在，请重新读取。");
  const chapter = latestCommittedContinuityChapter(index, (candidate) =>
    candidate.characterContinuity.some(
      (entry) => entry.characterId === characterId
    )
  );
  const continuity = chapter?.characterContinuity.find(
    (entry) => entry.characterId === characterId
  );
  const readAll = async (fileId: string) => {
    const parts: string[] = [];
    let offset: number | null = 0;
    while (offset !== null) {
      const page = await api.readDocument({
        bookId,
        fileId,
        offset,
        maxCharacters: 32_768
      });
      parts.push(page.content);
      if (page.nextOffset != null && page.nextOffset <= offset)
        throw new Error("角色资料读取位置未前进，请重新读取。");
      offset = page.nextOffset ?? null;
    }
    return parts.join("");
  };
  const [relationships, currentState, history] = await Promise.all([
    readAll(characterFiles.relationships.id),
    continuity ? readAll(continuity.currentState.id) : "",
    continuity ? readAll(continuity.history.id) : ""
  ]);
  const { name, keywords, faceDescription, settingDescription } = saved.profile;
  return {
    name,
    keywords,
    faceDescription,
    settingDescription,
    relationships,
    currentState,
    history
  };
}
