import * as vscode from 'vscode';
import { ClaudeApiClient, CompletionRequest } from '../api';
import { getLanguageId } from '../utils';

export interface GhostCompletionOptions {
  editor: vscode.TextEditor;
  position: vscode.Position;
  context: string;
  languageId: string;
}

export interface GhostCompletionResult {
  success: boolean;
  completion?: string;
  error?: string;
}

export class GhostCompletionManager {
  private static instance: GhostCompletionManager;
  private apiClient: ClaudeApiClient;
  private idleTimer: NodeJS.Timeout | null = null;
  private currentDecoration: vscode.TextEditorDecorationType | null = null;
  private currentGhostText: string = '';
  private currentEditor: vscode.TextEditor | null = null;
  private currentPosition: vscode.Position | null = null;
  private isShowingPrompt: boolean = false;
  private disposables: vscode.Disposable[] = [];
  private readonly IDLE_TIMEOUT = 3000; // 3 seconds

  private constructor(apiClient: ClaudeApiClient) {
    this.apiClient = apiClient;
    this.setupEventListeners();
  }

  public static getInstance(apiClient?: ClaudeApiClient): GhostCompletionManager {
    if (!GhostCompletionManager.instance && apiClient) {
      GhostCompletionManager.instance = new GhostCompletionManager(apiClient);
    }
    return GhostCompletionManager.instance;
  }

  private setupEventListeners(): void {
    // Listen for text document changes
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((event) => {
        const editor = vscode.window.activeTextEditor;
        if (editor && event.document === editor.document) {
          this.onTextChange(editor);
        }
      })
    );

    // Listen for cursor position changes
    this.disposables.push(
      vscode.window.onDidChangeTextEditorSelection((event) => {
        this.onCursorChange(event.textEditor);
      })
    );

