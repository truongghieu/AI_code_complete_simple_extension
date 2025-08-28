import { ChatMessage, ModelSelectorState } from '../core/chatManager';
import { ClaudeApiClient } from '../api';

/**
 * Handles HTML rendering for chat interfaces
 */
export class HtmlRenderer {
  
  static escapeHtml(text: string): string {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  static generateModelSelectorHtml(
    modelSelectorState: ModelSelectorState,
    apiClient: ClaudeApiClient
  ): string {
    const models = apiClient.getAvailableModels();
    const currentModel = modelSelectorState.selectedModel || apiClient.getModel();
    
    if (modelSelectorState.isLoading) {
      return '<div class="model-selector-loading">Loading models...</div>';
    } 
    
    if (modelSelectorState.error) {
      return `<div class="model-selector-error">Error: ${modelSelectorState.error}</div>`;
    }
    
    const modelOptions = models.map(model => 
      `<option value="${model.name}" ${model.name === currentModel ? 'selected' : ''}>${model.displayName || model.name}</option>`
    ).join('');
    
    return `
      <div class="model-selector">
        <label for="model-select">Model:</label>
        <div class="model-select-container">
          <select id="model-select">
            ${modelOptions.length ? modelOptions : `<option value="${currentModel}" selected>${currentModel}</option>`}
          </select>
          <button id="refresh-models" title="Refresh models list">↻</button>
        </div>
      </div>
    `;
  }

  static generateMessagesHtml(messages: ChatMessage[]): string {
    if (!messages.length) {
      return '<div class="welcome-message">Ask me anything about your code!</div>';
    }

    return messages.map(msg => {
      const isUser = msg.role === 'user';
      const isSystem = msg.role === 'system';
      const className = isUser ? 'user-message' : (isSystem ? 'system-message' : 'assistant-message');
      const avatar = isUser ? '👤' : (isSystem ? '🔔' : '🤖');
      
      let content = msg.content;
      
      if (!isUser) {
        // Process code blocks first - preserve them as formatted code
        const codeBlocks: { placeholder: string; html: string }[] = [];
        let codeBlockIndex = 0;
        
        // Extract and process code blocks
        content = content.replace(/```(\w*)\n?([\s\S]*?)```/g, (match, language, code) => {
          const lang = language || 'text';
          const trimmedCode = code.trim();
          
          const placeholder = `__CODE_BLOCK_${codeBlockIndex}__`;
          codeBlocks.push({
            placeholder,
            html: `<div class="code-block">
                    <div class="code-header">
                      <span class="language-tag">${lang}</span>
                      <div class="code-actions">
                        <button class="copy-button" onclick="copyCode(this)" title="Copy to clipboard">Copy</button>
                        <button class="insert-button" onclick="insertCode(this)" title="Insert into editor">Insert</button>
                      </div>
                    </div>
                    <pre><code class="language-${lang}">${trimmedCode}</code></pre>
                  </div>`
          });
          codeBlockIndex++;
          return placeholder;
        });
        
        // Process inline code with backticks before HTML escaping
        const inlineCodeBlocks: { placeholder: string; html: string }[] = [];
        content = content.replace(/`([^`]+)`/g, (match, code) => {
          const placeholder = `__INLINE_CODE_${codeBlockIndex}__`;
          inlineCodeBlocks.push({
            placeholder,
            html: `<code class="inline-code">${code}</code>`
          });
          codeBlockIndex++;
          return placeholder;
        });
        
        // Now escape HTML for the rest of the content
        content = this.escapeHtml(content);
        
        // Restore code blocks
        codeBlocks.forEach(block => {
          content = content.replace(block.placeholder, block.html);
        });
        
        // Restore inline code blocks
        inlineCodeBlocks.forEach(block => {
          content = content.replace(block.placeholder, block.html);
        });
        
        // Automatically detect and convert URLs to clickable links
        content = content.replace(
          /https?:\/\/[^\s<>"']+/g, 
          '<a href="$&" target="_blank" rel="noopener noreferrer">$&</a>'
        );
        
        // Convert plain text lists to HTML lists
        content = this.convertTextListsToHtml(content);
        
        // Replace newlines with <br> tags, but not inside code blocks
        content = content.replace(/\n(?![^<]*<\/pre>)/g, '<br>');
      } else {
        // For user messages, just escape HTML
        content = this.escapeHtml(content);
        
        // Make URLs clickable in user messages too
        content = content.replace(
          /https?:\/\/[^\s<>"']+/g, 
          '<a href="$&" target="_blank" rel="noopener noreferrer">$&</a>'
        );
      }
      
      return `<div class="message ${className}">
                <div class="avatar" aria-label="${isUser ? 'User' : 'Assistant'}">${avatar}</div>
                <div class="content">${content}</div>
              </div>`;
    }).join('');
  }

  /**
   * Converts plain text lists to HTML lists for better visual display
   */
  private static convertTextListsToHtml(text: string): string {
    // Process numbered lists (1. Item)
    let inNumberedList = false;
    let numberedListContent = '';
    
    const lines = text.split('<br>');
    const processedLines: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const numberedMatch = line.match(/^(\d+)\.\s(.+)$/);
      
      if (numberedMatch) {
        if (!inNumberedList) {
          inNumberedList = true;
          numberedListContent = `<ol><li>${numberedMatch[2]}</li>`;
        } else {
          numberedListContent += `<li>${numberedMatch[2]}</li>`;
        }
      } else {
        if (inNumberedList) {
          inNumberedList = false;
          numberedListContent += '</ol>';
          processedLines.push(numberedListContent);
          processedLines.push(line);
        } else {
          processedLines.push(line);
        }
      }
    }
    
    if (inNumberedList) {
      numberedListContent += '</ol>';
      processedLines.push(numberedListContent);
    }
    
    // Process bullet lists (• Item or - Item)
    let result = processedLines.join('<br>');
    let inBulletList = false;
    let bulletListContent = '';
    
    const bulletLines = result.split('<br>');
    const finalLines: string[] = [];
    
    for (let i = 0; i < bulletLines.length; i++) {
      const line = bulletLines[i];
      const bulletMatch = line.match(/^[\•\-]\s(.+)$/);
      
      if (bulletMatch) {
        if (!inBulletList) {
          inBulletList = true;
          bulletListContent = `<ul><li>${bulletMatch[1]}</li>`;
        } else {
          bulletListContent += `<li>${bulletMatch[1]}</li>`;
        }
      } else {
        if (inBulletList) {
          inBulletList = false;
          bulletListContent += '</ul>';
          finalLines.push(bulletListContent);
          finalLines.push(line);
        } else {
          finalLines.push(line);
        }
      }
    }
    
    if (inBulletList) {
      bulletListContent += '</ul>';
      finalLines.push(bulletListContent);
    }
    
    return finalLines.join('<br>');
  }

  static generateChatHtml(
    modelSelectorState: ModelSelectorState,
    apiClient: ClaudeApiClient,
    messages: ChatMessage[]
  ): string {
    const modelSelectorHtml = this.generateModelSelectorHtml(modelSelectorState, apiClient);
    const messageHtml = this.generateMessagesHtml(messages);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Code Assistant</title>
    <style>
        :root {
            --border-radius-sm: 4px;
            --border-radius-md: 8px;
            --border-radius-lg: 12px;
            --spacing-xs: 4px;
            --spacing-sm: 8px;
            --spacing-md: 12px;
            --spacing-lg: 16px;
            --spacing-xl: 24px;
            --transition-fast: 0.15s ease;
            --transition-normal: 0.25s ease;
            --shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.1);
            --shadow-md: 0 3px 8px rgba(0, 0, 0, 0.12);
            --shadow-lg: 0 6px 16px rgba(0, 0, 0, 0.15);
        }
        
        html, body {
            font-family: var(--vscode-font-family);
            padding: 0;
            margin: 0;
            color: var(--vscode-foreground);
            height: 100vh;
            width: 100%;
            overflow: hidden;
            line-height: 1.5;
            font-size: 0.9rem;
        }
        
        body {
            display: flex;
            flex-direction: column;
            background-color: var(--vscode-editor-inactiveSelectionBackground, rgba(0, 0, 0, 0.05));
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: var(--spacing-sm) var(--spacing-md);
            border-bottom: 1px solid var(--vscode-panel-border);
            background-color: var(--vscode-editor-background);
            box-shadow: var(--shadow-sm);
            position: relative;
            z-index: 10;
        }
        .header h2 {
            margin: 0;
            font-size: 1rem;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: var(--spacing-xs);
        }
        .header h2::before {
            content: "😎";
            font-size: 1.1rem;
        }
        .model-selector {
            display: flex;
            align-items: center;
            gap: var(--spacing-sm);
            padding: var(--spacing-sm) var(--spacing-md);
            border-bottom: 1px solid var(--vscode-panel-border);
            font-size: 0.8rem;
            background-color: var(--vscode-editor-background);
        }
        .model-selector label {
            font-weight: 500;
            color: var(--vscode-descriptionForeground);
        }
        .model-select-container {
            display: flex;
            align-items: center;
            gap: var(--spacing-xs);
            flex: 1;
        }
        #model-select {
            padding: var(--spacing-xs) var(--spacing-sm);
            background-color: var(--vscode-dropdown-background);
            color: var(--vscode-dropdown-foreground);
            border: 1px solid var(--vscode-dropdown-border);
            border-radius: var(--border-radius-sm);
            font-size: 0.8rem;
            flex: 1;
            transition: border-color var(--transition-fast);
        }
        #model-select:hover, #model-select:focus {
            border-color: var(--vscode-focusBorder);
            outline: none;
        }
        #refresh-models {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            border-radius: var(--border-radius-sm);
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            font-size: 0.8rem;
            transition: all var(--transition-fast);
        }
        #refresh-models:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        #refresh-models:active {
            transform: rotate(180deg);
        }
        .model-selector-loading, .model-selector-error {
            padding: var(--spacing-sm) var(--spacing-md);
            border-bottom: 1px solid var(--vscode-panel-border);
            font-size: 0.8rem;
            font-style: italic;
            background-color: var(--vscode-editor-background);
        }
        .model-selector-loading {
            display: flex;
            align-items: center;
            gap: var(--spacing-xs);
        }
        .model-selector-loading::before {
            content: "";
            display: inline-block;
            width: 12px;
            height: 12px;
            border: 2px solid var(--vscode-descriptionForeground);
            border-radius: 50%;
            border-top-color: transparent;
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        .model-selector-error {
            color: var(--vscode-errorForeground);
            display: flex;
            align-items: center;
            gap: var(--spacing-xs);
        }
        .model-selector-error::before {
            content: "⚠️";
            font-size: 0.9rem;
        }
        .system-message .content {
            background-color: var(--vscode-editorInfo-background, rgba(0, 122, 204, 0.1));
            color: var(--vscode-editorInfo-foreground, var(--vscode-foreground));
            font-style: italic;
            border-left: 3px solid var(--vscode-editorInfo-foreground, rgba(0, 122, 204, 0.6));
        }
        #clear-history {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            border-radius: var(--border-radius-sm);
            padding: var(--spacing-xs) var(--spacing-sm);
            cursor: pointer;
            font-size: 0.7rem;
            display: flex;
            align-items: center;
            gap: var(--spacing-xs);
            transition: background-color var(--transition-fast);
        }
        #clear-history::before {
            content: "🗑️";
            font-size: 0.8rem;
        }
        #clear-history:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        .chat-container {
            flex: 1;
            overflow-y: auto;
            padding: var(--spacing-sm);
            scroll-behavior: smooth;
            display: flex;
            flex-direction: column;
            gap: var(--spacing-sm);
            min-height: 0;
            max-height: calc(100vh - 180px);
            overscroll-behavior: contain;
        }
        .message {
            display: flex;
            max-width: 100%;
            font-size: 0.9rem;
            animation: fadeIn 0.3s ease-in-out;
            position: relative;
        }
        .user-message {
            margin-left: auto;
            flex-direction: row-reverse;
            max-width: 90%;
        }
        .assistant-message {
            margin-right: auto;
            max-width: 90%;
            width: 100%;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes pulseIn {
            0% { transform: scale(0.95); opacity: 0; }
            70% { transform: scale(1.03); }
            100% { transform: scale(1); opacity: 1; }
        }
        .avatar {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 var(--spacing-xs);
            font-size: 12px;
            flex-shrink: 0;
            box-shadow: var(--shadow-sm);
            position: relative;
            z-index: 2;
        }
        
        .user-message .avatar {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        
        .assistant-message .avatar {
            background: linear-gradient(135deg, var(--vscode-badge-background, rgba(127, 127, 127, 0.2)), var(--vscode-activityBarBadge-background,rgb(163, 163, 163)));
        }
        
        .system-message .avatar {
            background-color: var(--vscode-editorInfo-background, rgba(0, 122, 204, 0.1));
            color: var(--vscode-editorInfo-foreground);
        }
        .content {
            padding: var(--spacing-xs) var(--spacing-sm);
            border-radius: var(--border-radius-md);
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            word-break: break-word;
            overflow-wrap: break-word;
            box-shadow: var(--shadow-sm);
            font-size: 0.8rem;
            position: relative;
            transition: box-shadow var(--transition-fast);
            width: 100%;
            box-sizing: border-box;
        }
        
        .content:hover {
            box-shadow: var(--shadow-md);
        }
        
        .user-message .content {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border-top-right-radius: 2px;
        }
        
        .assistant-message .content {
            background-color: var(--vscode-editor-background);
            border-top-left-radius: 2px;
        }
        
        .user-message .content::after {
            content: "";
            position: absolute;
            top: 10px;
            right: -6px;
            width: 0;
            height: 0;
            border-left: 6px solid var(--vscode-button-background);
            border-top: 5px solid transparent;
            border-bottom: 5px solid transparent;
        }
        
        .assistant-message .content::after {
            content: "";
            position: absolute;
            top: 10px;
            left: -6px;
            width: 0;
            height: 0;
            border-right: 6px solid var(--vscode-editor-background);
            border-top: 5px solid transparent;
            border-bottom: 5px solid transparent;
        }
        
        .code-block {
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: var(--border-radius-sm);
            margin: var(--spacing-sm) 0;
            overflow: hidden;
            font-size: 0.85rem;
            box-shadow: var(--shadow-sm);
            transition: box-shadow var(--transition-fast);
            animation: pulseIn 0.3s ease-out;
            width: 100%;
            max-width: 100%;
        }
        .code-block:hover {
            box-shadow: var(--shadow-md);
        }
        
        .code-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: var(--spacing-xs) var(--spacing-sm);
            background-color: var(--vscode-editorGroupHeader-tabsBackground);
            border-bottom: 1px solid var(--vscode-panel-border);
            font-size: 11px;
            flex-wrap: wrap;
            gap: var(--spacing-xs);
        }
        
        .language-tag {
            font-weight: 500;
            color: var(--vscode-foreground);
            display: flex;
            align-items: center;
            gap: 2px;
        }
        
        .language-tag::before {
            content: "📄";
            font-size: 12px;
        }
        .code-actions {
            display: flex;
            gap: var(--spacing-xs);
            flex-wrap: wrap;
        }
        
        .copy-button, .insert-button {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            border-radius: var(--border-radius-sm);
            padding: 2px 6px;
            cursor: pointer;
            font-size: 10px;
            transition: all var(--transition-fast);
            display: flex;
            align-items: center;
            gap: 2px;
        }
        
        .copy-button::before {
            content: "📋";
            font-size: 11px;
        }
        
        .insert-button::before {
            content: "📌";
            font-size: 11px;
        }
        
        .copy-button:hover, .insert-button:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
            transform: translateY(-1px);
        }
        .code-block pre {
            margin: 0;
            padding: var(--spacing-sm);
            overflow-x: auto;
            background-color: var(--vscode-editor-background);
            scrollbar-width: thin;
            scrollbar-color: var(--vscode-scrollbarSlider-background) transparent;
            width: 100%;
            box-sizing: border-box;
        }
        
        .code-block pre::-webkit-scrollbar {
            height: 6px;
        }
        
        .code-block pre::-webkit-scrollbar-track {
            background: transparent;
        }
        
        .code-block pre::-webkit-scrollbar-thumb {
            background-color: var(--vscode-scrollbarSlider-background);
            border-radius: 3px;
        }
        
        .code-block pre::-webkit-scrollbar-thumb:hover {
            background-color: var(--vscode-scrollbarSlider-hoverBackground);
        }
        .code-block code {
            font-family: var(--vscode-editor-font-family), 'Consolas', 'Monaco', 'Courier New', monospace;
            font-size: var(--vscode-editor-font-size, 12px);
            line-height: 1.4;
            white-space: pre;
            color: var(--vscode-editor-foreground);
            display: block;
            width: 100%;
            box-sizing: border-box;
        }
        .inline-code {
            font-family: var(--vscode-editor-font-family), 'Consolas', 'Monaco', 'Courier New', monospace;
            background-color: var(--vscode-textBlockQuote-background);
            color: var(--vscode-textBlockQuote-foreground);
            padding: 1px 4px;
            border-radius: var(--border-radius-sm);
            font-size: 0.85em;
            border: 1px solid rgba(127, 127, 127, 0.2);
        }
        .input-container {
            display: flex;
            flex-direction: column;
            padding: var(--spacing-sm);
            border-top: 1px solid var(--vscode-panel-border);
            background-color: var(--vscode-editor-background);
            box-shadow: 0 -2px 6px rgba(0, 0, 0, 0.05);
            position: relative;
            z-index: 5;
        }
        #user-input {
            flex: 1;
            padding: var(--spacing-sm);
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border-radius: var(--border-radius-md);
            resize: none;
            font-family: var(--vscode-font-family);
            min-height: 40px;
            margin-bottom: var(--spacing-sm);
            font-size: 0.85rem;
            transition: all var(--transition-fast);
            box-shadow: var(--shadow-sm);
        }
        
        #user-input:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
            box-shadow: var(--shadow-md);
        }
        .button-row {
            display: flex;
            justify-content: flex-end;
        }
        #send-button {
            padding: var(--spacing-xs) var(--spacing-md);
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: var(--border-radius-md);
            cursor: pointer;
            font-size: 0.8rem;
            transition: all var(--transition-fast);
            display: flex;
            align-items: center;
            gap: var(--spacing-xs);
            box-shadow: var(--shadow-sm);
        }
        
        #send-button::after {
            content: "↗";
            font-size: 0.9rem;
            transition: transform var(--transition-fast);
        }
        
        #send-button:hover {
            background-color: var(--vscode-button-hoverBackground);
            transform: translateY(-1px);
            box-shadow: var(--shadow-md);
        }
        
        #send-button:hover::after {
            transform: translateX(2px);
        }
        
        #send-button:active {
            transform: translateY(0);
        }
        
        .welcome-message {
            color: var(--vscode-descriptionForeground);
            text-align: center;
            margin: auto;
            font-style: italic;
            padding: var(--spacing-lg);
        }
        
        @media screen and (max-width: 480px) {
            .code-header {
                flex-direction: column;
                align-items: flex-start;
            }
            
            .code-actions {
                margin-top: var(--spacing-xs);
                width: 100%;
                justify-content: flex-end;
            }
            
            .message {
                max-width: 100%;
            }
            
            .user-message, .assistant-message {
                max-width: 100%;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <h2>Code Assistant</h2>
        <button id="clear-history">Clear</button>
    </div>
    ${modelSelectorHtml}
    <div class="chat-container" id="chat-container">
        ${messageHtml}
    </div>
    <div class="input-container">
        <textarea id="user-input" placeholder="Ask something..." rows="2"></textarea>
        <div class="button-row">
            <button id="send-button">Send</button>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        const chatContainer = document.getElementById('chat-container');
        
        function scrollToBottom() {
            setTimeout(() => {
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }, 10);
        }
        
        scrollToBottom();
        
        const observer = new MutationObserver((mutations) => {
            scrollToBottom();
        });
        
        observer.observe(chatContainer, { 
            childList: true, 
            subtree: true, 
            attributes: true,
            characterData: true 
        });
        
        window.addEventListener('resize', scrollToBottom);
        
        document.getElementById('clear-history').addEventListener('click', () => {
            vscode.postMessage({
                command: 'clearHistory'
            });
        });
        
        const modelSelect = document.getElementById('model-select');
        if (modelSelect) {
            modelSelect.addEventListener('change', (e) => {
                const selectedModel = e.target.value;
                vscode.postMessage({
                    command: 'selectModel',
                    model: selectedModel
                });
            });
        }
        
        const refreshModelsBtn = document.getElementById('refresh-models');
        if (refreshModelsBtn) {
            refreshModelsBtn.addEventListener('click', () => {
                vscode.postMessage({
                    command: 'refreshModels'
                });
            });
        }
        
        document.getElementById('send-button').addEventListener('click', sendMessage);
        
        document.getElementById('user-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        
        function sendMessage() {
            const input = document.getElementById('user-input');
            const text = input.value.trim();
            
            if (text) {
                vscode.postMessage({
                    command: 'sendMessage',
                    text: text,
                    task: 'suggest'
                });
                
                input.value = '';
            }
        }
        
        function copyCode(button) {
            const codeBlock = button.closest('.code-block');
            const code = codeBlock.querySelector('code').innerText;
            navigator.clipboard.writeText(code);
            
            const originalText = button.innerText;
            button.innerText = 'Copied!';
            setTimeout(() => {
                button.innerText = originalText;
            }, 1500);
        }
        
        function insertCode(button) {
            const codeBlock = button.closest('.code-block');
            const code = codeBlock.querySelector('code').innerText;
            vscode.postMessage({
                command: 'insertCode',
                code: code
            });
        }
    </script>
</body>
</html>`;
  }
}
