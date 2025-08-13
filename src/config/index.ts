export const CONFIG = {
  validationRules: {
    priorityLevelRange: { min: 1, max: 5 },
    minDuration: 1,
    maxLoadPerPhase: 1
  },
  aiModels: {
    default: "gpt-4"
  },
  exportFileName: "resource-configuration.json"
};