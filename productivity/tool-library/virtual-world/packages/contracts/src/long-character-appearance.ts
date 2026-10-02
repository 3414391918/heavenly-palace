import { z } from "zod";
import {
  LongCharacterAppearanceIdSchema,
  LongCharacterAssetIdSchema,
  LongCharacterProfileSnapshotSchema,
  LongCharacterAssetFilenameSchema,
  LongReadCharacterProfileInputSchema
} from "./long-character-profile";
import { LongBookIdSchema, LongCharacterIdSchema } from "./long-workspace/ids";
import { LongTitleSchema } from "./long-workspace/primitives";

const AbsolutePathSchema = z
  .string()
  .min(1)
  .max(4096)
  .refine(
    (value) =>
      value.startsWith("/") ||
      /^[A-Za-z]:[\\/]/u.test(value) ||
      value.startsWith("\\\\"),
    "必须是绝对路径。"
  );
export const LongCharacterAppearanceStorageSchema = z
  .object({
    coreProfilePath: AbsolutePathSchema,
    assetsManifestPath: AbsolutePathSchema,
    assetsDirectory: AbsolutePathSchema
  })
  .strict();
export type LongCharacterAppearanceStorage = z.infer<
  typeof LongCharacterAppearanceStorageSchema
>;

export const LongCharacterAppearanceReferenceSchema = z
  .object({
    id: LongCharacterAppearanceIdSchema,
    name: LongTitleSchema,
    assets: z
      .array(
        z
          .object({
            label: z.string().min(1).max(256),
            filename: LongCharacterAssetFilenameSchema
          })
          .strict()
      )
      .min(1)
      .max(10_000)
  })
  .strict();
export type LongCharacterAppearanceReference = z.infer<
  typeof LongCharacterAppearanceReferenceSchema
>;

export const LongCharacterAppearanceReferenceCharacterSchema = z
  .object({
    characterId: LongCharacterIdSchema,
    name: LongTitleSchema,
    assetsDirectory: AbsolutePathSchema,
    assetsManifestPath: AbsolutePathSchema,
    appearances: z
      .array(LongCharacterAppearanceReferenceSchema)
      .min(1)
      .max(1000)
  })
  .strict();
export type LongCharacterAppearanceReferenceCharacter = z.infer<
  typeof LongCharacterAppearanceReferenceCharacterSchema
>;

export const LongGetCharacterAppearanceReferencesInputSchema =
  LongReadCharacterProfileInputSchema;
export type LongGetCharacterAppearanceReferencesInput = z.infer<
  typeof LongGetCharacterAppearanceReferencesInputSchema
>;
export const LongGetCharacterAppearanceReferencesResultSchema = z
  .object({
    bookId: LongBookIdSchema,
    characterId: LongCharacterIdSchema,
    target: LongCharacterAppearanceStorageSchema,
    characters: z
      .array(LongCharacterAppearanceReferenceCharacterSchema)
      .max(10_000)
  })
  .strict();
export type LongGetCharacterAppearanceReferencesResult = z.infer<
  typeof LongGetCharacterAppearanceReferencesResultSchema
>;

export const LongDeleteCharacterAppearanceInputSchema =
  LongReadCharacterProfileInputSchema.extend({
    appearanceId: LongCharacterAppearanceIdSchema,
    expectedRevision: z.string().regex(/^[a-f0-9]{64}$/u),
    expectedAssetIds: z
      .array(LongCharacterAssetIdSchema)
      .max(10_000)
      .refine((ids) => new Set(ids).size === ids.length, "图片标识不能重复。")
  }).strict();
export type LongDeleteCharacterAppearanceInput = z.infer<
  typeof LongDeleteCharacterAppearanceInputSchema
>;
export const LongDeleteCharacterAppearanceResultSchema =
  LongCharacterProfileSnapshotSchema.extend({
    directoryCleanupWarning: z.string().min(1).max(4096).optional()
  }).strict();
export type LongDeleteCharacterAppearanceResult = z.infer<
  typeof LongDeleteCharacterAppearanceResultSchema
>;
