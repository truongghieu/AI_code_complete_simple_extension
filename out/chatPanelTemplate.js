"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getChatPanelTemplate = void 0;
/**
 * HTML template for the chat panel webview
 */
function getChatPanelTemplate(modelSelectorHtml, messageHtml) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rica</title>
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
            padding: var(--spacing-md) var(--spacing-xl);
            border-bottom: 1px solid var(--vscode-panel-border);
            background-color: var(--vscode-editor-background);
            box-shadow: var(--shadow-sm);
            position: relative;
            z-index: 10;
        }
        .header h2 {
            margin: 0;
            font-size: 1.1rem;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: var(--spacing-sm);
        }
        .header h2::before {
            content: "😎";
            font-size: 1.2rem;
        }
        .model-selector {
            display: flex;
            align-items: center;
            gap: var(--spacing-md);
            padding: var(--spacing-md) var(--spacing-xl);
            border-bottom: 1px solid var(--vscode-panel-border);
            font-size: 0.85rem;
            background-color: var(--vscode-editor-background);
        }
        .model-selector label {
            font-weight: 500;
            color: var(--vscode-descriptionForeground);
        }
        .model-select-container {
            display: flex;
            align-items: center;
            gap: var(--spacing-sm);
            flex: 1;
        }
        #model-select {
            padding: var(--spacing-xs) var(--spacing-md);
            background-color: var(--vscode-dropdown-background);
            color: var(--vscode-dropdown-foreground);
            border: 1px solid var(--vscode-dropdown-border);
            border-radius: var(--border-radius-sm);
            font-size: 0.85rem;
            transition: border-color var(--transition-fast);
            flex: 1;
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
            width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            font-size: 0.9rem;
            transition: background-color var(--transition-fast), transform var(--transition-fast);
        }
        #refresh-models:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        #refresh-models:active {
            transform: rotate(180deg);
        }
        .model-selector-loading, .model-selector-error {
            padding: var(--spacing-md) var(--spacing-xl);
            border-bottom: 1px solid var(--vscode-panel-border);
            font-size: 0.85rem;
            font-style: italic;
            background-color: var(--vscode-editor-background);
        }
        .model-selector-loading {
            display: flex;
            align-items: center;
            gap: var(--spacing-sm);
        }
        .model-selector-loading::before {
            content: "";
            display: inline-block;
            width: 14px;
            height: 14px;
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
            gap: var(--spacing-sm);
        }
        .model-selector-error::before {
            content: "⚠️";
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
            padding: var(--spacing-xs) var(--spacing-md);
            cursor: pointer;
            font-size: 0.8rem;
            display: flex;
            align-items: center;
            gap: var(--spacing-xs);
            transition: background-color var(--transition-fast);
        }
        #clear-history::before {
            content: "🗑️";
            font-size: 0.9rem;
        }
        #clear-history:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        .chat-container {
            flex: 1;
            overflow-y: auto;
            padding: var(--spacing-md);
            scroll-behavior: smooth;
            display: flex;
            flex-direction: column;
            gap: var(--spacing-md);
            min-height: 0; /* Important for flexbox scrolling */
            max-height: calc(100vh - 200px); /* Ensure there's a maximum height */
            overscroll-behavior: contain; /* Prevent scroll chaining */
        }
        .message {
            display: flex;
            max-width: 100%;
            animation: fadeIn 0.3s ease-in-out;
            position: relative;
        }
        .user-message {
            margin-left: auto;
            flex-direction: row-reverse;
            max-width: min(85%, 600px);
        }
        .assistant-message {
            margin-right: auto;
            max-width: min(85%, 600px);
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes pulseIn {
            0% { transform: scale(0.95); opacity: 0; }
            70% { transform: scale(1.03); }
            100% { transform: scale(1); opacity: 1; }
        }
        .avatar {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 var(--spacing-sm);
            font-size: 16px;
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
            background: linear-gradient(135deg, var(--vscode-badge-background, rgba(127, 127, 127, 0.2)), var(--vscode-activityBarBadge-background,rgb(65, 65, 65)));
        }
        
        .system-message .avatar {
            background-color: var(--vscode-editorInfo-background, rgba(0, 122, 204, 0.1));
            color: var(--vscode-editorInfo-foreground);
        }
        .content {
            padding: var(--spacing-md) var(--spacing-lg);
            border-radius: var(--border-radius-md);
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            word-break: break-word;
            overflow-wrap: break-word;
            box-shadow: var(--shadow-sm);
            font-size: 0.85rem;
            position: relative;
            transition: box-shadow var(--transition-fast);
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
        
        /* Message bubble tails */
        .user-message .content::after {
            content: "";
            position: absolute;
            top: 10px;
            right: -8px;
            width: 0;
            height: 0;
            border-left: 8px solid var(--vscode-button-background);
            border-top: 6px solid transparent;
            border-bottom: 6px solid transparent;
        }
        
        .assistant-message .content::after {
            content: "";
            position: absolute;
            top: 10px;
            left: -8px;
            width: 0;
            height: 0;
            border-right: 8px solid var(--vscode-editor-background);
            border-top: 6px solid transparent;
            border-bottom: 6px solid transparent;
        }
        .code-block {
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: var(--border-radius-md);
            margin: var(--spacing-md) 0;
            overflow: hidden;
            box-shadow: var(--shadow-md);
            transition: box-shadow var(--transition-fast);
            animation: pulseIn 0.3s ease-out;
        }
        
        .code-block:hover {
            box-shadow: var(--shadow-lg);
        }
        
        .code-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: var(--spacing-sm) var(--spacing-md);
            background-color: var(--vscode-editorGroupHeader-tabsBackground);
            border-bottom: 1px solid var(--vscode-panel-border);
            font-size: 12px;
        }
        
        .language-tag {
            font-weight: 500;
            color: var(--vscode-foreground);
            display: flex;
            align-items: center;
            gap: var(--spacing-xs);
        }
        
        .language-tag::before {
            content: "📄";
            font-size: 14px;
        }
        
        .code-actions {
            display: flex;
            gap: var(--spacing-sm);
        }
        
        .copy-button, .insert-button {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            border-radius: var(--border-radius-sm);
            padding: var(--spacing-xs) var(--spacing-md);
            cursor: pointer;
            font-size: 11px;
            transition: all var(--transition-fast);
            display: flex;
            align-items: center;
            gap: 4px;
        }
        
        .copy-button::before {
            content: "📋";
            font-size: 12px;
        }
        
        .insert-button::before {
            content: "📌";
            font-size: 12px;
        }
        
        .copy-button:hover, .insert-button:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
            transform: translateY(-1px);
        }
        .code-block pre {
            margin: 0;
            padding: var(--spacing-md);
            overflow-x: auto;
            background-color: var(--vscode-editor-background);
            scrollbar-width: thin;
            scrollbar-color: var(--vscode-scrollbarSlider-background) transparent;
        }
        
        .code-block pre::-webkit-scrollbar {
            height: 8px;
        }
        
        .code-block pre::-webkit-scrollbar-track {
            background: transparent;
        }
        
        .code-block pre::-webkit-scrollbar-thumb {
            background-color: var(--vscode-scrollbarSlider-background);
            border-radius: 4px;
        }
        
        .code-block pre::-webkit-scrollbar-thumb:hover {
            background-color: var(--vscode-scrollbarSlider-hoverBackground);
        }
        
        .code-block code {
            font-family: var(--vscode-editor-font-family), 'Consolas', 'Monaco', 'Courier New', monospace;
            font-size: var(--vscode-editor-font-size, 12px);
            line-height: 1.5;
            white-space: pre;
            color: var(--vscode-editor-foreground);
            display: block;
        }
        
        .inline-code {
            font-family: var(--vscode-editor-font-family), 'Consolas', 'Monaco', 'Courier New', monospace;
            background-color: var(--vscode-textBlockQuote-background, rgba(127, 127, 127, 0.1));
            color: var(--vscode-textBlockQuote-foreground, var(--vscode-editor-foreground));
            padding: 2px 5px;
            border-radius: var(--border-radius-sm);
            font-size: 0.85em;
            white-space: pre-wrap;
            display: inline-block;
            margin: 0 2px;
            border: 1px solid rgba(127, 127, 127, 0.2);
        }
        .input-container {
            display: flex;
            flex-direction: column;
            padding: var(--spacing-md);
            border-top: 1px solid var(--vscode-panel-border);
            background-color: var(--vscode-editor-background);
            box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.05);
            position: relative;
            z-index: 5;
        }
        
        .task-selector {
            display: flex;
            margin-bottom: var(--spacing-md);
            flex-wrap: wrap;
            gap: var(--spacing-xs);
        }
        
        .task-button {
            background: none;
            border: 1px solid var(--vscode-button-border);
            color: var(--vscode-foreground);
            padding: var(--spacing-xs) var(--spacing-md);
            border-radius: var(--border-radius-sm);
            cursor: pointer;
            font-size: 0.8rem;
            transition: all var(--transition-fast);
        }
        
        .task-button:hover {
            background-color: rgba(127, 127, 127, 0.1);
        }
        
        .task-button.selected {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            transform: scale(1.05);
        }
        
        .message-input {
            display: flex;
            flex-direction: column;
        }
        
        #user-input {
            flex: 1;
            padding: var(--spacing-md);
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border-radius: var(--border-radius-md);
            resize: none;
            font-family: var(--vscode-font-family);
            min-height: 50px;
            margin-bottom: var(--spacing-md);
            transition: all var(--transition-normal);
            font-size: 0.85rem;
            box-shadow: var(--shadow-sm);
        }
        
        #user-input:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
            box-shadow: var(--shadow-md);
        }
        
        .button-row {
            display: flex;
            justify-content: space-between;
        }
        
        #send-button {
            padding: var(--spacing-sm) var(--spacing-lg);
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: var(--border-radius-md);
            cursor: pointer;
            font-size: 0.85rem;
            transition: all var(--transition-fast);
            display: flex;
            align-items: center;
            gap: var(--spacing-xs);
            box-shadow: var(--shadow-sm);
        }
        
        #send-button::after {
            content: "↗";
            font-size: 1rem;
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
        
        .tips {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-top: var(--spacing-sm);
        }

        /* Responsive styles */
        @media (max-width: 480px) {
            .chat-container {
                padding: var(--spacing-sm);
                gap: var(--spacing-sm);
            }
            
            .header, .model-selector {
                padding: var(--spacing-sm);
            }
            
            .user-message, .assistant-message {
                max-width: 90%;
            }
            
            .avatar {
                width: 24px;
                height: 24px;
                font-size: 12px;
            }
            
            .content {
                padding: var(--spacing-sm);
                font-size: 0.8rem;
            }
            
            #user-input {
                min-height: 40px;
                padding: var(--spacing-sm);
            }
            
            #send-button {
                padding: var(--spacing-xs) var(--spacing-sm);
            }
        }
        
        @media (min-width: 481px) and (max-width: 768px) {
            .chat-container {
                padding: var(--spacing-md);
            }
            
            .user-message, .assistant-message {
                max-width: 85%;
            }
        }
        
        @media (min-width: 769px) {
            .chat-container {
                padding: var(--spacing-lg);
                gap: var(--spacing-lg);
            }
            
            .message-input {
                flex-direction: row;
                align-items: flex-end;
            }
            
            #user-input {
                margin-bottom: 0;
                margin-right: var(--spacing-md);
            }
            
            .button-row {
                justify-content: flex-end;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <h2>Rica</h2>
        <button id="clear-history">Clear History</button>
    </div>
    ${modelSelectorHtml}
    <div class="chat-container" id="chat-container">
        ${messageHtml}
    </div>
    <div class="input-container">
        <div class="message-input">
            <textarea id="user-input" placeholder="Ask something" rows="3"></textarea>
            <div class="button-row">
                <button id="send-button">Send</button>
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let selectedTask = 'suggest';
        
        // Scroll to bottom on load and keep scrolled to bottom when new messages arrive
        const chatContainer = document.getElementById('chat-container');
        
        // Function to scroll to bottom
        function scrollToBottom() {
            setTimeout(() => {
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }, 10);
        }
        
        // Initial scroll
        scrollToBottom();
        
        // Create an observer to watch for changes in the chat container
        const observer = new MutationObserver((mutations) => {
            scrollToBottom();
        });
        
        // Start observing the chat container for changes with more comprehensive options
        observer.observe(chatContainer, { 
            childList: true, 
            subtree: true, 
            attributes: true,
            characterData: true 
        });
        
        // Also add a window resize listener to ensure scrolling works after resize
        window.addEventListener('resize', scrollToBottom);
        
        // Clear history button
        document.getElementById('clear-history').addEventListener('click', () => {
            vscode.postMessage({
                command: 'clearHistory'
            });
        });
        
        // Model selector
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
        
        // Refresh models button
        const refreshModelsBtn = document.getElementById('refresh-models');
        if (refreshModelsBtn) {
            refreshModelsBtn.addEventListener('click', () => {
                vscode.postMessage({
                    command: 'refreshModels'
                });
            });
        }
        
        // Send message
        document.getElementById('send-button').addEventListener('click', sendMessage);
        
        // Handle Enter key (with Shift+Enter for new line)
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
                    task: selectedTask
                });
                
                input.value = '';
            }
        }
        
        function copyCode(button) {
            const codeBlock = button.closest('.code-block');
            const code = codeBlock.querySelector('code').innerText;
            navigator.clipboard.writeText(code);
            
            // Show feedback
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
exports.getChatPanelTemplate = getChatPanelTemplate;
//# sourceMappingURL=chatPanelTemplate.js.map