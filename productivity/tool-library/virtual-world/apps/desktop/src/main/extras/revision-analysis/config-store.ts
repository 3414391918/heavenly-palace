import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  DEFAULT_REVISION_METHOD,
  RevisionAnalysisSettingsSchema,
  type RevisionAnalysisSettings,
  type CommandEnvelope,
  type CommandResult
} from "@deepwrite/contracts";
export class RevisionAnalysisConfigStore {
  constructor(private readonly directory: string) {}
  async list(): Promise<RevisionAnalysisSettings> {
    try {
      return RevisionAnalysisSettingsSchema.parse(
        JSON.parse(
          await readFile(
            join(this.directory, "revision-analysis-settings.json"),
            "utf8"
          )
        )
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        return { systemPrompt: DEFAULT_REVISION_METHOD };
      throw error;
    }
  }
  async save(input: RevisionAnalysisSettings) {
    const settings = RevisionAnalysisSettingsSchema.parse(input);
    await mkdir(this.directory, { recursive: true });
    const target = join(this.directory, "revision-analysis-settings.json");
    const temporary = `${target}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(settings, null, 2), "utf8");
    await rename(temporary, target);
    return settings;
  }
  async handle(command: CommandEnvelope): Promise<CommandResult | undefined> {
    if (
      command.type !== "revisionAnalysisSettings.list" &&
      command.type !== "revisionAnalysisSettings.save" &&
      command.type !== "revisionAnalysisSettings.reset"
    )
      return undefined;
    try {
      const payload =
        command.type === "revisionAnalysisSettings.list"
          ? await this.list()
          : await this.save(
              command.type === "revisionAnalysisSettings.reset"
                ? { systemPrompt: DEFAULT_REVISION_METHOD }
                : command.payload
            );
      return { requestId: command.id, status: "accepted", payload };
    } catch (error) {
      return {
        requestId: command.id,
        status: "rejected",
        error: {
          code: "revision_analysis.settings_failed",
          message:
            error instanceof Error ? error.message : "修改分析设置操作失败。"
        }
      };
    }
  }
}
