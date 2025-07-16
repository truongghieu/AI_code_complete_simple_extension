import * as vscode from 'vscode';

/**
 * Interface for the result of a lazy edit operation
 */
export interface LazyEditResult {
  /** Whether the edit was successful */
  success: boolean;
  /** Error message if the edit failed */
  error?: string;
  /** The edited content */
  content?: string;
}

/**
 * Interface for the options of a lazy edit operation
 */
export interface LazyEditOptions {
  /** The editor to apply the edit to */
  editor: vscode.TextEditor;
  /** The selection to edit */
  selection?: vscode.Selection;
  /** The language ID of the document */
  languageId: string;
  /** Whether to apply the edit to the entire document */
  entireDocument?: boolean;
  /** The user's instructions for the edit (optional) */
  userInstructions?: string;
}
