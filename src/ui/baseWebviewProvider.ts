import * as vscode from 'vscode';
import { ChatManager } from '../core/chatManager';
import { HtmlRenderer } from './htmlRenderer';

/**
 * Base class for webview providers that use chat functionality
 */
export abstract class BaseWebviewProvider {
  protected _chatManager: ChatManager;
  protected _disposables: vscode.Disposable[] = [];

  constructor(
    protected readonly _extensionUri: vscode.Uri,
    chatManager: ChatManager
  ) {
    this._chatManager = chatManager;
  }

  protected setupWebviewMessageHandling(webview: vscode.Webview, onUpdate: () => void): void {
    webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'sendMessage':
            await this._chatManager.handleUserMessage(message.text, message.task);
            onUpdate();
            break;
          case 'insertCode':
            this.insertCodeToEditor(message.code);
            break;
          case 'selectModel':
            await this._chatManager.handleModelSelection(message.model);
            onUpdate();
            break;
          case 'refreshModels':
            await this._chatManager.fetchAvailableModels();
            onUpdate();
            break;
          case 'clearHistory':
            this._chatManager.clearMessages();
            onUpdate();
            break;
        }
      },
      null,
      this._disposables
    );
  }

  protected insertCodeToEditor(code: string): void {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      editor.edit(editBuilder => {
        if (editor.selection.isEmpty) {
          editBuilder.insert(editor.selection.active, code);
        } else {
          editBuilder.replace(editor.selection, code);
        }
      });
    }
  }

  protected generateWebviewHtml(): string {
    return HtmlRenderer.generateChatHtml(
      this._chatManager.modelSelectorState,
      this._chatManager.apiClient,
      this._chatManager.messages
    );
  }

  public dispose(): void {
    this._disposables.forEach((disposable) => disposable.dispose());
  }
}
