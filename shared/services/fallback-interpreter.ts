import {
  CoreEnv,
  EphemeralState,
  InterpretationResult,
  InterpretationResultSchema,
} from "../types";
import { AgentFactory } from "./agent-factory";
import { BorgLogger } from "./borg-logger";

export class FallbackInterpreter {
  constructor(
    private env: CoreEnv,
    private logger?: BorgLogger,
  ) {}
  async interpret(
    text: string,
    state: EphemeralState,
  ): Promise<InterpretationResult> {
    const response = await AgentFactory.runAgent(
      "INTERPRETER",
      "Eres un intérprete de lenguaje natural para un taller mecánico. Extrae datos del vehículo y servicio en formato JSON.",
      `Contexto actual: ${JSON.stringify(state)}\nUsuario dice: ${text}`,
      [],
      this.env,
      { temperature: 0.1 },
      undefined,
      this.logger,
    );

    if (response.success) {
      const jsonStr = response.text.match(/\{[\s\S]*\}/)?.[0];
      if (jsonStr) {
        try {
          return InterpretationResultSchema.parse(JSON.parse(jsonStr));
        } catch (_e) {
          // Ignorar error de parsing
        }
      }
    }

    return { relevance: "IRRELEVANT", extractedData: {} };
  }
}
