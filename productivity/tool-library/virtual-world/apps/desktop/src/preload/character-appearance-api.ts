import {
  CommandEnvelopeSchema,
  createEnvelope,
  LongGetCharacterAppearanceReferencesInputSchema,
  LongGetCharacterAppearanceReferencesResultSchema,
  LongDeleteCharacterAppearanceInputSchema,
  LongDeleteCharacterAppearanceResultSchema,
  type LongDeleteCharacterAppearanceInput,
  type LongGetCharacterAppearanceReferencesInput
} from "@deepwrite/contracts";
import { browserId, invokeCommand } from "./invoke";

export async function getCharacterAppearanceReferences(
  raw: LongGetCharacterAppearanceReferencesInput
) {
  const input = LongGetCharacterAppearanceReferencesInputSchema.parse(raw);
  const id = browserId("cmd_character_reference");
  return LongGetCharacterAppearanceReferencesResultSchema.parse(
    await invokeCommand<unknown>(
      CommandEnvelopeSchema.parse(
        createEnvelope("long.getCharacterAppearanceReferences", input, {
          id,
          correlationId: id,
          context: { resourceId: input.bookId }
        })
      )
    )
  );
}

export async function deleteCharacterAppearance(
  raw: LongDeleteCharacterAppearanceInput
) {
  const input = LongDeleteCharacterAppearanceInputSchema.parse(raw);
  const id = browserId("cmd_character_appearance_delete");
  return LongDeleteCharacterAppearanceResultSchema.parse(
    await invokeCommand<unknown>(
      CommandEnvelopeSchema.parse(
        createEnvelope("long.deleteCharacterAppearance", input, {
          id,
          correlationId: id,
          context: { resourceId: input.bookId }
        })
      )
    )
  );
}
