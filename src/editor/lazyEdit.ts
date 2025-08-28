import * as vscode from 'vscode';
import { ClaudeApiClient, CompletionRequest } from '../api';
import { LazyEditOptions, LazyEditResult } from './types';
import { 
  applyEditToEditor, 
  createLazyEditPrompt, 
  extractCodeFromResponse, 
  processLazyEditResponse 
} from './utils';
import { getLanguageId } from '../utils';
import { LazyEditAbortManager } from './abortManager';

/**
 * Apply a lazy edit to the given editor
 * @param apiClient The API client to use for the edit
 * @param options The options for the lazy edit
 * @returns A promise that resolves with the result of the lazy edit
 */
export async function applyLazyEdit(
  apiClient: ClaudeApiClient,
  options: LazyEditOptions
): Promise<LazyEditResult> {
  const { editor, selection, languageId, entireDocument } = options;
  const document = editor.document;
  
  // Get the current model from configuration to ensure we're using the same model as the chat panel
  const config = vscode.workspace.getConfiguration('claudeCodeAssistant');
  const currentModel = config.get<string>('model');
  
  // Update the API client's model if it's different from the current one
  if (currentModel && currentModel !== apiClient.getModel()) {
    apiClient.setModel(currentModel);
  }
  
  try {
    // Show a progress notification
    return await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Applying lazy edit...',
        cancellable: true
      },
      async (progress, token) => {
        // Create abort controller
        const abortManager = LazyEditAbortManager.getInstance();
        const editId = `lazy-edit-${Date.now()}`;
        const abortController = abortManager.get(editId);
        
        // Handle cancellation
        token.onCancellationRequested(() => {
          abortManager.abort(editId);
          return { success: false, error: 'Operation cancelled' };
        });
        
        progress.report({ message: 'Getting document content...' });
        
        // Get the content to edit
        let textToEdit: string;
        let editRange: vscode.Range;
        
        if (entireDocument || !selection || selection.isEmpty) {
          // Edit the entire document
          textToEdit = document.getText();
          const lastLine = document.lineCount - 1;
          const lastChar = document.lineAt(lastLine).text.length;
          editRange = new vscode.Range(0, 0, lastLine, lastChar);
        } else {
          // Edit the selected text
          textToEdit = document.getText(selection);
          editRange = selection;
        }
        
        progress.report({ message: 'Preparing edit prompt...' });
        
        // Create the prompt for the lazy edit
        const prompt = createLazyEditPrompt(textToEdit, document.fileName, options.userInstructions);
        
        progress.report({ message: 'Sending to API...' });
        
        // Send the prompt to the API
        const request: CompletionRequest = {
          input: prompt,
          language: getLanguageId(languageId),
          maxTokens: 4000
        };
        
        const response = await apiClient.agentRequest(request);
        
        progress.report({ message: 'Processing response...' });
        
        // Extract the code from the response
        const extractedCode = extractCodeFromResponse(response);
        
        if (!extractedCode) {
          return { 
            success: false, 
            error: 'Failed to extract code from API response' 
          };
        }
        
        // Process the response to handle UNCHANGED_CODE markers
        const processedCode = processLazyEditResponse(textToEdit, extractedCode);
        
        progress.report({ message: 'Applying edits...' });
        
        // Apply the edits to the editor
        const editSuccess = await applyEditToEditor(
          editor,
          processedCode,
          new vscode.Selection(editRange.start, editRange.end)
        );
        
        if (!editSuccess) {
          return { 
            success: false, 
            error: 'Failed to apply edits to editor' 
          };
        }
        
        // Clean up
        abortManager.abort(editId);
        
        return { 
          success: true, 
          content: processedCode 
        };
      }
    );
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
}
