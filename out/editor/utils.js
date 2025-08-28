"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processLazyEditResponse = exports.extractCodeFromResponse = exports.createLazyEditPrompt = exports.applyEditToEditor = exports.getIndentation = void 0;
const constants_1 = require("./constants");
/**
 * Get the indentation of a line
 * @param line The line to get the indentation from
 * @returns The indentation string
 */
function getIndentation(line) {
    const match = line.match(/^(\s*)/);
    return match ? match[1] : '';
}
exports.getIndentation = getIndentation;
/**
 * Apply the edited content to the editor
 * @param editor The editor to apply the content to
 * @param content The content to apply
 * @param selection The selection to replace
 * @returns A promise that resolves when the edit is applied
 */
async function applyEditToEditor(editor, content, selection) {
    return editor.edit(editBuilder => {
        editBuilder.replace(selection, content);
    });
}
exports.applyEditToEditor = applyEditToEditor;
/**
 * Create a prompt for the lazy edit operation
 * @param originalCode The original code to edit
 * @param filename The filename of the document
 * @param userInstructions Optional user instructions for the edit
 * @returns The prompt for the lazy edit operation
 */
function createLazyEditPrompt(originalCode, filename, userInstructions) {
    const fileExtension = filename.split('.').pop() || '';
    // Default focus areas if no user instructions provided
    const focusAreas = userInstructions ?
        `USER INSTRUCTIONS:\n${userInstructions}` :
        `Focus on:
- Improving code quality and readability
- Fixing bugs or potential issues
- Optimizing performance where applicable
- Following best practices for the language
- Maintaining the original functionality`;
    return `
You are an expert code editor. I'll provide you with code that needs to be improved or modified based on specific instructions.

ORIGINAL CODE:
\`\`\`${fileExtension}
${originalCode}
\`\`\`

${focusAreas}

Please analyze and improve this code according to the instructions. Your response should be a code block containing a rewritten version of the file.

When parts of the code remain unchanged, you may indicate this with a comment that says "${constants_1.UNCHANGED_CODE}" instead of rewriting that section.
Keep at least one line above and below from the original code when using "${constants_1.UNCHANGED_CODE}", so that we can identify what the previous code was.
Do not place "${constants_1.UNCHANGED_CODE}" comments at the top or bottom of the file when there is nothing to replace them.
The code should always be syntactically valid, even with these comments.

Your improved code:
\`\`\`${fileExtension}
`;
}
exports.createLazyEditPrompt = createLazyEditPrompt;
/**
 * Process the response from the API to extract the edited code
 * @param response The response from the API
 * @returns The extracted code
 */
function extractCodeFromResponse(response) {
    // Extract code between triple backticks
    const codeBlockRegex = /```(?:\w*\n|\n)([\s\S]*?)```/g;
    const matches = [...response.matchAll(codeBlockRegex)];
    if (matches.length > 0) {
        // Return the content of the first code block
        return matches[0][1].trim();
    }
    return undefined;
}
exports.extractCodeFromResponse = extractCodeFromResponse;
/**
 * Process the lazy edit response to handle UNCHANGED_CODE markers
 * @param originalCode The original code
 * @param editedCode The edited code with UNCHANGED_CODE markers
 * @returns The final edited code with UNCHANGED_CODE sections replaced
 */
function processLazyEditResponse(originalCode, editedCode) {
    const originalLines = originalCode.split('\n');
    const editedLines = editedCode.split('\n');
    const resultLines = [];
    let i = 0;
    while (i < editedLines.length) {
        const line = editedLines[i];
        if (line.includes(constants_1.UNCHANGED_CODE)) {
            // Find the context lines (at least one line above and below)
            let contextAbove = '';
            let contextBelow = '';
            // Get context above (if not at the beginning)
            if (i > 0) {
                contextAbove = editedLines[i - 1];
            }
            // Get context below (if not at the end)
            if (i < editedLines.length - 1) {
                contextBelow = editedLines[i + 1];
            }
            // Find matching section in original code
            const originalSection = findOriginalSection(originalLines, contextAbove, contextBelow);
            if (originalSection) {
                // Add the original section
                resultLines.push(...originalSection);
            }
            else {
                // If no match found, keep the UNCHANGED_CODE line as is
                resultLines.push(line);
            }
            i++;
        }
        else {
            // Add the edited line
            resultLines.push(line);
            i++;
        }
    }
    return resultLines.join('\n');
}
exports.processLazyEditResponse = processLazyEditResponse;
/**
 * Find the original section of code based on context lines
 * @param originalLines The original lines of code
 * @param contextAbove The context line above the UNCHANGED_CODE marker
 * @param contextBelow The context line below the UNCHANGED_CODE marker
 * @returns The original section of code, or undefined if no match found
 */
function findOriginalSection(originalLines, contextAbove, contextBelow) {
    // Try to find the context in the original code
    let startIndex = -1;
    let endIndex = -1;
    // Find the context above
    for (let i = 0; i < originalLines.length; i++) {
        if (originalLines[i].trim() === contextAbove.trim()) {
            startIndex = i + 1;
            break;
        }
    }
    // Find the context below
    for (let i = startIndex; i < originalLines.length; i++) {
        if (originalLines[i].trim() === contextBelow.trim()) {
            endIndex = i - 1;
            break;
        }
    }
    // If both context lines were found, return the section
    if (startIndex >= 0 && endIndex >= startIndex) {
        return originalLines.slice(startIndex, endIndex + 1);
    }
    // If only context above was found, try to find a reasonable section
    if (startIndex >= 0) {
        // Look for the next empty line or a line that matches the context below
        for (let i = startIndex; i < originalLines.length; i++) {
            if (originalLines[i].trim() === '' || originalLines[i].trim() === contextBelow.trim()) {
                return originalLines.slice(startIndex, i);
            }
        }
        // If no empty line found, return a reasonable number of lines
        return originalLines.slice(startIndex, Math.min(startIndex + 10, originalLines.length));
    }
    return undefined;
}
//# sourceMappingURL=utils.js.map