    // Listen for active editor changes
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        this.clearGhostText();
        if (editor) {
          this.onTextChange(editor);
        }
      })
    );

    // Listen for Tab key press to accept ghost completion
    this.disposables.push(
      vscode.commands.registerCommand('claudeCodeAssistant.acceptGhostCompletion', () => {
        this.acceptGhostCompletion();
      })
    );

    // Listen for Escape key to dismiss ghost completion
    this.disposables.push(
      vscode.commands.registerCommand('claudeCodeAssistant.dismissGhostCompletion', () => {
        this.clearGhostText();
      })
    );
  }

  private onTextChange(editor: vscode.TextEditor): void {
    // Clear any existing timer and ghost text
    this.resetIdleTimer();
    this.clearGhostText();

    // Don't start timer if we're showing a prompt
    if (this.isShowingPrompt) {
      return;
    }

    // Start new idle timer
    this.idleTimer = setTimeout(() => {
      this.onIdle(editor);
    }, this.IDLE_TIMEOUT);
  }

  private onCursorChange(editor: vscode.TextEditor): void {
    // Clear ghost text if cursor moved away from the ghost position
    if (this.currentPosition && this.currentEditor === editor) {
      const currentPos = editor.selection.active;
      if (!currentPos.isEqual(this.currentPosition)) {
        this.clearGhostText();
      }
    }
  }

  private resetIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private async onIdle(editor: vscode.TextEditor): Promise<void> {
    // Don't show prompt if already showing one
    if (this.isShowingPrompt) {
      return;
    }

    // Get current cursor position and surrounding context
    const position = editor.selection.active;
    const document = editor.document;
    
    // Get context around cursor (previous 10 lines and current line up to cursor)
    const startLine = Math.max(0, position.line - 10);
    const endLine = position.line;
    const contextRange = new vscode.Range(startLine, 0, endLine, position.character);
    const context = document.getText(contextRange);

    // Only show prompt if there's meaningful context
    if (context.trim().length < 10) {
      return;
    }

    this.isShowingPrompt = true;

    try {
      // Show quick pick to ask user
      const choice = await vscode.window.showQuickPick(
        [
          { label: 'Yes', description: 'Generate AI code completion' },
          { label: 'No', description: 'Continue coding without AI assistance' }
        ],
        {
          placeHolder: 'Would you like AI to complete your code?',
          ignoreFocusOut: false
        }
      );

      if (choice && choice.label === 'Yes') {
        await this.generateGhostCompletion({
          editor,
          position,
          context,
          languageId: document.languageId
        });
      }
    } catch (error) {
      console.error('Error showing completion prompt:', error);
    } finally {
      this.isShowingPrompt = false;
    }
  }

  private async generateGhostCompletion(options: GhostCompletionOptions): Promise<GhostCompletionResult> {
    const { editor, position, context, languageId } = options;

    try {
      // Show progress
      return await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Generating AI completion...',
          cancellable: true
        },
        async (progress, token) => {
          progress.report({ message: 'Analyzing context...' });

          // Create prompt for code completion
          const prompt = this.createCompletionPrompt(context, languageId);

          progress.report({ message: 'Requesting completion...' });

          // Get completion from API
          const request: CompletionRequest = {
            input: prompt,
            language: getLanguageId(languageId),
            maxTokens: 500
          };

          const completion = await this.apiClient.agentRequest(request);

          if (token.isCancellationRequested) {
            return { success: false, error: 'Cancelled' };
          }

          // Extract and clean the completion
          const cleanedCompletion = this.extractCompletion(completion);

          if (cleanedCompletion) {
            progress.report({ message: 'Showing completion...' });
            this.showGhostText(editor, position, cleanedCompletion);
            return { success: true, completion: cleanedCompletion };
          } else {
            return { success: false, error: 'No valid completion generated' };
          }
        }
      );
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private createCompletionPrompt(context: string, languageId: string): string {
    return `You are a code completion assistant. Given the following code context, provide a natural continuation that completes the current line or adds the next logical lines of code.

Language: ${languageId}

Context:
\`\`\`${languageId}
${context}
\`\`\`

Instructions:
- Only provide the completion text that should be added after the cursor
- Do not repeat the existing context
- Keep the completion concise and focused (1-3 lines typically)
- Ensure proper syntax and indentation
- Do not include code block markers in your response
- Provide only the raw code that should be inserted

Completion:`;
  }

  private extractCompletion(response: string): string {
    // Remove code block markers if present
    let completion = response.replace(/```[\w]*\n?/g, '').trim();
    
    // Remove any leading/trailing whitespace
    completion = completion.trim();
    
    // Limit to reasonable length (max 3 lines)
    const lines = completion.split('\n');
    if (lines.length > 3) {
      completion = lines.slice(0, 3).join('\n');
    }

    return completion;
  }

  private showGhostText(editor: vscode.TextEditor, position: vscode.Position, completion: string): void {
    // Clear any existing ghost text
    this.clearGhostText();

    // Create decoration type for ghost text
    this.currentDecoration = vscode.window.createTextEditorDecorationType({
      after: {
        contentText: completion,
        color: new vscode.ThemeColor('editorGhostText.foreground'),
        fontStyle: 'italic'
      }
    });

    // Apply decoration at cursor position
    const range = new vscode.Range(position, position);
    editor.setDecorations(this.currentDecoration, [range]);

    // Store current state
    this.currentGhostText = completion;
    this.currentEditor = editor;
    this.currentPosition = position;

    // Set context key to enable keybindings
    vscode.commands.executeCommand('setContext', 'claudeCodeAssistant.ghostCompletionVisible', true);

    // Show information message with instructions
    vscode.window.showInformationMessage(
      'AI completion ready. Press Tab to accept or continue typing to dismiss.',
      { modal: false }
    );
  }

  private acceptGhostCompletion(): void {
    if (this.currentEditor && this.currentPosition && this.currentGhostText) {
      // Insert the ghost text at the current position
      this.currentEditor.edit(editBuilder => {
        editBuilder.insert(this.currentPosition!, this.currentGhostText);
      });

      // Clear ghost text
      this.clearGhostText();
    }
  }

  private clearGhostText(): void {
    if (this.currentDecoration) {
      this.currentDecoration.dispose();
      this.currentDecoration = null;
    }
    this.currentGhostText = '';
    this.currentEditor = null;
    this.currentPosition = null;
    
    // Clear context key to disable keybindings
    vscode.commands.executeCommand('setContext', 'claudeCodeAssistant.ghostCompletionVisible', false);
  }

  public dispose(): void {
    this.resetIdleTimer();
    this.clearGhostText();
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }
}
