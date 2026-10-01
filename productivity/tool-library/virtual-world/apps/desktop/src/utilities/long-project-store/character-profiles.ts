import {
  LONG_WORKSPACE_INDEX_PATH,
  LongProjectManifestSchema,
  LongReadCharacterProfileInputSchema,
  LongSaveCharacterProfileInputSchema,
  LongWorkspaceIndexSnapshotSchema,
  isStructuredLongCharacterProfileMarkdown,
  longCharacterKeywordsAliases,
  serializeLongCharacterProfileMarkdown,
  type LongReadCharacterProfileInput,
  type LongSaveCharacterProfileInput
} from "@deepwrite/contracts";
import {
  commitProjectTransaction,
  type ProjectTransactionFileOperation
} from "../project-transaction";
import {
  assertCharacterAssetsAppearances,
  characterAssetPaths,
  characterProfileSnapshot,
  loadCharacterProfileState
} from "./character-profile-context";
import { encodeUtf8Strict, secureDirectory, serializeJson } from "./io";
import type { LongProjectStoreContext } from "./store-context";
import {
  MANIFEST_PATH,
  MAX_DOCUMENT_BYTES,
  MAX_LEDGER_RECORD_BYTES
} from "./types";

export async function readCharacterProfile(
  ctx: LongProjectStoreContext,
  projectDirectory: string,
  input: LongReadCharacterProfileInput
) {
  const parsed = LongReadCharacterProfileInputSchema.parse(input);
  const canonical = await secureDirectory(projectDirectory, "长篇项目目录");
  return await ctx.runExclusive(canonical, async () =>
    characterProfileSnapshot(
      await loadCharacterProfileState(ctx, canonical, parsed)
    )
  );
}

export async function saveCharacterProfile(
  ctx: LongProjectStoreContext,
  projectDirectory: string,
  input: LongSaveCharacterProfileInput
) {
  const parsed = LongSaveCharacterProfileInputSchema.parse(input);
  const canonical = await secureDirectory(projectDirectory, "长篇项目目录");
  return await ctx.runExclusive(canonical, async () => {
    const state = await loadCharacterProfileState(ctx, canonical, parsed);
    if (characterProfileSnapshot(state).revision !== parsed.expectedRevision)
      throw new Error(
        "角色档案已在其他位置更新。请重新读取后再保存，避免覆盖较新的修改。"
      );
    assertCharacterAssetsAppearances(parsed.profile, state.manifest);
    const profileContent = serializeLongCharacterProfileMarkdown(
      parsed.profile
    );
    if (encodeUtf8Strict(profileContent).byteLength > MAX_DOCUMENT_BYTES)
      throw new Error("角色核心档案超过 32 MiB 大小限制。");
    const timestamp = ctx.timestamp();
    const nextIndex = LongWorkspaceIndexSnapshotSchema.parse(
      structuredClone(state.loaded.index)
    );
    const character = nextIndex.characters.find(
      ({ id }) => id === parsed.characterId
    )!;
    character.name = parsed.profile.name;
    character.aliases = longCharacterKeywordsAliases(parsed.profile.keywords);
    nextIndex.characterFiles.find(
      ({ characterId }) => characterId === parsed.characterId
    )!.coreProfile.updatedAt = timestamp;
    nextIndex.updatedAt = timestamp;
    const manifest = LongProjectManifestSchema.parse({
      ...state.loaded.manifest,
      updatedAt: timestamp,
      workspaceIndexFile: {
        ...state.loaded.manifest.workspaceIndexFile,
        updatedAt: timestamp
      }
    });
    const operations: ProjectTransactionFileOperation[] = [
      {
        path: state.file.reference.path,
        content: profileContent,
        expectedSha256: state.file.disk.sha256
      },
      {
        path: LONG_WORKSPACE_INDEX_PATH,
        content: serializeJson(nextIndex),
        expectedSha256: state.loaded.indexDisk.sha256
      },
      {
        path: MANIFEST_PATH,
        content: serializeJson(manifest),
        expectedSha256: state.loaded.manifestDisk.sha256
      }
    ];
    if (!isStructuredLongCharacterProfileMarkdown(state.file.disk.content))
      operations.push({
        path: characterAssetPaths(state.file.reference.path).legacy,
        content: state.file.disk.bytes,
        expectedSha256: null
      });
    // Keep the generic transaction's optimistic checks for this explicit form save.
    await commitProjectTransaction({
      projectRoot: canonical,
      operations,
      maxFileBytes: MAX_LEDGER_RECORD_BYTES
    });
    return characterProfileSnapshot(
      await loadCharacterProfileState(ctx, canonical, parsed)
    );
  });
}
