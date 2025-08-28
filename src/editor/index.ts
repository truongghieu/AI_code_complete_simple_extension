import * as vscode from 'vscode';
import { ClaudeApiClient } from '../api';
import { getLanguageId } from '../utils';
import { applyLazyEdit } from './lazyEdit';
import { showInlineInputBox } from './inlineInput';
import { GhostCompletionManager } from './ghostCompletion';

/**
 * Register the editor commands
 * @param context The extension context
 * @param apiClient The API client to use for the editor
 */
export function registerEditorCommands(
  context: vscode.ExtensionContext,
  apiClient: ClaudeApiClient
): void {
  // Initialize ghost completion manager
  const ghostCompletionManager = GhostCompletionManager.getInstance(apiClient);
  context.subscriptions.push({
    dispose: () => ghostCompletionManager.dispose()
  });

  // Register the lazy edit command
  const lazyEditCommand = vscode.commands.registerCommand(
    'claudeCodeAssistant.lazyEdit',
    async () => {
      const editor = vscode.window.activeTextEditor;
      
      if (!editor) {
        vscode.window.showErrorMessage('No active editor found');
        return;
      }
      
      // Get the selection or entire document
      const selection = editor.selection;
      const document = editor.document;
      
      // Get the selected text or entire document
      let code: string;
      if (selection.isEmpty) {
        // Use entire document if no selection
        code = document.getText();
      } else {
        // Use selected text
        code = document.getText(selection);
      }
      
      // Get language ID
      const language = getLanguageId(document.languageId);
      
      // Show an inline input box at the cursor position
      const userInput = await showInlineInputBox(
        editor,
        'e.g., Refactor this code to use async/await'
      );
      
      if (userInput) {
        // Show progress notification
        vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Applying lazy edit...',
            cancellable: true
          },
          async (progress, token) => {
            progress.report({ message: 'Processing your request...' });
            
            // Apply the lazy edit directly with user instructions
            const result = await applyLazyEdit(apiClient, {
              editor,
              selection,
              languageId: language,
              entireDocument: selection.isEmpty,
              userInstructions: userInput
            });
            
            if (result.success) {
              vscode.window.showInformationMessage('Lazy edit applied successfully!');
            } else {
              vscode.window.showErrorMessage(`Failed to apply lazy edit: ${result.error}`);
            }
          }
        );
      }
    }
  );
  
  // Add the command to the context
  context.subscriptions.push(lazyEditCommand);
}

// No exports needed
