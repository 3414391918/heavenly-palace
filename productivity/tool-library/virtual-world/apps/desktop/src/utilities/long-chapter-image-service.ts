import {
  LongReadChapterImageInputSchema,
  LongReplaceChapterImageInputSchema,
  type LongReadChapterImageInput,
  type LongReplaceChapterImageInput
} from "@deepwrite/contracts";
import type { LongProjectCatalog } from "./long-project-catalog";
import type { LongProjectStore } from "./long-project-store";

/** Registry resolution stays outside the physical chapter image store. */
export class LongChapterImageService {
  constructor(
    private readonly catalog: LongProjectCatalog,
    private readonly store: LongProjectStore
  ) {}

  async readChapterImage(input: LongReadChapterImageInput) {
    const parsed = LongReadChapterImageInputSchema.parse(input);
    const opened = await this.catalog.open(parsed.bookId);
    return await this.store.readChapterImage(opened.projectDirectory, parsed);
  }

  async replaceChapterImage(input: LongReplaceChapterImageInput) {
    const parsed = LongReplaceChapterImageInputSchema.parse(input);
    const opened = await this.catalog.open(parsed.bookId);
    return await this.store.replaceChapterImage(
      opened.projectDirectory,
      parsed
    );
  }
}
