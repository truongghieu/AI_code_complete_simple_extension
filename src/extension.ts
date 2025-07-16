import * as vscode from 'vscode';
import { ChatPanel } from './chatPanel';
import { ClaudeApiClient } from './api';
import { SidebarProvider } from './sidebarProvider';
import { registerEditerCommands } from './editer';

export function activate(context: vscode.ExtensionContext) {
  console.log('AI Chat extension is now active!');

  // Get configuration
  const config = vscode.workspace.getConfiguration('claudeCodeAssistant');
  const apiUrl = config.get<string>('apiUrl') || 'http://127.0.0.1:11434';
  const model = config.get<string>('model') || 'databricks-claude-sonnet-4';
  const autoRefreshModels = config.get<boolean>('autoRefreshModels') || true;

  // Create shared API client
  const apiClient = new ClaudeApiClient(apiUrl, model);
  
  // Auto-refresh models if enabled
  if (autoRefreshModels) {
    apiClient.fetchAvailableModels().then(() => {
      console.log('Available models refreshed on startup');
    }).catch(err => {
      console.error('Failed to refresh models on startup:', err);
    });
  }

  // Register sidebar provider for activity bar view
  const sidebarProvider = new SidebarProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "claudeCodeAssistantView", 
      sidebarProvider
    )
  );
  
  // Register sidebar provider for panel view
  const panelProvider = new SidebarProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "claudeCodeAssistantPanelView", 
      panelProvider
    )
  );
  
  // Register sidebar provider for secondary sidebar view
  const secondarySidebarProvider = new SidebarProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "claudeCodeAssistantSecondaryView", 
      secondarySidebarProvider
    )
  );

  // Register command to refresh models
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeCodeAssistant.refreshModels', async () => {
      try {
        vscode.window.setStatusBarMessage('$(loading~spin) Refreshing available models...', 5000);
        await apiClient.fetchAvailableModels();
        vscode.window.showInformationMessage('Models refreshed successfully');
      } catch (error) {
        vscode.window.showErrorMessage('Failed to refresh models');
        console.error('Error refreshing models:', error);
      }
    })
  );

  // Register command to open chat panel
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeCodeAssistant.openChat', () => {
      ChatPanel.createOrShow(context.extensionUri);
    })
  );
  
  // Register editer commands
  registerEditerCommands(context, apiClient);
}
