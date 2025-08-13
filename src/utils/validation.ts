import { ClientData, WorkerData, TaskData, ValidationError } from '@/types';

export const validateClients = (data: ClientData[]): ValidationError[] => {
  const errors: ValidationError[] = [];
  const ids = new Set();
  
  data.forEach((client, index) => {
    // Check for duplicate IDs
    if (ids.has(client.ClientID)) {
      errors.push({
        type: 'duplicate_id',
        message: `Duplicate ClientID: ${client.ClientID}`,
        row: index + 1,
        column: 'ClientID'
      });
    }
    ids.add(client.ClientID);

    // Validate PriorityLevel
    if (client.PriorityLevel < 1 || client.PriorityLevel > 5) {
      errors.push({
        type: 'out_of_range',
        message: `PriorityLevel must be 1-5, got: ${client.PriorityLevel}`,
        row: index + 1,
        column: 'PriorityLevel'
      });
    }

    // Check required fields
    if (!client.ClientID || !client.ClientName) {
      errors.push({
        type: 'missing_required',
        message: 'Missing required ClientID or ClientName',
        row: index + 1,
        column: 'ClientID/ClientName'
      });
    }

    // Validate JSON
    try {
      if (client.AttributesJSON) {
        JSON.parse(client.AttributesJSON);
      }
    } catch (e) {
      errors.push({
        type: 'invalid_json',
        message: 'Invalid JSON in AttributesJSON',
        row: index + 1,
        column: 'AttributesJSON'
      });
    }
  });

  return errors;
};

// Add validateWorkers and validateTasks functions similarly