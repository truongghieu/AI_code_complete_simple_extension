"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLanguageId = void 0;
function getLanguageId(vscodeLangId) {
    // Map VS Code language IDs to more common names for the API
    const languageMap = {
        'typescript': 'typescript',
        'javascript': 'javascript',
        'python': 'python',
        'java': 'java',
        'csharp': 'csharp',
        'cpp': 'cpp',
        'c': 'c',
        'go': 'go',
        'ruby': 'ruby',
        'php': 'php',
        'rust': 'rust',
        'swift': 'swift',
        'kotlin': 'kotlin',
        'html': 'html',
        'css': 'css',
        'json': 'json',
        'markdown': 'markdown',
        'shellscript': 'bash',
        'yaml': 'yaml',
        'sql': 'sql'
    };
    return languageMap[vscodeLangId] || vscodeLangId;
}
exports.getLanguageId = getLanguageId;
//# sourceMappingURL=utils.js.map