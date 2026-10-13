import { describe, expect, it, vi } from "vitest";
import type { DeepWriteApi } from "@deepwrite/contracts";
import { readCharacterVoiceProfile } from "./readCharacterVoiceProfile";

type CharacterApi = Pick<
  DeepWriteApi["long"],
  "readCharacterProfile" | "getWorkspaceIndex" | "readDocument"
>;

function fixture() {
  const readDocument = vi.fn(
    async ({ fileId, offset }: { fileId: string; offset: number }) => ({
      content:
        fileId === "relationships"
          ? "与阿青结盟"
          : fileId === "state"
            ? "已经受伤"
            : "昨夜获救",
      offset
    })
  );
  const api = {
    readCharacterProfile: vi.fn(async () => ({
      profile: {
        name: "星离",
        keywords: "少主",
        faceDescription: "红瞳",
        settingDescription: "谨慎",
        appearances: [
          { id: "appearance_one", name: "红衣", description: "繁复长裙" }
        ]
      }
    })),
    getWorkspaceIndex: vi.fn(async () => ({
      workspaceIndex: {
        characterFiles: [
          {
            characterId: "character_star",
            relationships: { id: "relationships" }
          }
        ],
        plot: {
          volumes: [{ id: "volume_one", order: 1 }],
          chapterCards: [
            { id: "chapter_one", volumeId: "volume_one", narrativeOrder: 1 }
          ]
        },
        ledger: {
          commits: [
            { id: "commit_one", chapterCardId: "chapter_one", sequence: 1 }
          ]
        },
        chapters: [
          {
            chapterCardId: "chapter_one",
            commitId: "commit_one",
            characterContinuity: [
              {
                characterId: "character_star",
                currentState: { id: "state" },
                history: { id: "history" }
              }
            ]
          }
        ]
      }
    })),
    readDocument
  } as unknown as CharacterApi;
  return { api, readDocument };
}

describe("readCharacterVoiceProfile", () => {
  it("reads the saved relationship and latest committed continuity for the selected character", async () => {
    const { api, readDocument } = fixture();
    const result = await readCharacterVoiceProfile(
      "book_one",
      "character_star",
      api
    );

    expect(result).toMatchObject({
      name: "星离",
      keywords: "少主",
      faceDescription: "红瞳",
      settingDescription: "谨慎",
      relationships: "与阿青结盟",
      currentState: "已经受伤",
      history: "昨夜获救"
    });
    expect(result).not.toHaveProperty("appearanceDescriptions");
    expect(readDocument.mock.calls.map(([input]) => input.fileId)).toEqual(
      expect.arrayContaining(["relationships", "state", "history"])
    );
  });

  it("returns empty continuity when no chapter has a committed record for this character", async () => {
    const { api, readDocument } = fixture();
    vi.mocked(api.getWorkspaceIndex).mockResolvedValueOnce({
      workspaceIndex: {
        characterFiles: [
          {
            characterId: "character_star",
            relationships: { id: "relationships" }
          }
        ],
        plot: { volumes: [], chapterCards: [] },
        ledger: { commits: [] },
        chapters: []
      }
    } as unknown as Awaited<ReturnType<CharacterApi["getWorkspaceIndex"]>>);

    const result = await readCharacterVoiceProfile(
      "book_one",
      "character_star",
      api
    );
    expect(result.currentState).toBe("");
    expect(result.history).toBe("");
    expect(readDocument).toHaveBeenCalledTimes(1);
  });

  it("reads every page of relationships, current state, and history", async () => {
    const { api, readDocument } = fixture();
    readDocument.mockImplementation(async ({ fileId, offset }) => {
      const parts: Record<string, [string, string]> = {
        relationships: ["关系前段", "关系后段"],
        state: ["状态前段", "状态后段"],
        history: ["历史前段", "历史后段"]
      };
      const [first, second] = parts[fileId]!;
      return offset === 0
        ? {
            content: first,
            offset,
            totalCharacters: first.length + second.length,
            nextOffset: first.length
          }
        : {
            content: second,
            offset,
            totalCharacters: first.length + second.length,
            nextOffset: null
          };
    });

    const result = await readCharacterVoiceProfile(
      "book_one",
      "character_star",
      api
    );
    expect(result.relationships).toBe("关系前段关系后段");
    expect(result.currentState).toBe("状态前段状态后段");
    expect(result.history).toBe("历史前段历史后段");
    expect(readDocument).toHaveBeenCalledTimes(6);
  });
});
