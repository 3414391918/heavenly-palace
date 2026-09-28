import {
  CommandEnvelopeSchema,
  createEnvelope,
  RevisionAnalysisSettingsSchema,
  type RevisionAnalysisApi,
  type CommandEnvelope
} from "@deepwrite/contracts";
import { browserId, invokeCommand } from "./invoke";
async function request(type: CommandEnvelope["type"], payload: unknown) {
  const id = browserId("revision_analysis");
  return RevisionAnalysisSettingsSchema.parse(
    await invokeCommand(
      CommandEnvelopeSchema.parse(
        createEnvelope(type, payload, { id, correlationId: id })
      )
    )
  );
}
export const revisionAnalysisApi: RevisionAnalysisApi = {
  list: () => request("revisionAnalysisSettings.list", {}),
  save: (input) =>
    request(
      "revisionAnalysisSettings.save",
      RevisionAnalysisSettingsSchema.parse(input)
    ),
  reset: () => request("revisionAnalysisSettings.reset", {})
};
