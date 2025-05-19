/**
 * Variable types
 */
export type VariableType = 'global' | 'character' | 'chat' | 'message';

/**
 * Variable data types
 */
export type VariableDataType = 'array' | 'boolean' | 'number' | 'object' | 'string';

/**
 * Variable item structure
 */
export interface VariableItem {
  /** Variable name */
  name: string;
  /** Variable type */
  type: VariableDataType;
  /** Variable value (can be different data based on type) */
  value: any;
}

/**
 * Variable change event callback type
 */
export type VariableChangeCallback = (type: VariableType, name: string, value: any) => void;
