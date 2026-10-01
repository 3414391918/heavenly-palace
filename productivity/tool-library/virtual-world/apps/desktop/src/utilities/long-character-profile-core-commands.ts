import {
  LongCharacterProfileSnapshotSchema,
  type CommandEnvelope,
  type CommandResult
} from "@deepwrite/contracts";
import type { LongWorkspaceService } from "./long-workspace-service";

export async function handleLongCharacterProfileCoreCommand(
  service: LongWorkspaceService,
  command: CommandEnvelope
): Promise<CommandResult | undefined> {
  let payload;
  switch (command.type) {
    case "long.readCharacterProfile":
      payload = await service.readCharacterProfile(command.payload);
      break;
    case "long.saveCharacterProfile":
      payload = await service.saveCharacterProfile(command.payload);
      break;
    case "long.importCharacterAssetsAtPaths":
      payload = await service.importCharacterAssetsAtPaths(command.payload);
      break;
    case "long.renameCharacterAsset":
      payload = await service.renameCharacterAsset(command.payload);
      break;
    case "long.deleteCharacterAsset":
      payload = await service.deleteCharacterAsset(command.payload);
      break;
    default:
      return undefined;
  }
  return {
    status: "accepted",
    requestId: command.id,
    payload: LongCharacterProfileSnapshotSchema.parse(payload)
  };
}
