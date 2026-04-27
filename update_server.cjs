const fs = require('fs');
let code = fs.readFileSync('backend/server.js', 'utf8');

// 1. Add dotenv
code = 'import "dotenv/config";\n' + code;

// 2. Secret
code = code.replace('secret: "shopops-dev-secret"', 'secret: process.env.SESSION_SECRET || "shopops-dev-secret"');

// 3. OLLAMA and MODEL constants
code = code.replace(
    'const OLLAMA = "http://localhost:11434/api/generate";',
    'const OLLAMA = process.env.OLLAMA_URL || "http://localhost:11434/api/generate";\nconst MODEL = process.env.MODEL || "deepseek-coder:6.7b";'
);

// 4. Update ollama function definition
code = code.replace('async function ollama(model, prompt)', 'async function ollama(prompt)');

// 5. Update ollama body payload
code = code.replace(
    'body: JSON.stringify({ model, prompt, stream: false })',
    'body: JSON.stringify({ model: MODEL, prompt, stream: false })'
);

// 6. Replace ollama("llama3", prompt) -> ollama(prompt)
code = code.replace(/ollama\("llama3", prompt\)/g, 'ollama(prompt)');

// 7. Replace ollama("deepseek-coder", prompt) -> ollama(prompt)
code = code.replace(/ollama\("deepseek-coder", prompt\)/g, 'ollama(prompt)');

// 8. Replace hardcoded model in /api/chat fetch
code = code.replace(
    /const \{ message, history = \[\], model = "llama3", currentConfig \} = req\.body;/,
    'const { message, history = [], currentConfig } = req.body;'
);

code = code.replace(
    'body: JSON.stringify({ model, prompt: fullPrompt, stream: true }),',
    'body: JSON.stringify({ model: MODEL, prompt: fullPrompt, stream: true }),'
);
code = code.replace(
    'const ollamaRes = await fetch("http://localhost:11434/api/generate", {',
    'const ollamaRes = await fetch(OLLAMA, {'
);

// 9. Update models array in /api/health
code = code.replace(
    'models: ["llama3", "deepseek-coder"]',
    'models: [MODEL]'
);

// 10. Update deployment script terraformCode generation
code = code.replace(
    /terraformCode = await ollama\(\s*"deepseek-coder",\s*`/g,
    'terraformCode = await ollama(`'
);

fs.writeFileSync('backend/server.js', code);
console.log("Updated server.js");
